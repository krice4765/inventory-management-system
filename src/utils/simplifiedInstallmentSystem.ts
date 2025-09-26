// 緊急代替システム: シンプルで確実な分納処理
import { supabase } from '../lib/supabase';

export interface SimplifiedInstallmentData {
  orderId: string;
  amount: number;
  deliveryType: string;
  quantities?: { [productId: string]: number };
  userId: string;
  memo?: string;
}

export class SimplifiedInstallmentService {

  /**
   * データベース制約安全対応の分納処理
   * 409 Conflictエラーを根本的に解決
   */
  static async createInstallmentTransaction(data: SimplifiedInstallmentData): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      console.log('分納作成開始:', {
        orderId: data.orderId,
        amount: data.amount,
        userId: data.userId
      });

      // 🛡️ Phase 1: 分納番号を事前計算

      // 分納番号を安全に取得
      let installmentNumber = 1;
      try {
        const { data: existingTransactions, error: countError } = await supabase
          .from('transactions')
          .select('installment_no')
          .eq('parent_order_id', data.orderId)
          .eq('transaction_type', 'purchase')
          // すべてのステータスの分納を含める（重複番号を避けるため）
          .order('installment_no', { ascending: false })
          .limit(1);

        // ログ出力（削除済み）

        if (!countError && existingTransactions?.length > 0) {
          installmentNumber = (existingTransactions[0]?.installment_no || 0) + 1;
        } else {
        }
      } catch (error) {
        console.warn('⚠️ 分納番号計算でエラー、デフォルト値使用:', error);
      }


      // パートナーID取得
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('partner_id')
        .eq('id', data.orderId)
        .single();

      if (!orderError && orderData) {
        // 🆕 商品情報を含むV3関数を優先使用
        let items = [];

        // 商品・数量情報が提供されている場合は配列を構築
        if (data.quantities && Object.keys(data.quantities).length > 0) {
          console.log('🔍 数量情報あり:', data.quantities);

          // 発注商品情報を取得
          const { data: orderItems, error: itemsError } = await supabase
            .from('purchase_order_items')
            .select(`
              id, product_id, quantity, unit_price, total_amount,
              products (
                product_name, product_code
              )
            `)
            .eq('purchase_order_id', data.orderId);

          if (!itemsError && orderItems) {
            const totalQuantity = Object.values(data.quantities).reduce((sum: number, qty: any) => {
              const numQty = Number(qty) || 0;
              return sum + numQty;
            }, 0);

            console.log('🔍 数量計算結果:', { originalQuantities: data.quantities, totalQuantity });

            if (totalQuantity > 0) {
              items = Object.entries(data.quantities)
                .filter(([_productId, quantity]) => (Number(quantity) || 0) > 0)
                .map(([productId, quantity]) => {
                  const numQuantity = Number(quantity) || 0;
                  const orderItem = orderItems.find(item => item.product_id === productId);
                  if (orderItem) {
                    // 実際の分納単価を計算（分納金額 / 総数量）
                    const actualUnitPrice = Math.round(data.amount / totalQuantity);
                    return {
                      product_id: productId,
                      quantity: numQuantity,
                      unit_price: actualUnitPrice || 0, // 0除算対策
                      total_amount: (actualUnitPrice || 0) * numQuantity
                    };
                  }
                  return null;
                }).filter(item => item !== null);

              console.log('🔍 作成されたアイテム配列:', items);
            }
          }
        } else {
          console.log('🔍 数量情報なし - アイテム作成をスキップ');
        }

        // 一意性を保証するトランザクション番号生成
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const transactionNo = `TXN-${timestamp}-${installmentNumber}-${randomSuffix}`;

        // RPC関数の代わりに直接取引を作成
        const insertData = {
          transaction_no: transactionNo,
          transaction_type: 'purchase',
          partner_id: orderData.partner_id,
          transaction_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
          total_amount: data.amount,
          status: 'confirmed',
          memo: data.memo || `第${installmentNumber}回`,
          parent_order_id: data.orderId,
          installment_no: installmentNumber
        };

        console.log('🔍 挿入データ:', insertData);

        const { data: transactionData, error: transactionError } = await supabase
          .from('transactions')
          .insert(insertData)
          .select()
          .single();

        let result = null;
        if (transactionError) {
          console.error('❌ transactions挿入エラー詳細:', {
            error: transactionError,
            code: transactionError.code,
            message: transactionError.message,
            details: transactionError.details,
            hint: transactionError.hint,
            insertData: insertData
          });
        }

        if (!transactionError && transactionData) {
          result = { transaction_id: transactionData.id };

          // 分納明細アイテムを作成
          if (items.length > 0) {
            const itemsToInsert = items.map(item => ({
              transaction_id: transactionData.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price || 0,
              total_amount: item.total_amount || 0
            }));

            console.log('🔍 分納明細挿入データ:', itemsToInsert);

            const { error: itemsError } = await supabase
              .from('transaction_items')
              .insert(itemsToInsert);

            if (itemsError) {
              console.error('❌ 分納明細作成エラー:', {
                error: itemsError,
                code: itemsError.code,
                message: itemsError.message,
                details: itemsError.details,
                hint: itemsError.hint,
                itemsData: itemsToInsert
              });
            } else {
              console.log('✅ 分納明細作成成功');

              // 🎯 在庫移動レコードも同時作成（transaction_id付き）
              const movementsToInsert = items.map(item => ({
                product_id: item.product_id,
                movement_type: 'in',
                quantity: item.quantity,
                unit_price: item.unit_price || 0,
                total_amount: item.total_amount || 0,
                transaction_id: transactionData.id,
                memo: `分納入庫 - ${data.memo || `第${installmentNumber}回`}`,
                created_at: new Date().toISOString()
              }));

              console.log('🔍 在庫移動挿入データ:', movementsToInsert);

              const { error: movementsError } = await supabase
                .from('inventory_movements')
                .insert(movementsToInsert);

              if (movementsError) {
                console.error('❌ 在庫移動作成エラー:', {
                  error: movementsError,
                  code: movementsError.code,
                  message: movementsError.message,
                  details: movementsError.details,
                  hint: movementsError.hint,
                  movementsData: movementsToInsert
                });
              } else {
                console.log('✅ 在庫移動レコード作成成功');
              }
            }
          }

          // 🎯 V3処理成功時は即座にリターン（フォールバック処理を回避）
          console.log('✅ V3分納処理完了');
          return {
            success: true,
            transactionId: transactionData.id
          };
        }

        const rpcError = transactionError;

        // データベース関数が成功した場合
        if (!rpcError && result) {
          // ログ出力（削除済み）

          return {
            success: true,
            transactionId: result.id
          };
        } else {
          // ログ出力（削除済み）
        }
      }

      // V3関数が失敗または使用できない場合はフォールバックに移行

      // 🔄 Phase 2: フォールバック - 従来方式（改良版）

      // 一意性を保証するトランザクション番号生成
      const fallbackTimestamp = Date.now();
      const fallbackRandomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      let fallbackTransactionNo = `SAFE-${fallbackTimestamp}-${installmentNumber}-${fallbackRandomSuffix}`;

      // 安全な分納レコード挿入（再試行ロジック付き）
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          const fallbackInsertData = {
            transaction_no: fallbackTransactionNo,
            transaction_type: 'purchase',
            partner_id: orderData.partner_id,
            parent_order_id: data.orderId,
            installment_no: installmentNumber,
            transaction_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
            status: 'confirmed',
            total_amount: data.amount,
            memo: data.memo || `第${installmentNumber}回`,
          };

          console.log('🔄 フォールバック挿入データ:', fallbackInsertData);

          const { data: transaction, error: insertError } = await supabase
            .from('transactions')
            .insert(fallbackInsertData)
            .select()
            .single();

          if (insertError) {
            console.error('❌ フォールバック分納作成エラー:', insertError);

            // 409エラー/23505（重複）の場合は分納番号を調整して再試行
            if (insertError.code === '23505') {
              installmentNumber++;
              // 新しいトランザクション番号を生成
              const newTimestamp = Date.now();
              const newRandomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
              fallbackTransactionNo = `SAFE-${newTimestamp}-${installmentNumber}-${newRandomSuffix}`;
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
              continue;
            }

            return { success: false, error: `分納作成失敗: ${insertError.message}` };
          }

          // 商品情報がある場合はtransaction_itemsテーブルにも保存
          if (data.quantities && Object.keys(data.quantities).length > 0) {
            // ログ出力（削除済み）

            const totalQuantity = Object.values(data.quantities).reduce((sum: number, qty: number) => sum + qty, 0);
            const transactionItems = Object.entries(data.quantities)
              .filter(([_, quantity]) => quantity > 0)
              .map(([productId, quantity]) => ({
                transaction_id: transaction.id,
                product_id: productId,
                quantity: quantity,
                unit_price: totalQuantity > 0 ? Math.round(data.amount / totalQuantity) : 0,
                line_total: totalQuantity > 0 ? Math.round((data.amount / totalQuantity) * quantity) : 0
              }));


            if (transactionItems.length > 0) {
              // まずは最小限のカラムで試行
              const minimalItems = transactionItems.map(item => ({
                transaction_id: item.transaction_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price
              }));


              const { data: insertResult, error: itemsError } = await supabase
                .from('transaction_items')
                .insert(minimalItems)
                .select('*');

              if (itemsError) {
                console.error('❌ 商品情報の保存詳細エラー:', {
                  error: itemsError,
                  code: itemsError.code,
                  message: itemsError.message,
                  details: itemsError.details,
                  hint: itemsError.hint,
                  originalData: transactionItems,
                  minimalData: minimalItems
                });

                // それでも失敗する場合、より基本的なデータで再試行
                if (itemsError.code === '42703') { // column does not exist
                  const basicItems = transactionItems.map(item => ({
                    transaction_id: item.transaction_id,
                    product_id: item.product_id,
                    quantity: item.quantity
                  }));

                  const { error: basicError } = await supabase
                    .from('transaction_items')
                    .insert(basicItems);

                  if (basicError) {
                    console.error('❌ 基本カラムでも挿入失敗:', basicError);
                  } else {
                  }
                }
              } else {
                // ログ出力（削除済み）

                // 🎯 フォールバック処理でも在庫移動レコードを作成
                const fallbackMovementsToInsert = transactionItems.map(item => ({
                  product_id: item.product_id,
                  movement_type: 'in',
                  quantity: item.quantity,
                  unit_price: item.unit_price || 0,
                  total_amount: item.line_total || 0,
                  transaction_id: transaction.id,
                  memo: `分納入庫 - ${data.memo || `第${installmentNumber}回`}`,
                  created_at: new Date().toISOString()
                }));

                console.log('🔍 フォールバック在庫移動挿入データ:', fallbackMovementsToInsert);

                const { error: fallbackMovementsError } = await supabase
                  .from('inventory_movements')
                  .insert(fallbackMovementsToInsert);

                if (fallbackMovementsError) {
                  console.error('❌ フォールバック在庫移動作成エラー:', {
                    error: fallbackMovementsError,
                    code: fallbackMovementsError.code,
                    message: fallbackMovementsError.message,
                    details: fallbackMovementsError.details,
                    hint: fallbackMovementsError.hint,
                    movementsData: fallbackMovementsToInsert
                  });
                } else {
                  console.log('✅ フォールバック在庫移動レコード作成成功');
                }
              }
            }
          }

          // ログ出力（削除済み）

          return {
            success: true,
            transactionId: transaction.id
          };

        } catch (error) {
          console.error('❌ フォールバック処理で予期しないエラー:', error);
          retryCount++;
          if (retryCount >= maxRetries) {
            return { success: false, error: '分納処理の再試行回数上限に達しました' };
          }
        }
      }

      // 最終的にすべて失敗した場合
      return { success: false, error: '分納処理がすべて失敗しました' };

    } catch (error) {
      console.error('❌ 安全な分納処理で予期しないエラー:', error);
      return {
        success: false,
        error: `予期しないエラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      };
    }
  }

  /**
   * 今日作成された重複トランザクションをクリーンアップ
   */
  static async cleanupTodaysDuplicates(orderId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 今日作成された同じ注文の分納を取得
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('id, created_at, installment_no')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .order('created_at', { ascending: true });

      if (fetchError || !transactions || transactions.length <= 1) {
        return; // エラーまたは重複なし
      }

      // 最初のもの以外を削除
      const duplicateIds = transactions.slice(1).map(t => t.id);

      if (duplicateIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .in('id', duplicateIds);

        if (deleteError) {
          console.error('❌ 重複削除エラー:', deleteError);
        } else {
        }
      }
    } catch (error) {
      console.error('❌ クリーンアップエラー:', error);
    }
  }
}

// React Hook
export function useSimplifiedInstallment() {
  const createInstallment = async (data: SimplifiedInstallmentData) => {
    // 🚨 緊急修正: 重複削除を無効化（数量リセットバグの原因）
    // await SimplifiedInstallmentService.cleanupTodaysDuplicates(data.orderId);

    // シンプルな分納処理を実行
    return await SimplifiedInstallmentService.createInstallmentTransaction(data);
  };

  return {
    createInstallment,
    cleanupDuplicates: SimplifiedInstallmentService.cleanupTodaysDuplicates
  };
}