import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createIntegratedInstallment,
  repairInstallmentInventoryLink,
  validateIntegration,
  type IntegratedInstallmentParams
} from '../api/inventory-integration';

interface Props {
  parentOrderId: string;
  onSuccess?: () => void;
}

export const InstallmentIntegrationManager: React.FC<Props> = ({
  parentOrderId,
  onSuccess
}) => {
  const [products, setProducts] = useState<Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>>([]);
  const [amount, setAmount] = useState<number>(0);
  const [memo, setMemo] = useState<string>('');

  const queryClient = useQueryClient();

  // 整合性チェック
  const { data: validation, isLoading: validationLoading } = useQuery({
    queryKey: ['integration-validation', parentOrderId],
    queryFn: () => validateIntegration(parentOrderId),
    refetchInterval: 30000, // 30秒ごとに自動チェック
  });

  // 統合分納作成
  const createMutation = useMutation({
    mutationFn: (params: IntegratedInstallmentParams) => createIntegratedInstallment(params),
    onSuccess: (result) => {
      if (result.integrationStatus === 'success') {
        alert('✅ 分納と在庫移動の連携が完了しました');
        queryClient.invalidateQueries({ queryKey: ['integration-validation'] });
        onSuccess?.();
      } else if (result.integrationStatus === 'partial') {
        alert('⚠️ 分納は作成されましたが、在庫移動の連携に問題があります');
        console.error('部分的な失敗:', result.errors);
      } else {
        alert('❌ 統合分納の作成に失敗しました');
        console.error('完全な失敗:', result.errors);
      }
    },
  });

  // 修復機能
  const repairMutation = useMutation({
    mutationFn: ({ transactionId, products }: {
      transactionId: string;
      products: Array<{ productId: string; quantity: number; unitPrice: number; }>;
    }) => repairInstallmentInventoryLink(transactionId, products),
    onSuccess: (result) => {
      if (result.success) {
        alert('🔧 在庫移動の修復が完了しました');
        queryClient.invalidateQueries({ queryKey: ['integration-validation'] });
      } else {
        alert('❌ 修復に失敗しました');
        console.error('修復エラー:', result.errors);
      }
    },
  });

  const handleSubmit = () => {
    if (products.length === 0) {
      alert('商品を追加してください');
      return;
    }

    const params: IntegratedInstallmentParams = {
      parentOrderId,
      amount,
      products,
      memo,
    };

    createMutation.mutate(params);
  };

  const addProduct = () => {
    setProducts([...products, { productId: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const updated = products.map((product, i) =>
      i === index ? { ...product, [field]: value } : product
    );
    setProducts(updated);
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        🔗 統合分納管理システム
      </h2>

      {/* 整合性チェック結果 */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">📊 連携状況</h3>
        {validationLoading ? (
          <div className="text-gray-500">チェック中...</div>
        ) : validation ? (
          <div className={`p-3 rounded ${validation.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
            <div className={`font-semibold ${validation.isValid ? 'text-green-800' : 'text-red-800'}`}>
              {validation.isValid ? '✅ 連携正常' : '❌ 連携問題あり'}
            </div>
            {validation.issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {validation.issues.map((issue, index) => (
                  <div key={index} className="text-sm text-red-700 flex items-center justify-between">
                    <span>• {issue.description}</span>
                    {issue.type === 'missing_inventory' && issue.transactionId && (
                      <button
                        onClick={() => {
                          // 簡単な修復: 空の商品配列で修復実行
                          repairMutation.mutate({
                            transactionId: issue.transactionId!,
                            products: [{ productId: 'sample-product', quantity: 1, unitPrice: 1000 }]
                          });
                        }}
                        className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                        disabled={repairMutation.isPending}
                      >
                        🔧 修復
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-red-500">チェック失敗</div>
        )}
      </div>

      {/* 新規統合分納作成 */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">➕ 新規統合分納作成</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">分納金額</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="金額を入力"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">メモ</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="第○回など"
            />
          </div>
        </div>

        {/* 商品リスト */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">連携商品</label>
            <button
              onClick={addProduct}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              ➕ 商品追加
            </button>
          </div>

          <div className="space-y-2">
            {products.map((product, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="商品ID"
                  value={product.productId}
                  onChange={(e) => updateProduct(index, 'productId', e.target.value)}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="数量"
                  value={product.quantity}
                  onChange={(e) => updateProduct(index, 'quantity', Number(e.target.value))}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="単価"
                  value={product.unitPrice}
                  onChange={(e) => updateProduct(index, 'unitPrice', Number(e.target.value))}
                  className="w-24 px-2 py-1 border rounded text-sm"
                />
                <button
                  onClick={() => removeProduct(index)}
                  className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending || products.length === 0}
          className="w-full py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? '作成中...' : '🔗 統合分納作成'}
        </button>
      </div>
    </div>
  );
};