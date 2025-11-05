import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface OrderItemForDelivery {
  product_id: string
  product_name: string
  product_code: string
  ordered_quantity: number
  delivered_quantity: number
  remaining_quantity: number
  unit_price: number
}

export const useOrderItemsForDelivery = (orderId: string | null) => {
  return useQuery({
    queryKey: ['delivery-order-items', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];

      // 発注明細を取得
      const { data: orderItems, error: orderError } = await supabase
        .from('purchase_order_items')
        .select('product_id, quantity, unit_price')
        .eq('purchase_order_id', orderId);

      if (orderError) throw orderError;
      if (!orderItems || orderItems.length === 0) return [];

      // 商品情報を別途取得
      const productIds = orderItems.map(item => item.product_id);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_name, product_code')
        .in('id', productIds);

      if (productsError) throw productsError;

      // 商品IDでマップを作成
      const productsMap = new Map(
        products?.map(p => [p.id, p]) || []
      );

      // 各商品の既納品数量を集計
      const { data: deliveredItems, error: deliveredError } = await supabase
        .from('transaction_items')
        .select(`
          product_id,
          quantity,
          transactions!inner(
            parent_order_id,
            transaction_type,
            status
          )
        `)
        .in('product_id', productIds)
        .eq('transactions.parent_order_id', orderId)
        .eq('transactions.transaction_type', 'purchase')
        .eq('transactions.status', 'confirmed');

      if (deliveredError) throw deliveredError;

      // 商品ごとに納品済み数量を集計
      const deliveredMap = new Map<string, number>();
      if (deliveredItems) {
        deliveredItems.forEach(item => {
          const currentQty = deliveredMap.get(item.product_id) || 0;
          deliveredMap.set(item.product_id, currentQty + item.quantity);
        });
      }

      // 結果を整形
      const result: OrderItemForDelivery[] = orderItems.map(item => {
        const product = productsMap.get(item.product_id);
        const delivered = deliveredMap.get(item.product_id) || 0;
        return {
          product_id: item.product_id,
          product_name: product?.product_name || '不明な商品',
          product_code: product?.product_code || '',
          ordered_quantity: item.quantity,
          delivered_quantity: delivered,
          remaining_quantity: item.quantity - delivered,
          unit_price: item.unit_price,
        };
      });

      return result;
    },
    staleTime: 30000, // 30秒間はキャッシュを使用
  })
}
