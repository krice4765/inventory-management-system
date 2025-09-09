// 🔄 発注・在庫連動システム
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface InventoryTransaction {
  id: string;
  product_id: string;
  transaction_type: 'in' | 'out';
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo: string;
  transaction_date: string;
}

/**
 * 発注明細から在庫入庫処理を実行
 * @param purchaseOrderId 発注ID
 * @param deliveredAmount 納品金額
 * @param memo 備考
 * @param deliveryType 分納タイプ（金額のみ or 金額+個数）
 * @param quantities 商品別個数指定（deliveryType='amount_and_quantity'の場合）
 */
export async function processInventoryFromOrder(
  purchaseOrderId: string,
  deliveredAmount: number,
  memo: string,
  deliveryType: 'amount_only' | 'amount_and_quantity' = 'amount_only',
  quantities?: { [productId: string]: number },
  transactionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 🛡️ 重複処理防止：既にこのtransactionIdで在庫移動が存在するかチェック
    if (transactionId) {
      const { data: existingMovements, error: checkError } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('transaction_id', transactionId)
        .limit(1);
      
      if (checkError) {
        console.warn('重複チェックエラー:', checkError.message);
      } else if (existingMovements && existingMovements.length > 0) {
        console.log('⚠️ 重複処理防止: この分納は既に在庫処理済みです', { transactionId });
        return { success: true }; // 既に処理済みなので成功として返す
      }
    }
    // 1. 発注明細を取得
    const { data: orderItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select(`
        *,
        products (
          id,
          product_name,
          product_code,
          current_stock
        )
      `)
      .eq('purchase_order_id', purchaseOrderId);

    if (itemsError) {
      throw new Error(`発注明細取得エラー: ${itemsError.message}`);
    }

    if (!orderItems || orderItems.length === 0) {
      throw new Error('発注明細が見つかりません');
    }

    // 2. 発注総額と発注番号を取得
    const { data: orderData, error: orderError } = await supabase
      .from('purchase_orders')
      .select('total_amount, order_no')
      .eq('id', purchaseOrderId)
      .single();

    if (orderError) {
      throw new Error(`発注データ取得エラー: ${orderError.message}`);
    }

    // 3. 分納比率を計算
    const orderTotalAmount = orderData.total_amount;
    const deliveryRatio = deliveredAmount / orderTotalAmount;

    console.log(`🔄 在庫連動処理開始:`, {
      purchaseOrderId,
      orderTotalAmount,
      deliveredAmount,
      deliveryRatio: `${(deliveryRatio * 100).toFixed(2)}%`
    });

    // 4. 各商品の入庫処理
    const inventoryUpdates = [];
    const inventoryTransactions = [];

    for (const item of orderItems) {
      if (!item.products) {
        console.warn(`商品情報なし: item_id=${item.id}`);
        continue;
      }

      // 🔄 分納処理：金額のみ vs 金額+個数選択
      let deliveryQuantity: number;
      let adjustedUnitPrice: number = item.unit_price;
      
      if (deliveryType === 'amount_and_quantity' && quantities && quantities[item.products.id] && quantities[item.products.id] > 0) {
        // 個数指定分納: ユーザー指定数量を入庫、但し金額は分納金額に比例配分
        deliveryQuantity = quantities[item.products.id];
        
        // 🔧 小数点問題修正: 分納金額を指定商品数で均等分割（整数化）
        const totalSpecifiedQuantity = Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0);
        adjustedUnitPrice = totalSpecifiedQuantity > 0 
          ? Math.round(deliveredAmount / totalSpecifiedQuantity)  // 整数化
          : item.unit_price;
        
        console.log(`📦 個数指定分納: ${item.products.product_name}`, {
          発注数量: item.quantity,
          指定入庫数量: deliveryQuantity,
          本来単価: item.unit_price,
          調整後単価: adjustedUnitPrice,
          処理方式: '個数指定分納（金額均等分割）',
          総指定数量: totalSpecifiedQuantity,
          分納金額: deliveredAmount
        });
      } else if (deliveryType === 'amount_and_quantity') {
        // 個数指定分納だが、この商品は指定されていない -> スキップ
        console.log(`⏭️ 個数指定分納でスキップ: ${item.products.product_name} (指定数量: ${quantities ? quantities[item.products.id] || 0 : 0})`);
        continue;
      } else {
        // 金額のみ分納: 発注数量の100%を入庫（従来方式）
        deliveryQuantity = item.quantity;
        console.log(`📦 金額分納: ${item.products.product_name}`, {
          発注数量: item.quantity,
          入庫数量: deliveryQuantity,
          処理方式: '金額分納（発注数量=入庫数量）',
          金額比率: `${(deliveryRatio * 100).toFixed(1)}%`
        });
      }
      
      if (deliveryQuantity <= 0) {
        console.warn(`入庫数量が0: product=${item.products.product_name}, calculated=${deliveryQuantity}`);
        continue;
      }

      // 在庫数量を更新
      const newStockQuantity = (item.products.current_stock || 0) + deliveryQuantity;
      
      inventoryUpdates.push({
        id: item.products.id,
        current_stock: newStockQuantity
      });

      // 在庫履歴を記録（調整後単価を使用）
      inventoryTransactions.push({
        id: crypto.randomUUID(),
        product_id: item.products.id,
        transaction_type: 'in' as const,
        quantity: deliveryQuantity,
        unit_price: adjustedUnitPrice,
        total_amount: deliveryQuantity * adjustedUnitPrice,
        memo: `${memo} - ${item.products.product_name} (${item.products.product_code}) [分納: ${orderData.order_no}]`,
        transaction_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      console.log(`📦 商品入庫:`, {
        product: item.products.product_name,
        code: item.products.product_code,
        deliveryQuantity,
        newStock: newStockQuantity
      });
    }

    // 5. データベース更新（トランザクション処理）
    if (inventoryUpdates.length === 0) {
      console.warn('⚠️ 更新対象の在庫がありません');
      return { success: true };
    }

    // 在庫数量更新
    for (const update of inventoryUpdates) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ current_stock: update.current_stock })
        .eq('id', update.id);

      if (updateError) {
        throw new Error(`在庫更新エラー: ${updateError.message}`);
      }
    }

    // 在庫履歴記録（既存のinventory_movementsテーブルを使用）
    if (inventoryTransactions.length > 0) {
      const movementRecords = inventoryTransactions.map(tx => ({
        id: tx.id,
        product_id: tx.product_id,
        movement_type: tx.transaction_type,
        quantity: tx.quantity,
        unit_price: tx.unit_price,
        total_amount: tx.total_amount,
        memo: tx.memo,
        transaction_id: transactionId,
        created_at: tx.transaction_date
      }));

      const { error: transactionError } = await supabase
        .from('inventory_movements')
        .insert(movementRecords);

      if (transactionError) {
        throw new Error(`在庫履歴記録エラー: ${transactionError.message}`);
      }
    }

    console.log('✅ 在庫連動処理完了:', {
      updatedProducts: inventoryUpdates.length,
      transactions: inventoryTransactions.length
    });

    return { success: true };

  } catch (error) {
    console.error('❌ 在庫連動処理エラー:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '不明なエラー' 
    };
  }
}

/**
 * 在庫履歴の手動記録（既存のQuick入出庫と統合）
 */
export async function recordInventoryTransaction(transaction: {
  product_id: string;
  transaction_type: 'in' | 'out';
  quantity: number;
  unit_price: number;
  memo: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 商品の現在在庫を取得
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('current_stock, product_name')
      .eq('id', transaction.product_id)
      .single();

    if (productError) {
      throw new Error(`商品情報取得エラー: ${productError.message}`);
    }

    // 2. 新しい在庫数を計算
    const currentStock = product.current_stock || 0;
    const quantityChange = transaction.transaction_type === 'in' 
      ? transaction.quantity 
      : -transaction.quantity;
    const newStock = currentStock + quantityChange;

    if (newStock < 0) {
      throw new Error(`在庫不足: ${product.product_name} (現在在庫: ${currentStock}, 出庫予定: ${transaction.quantity})`);
    }

    // 3. 在庫数更新
    const { error: updateError } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', transaction.product_id);

    if (updateError) {
      throw new Error(`在庫更新エラー: ${updateError.message}`);
    }

    // 4. 履歴記録（既存のinventory_movementsテーブルを使用）
    const { error: historyError } = await supabase
      .from('inventory_movements')
      .insert({
        id: crypto.randomUUID(),
        product_id: transaction.product_id,
        movement_type: transaction.transaction_type,
        quantity: transaction.quantity,
        unit_price: transaction.unit_price,
        total_amount: transaction.quantity * transaction.unit_price,
        memo: transaction.memo,
        created_at: new Date().toISOString()
      });

    if (historyError) {
      throw new Error(`履歴記録エラー: ${historyError.message}`);
    }

    return { success: true };

  } catch (error) {
    console.error('❌ 在庫記録エラー:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '不明なエラー' 
    };
  }
}