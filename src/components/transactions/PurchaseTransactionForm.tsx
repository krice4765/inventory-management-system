import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRemainingAmount } from '../../hooks/useRemainingAmount';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ConfirmOrderButton } from './ConfirmOrderButton';

interface PurchaseTransactionFormProps {
      parentOrderId: string; transactionId?: string; initialData?: { total_amount?: number; memo?: string; transaction_date?: string; status?: string; order_no?: string; };
      onSuccess: () => void; onCancel: () => void; }

export const PurchaseTransactionForm: React.FC<PurchaseTransactionFormProps> = ({
  parentOrderId,
  transactionId,
  initialData,
  onSuccess,
  onCancel
}) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    transaction_type: 'purchase',
    total_amount: Number(initialData?.total_amount || 0),
    memo: initialData?.memo || '',
    transaction_date: initialData?.transaction_date || new Date().toISOString().split('T')[0],
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // リアルタイム残額計算
  const { 
    data: remainingInfo, 
    isLoading: remainingLoading, 
      error: remainingError  } = useRemainingAmount(parentOrderId, formData.total_amount, transactionId);

  // 🔥 UX改善: 最大入力可能額の計算
  const allowedMax = remainingInfo 
    ? Math.max(0, remainingInfo.orderTotal - remainingInfo.siblingsTotal) 
      : Number.MAX_SAFE_INTEGER; // 入力値を0〜allowedMaxにクランプ
      const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => { const raw = Number(e.target.value);
    const clamped = Number.isFinite(raw) 
      ? Math.max(0, Math.min(raw, allowedMax))
      : 0; setFormData(prev => ({ ...prev, total_amount: clamped }));
  };

  // 確定処理（P0001エラー完全防止）
  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);

      if (!remainingInfo) {
        throw new Error('残額情報の取得に失敗しました');
      }

      if (remainingInfo.isExceeding) {
        toast.error(
          `❌ 発注残額を超過しています\n` +
          `発注総額: ¥${remainingInfo.orderTotal.toLocaleString()}
` +
          `既存取引: ¥${remainingInfo.siblingsTotal.toLocaleString()}
` +
          `今回金額: ¥${remainingInfo.currentAmount.toLocaleString()}
` +
          `超過額: ¥${remainingInfo.exceedingAmount.toLocaleString()}`,
          { duration: 6000 }
        );
        return;
      }

      const { data: result, error: rpcError } = await supabase
        .rpc('confirm_purchase_transaction', {
          p_transaction_id: transactionId,
      p_new_amount: formData.total_amount });

      if (rpcError) {
        throw new Error(`サーバー処理エラー: ${rpcError.message}`);
      }

      const rpcResult = result as {
      success?: boolean; error_code?: string; message?: string; exceeding_amount?: number; current_amount?: number; remaining_amount?: number; };
      
      if (!rpcResult?.success) {
        if (rpcResult.error_code === 'P0001') {
          toast.error(
            `❌ サーバー側でも残額超過が検出されました\n` +
            `超過額: ¥${rpcResult.exceeding_amount?.toLocaleString() || '不明'}\n` +
            `画面を更新して再度お試しください。`,
            { duration: 8000 }
          );
        } else {
          toast.error(`サーバーエラー: ${rpcResult.message}`);
        }
        return;
      }

      toast.success(
        `✅ 取引が正常に確定されました\n` +
        `金額: ¥${rpcResult.current_amount?.toLocaleString()}
` +
        `残額: ¥${rpcResult.remaining_amount?.toLocaleString()}`
      );

      // キャッシュの無効化
      queryClient.invalidateQueries({ queryKey: ['transactionsByPartner'] });
      queryClient.invalidateQueries({ queryKey: ['remainingAmount'] });

      onSuccess();

    } catch (error: Error) {
      console.error('確定エラー:', error);
      toast.error(`確定に失敗しました: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {transactionId ? '取引の編集' : '新規取引の作成'}
      </h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          取引金額 *
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            value={formData.total_amount}
            onChange={handleAmountChange}
      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus: ring-blue-500 focus:border-blue-500"placeholder="0"
            min="0"
            step="1"
          />
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, total_amount: allowedMax }))}
            disabled={!remainingInfo || allowedMax <= 0 || remainingLoading}
            className={`px-3 py-2 text-sm rounded-md border transition-colors ${
              !remainingInfo || allowedMax <= 0 || remainingLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300' }`}
            title="残額をすべて使用する金額を自動入力"
          >
            残額ちょうど
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          最大入力可能額: ¥{allowedMax.toLocaleString()}
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">商品名・メモ</label>
        <textarea
          value={formData.memo}
          onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          rows={3}
        />
      </div>

      {remainingInfo && (
        <div className={`mb-6 p-4 rounded-md ${remainingInfo.isExceeding ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <h4 className={`text-sm font-medium mb-2 ${remainingInfo.isExceeding ? 'text-red-800' : 'text-blue-800'}`}>
            {remainingInfo.isExceeding ? '⚠️ 残額超過警告' : '💰 残額情報'}
          </h4>
          <div className="text-xs space-y-1">
            <div>発注総額: ¥{remainingInfo.orderTotal.toLocaleString()}</div>
            <div>既存取引: ¥{remainingInfo.siblingsTotal.toLocaleString()}</div>
            <div>今回金額: ¥{remainingInfo.currentAmount.toLocaleString()}</div>
            <div>最大入力可能額: ¥{allowedMax.toLocaleString()}</div>
            <div className="border-t pt-1 font-medium">
              {remainingInfo.isExceeding ? (
                <span className="text-red-700">
                  超過額: ¥{remainingInfo.exceedingAmount.toLocaleString()}
                </span>
      ) : ( <span className="text-blue-700">
                  残額: ¥{remainingInfo.remainingAmount.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        {transactionId ? (
          <ConfirmOrderButton
            transactionId={transactionId}
            currentStatus={initialData?.status || 'draft'}
            orderNo={initialData?.order_no || 'N/A'}
            onConfirmed={onSuccess}
            className="flex-1"
          />
      ) : ( <button
            onClick={handleConfirm}
            disabled={isSubmitting || !formData.total_amount || remainingInfo?.isExceeding || remainingLoading}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${isSubmitting || !formData.total_amount || remainingInfo?.isExceeding || remainingLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-blue-600 text-white hover:bg-blue-700' }`}
          >
            {isSubmitting ? '処理中...' : remainingLoading ? '計算中...' : '作成'}
          </button>
        )}
        <button
          onClick={onCancel}
          disabled={isSubmitting}
      className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover: bg-gray-50">
          キャンセル
        </button>
      </div>

      {remainingError && (
        <div className="mt-4 p-3 bg-red-50 border-red-200 rounded-md">
          <p className="text-red-800 text-sm">残額計算エラー: {remainingError.message}</p>
        </div>
      )}
    </div>
  );
};
