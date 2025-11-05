import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useOrderForDelivery = (orderId: string | null) => {
  return useQuery({
    queryKey: ['delivery-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('delivery_progress')
        .select(`
          purchase_order_id,
          order_no,
          partner_name,
          ordered_amount,
          delivered_amount,
          remaining_amount,
          partner_id
        `)
        .eq('purchase_order_id', orderId)
        .single();
        
      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30秒間はキャッシュを使用
  })
}
