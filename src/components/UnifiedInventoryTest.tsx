// 統合在庫履歴表示のテストコンポーネント（Phase 1動作確認用）
import React, { useState } from 'react';
import { useUnifiedInventoryMovements, validateDataIntegrity } from '../hooks/useUnifiedInventory';
import { MovementFilters } from '../hooks/useOptimizedInventory';

interface TestResults {
  success: boolean;
  performance?: {
    fetchTime: number;
    recordCount: number;
    inventoryMovements: number;
    amountOnlyTransactions: number;
  };
  integrity?: {
    consistentCount: number;
    inconsistentCount: number;
    integrityRate: number;
  };
  functional?: {
    hasUnifiedTimestamp: boolean;
    hasRecordType: boolean;
    hasProductInfo: boolean;
    correctSorting: boolean;
  };
  sampleData?: unknown[];
  error?: string;
}

interface UnifiedInventoryTestProps {
  onTestComplete?: (results: TestResults) => void;
}

export const UnifiedInventoryTest: React.FC<UnifiedInventoryTestProps> = ({ onTestComplete }) => {
  const [testFilters, setTestFilters] = useState<MovementFilters>({
    recordType: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // 統合データを取得
  const {
    data: unifiedData,
    isLoading,
    error,
    refetch
  } = useUnifiedInventoryMovements(testFilters);

  // テスト実行
  const runTests = async () => {
    setIsRunning(true);
    const startTime = performance.now();

    try {
      console.log('🧪 統合在庫履歴表示テスト開始');

      // Step 1: データ取得テスト
      await refetch();
      const fetchTime = performance.now() - startTime;

      if (!unifiedData?.data) {
        throw new Error('データが取得できませんでした');
      }

      const records = unifiedData.data;

      // Step 2: データ整合性検証
      const integrityResults = validateDataIntegrity(records);

      // Step 3: パフォーマンステスト
      const performanceResults = {
        fetchTime: Math.round(fetchTime),
        recordCount: records.length,
        inventoryMovements: records.filter(r => r.record_type === 'inventory_movement').length,
        amountOnlyTransactions: records.filter(r => r.record_type === 'amount_only_transaction').length
      };

      // Step 4: 機能テスト
      const functionalTests = {
        hasUnifiedTimestamp: records.every(r => r.unified_timestamp > 0),
        hasRecordType: records.every(r => r.record_type),
        hasProductInfo: records.every(r => r.products && r.products.product_name),
        correctSorting: records.length <= 1 || records.every((r, i) =>
          i === 0 || r.unified_timestamp <= records[i-1].unified_timestamp
        )
      };

      const results = {
        success: true,
        performance: performanceResults,
        integrity: {
          consistentCount: integrityResults.consistent.length,
          inconsistentCount: integrityResults.inconsistencies.length,
          integrityRate: Math.round((integrityResults.consistent.length / records.length) * 100)
        },
        functional: functionalTests,
        sampleData: records.slice(0, 3).map(r => ({
          id: r.id,
          record_type: r.record_type,
          product_name: r.products?.product_name,
          amount: r.total_amount,
          installment_no: r.installment_no,
          created_at: r.created_at
        }))
      };

      setTestResults(results);
      onTestComplete?.(results);

      console.log('✅ 統合在庫履歴表示テスト完了', results);

    } catch (error) {
      const errorResults = {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー',
        performance: { fetchTime: performance.now() - startTime }
      };

      setTestResults(errorResults);
      console.error('❌ テスト失敗:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // フィルタテスト
  const testFilters_AmountOnly = () => {
    setTestFilters({
      ...testFilters,
      recordType: 'amount_only_transaction'
    });
  };

  const testFilters_InventoryOnly = () => {
    setTestFilters({
      ...testFilters,
      recordType: 'inventory_movement'
    });
  };

  const testFilters_All = () => {
    setTestFilters({
      ...testFilters,
      recordType: 'all'
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">🧪 統合在庫履歴表示テスト</h2>

      {/* テスト実行ボタン */}
      <div className="mb-6">
        <button
          onClick={runTests}
          disabled={isRunning || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isRunning ? '🔄 テスト実行中...' : '🚀 テスト実行'}
        </button>
      </div>

      {/* フィルタテスト */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">フィルタテスト</h3>
        <div className="space-x-2">
          <button
            onClick={testFilters_All}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            全て (現在: {testFilters.recordType})
          </button>
          <button
            onClick={testFilters_InventoryOnly}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            在庫移動のみ
          </button>
          <button
            onClick={testFilters_AmountOnly}
            className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            金額分納のみ
          </button>
        </div>
      </div>

      {/* データ表示 */}
      {isLoading && (
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p>📊 データ取得中...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <p className="text-red-700">❌ エラー: {error.message}</p>
        </div>
      )}

      {unifiedData?.data && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">📊 データサマリー</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">総レコード数</p>
              <p className="text-2xl font-bold">{unifiedData.data.length}</p>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <p className="text-sm text-gray-600">在庫移動</p>
              <p className="text-2xl font-bold text-green-600">
                {unifiedData.data.filter(r => r.record_type === 'inventory_movement').length}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded">
              <p className="text-sm text-gray-600">金額分納</p>
              <p className="text-2xl font-bold text-orange-600">
                {unifiedData.data.filter(r => r.record_type === 'amount_only_transaction').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* テスト結果 */}
      {testResults && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            {testResults.success ? '✅ テスト結果' : '❌ テスト結果'}
          </h3>

          {testResults.success ? (
            <div className="space-y-4">
              {/* パフォーマンス結果 */}
              <div className="p-4 bg-green-50 rounded">
                <h4 className="font-semibold">⚡ パフォーマンス</h4>
                <p>取得時間: {testResults.performance.fetchTime}ms</p>
                <p>レコード数: {testResults.performance.recordCount}</p>
                <p className={testResults.performance.fetchTime <= 2000 ? 'text-green-600' : 'text-red-600'}>
                  {testResults.performance.fetchTime <= 2000 ? '🎯 目標達成 (≤2秒)' : '⚠️ 目標未達 (>2秒)'}
                </p>
              </div>

              {/* データ整合性結果 */}
              <div className="p-4 bg-blue-50 rounded">
                <h4 className="font-semibold">🛡️ データ整合性</h4>
                <p>整合性率: {testResults.integrity.integrityRate}%</p>
                <p>一貫データ: {testResults.integrity.consistentCount}</p>
                <p>問題データ: {testResults.integrity.inconsistentCount}</p>
              </div>

              {/* 機能テスト結果 */}
              <div className="p-4 bg-purple-50 rounded">
                <h4 className="font-semibold">🔧 機能テスト</h4>
                <div className="space-y-1">
                  <p className={testResults.functional.hasUnifiedTimestamp ? 'text-green-600' : 'text-red-600'}>
                    統一タイムスタンプ: {testResults.functional.hasUnifiedTimestamp ? '✅' : '❌'}
                  </p>
                  <p className={testResults.functional.hasRecordType ? 'text-green-600' : 'text-red-600'}>
                    レコード種別: {testResults.functional.hasRecordType ? '✅' : '❌'}
                  </p>
                  <p className={testResults.functional.hasProductInfo ? 'text-green-600' : 'text-red-600'}>
                    商品情報: {testResults.functional.hasProductInfo ? '✅' : '❌'}
                  </p>
                  <p className={testResults.functional.correctSorting ? 'text-green-600' : 'text-red-600'}>
                    ソート順序: {testResults.functional.correctSorting ? '✅' : '❌'}
                  </p>
                </div>
              </div>

              {/* サンプルデータ */}
              <div className="p-4 bg-gray-50 rounded">
                <h4 className="font-semibold">📝 サンプルデータ</h4>
                <div className="mt-2 space-y-2">
                  {testResults.sampleData.map((sample: unknown, _index: number) => {
                    const sampleData = sample as {
                      id: string;
                      record_type: string;
                      product_name: string;
                      amount: number;
                      installment_no?: number;
                    };
                    return (
                    <div key={sampleData.id} className="p-2 bg-white rounded text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs ${
                        sampleData.record_type === 'inventory_movement'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {sampleData.record_type === 'inventory_movement' ? '在庫移動' : '金額分納'}
                      </span>
                      <span className="ml-2 font-medium">{sampleData.product_name}</span>
                      <span className="ml-2 text-gray-600">¥{sampleData.amount?.toLocaleString()}</span>
                      {sampleData.installment_no && (
                        <span className="ml-2 text-sm text-gray-500">
                          {sampleData.installment_no}回目
                        </span>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded">
              <p className="text-red-700">エラー: {testResults.error}</p>
              <p className="text-sm text-gray-600">
                実行時間: {testResults.performance?.fetchTime}ms
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};