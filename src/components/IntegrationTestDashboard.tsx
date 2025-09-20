import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { InstallmentIntegrationManager } from './InstallmentIntegrationManager';
import { useIntegratedInstallment } from '../hooks/useIntegratedInstallment';

interface Props {
  orderNo?: string;
}

export const IntegrationTestDashboard: React.FC<Props> = ({ orderNo = 'PO250920003' }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 発注書取得
  const { data: order } = useQuery({
    queryKey: ['order-lookup', orderNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('order_no', orderNo)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderNo,
  });

  // 統合状況取得
  const {
    validation,
    validationLoading,
    hasIssues,
    issueCount,
    autoRepair,
    isRepairing
  } = useIntegratedInstallment({
    parentOrderId: order?.id || '',
    onSuccess: () => console.log('統合操作成功'),
    onError: (error) => console.error('統合操作エラー:', error),
  });

  // データベース関数実行
  const executeDbFunction = async (functionName: string, params: any = {}) => {
    try {
      const { data, error } = await supabase.rpc(functionName, params);
      if (error) throw error;
      console.log(`✅ ${functionName}実行結果:`, data);
      alert(`✅ ${functionName}実行完了\n結果: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error(`❌ ${functionName}実行エラー:`, error);
      alert(`❌ ${functionName}実行失敗: ${error}`);
    }
  };

  if (!order) {
    return (
      <div className="p-6 bg-white rounded-lg border">
        <h2 className="text-xl font-bold mb-4">🧪 統合システムテストダッシュボード</h2>
        <div className="text-gray-500">発注書 {orderNo} を読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          🧪 統合システムテストダッシュボード
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-3 rounded border-blue-200 border">
            <h3 className="font-semibold text-blue-800">対象発注</h3>
            <p className="text-blue-700">{order.order_no}</p>
            <p className="text-sm text-blue-600">¥{order.total_amount?.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded border ${hasIssues ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <h3 className={`font-semibold ${hasIssues ? 'text-red-800' : 'text-green-800'}`}>
              統合状況
            </h3>
            <p className={hasIssues ? 'text-red-700' : 'text-green-700'}>
              {validationLoading ? '確認中...' : hasIssues ? `${issueCount}件の問題` : '正常'}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded border-gray-200 border">
            <h3 className="font-semibold text-gray-800">ID</h3>
            <p className="text-xs text-gray-600 font-mono">{order.id}</p>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-3">⚡ クイックアクション</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => executeDbFunction('validate_installment_integration', { p_parent_order_id: order.id })}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            🔍 統合検証
          </button>
          <button
            onClick={() => executeDbFunction('repair_installment_inventory_integration', { p_parent_order_id: order.id })}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
          >
            🔧 自動修復
          </button>
          <button
            onClick={autoRepair}
            disabled={isRepairing || !hasIssues}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 text-sm"
          >
            {isRepairing ? '修復中...' : '🚀 フロント修復'}
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
          >
            {showAdvanced ? '📤' : '📥'} 詳細
          </button>
        </div>
      </div>

      {/* 問題一覧 */}
      {validation && validation.issues.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-red-200">
          <h3 className="font-semibold mb-3 text-red-800">🚨 検出された問題</h3>
          <div className="space-y-2">
            {validation.issues.map((issue, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded">
                <div>
                  <span className="text-sm font-medium text-red-700">
                    {issue.type === 'missing_inventory' ? '❌ 在庫移動不足' :
                     issue.type === 'orphaned_inventory' ? '🔗 孤立在庫移動' :
                     issue.type === 'numbering_issue' ? '🔢 番号不整合' : '⚠️ その他'}
                  </span>
                  <p className="text-sm text-red-600">{issue.description}</p>
                </div>
                {issue.transactionId && (
                  <div className="text-xs text-red-500 font-mono max-w-32 truncate">
                    {issue.transactionId}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 統合分納管理 */}
      <InstallmentIntegrationManager
        parentOrderId={order.id}
        onSuccess={() => {
          console.log('統合分納作成成功');
        }}
      />

      {/* 高度な機能 */}
      {showAdvanced && (
        <div className="bg-white p-6 rounded-lg border border-gray-300">
          <h3 className="font-semibold mb-3 text-gray-800">🔧 高度な機能</h3>

          <div className="space-y-4">
            {/* SQL実行エリア */}
            <div>
              <h4 className="font-medium mb-2">SQL関数テスト</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={() => executeDbFunction('add_purchase_installment_v3', {
                    p_parent_order_id: order.id,
                    p_amount: 5000,
                    p_products: JSON.stringify([{
                      product_id: '037ac88a-6691-47a6-8d9b-5bb6d579dd62',
                      quantity: 1,
                      unit_price: 5000
                    }]),
                    p_memo: 'テスト分納v3'
                  })}
                  className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                >
                  🚀 V3分納テスト
                </button>
                <button
                  onClick={() => {
                    const sql = `
                      SELECT
                        t.installment_no,
                        t.total_amount,
                        COUNT(im.id) as movements,
                        SUM(im.total_amount) as movement_total
                      FROM transactions t
                      LEFT JOIN inventory_movements im ON im.transaction_id = t.id
                      WHERE t.parent_order_id = '${order.id}'
                      GROUP BY t.id, t.installment_no, t.total_amount
                      ORDER BY t.installment_no
                    `;
                    navigator.clipboard.writeText(sql);
                    alert('📋 SQL文をクリップボードにコピーしました');
                  }}
                  className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                >
                  📋 分析SQLコピー
                </button>
              </div>
            </div>

            {/* 統計情報 */}
            {validation && (
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium mb-2">📊 統計情報</h4>
                <div className="text-sm space-y-1">
                  <p>総問題数: {validation.issues.length}</p>
                  <p>未連携分納: {validation.issues.filter(i => i.type === 'missing_inventory').length}</p>
                  <p>孤立在庫移動: {validation.issues.filter(i => i.type === 'orphaned_inventory').length}</p>
                  <p>番号問題: {validation.issues.filter(i => i.type === 'numbering_issue').length}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};