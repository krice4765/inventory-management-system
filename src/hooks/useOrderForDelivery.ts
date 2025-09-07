import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useOrderForDelivery = (orderId: string | null) => {
  return useQuery({
    queryKey: ['delivery-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      
      // 🚨 purchase_orders_stable_v1ビューを使用してDeliveryModalと整合性を取る
      const { data, error } = await supabase
        .from('purchase_orders_stable_v1')
        .select(`
          id,
          order_no,
          partner_name,
          total_amount,
          partner_id,
          status
        `)
        .eq('id', orderId)
        .single();
        
      if (error) throw error;
      
      // 🎯 DeliveryModalが期待する形式に変換
      return {
        purchase_order_id: data.id,
        order_no: data.order_no,
        partner_name: data.partner_name,
        ordered_amount: data.total_amount || 0,
        delivered_amount: 0, // 暫定値（分納管理実装後に正確な値を設定）
        remaining_amount: data.total_amount || 0,
        partner_id: data.partner_id
      };
    },
    staleTime: 30000, // 30秒間はキャッシュを使用
  })
}
