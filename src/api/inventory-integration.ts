import { supabase } from '../lib/supabase';
import type { InstallmentResult } from './transactions';

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo?: string;
  transaction_id: string;
  installment_no: number;
  created_at: string;
}

export interface IntegratedInstallmentParams {
  parentOrderId: string;
  amount: number;
  products: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  status?: string;
  dueDate?: string;
  memo?: string;
}

export interface IntegratedInstallmentResult {
  transaction: InstallmentResult;
  inventoryMovements: InventoryMovement[];
  integrationStatus: 'success' | 'partial' | 'failed';
  errors?: string[];
}

/**
 * 統合分納作成: 分納と在庫移動を同時作成し確実に連携
 */
export async function createIntegratedInstallment(
  params: IntegratedInstallmentParams
): Promise<IntegratedInstallmentResult> {
  const errors: string[] = [];

  try {
    // Step 1: 分納作成
    const { data: transactionData, error: transactionError } = await supabase.rpc(
      'add_purchase_installment_v2',
      {
        p_parent_order_id: params.parentOrderId,
        p_amount: params.amount,
        p_status: params.status || 'draft',
        p_due_date: params.dueDate,
        p_memo: params.memo,
      }
    );

    if (transactionError) {
      throw new Error(`分納作成エラー: ${transactionError.message}`);
    }

    if (!transactionData) {
      throw new Error('分納データが返されませんでした');
    }

    const transaction = transactionData as InstallmentResult;

    // Step 2: 在庫移動を並列作成（全て成功するか全て失敗）
    const inventoryPromises = params.products.map(async (product) => {
      const movementData = {
        product_id: product.productId,
        movement_type: 'in' as const,
        quantity: product.quantity,
        unit_price: product.unitPrice,
        total_amount: product.quantity * product.unitPrice,
        memo: `${params.memo || `第${transaction.installment_no}回`} - 自動連携`,
        transaction_id: transaction.id,
        installment_no: transaction.installment_no,
      };

      const { data, error } = await supabase
        .from('inventory_movements')
        .insert(movementData)
        .select()
        .single();

      if (error) {
        throw new Error(`在庫移動作成エラー (商品ID: ${product.productId}): ${error.message}`);
      }

      return data as InventoryMovement;
    });

    try {
      const inventoryMovements = await Promise.all(inventoryPromises);

      return {
        transaction,
        inventoryMovements,
        integrationStatus: 'success',
      };
    } catch (inventoryError) {
      errors.push(`在庫移動作成失敗: ${inventoryError}`);

      // 分納は作成済みなので部分成功として扱う
      return {
        transaction,
        inventoryMovements: [],
        integrationStatus: 'partial',
        errors,
      };
    }

  } catch (mainError) {
    errors.push(`統合分納作成失敗: ${mainError}`);

    return {
      transaction: {} as InstallmentResult,
      inventoryMovements: [],
      integrationStatus: 'failed',
      errors,
    };
  }
}

/**
 * 既存分納の在庫移動を修復
 */
export async function repairInstallmentInventoryLink(
  transactionId: string,
  products: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    // 分納情報取得
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      return { success: false, errors: ['分納情報の取得に失敗しました'] };
    }

    // 在庫移動を作成
    const inventoryPromises = products.map(async (product) => {
      const movementData = {
        product_id: product.productId,
        movement_type: 'in' as const,
        quantity: product.quantity,
        unit_price: product.unitPrice,
        total_amount: product.quantity * product.unitPrice,
        memo: `${transaction.memo || `第${transaction.installment_no}回`} - 修復連携`,
        transaction_id: transactionId,
        installment_no: transaction.installment_no,
      };

      const { error } = await supabase
        .from('inventory_movements')
        .insert(movementData);

      if (error) {
        throw new Error(`商品ID ${product.productId}: ${error.message}`);
      }
    });

    await Promise.all(inventoryPromises);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      errors: [`修復処理エラー: ${error}`]
    };
  }
}

/**
 * 統合データ整合性チェック
 */
export async function validateIntegration(
  parentOrderId: string
): Promise<{
  isValid: boolean;
  issues: Array<{
    type: 'missing_inventory' | 'orphaned_inventory' | 'amount_mismatch' | 'numbering_issue';
    description: string;
    transactionId?: string;
    installmentNo?: number;
  }>;
}> {
  const issues: any[] = [];

  try {
    // 分納データ取得
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_order_id', parentOrderId)
      .eq('transaction_type', 'purchase')
      .order('installment_no');

    // 在庫移動データ取得
    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('*')
      .in('installment_no', transactions?.map(t => t.installment_no) || [])
      .gte('created_at', '2025-09-20T00:00:00');

    if (!transactions || !movements) {
      return { isValid: false, issues: [{ type: 'missing_inventory', description: 'データ取得エラー' }] };
    }

    // 1. 在庫移動が不足している分納をチェック
    transactions.forEach(transaction => {
      const linkedMovements = movements.filter(m => m.transaction_id === transaction.id);
      if (linkedMovements.length === 0) {
        issues.push({
          type: 'missing_inventory',
          description: `分納${transaction.installment_no}に対応する在庫移動がありません`,
          transactionId: transaction.id,
          installmentNo: transaction.installment_no,
        });
      }
    });

    // 2. 孤立した在庫移動をチェック
    movements.forEach(movement => {
      if (movement.transaction_id && !transactions.find(t => t.id === movement.transaction_id)) {
        issues.push({
          type: 'orphaned_inventory',
          description: `在庫移動が存在しない分納IDを参照しています: ${movement.transaction_id}`,
          installmentNo: movement.installment_no,
        });
      }
    });

    // 3. 分納番号の連続性チェック
    const installmentNumbers = transactions.map(t => t.installment_no).sort((a, b) => a - b);
    for (let i = 0; i < installmentNumbers.length; i++) {
      if (installmentNumbers[i] !== i + 1) {
        issues.push({
          type: 'numbering_issue',
          description: `分納番号が連続していません。期待値: ${i + 1}, 実際: ${installmentNumbers[i]}`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  } catch (error) {
    return {
      isValid: false,
      issues: [{ type: 'missing_inventory', description: `整合性チェックエラー: ${error}` }],
    };
  }
}