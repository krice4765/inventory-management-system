import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface OrderForInstallment {
  purchase_order_id: string
  order_no: string
  partner_name: string
  partner_id: string
  total_amount: number
  allocated_amount: number
  remaining_amount: number
  installment_count: number
}

export const useOrderForInstallment = (orderId: string | null) => {
  return useQuery<OrderForInstallment | null>({
    queryKey: ['installment-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      
      // 発注情報取得 (分離クエリで曖昧性解決)
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, order_no, total_amount, partner_id')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // パートナー情報を分離取得
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('id, name')
        .eq('id', orderData.partner_id)
        .single();
        
      if (partnerError) throw partnerError;
      
      // 既存分納情報取得（確定済みのみ）
      const { data: installments, error: installmentError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed');
        
      if (installmentError) throw installmentError;
      
      const allocatedAmount = installments?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;
      const remainingAmount = Math.max(0, orderData.total_amount - allocatedAmount);
      const installmentCount = installments?.length || 0;

        orderId,
        orderNo: orderData.order_no,
        installments: installments?.map(i => ({ amount: i.total_amount, no: i.installment_no })),
        installmentCount,
        allocatedAmount,
        remainingAmount
      });
      
      return {
        purchase_order_id: String(orderData.id),
        order_no: orderData.order_no,
        partner_name: partnerData?.name || '不明',
        partner_id: String(orderData.partner_id),
        total_amount: orderData.total_amount,
        allocated_amount: allocatedAmount,
        remaining_amount: remainingAmount,
        installment_count: installmentCount,
      };
    },
    staleTime: 30000, // 30秒間はキャッシュを使用
  })
}