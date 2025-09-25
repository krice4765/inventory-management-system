import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { InventoryOverrideRequest } from '../types/permissions';
import { useInventoryOverride } from '../hooks/usePermissions';

interface InventoryOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  orderId: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  currentStock: number;
  shortage: number;
}

interface OverrideFormData {
  reason: string;
  acknowledge: boolean;
}

const overrideSchema = yup.object({
  reason: yup
    .string()
    .min(10, '理由は10文字以上で入力してください')
    .max(200, '理由は200文字以内で入力してください')
    .required('オーバーライド理由は必須です'),
  acknowledge: yup
    .boolean()
    .oneOf([true], '責任を理解し同意する必要があります')
    .required()
});

export const InventoryOverrideModal: React.FC<InventoryOverrideModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  orderId,
  productId,
  productName,
  requestedQuantity,
  currentStock,
  shortage,
}) => {
  const { canOverrideInventory, requestInventoryOverride } = useInventoryOverride();

  const form = useForm<OverrideFormData>({
    resolver: yupResolver(overrideSchema),
    defaultValues: {
      reason: '',
      acknowledge: false,
    },
  });

  const handleOverride = async (data: OverrideFormData) => {
    if (!canOverrideInventory) {
      alert('在庫制限をオーバーライドする権限がありません');
      return;
    }

    try {
      const request: InventoryOverrideRequest = {
        orderId,
        productId,
        requestedQuantity,
        currentStock,
        shortage,
        reason: data.reason,
        requestedBy: 'current-user', // TODO: 実際のユーザーIDを取得
        timestamp: new Date(),
      };

      const success = await requestInventoryOverride(request);

      if (success) {
        onApprove();
        form.reset();
        onClose();
      } else {
        alert('在庫オーバーライドの承認に失敗しました');
      }
    } catch (error) {
      console.error('在庫オーバーライドエラー:', error);
      alert(error instanceof Error ? error.message : '不明なエラーが発生しました');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-red-700">🚨 在庫制限オーバーライド</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <h4 className="font-semibold text-red-800 mb-2">⚠️ 在庫不足警告</h4>
          <div className="text-sm text-red-700 space-y-1">
            <div><strong>商品:</strong> {productName}</div>
            <div><strong>要求数量:</strong> {requestedQuantity.toLocaleString()}</div>
            <div><strong>現在在庫:</strong> {currentStock.toLocaleString()}</div>
            <div><strong>不足数量:</strong> <span className="font-bold">{shortage.toLocaleString()}</span></div>
          </div>
        </div>

        {!canOverrideInventory ? (
          <div className="text-center py-4">
            <p className="text-red-600 mb-4">在庫制限をオーバーライドする権限がありません。</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(handleOverride)}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                オーバーライド理由 <span className="text-red-500">*</span>
              </label>
              <textarea
                {...form.register('reason')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="在庫制限をオーバーライドする理由を詳しく記入してください（10文字以上）"
              />
              {form.formState.errors.reason && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  {...form.register('acknowledge')}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  この操作により在庫不足が発生することを理解し、その責任を負うことに同意します。
                  すべての操作はログに記録され、監査対象となります。
                </span>
              </label>
              {form.formState.errors.acknowledge && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.acknowledge.message}
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!form.formState.isValid}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                オーバーライド実行
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};