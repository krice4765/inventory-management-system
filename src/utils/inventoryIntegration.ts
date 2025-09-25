// 🔄 純粋な在庫管理システム (物理的な商品移動のみ)
import { supabase } from '../lib/supabase';

export interface PureInventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  actual_unit_price: number;  // 商品の実際の単価 (変動なし)
  memo: string;
  transaction_date: string;
  source_transaction_id?: string; // 分納記録への参照
}

// 会計配分は別システムで管理
export interface AccountingAllocation {
  id: string;
  transaction_id: string;      // 分納記録ID
  product_id: string;
  allocated_amount: number;    // 配分金額
  allocation_ratio: number;    // 配分比率
  allocation_method: 'delivery_ratio' | 'manual';
  notes: string;
  created_at: string;
}

/**
 * 🏭 純粋な在庫入庫処理 (物理的な商品移動のみ)
 * 会計配分は別システムで処理
 * @param purchaseOrderId 発注ID
 * @param deliveredAmount 分納金額 (会計配分用の参考値)
 * @param memo 備考
 * @param deliveryType 分納タイプ
 * @param quantities 商品別個数指定
 * @param transactionId 分納記録ID
 * @param deliverySequence 分納回数
 */
export async function processInventoryFromOrder(
  purchaseOrderId: string,
  deliveredAmount: number,
  memo: string,
  deliveryType: 'amount_only' | 'amount_and_quantity' | 'full' = 'amount_only',
  quantities?: { [productId: string]: number },
  transactionId?: string,
  deliverySequence?: number
): Promise<{ 
  success: boolean; 
  error?: string;
  message?: string;
  inventoryMovements?: PureInventoryMovement[];
  accountingAllocations?: AccountingAllocation[];
}> {
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
      console.error('発注明細取得エラー:', itemsError);
      throw new Error(`発注明細取得エラー: ${itemsError.message}`);
    }


    if (!orderItems || orderItems.length === 0) {
      console.warn('発注明細が見つかりません:', { purchaseOrderId, orderItems });
      // 発注明細がない場合でも処理を継続（全納の場合など）
      return {
        success: true,
        message: '発注明細がないため在庫連動処理をスキップしました'
      };
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

      purchaseOrderId,
      orderTotalAmount,
      deliveredAmount,
      deliveryRatio: `${(deliveryRatio * 100).toFixed(2)}%`
    });

    // 4. 各商品の入庫処理
    const inventoryUpdates = [];
    const inventoryTransactions: PureInventoryMovement[] = [];
    const accountingAllocations: AccountingAllocation[] = [];

    for (const item of orderItems) {
      if (!item.products) {
        console.warn(`商品情報なし: item_id=${item.id}`);
        continue;
      }

      // 🏭 純粋な在庫処理：物理的な商品移動のみ
      let deliveryQuantity: number;
      const actualUnitPrice = item.unit_price; // 商品の実際単価 (固定)
      
      if (deliveryType === 'amount_and_quantity' && quantities && quantities[item.products.id] && quantities[item.products.id] > 0) {
        // 個数指定分納: ユーザー指定数量を入庫
        deliveryQuantity = quantities[item.products.id];
        
          発注数量: item.quantity,
          指定入庫数量: deliveryQuantity,
          実際単価: actualUnitPrice,
          在庫価値: deliveryQuantity * actualUnitPrice,
          処理方式: '個数指定入庫'
        });
      } else if (deliveryType === 'amount_and_quantity') {
        // 個数指定分納だが、この商品は指定されていない -> スキップ
        continue;
      } else if (deliveryType === 'full') {
        // 全納登録: 残り数量の100%を入庫
        deliveryQuantity = item.remaining_quantity || item.quantity;
        
          発注数量: item.quantity,
          入庫数量: deliveryQuantity,
          実際単価: actualUnitPrice,
          在庫価値: deliveryQuantity * actualUnitPrice,
          処理方式: '全納入庫（残り数量100%）'
        });
      } else {
        // 金額のみ分納: 在庫変動なし（会計のみの処理）
          発注数量: item.quantity,
          入庫数量: '在庫変動なし',
          処理方式: '金額のみ分納（在庫変動なし）'
        });
        continue; // 在庫処理をスキップ
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

      // 📋 純粋な在庫履歴を記録（実際の商品価値で記録）
      const _inventoryValue = deliveryQuantity * actualUnitPrice;
      
      inventoryTransactions.push({
        id: crypto.randomUUID(),
        product_id: item.products.id,
        movement_type: 'in' as const,
        quantity: deliveryQuantity,
        actual_unit_price: actualUnitPrice,
        memo: `${memo} - ${item.products.product_name} (${item.products.product_code}) [発注: ${orderData.order_no}]${deliverySequence ? ` 第${deliverySequence}回` : ''}`,
        transaction_date: new Date().toISOString(),
        source_transaction_id: transactionId
      });

      // 💰 会計配分情報を別途記録
      if (deliveredAmount > 0 && orderTotalAmount > 0) {
        const itemOrderAmount = item.quantity * item.unit_price;
        const allocationRatio = deliveredAmount / orderTotalAmount;
        const allocatedAmount = Math.round(itemOrderAmount * allocationRatio);
        
        accountingAllocations.push({
          id: crypto.randomUUID(),
          transaction_id: transactionId || '',
          product_id: item.products.id,
          allocated_amount: allocatedAmount,
          allocation_ratio: allocationRatio,
          allocation_method: 'delivery_ratio',
          notes: `発注比率による配分 - ${item.products.product_name}`,
          created_at: new Date().toISOString()
        });
      }

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

    // 📋 純粋な在庫履歴記録
    if (inventoryTransactions.length > 0) {
      const movementRecords = inventoryTransactions.map(tx => ({
        id: tx.id,
        product_id: tx.product_id,
        movement_type: tx.movement_type,
        quantity: tx.quantity,
        unit_price: tx.actual_unit_price,  // 実際の商品単価
        total_amount: tx.quantity * tx.actual_unit_price, // 在庫価値
        memo: tx.memo,
        transaction_id: tx.source_transaction_id,
        created_at: tx.transaction_date,
        installment_no: deliverySequence || null  // 分納回数を追加
      }));

      const { error: transactionError } = await supabase
        .from('inventory_movements')
        .insert(movementRecords);

      if (transactionError) {
        console.error('❌ 在庫履歴記録エラー:', transactionError);
        throw new Error(`在庫履歴記録エラー: ${transactionError.message}`);
      }
    }

    // 💰 会計配分情報の記録（将来的に別テーブルに保存予定）
    
      更新商品数: inventoryUpdates.length,
      在庫移動記録数: inventoryTransactions.length,
      会計配分記録数: accountingAllocations.length,
      分納金額: deliveredAmount,
      在庫価値合計: inventoryTransactions.reduce((sum, tx) => sum + (tx.quantity * tx.actual_unit_price), 0)
    });

    return { 
      success: true, 
      message: '在庫処理が完了しました',
      inventoryMovements: inventoryTransactions,
      accountingAllocations: accountingAllocations
    };

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