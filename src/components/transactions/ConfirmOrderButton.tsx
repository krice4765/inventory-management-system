import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

interface ConfirmOrderButtonProps {
      transactionId: string; currentStatus: string; orderNo: string; onConfirmed?: () => void; className?: string; }

export const ConfirmOrderButton: React.FC<ConfirmOrderButtonProps> = ({ 
  transactionId, 
  currentStatus, 
  orderNo, 
  onConfirmed,
  className = ""
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();

      const extractDetailedError = (err: unknown): string => { if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      const e = err as Record<string, unknown>;
      return e?.message as string || 
             e?.hint as string || 
             e?.details as string || 
             e?.error_description as string || 
             e?.code as string || 
             JSON.stringify(e, null, 2);
    }
    return String(err);
  };

  const handleConfirm = async () => {
    if (currentStatus !== 'draft') {
      toast.error('確定済みまたは処理中の発注です');
      return;
    }
    
    setIsConfirming(true);
    
    try {
      
      // 🛡️ 事前検証: 金額整合性チェック (分離クエリで曖昧性解決)
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('id, total_amount, parent_order_id')
        .eq('id', transactionId)
        .single();

      if (transactionError) {
        console.error('❌ [Confirm][PreCheck] 取引データ取得エラー:', transactionError);
        throw transactionError;
      }

      // 発注情報を分離取得
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, total_amount')
        .eq('id', transactionData.parent_order_id)
        .single();

      if (orderError) {
        console.error('❌ [Confirm][PreCheck] 発注データ取得エラー:', orderError);
        throw orderError;
      }

      const preCheckData = {
        ...transactionData,
        purchase_orders: orderData
      };

        // 検証ロジック（削除済み）

      if (preCheckData?.purchase_orders?.total_amount && 
          preCheckData.total_amount > preCheckData.purchase_orders.total_amount) {
        throw new Error(
          `金額整合性エラー: 分納額¥${preCheckData.total_amount.toLocaleString()} > ` +
          `発注額¥${preCheckData.purchase_orders.total_amount.toLocaleString()}`
        );
      }
      
      // 🎯 RPC関数による原子的確定処理
      const { data, error } = await supabase.rpc('confirm_purchase_transaction', { 
      p_transaction_id: transactionId });
        
      if (error) {
        console.error('❌ [Confirm][RPC] エラー詳細:', error);
        console.error('❌ [Confirm][RPC] エラーコード:', error.code);
        console.error('❌ [Confirm][RPC] エラーメッセージ:', error.message);
        console.error('❌ [Confirm][RPC] エラーヒント:', error.hint);
        console.error('❌ [Confirm][RPC] エラー詳細:', error.details);
        throw error;
      }
      
      
      // RPCレスポンス処理
      if (data?.status === 'error') {
        throw new Error(`RPC内部エラー: ${data.error_message} (${data.error_code})`);
      }
      
      if (data?.status === 'already_confirmed') {
        toast.error('この発注は既に確定済みです');
        return;
      }
      
      if (data?.status === 'confirmed') {
        const movementsCount = data.movements_created || 0;
        const inventoryTotal = data.inventory_total || 0;
        
        toast.success(
          `✅ 発注 ${orderNo} を確定しました\n` +
          `📦 在庫反映: ${movementsCount}件 (¥${Number(inventoryTotal).toLocaleString()})`
        );
      }
      
      // 包括的キャッシュ同期
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['transactionsByPartner'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      ]);
      
      onConfirmed?.();

    } catch (err: unknown) {
      console.error('❌ [Confirm][RPC] 予期しないエラー:', err);
      
      if (err instanceof Error) {
        // エラーメッセージの分類と適切な対応メッセージ
        if (err.message.includes('納品額が発注額を超過') || err.message.includes('金額整合性エラー')) {
          toast.error(
            '⚠️ 金額エラー\n' +
            '分納金額が発注金額を超過しています。\n' +
            '金額を確認して再度お試しください。',
            { duration: 6000 }
          );
        } else if (err.code === 'P0001') {
          toast.error(
            '🔒 データ整合性エラー\n' +
            'システム保護により処理を停止しました。\n' +
            'データを再読み込みして再度お試しください。',
            { duration: 5000 }
          );
        } else {
          const detailedError = extractDetailedError(err);
          toast.error(`確定処理に失敗: ${detailedError}`);
        }
      } else {
        toast.error('確定処理で予期しないエラーが発生しました');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const isDisabled = currentStatus !== 'draft' || isConfirming;
      const buttonText = isConfirming ? '確定中...' : '発注確定'; const statusText = currentStatus === 'confirmed' ? '確定済み' :   currentStatus === 'active' ? '処理中' : '確定可能'; return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleConfirm}
        disabled={isDisabled}
        className={`
          px-4 py-2 text-sm font-medium rounded-md transition-colors
          ${isDisabled 
      ? 'bg-gray-300 dark: bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'  : 'bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500' }
          ${className}
        `}
      >
        {buttonText}
      </button>
      
      <span className={`text-xs px-2 py-1 rounded-full ${
      currentStatus === 'confirmed' ? 'bg-green-100 dark: bg-green-900/20 text-green-800 dark:text-green-400' : currentStatus === 'active' ? 'bg-yellow-100 dark: bg-yellow-900/20 text-yellow-800 dark:text-yellow-400' : 'bg-gray-100 dark: bg-gray-800 text-gray-600 dark:text-gray-400' }`}>
        {statusText}
      </span>
    </div>
  );
};