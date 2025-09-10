import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useOrderForDelivery = (orderId: string | null) => {
  return useQuery({
    queryKey: ['delivery-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      
      // 発注データ、発注明細、分納実績、在庫移動履歴を並列取得
      const [orderResult, itemsResult, deliveryResult, movementsResult] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('id, order_no, total_amount, partner_id, status, delivery_deadline')
          .eq('id', orderId)
          .single(),
        supabase
          .from('purchase_order_items')
          .select(`
            *,
            products (
              id,
              product_name,
              product_code
            )
          `)
          .eq('purchase_order_id', orderId),
        supabase
          .from('transactions')
          .select('id, total_amount')
          .eq('parent_order_id', orderId)
          .eq('transaction_type', 'purchase')
          .eq('status', 'confirmed'),
        // 在庫移動履歴から分納実績を取得（transaction_idで結合）
        supabase
          .from('inventory_movements')
          .select('product_id, quantity, transaction_id')
          .eq('movement_type', 'in')
      ]);
        
      if (orderResult.error) throw orderResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (deliveryResult.error) throw deliveryResult.error;
      if (movementsResult.error) throw movementsResult.error;
      
      const data = orderResult.data;
      const items = itemsResult.data || [];
      const deliveries = deliveryResult.data || [];
      const movements = movementsResult.data || [];
      
      // 分納実績を合計
      const delivered_amount = deliveries.reduce((sum, delivery) => sum + (delivery.total_amount || 0), 0);
      
      // 商品別の分納済み数量を集計（inventory_movementsから）
      const deliveryTransactionIds = deliveries.map(d => d.id);
      const relevantMovements = movements.filter(m => 
        deliveryTransactionIds.includes(m.transaction_id)
      );
      
      // デバッグログ
      console.log('🔍 分納数量集計デバッグ:', {
        orderId,
        deliveries: deliveries.length,
        deliveryTransactionIds,
        movements: movements.length,
        relevantMovements: relevantMovements.length,
        movementDetails: relevantMovements.map(m => ({
          productId: m.product_id,
          quantity: m.quantity,
          transactionId: m.transaction_id
        }))
      });
      
      const deliveredQuantitiesByProduct = relevantMovements.reduce((acc: { [key: string]: number }, movement) => {
        const productId = movement.product_id;
        acc[productId] = (acc[productId] || 0) + (movement.quantity || 0);
        return acc;
      }, {});
      
      console.log('📊 商品別分納数量:', deliveredQuantitiesByProduct);
      
      // 仕入先名を取得
      let partnerName = '仕入先未設定';
      if (data.partner_id) {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('name')
          .eq('id', data.partner_id)
          .single();
        
        if (partnerData) {
          partnerName = partnerData.name;
        }
      }
      
      // 🎯 DeliveryModalが期待する形式に変換（明細情報付き）
      const ordered_amount = data.total_amount || 0;
      const remaining_amount = Math.max(0, ordered_amount - delivered_amount);
      
      return {
        purchase_order_id: data.id,
        order_no: data.order_no,
        partner_name: partnerName,
        ordered_amount,
        delivered_amount,
        remaining_amount,
        partner_id: data.partner_id,
        delivery_deadline: data.delivery_deadline,
        items: items.map((item: any) => {
          const deliveredQuantity = deliveredQuantitiesByProduct[item.product_id] || 0;
          const remainingQuantity = Math.max(0, item.quantity - deliveredQuantity);
          
          return {
            id: item.id,
            product_id: item.product_id,
            product_name: item.products?.product_name || '',
            product_code: item.products?.product_code || '',
            quantity: item.quantity,
            delivered_quantity: deliveredQuantity,
            remaining_quantity: remainingQuantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
          };
        })
      };
    },
    staleTime: 5000, // 5秒間はキャッシュを使用（分納後の更新を早める）
  })
}
