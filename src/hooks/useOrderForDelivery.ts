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
        // 現在の在庫残高を取得（inventory_movementsから実際の在庫数量を計算）
        supabase
          .from('inventory_movements')
          .select('product_id, movement_type, quantity')
          .order('created_at', { ascending: false })
          .limit(1000)
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
      const allMovements = stockResult.data || [];

      // ログ出力（削除済み）

      // 分納実績を合計
      const delivered_amount = deliveries.reduce((sum, delivery) => sum + (delivery.total_amount || 0), 0);

      // 商品別の分納済み数量を集計（inventory_movementsから）
      const deliveryTransactionIds = deliveries.map(d => d.id);
      const relevantMovements = movements.filter(m =>
        deliveryTransactionIds.includes(m.transaction_id)
      );

      // 🚨 強化デバッグログ（削除済み）

      // 🚨 数量リセットバグ検出とデバッグ情報
      console.log('🔍 分納データの詳細調査:', {
        deliveries: deliveries.length,
        movements: movements.length,
        deliveryTransactionIds,
        relevantMovements: relevantMovements.length,
        allDeliveries: deliveries,
        allMovements: movements.slice(0, 5) // 最初の5件のみ表示
      });

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

      console.log('🔍 分納済み数量の計算結果:', deliveredQuantitiesByProduct);


      // inventory_movementsから実際の在庫数量を計算（InventoryStatusTabと同じロジック）
      const stockMap: { [key: string]: number } = {};

      // 各商品ごとに在庫を計算
      const productIds = [...new Set(allMovements.map(m => m.product_id))];
      productIds.forEach(productId => {
        const productMovements = allMovements.filter(m => m.product_id === productId);
        const totalIn = productMovements
          .filter(m => m.movement_type === 'in')
          .reduce((sum, m) => sum + (m.quantity || 0), 0);
        const totalOut = productMovements
          .filter(m => m.movement_type === 'out')
          .reduce((sum, m) => sum + (m.quantity || 0), 0);

        stockMap[productId] = Math.max(0, totalIn - totalOut);
      });
      
      
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
