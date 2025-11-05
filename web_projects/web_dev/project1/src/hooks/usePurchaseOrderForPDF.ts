import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const usePurchaseOrderForPDF = (orderId: string) => {
  return useQuery({
    queryKey: ['purchase-order-pdf', orderId],
    queryFn: async () => {
      // 発注基本情報を取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          order_no,
          order_date,
          delivery_deadline,
          total_amount,
          partner_id,
          partners (
            name
          )
        `)
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError
      if (!order) throw new Error('Order not found')

      // 発注明細を取得
      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select(`
          product_id,
          quantity,
          unit_price,
          products (
            product_name,
            product_code
          )
        `)
        .eq('purchase_order_id', orderId)

      if (itemsError) throw itemsError
      if (!items) throw new Error('Order items not found')

      // データを整形
      return {
        order_no: order.order_no,
        order_date: order.order_date,
        delivery_deadline: order.delivery_deadline,
        partner_name: (order.partners as any)?.name || '不明な仕入先',
        total_amount: order.total_amount,
        items: items.map(item => ({
          product_name: (item.products as any)?.product_name || '不明な商品',
          product_code: (item.products as any)?.product_code || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        }))
      }
    },
    enabled: !!orderId,
    staleTime: 30000
  })
}
