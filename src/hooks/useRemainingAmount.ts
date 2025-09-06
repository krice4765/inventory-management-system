// src/hooks/useRemainingAmount.ts - 新規作成
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateRemainingAmount } from '../utils/number';

export function useRemainingAmount(
  parentOrderId: string | null,
  currentAmount: number,
  excludeTransactionId?: string
) {
  return useQuery({
    queryKey: ['remainingAmount', parentOrderId, currentAmount, excludeTransactionId],
    enabled: !!parentOrderId && currentAmount > 0,
    staleTime: 10 * 1000, // 10秒
    gcTime: 30 * 1000,    // 30秒
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!parentOrderId) return null;

      // 発注データ取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, total_amount')
        .eq('id', parentOrderId)
        .single();

      if (orderError) {
        throw new Error(`発注データ取得エラー: ${orderError.message}`);
      }

      // 関連取引データ取得
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('id, total_amount, status, parent_order_id')
        .eq('parent_order_id', parentOrderId);

      if (transError) {
        throw new Error(`取引データ取得エラー: ${transError.message}`);
      }

      // 残額計算
      return calculateRemainingAmount(
        order,
        transactions || [],
        currentAmount,
        excludeTransactionId
      );
    },
  });
}
