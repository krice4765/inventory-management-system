import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useOrderForDelivery = (orderId: string | null) => {
  return useQuery({
    queryKey: ['delivery-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      
      // 発注データ、発注明細、分納実績、在庫移動履歴、現在の在庫残高を並列取得
      const [orderResult, itemsResult, deliveryResult, movementsResult, stockResult] = await Promise.all([
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
          .select('id, total_amount, installment_no, delivery_sequence, created_at, transaction_date, memo')
          .eq('parent_order_id', orderId)
          .eq('transaction_type', 'purchase')
          .eq('status', 'confirmed')
          .order('installment_no', { ascending: true }),
        // 在庫移動履歴から分納実績を取得（transaction_idで結合）
        supabase
          .from('inventory_movements')
          .select('product_id, quantity, transaction_id')
          .eq('movement_type', 'in'),
        // 現在の在庫残高を取得（整合性チェック用）
        supabase
          .from('products')
          .select('id, product_name, current_stock')
      ]);
        
      if (orderResult.error) throw orderResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (deliveryResult.error) throw deliveryResult.error;
      if (movementsResult.error) throw movementsResult.error;
      if (stockResult.error) throw stockResult.error;
      
      const data = orderResult.data;
      const items = itemsResult.data || [];
      const deliveries = deliveryResult.data || [];
      const movements = movementsResult.data || [];
      const currentStocks = stockResult.data || [];

        orderId,
        deliveries: deliveries?.map(d => ({
          id: d.id,
          installment_no: d.installment_no,
          amount: d.total_amount,
          memo: d.memo,
          created_at: d.created_at
        })),
        deliveriesCount: deliveries?.length || 0
      });
      
      // 分納実績を合計
      const delivered_amount = deliveries.reduce((sum, delivery) => sum + (delivery.total_amount || 0), 0);
      
      // 商品別の分納済み数量を集計（inventory_movementsから）
      const deliveryTransactionIds = deliveries.map(d => d.id);
      const relevantMovements = movements.filter(m => 
        deliveryTransactionIds.includes(m.transaction_id)
      );
      
      // 🚨 強化デバッグログ（数量リセットバグ調査）
        orderId,
        deliveries: deliveries.length,
        deliveryTransactionIds,
        movements: movements.length,
        relevantMovements: relevantMovements.length,
        deliveriesDetail: deliveries.map(d => ({
          id: d.id,
          total_amount: d.total_amount,
          created_at: d.created_at
        })),
        movementsDetail: movements.map(m => ({
          id: m.id,
          product_id: m.product_id,
          quantity: m.quantity,
          transaction_id: m.transaction_id,
          created_at: m.created_at
        })),
        relevantMovementsDetail: relevantMovements.map(m => ({
          product_id: m.product_id,
          quantity: m.quantity,
          transaction_id: m.transaction_id
        }))
      });

      // 🚨 数量リセットバグ検出
      if (relevantMovements.length === 0 && deliveries.length > 0) {
        console.error('🚨 数量リセットバグ検出: 分納レコードは存在するが在庫移動が0件', {
          問題: '分納レコードと在庫移動の関連付け失敗',
          deliveriesCount: deliveries.length,
          movementsCount: movements.length,
          deliveryTransactionIds,
          分析: 'transaction_idのマッピングに問題がある可能性'
        });
      }
      
      const deliveredQuantitiesByProduct = relevantMovements.reduce((acc: { [key: string]: number }, movement) => {
        const productId = movement.product_id;
        acc[productId] = (acc[productId] || 0) + (movement.quantity || 0);
        return acc;
      }, {});
      
      
      // 現在在庫との整合性チェック
      const stockMap = currentStocks.reduce((acc: { [key: string]: number }, stock) => {
        acc[stock.id] = stock.current_stock || 0;
        return acc;
      }, {});
      
      
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
        items: items.map((item: {
          id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          products?: {
            product_name?: string;
            product_code?: string;
          };
        }) => {
          const deliveredQuantity = deliveredQuantitiesByProduct[item.product_id] || 0;
          const remainingQuantity = Math.max(0, item.quantity - deliveredQuantity);
          const currentStock = stockMap[item.product_id] || 0;
          
          // 🎯 在庫整合性チェック
          const hasStockForDelivery = currentStock >= remainingQuantity;
          const stockShortage = remainingQuantity > currentStock ? remainingQuantity - currentStock : 0;
          
          return {
            id: item.id,
            product_id: item.product_id,
            product_name: item.products?.product_name || '',
            product_code: item.products?.product_code || '',
            quantity: item.quantity,
            delivered_quantity: deliveredQuantity,
            remaining_quantity: remainingQuantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            // 在庫整合性情報
            current_stock: currentStock,
            has_stock_for_delivery: hasStockForDelivery,
            stock_shortage: stockShortage,
            stock_status: hasStockForDelivery ? 'sufficient' : (currentStock > 0 ? 'insufficient' : 'out_of_stock')
          };
        })
      };
    },
    staleTime: 5000, // 5秒間はキャッシュを使用（分納後の更新を早める）
  })
}
