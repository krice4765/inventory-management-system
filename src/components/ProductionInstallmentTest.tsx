/**
 * 実運用データでの分納機能テストコンポーネント
 * 本格運用前の最終確認用
 */

import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useErrorHandler, UserFriendlyError } from '../utils/error-handler';
import { ErrorDisplay } from './shared/ErrorDisplay';

interface PurchaseOrder {
  id: string;
  total_amount: number;
  status: string;
  order_number: string;
  created_at: string;
  assignee_name?: string;
  installments?: Installment[];
}

interface Installment {
  id: string;
  amount: number;
  status: string;
  transaction_no: string;
  created_at: string;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  expectedResult: string;
  order: PurchaseOrder | null;
  testAmount: number;
  executed: boolean;
  success: boolean | null;
  error?: string;
  resultData?: any;
}

export const ProductionInstallmentTest: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<UserFriendlyError | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const { handleError } = useErrorHandler();

  // 実運用データの取得
  const fetchProductionData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 確認済みの発注データを取得（分納テスト用）
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          total_amount,
          status,
          order_number,
          created_at,
          assignee_name
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (ordersError) throw ordersError;

      // 各発注の既存分納を取得
      const ordersWithInstallments = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: installments, error: installmentError } = await supabase
            .from('installments')
            .select('id, amount, status, transaction_no, created_at')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false });

          if (installmentError) {
            console.warn(`Failed to fetch installments for order ${order.id}:`, installmentError);
          }

          return {
            ...order,
            installments: installments || []
          };
        })
      );

      setOrders(ordersWithInstallments);

      // テストシナリオを自動生成
      if (ordersWithInstallments.length > 0) {
        generateTestScenarios(ordersWithInstallments);
      }

    } catch (err) {
      const userError = handleError(err);
      setError(userError);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  // テストシナリオの自動生成
  const generateTestScenarios = useCallback((orders: PurchaseOrder[]) => {
    const scenarios: TestScenario[] = [];

    orders.forEach((order, index) => {
      const existingTotal = order.installments?.reduce((sum, inst) => sum + inst.amount, 0) || 0;
      const remainingAmount = order.total_amount - existingTotal;

      if (remainingAmount > 0) {
        // シナリオ1: 正常な分納作成
        scenarios.push({
          id: `normal_${order.id}`,
          name: `正常分納作成 (発注${index + 1})`,
          description: `発注番号: ${order.order_number}, 残り金額: ¥${remainingAmount.toLocaleString()}`,
          expectedResult: '分納が正常に作成される',
          order,
          testAmount: Math.min(remainingAmount * 0.5, 50000), // 50%か5万円の小さい方
          executed: false,
          success: null
        });

        // シナリオ2: 上限超過エラー（P0001）テスト
        if (remainingAmount > 1000) {
          scenarios.push({
            id: `overflow_${order.id}`,
            name: `P0001エラー検証 (発注${index + 1})`,
            description: `故意に超過額で分納作成: ¥${(remainingAmount * 1.2).toLocaleString()}`,
            expectedResult: 'P0001エラーが発生し、ユーザー向けメッセージが表示される',
            order,
            testAmount: remainingAmount * 1.2, // 残り金額の120%
            executed: false,
            success: null
          });
        }
      }
    });

    setScenarios(scenarios.slice(0, 6)); // 最大6シナリオ
  }, []);

  // 個別テストシナリオの実行
  const executeScenario = useCallback(async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario || !scenario.order) return;

    setScenarios(prev => 
      prev.map(s => 
        s.id === scenarioId 
          ? { ...s, executed: true, success: null, error: undefined, resultData: undefined }
          : s
      )
    );

    try {
      const { data, error } = await supabase.rpc('add_purchase_installment_v3_standard', {
        p_order_id: scenario.order.id,
        p_amount: scenario.testAmount,
        p_transaction_no: `PROD_TEST_${Date.now()}`,
        p_description: `実運用テスト: ${scenario.name}`
      });

      let success = false;
      let resultData = null;
      let errorMessage = '';

      if (scenario.id.startsWith('normal_')) {
        // 正常ケース: 成功を期待
        success = !error && data?.success === true;
        resultData = data?.data;
        if (!success) {
          errorMessage = error?.message || data?.error?.message || '不明なエラー';
        }
      } else if (scenario.id.startsWith('overflow_')) {
        // エラーケース: P0001エラーを期待
        success = (error || !data?.success) && (
          error?.message?.includes('P0001') || 
          data?.error?.code === 'P0001'
        );
        resultData = data?.error || error;
        if (!success) {
          errorMessage = 'P0001エラーが期待通りに発生しませんでした';
        }
      }

      setScenarios(prev => 
        prev.map(s => 
          s.id === scenarioId 
            ? { ...s, success, error: errorMessage || undefined, resultData }
            : s
        )
      );

    } catch (err) {
      const userError = handleError(err);
      setScenarios(prev => 
        prev.map(s => 
          s.id === scenarioId 
            ? { ...s, success: false, error: userError.message }
            : s
        )
      );
    }
  }, [scenarios, handleError]);

  // すべてのテストシナリオを実行
  const executeAllScenarios = useCallback(async () => {
    for (const scenario of scenarios) {
      if (!scenario.executed) {
        await executeScenario(scenario.id);
        // テスト間隔を開ける
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, [scenarios, executeScenario]);

  // 初期データ読み込み
  useEffect(() => {
    fetchProductionData();
  }, [fetchProductionData]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          🏭 実運用データでの分納機能テスト
        </h2>
        <p className="text-gray-600">
          本格運用中のデータを使用して、分納機能の最終動作確認を実行します。
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <ErrorDisplay
          error={error}
          onDismiss={() => setError(null)}
          onRetry={fetchProductionData}
          showTechnicalDetails={import.meta.env.DEV}
        />
      )}

      {/* 読み込み中 */}
      {isLoading && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-blue-700">実運用データを読み込み中...</p>
          </div>
        </div>
      )}

      {/* 発注データ概要 */}
      {orders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 発注データ概要</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
              <div className="text-sm text-gray-600">確認済み発注</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {orders.reduce((sum, order) => sum + (order.installments?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">既存分納数</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                ¥{orders.reduce((sum, order) => sum + order.total_amount, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">総発注金額</div>
            </div>
          </div>

          {/* 発注一覧 */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    発注番号
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    発注金額
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    既存分納
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    残り金額
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    担当者
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const existingTotal = order.installments?.reduce((sum, inst) => sum + inst.amount, 0) || 0;
                  const remaining = order.total_amount - existingTotal;
                  
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{order.order_number}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        ¥{order.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {order.installments?.length || 0}件 
                        {existingTotal > 0 && (
                          <span className="text-gray-500 ml-1">
                            (¥{existingTotal.toLocaleString()})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        ¥{remaining.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {order.assignee_name || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* テストシナリオ実行 */}
      {scenarios.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🧪 テストシナリオ実行</h3>
            <button
              onClick={executeAllScenarios}
              disabled={scenarios.every(s => s.executed)}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
            >
              全シナリオ実行
            </button>
          </div>

          <div className="space-y-4">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`border rounded-lg p-4 ${
                  scenario.success === true
                    ? 'border-green-200 bg-green-50'
                    : scenario.success === false
                    ? 'border-red-200 bg-red-50'
                    : scenario.executed
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {scenario.executed && scenario.success !== null && (
                        <span className="mr-2">
                          {scenario.success ? '✅' : '❌'}
                        </span>
                      )}
                      {scenario.name}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                    <p className="text-sm text-blue-600 mb-2">期待結果: {scenario.expectedResult}</p>
                    
                    {scenario.order && (
                      <div className="text-xs text-gray-500 mb-2">
                        テスト金額: ¥{scenario.testAmount.toLocaleString()} 
                        (発注ID: {scenario.order.id.slice(0, 8)}...)
                      </div>
                    )}

                    {/* 実行結果 */}
                    {scenario.executed && (
                      <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
                        {scenario.success ? (
                          <div className="text-green-700">
                            ✅ テスト成功: 期待通りの結果が得られました
                          </div>
                        ) : (
                          <div className="text-red-700">
                            ❌ テスト失敗: {scenario.error || '期待と異なる結果'}
                          </div>
                        )}
                        
                        {scenario.resultData && (
                          <details className="mt-2">
                            <summary className="cursor-pointer">詳細データ</summary>
                            <pre className="mt-1 text-xs overflow-x-auto">
                              {JSON.stringify(scenario.resultData, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 個別実行ボタン */}
                  <button
                    onClick={() => executeScenario(scenario.id)}
                    disabled={scenario.executed}
                    className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm"
                  >
                    {scenario.executed ? '実行済み' : '実行'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 全体結果サマリー */}
          {scenarios.some(s => s.executed) && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">📊 実行結果サマリー</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {scenarios.filter(s => s.executed).length}
                  </div>
                  <div className="text-sm text-gray-600">実行済み</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {scenarios.filter(s => s.success === true).length}
                  </div>
                  <div className="text-sm text-gray-600">成功</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {scenarios.filter(s => s.success === false).length}
                  </div>
                  <div className="text-sm text-gray-600">失敗</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* データ更新 */}
      <div className="flex justify-center">
        <button
          onClick={fetchProductionData}
          disabled={isLoading}
          className="px-6 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg"
        >
          {isLoading ? '読み込み中...' : '🔄 データを再読み込み'}
        </button>
      </div>
    </div>
  );
};