import { supabase } from '../lib/supabase';
import type { DuplicateDetectionData } from './improvedDuplicateDetection';

// Saga Patternによる分散トランザクション管理
export interface SagaStep {
  name: string;
  execute: () => Promise<any>;
  compensate: (result?: any) => Promise<void>;
}

export interface SagaContext {
  orderId: string;
  amount: number;
  deliveryType: string;
  quantities?: { [productId: string]: number };
  userId: string;
  sessionId: string;
}

export class DeliveryTransactionSaga {
  private steps: SagaStep[] = [];
  private executedSteps: { step: SagaStep; result: any }[] = [];
  private context: SagaContext;

  constructor(context: SagaContext) {
    this.context = context;
  }

  // ステップ1: 重複検出レコード作成
  addDuplicateDetectionStep(duplicateCheckData: DuplicateDetectionData) {
    this.steps.push({
      name: 'duplicate-detection',
      execute: async () => {
        // 重複検出処理は既にDuplicateDetectionServiceで実行済み
        return { recorded: true };
      },
      compensate: async () => {
        // 重複検出レコードを削除（セッション無効化）
        await supabase
          .from('duplicate_detection_records')
          .update({ expires_at: new Date().toISOString() })
          .eq('session_id', duplicateCheckData.sessionId);
      }
    });
  }

  // ステップ2: 分納記録作成
  addTransactionCreationStep(transactionData: {
    transactionId: string;
    parentOrderId: string;
    amount: number;
    partnerId?: number;
    installmentNo: number;
  }) {
    this.steps.push({
      name: 'transaction-creation',
      execute: async () => {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            id: transactionData.transactionId,
            transaction_type: 'purchase',
            transaction_no: `DEL-${Date.now()}-${transactionData.installmentNo}`,
            parent_order_id: transactionData.parentOrderId,
            partner_id: transactionData.partnerId,
            transaction_date: new Date().toISOString().split('T')[0],
            status: 'confirmed',
            total_amount: transactionData.amount,
            installment_no: transactionData.installmentNo,
            memo: `第${transactionData.installmentNo}回分納`,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      compensate: async (result) => {
        if (result?.id) {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', result.id);
        }
      }
    });
  }

  // ステップ3: 在庫更新
  addInventoryUpdateStep(inventoryUpdates: { productId: string; quantity: number; unitPrice: number }[]) {
    this.steps.push({
      name: 'inventory-update',
      execute: async () => {
        const results = [];
        const originalStocks = [];

        for (const update of inventoryUpdates) {
          // 現在の在庫を保存（ロールバック用）
          const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', update.productId)
            .single();

          if (fetchError) throw fetchError;
          originalStocks.push({ productId: update.productId, originalStock: currentProduct.current_stock });

          // 在庫更新
          const { data, error } = await supabase
            .from('products')
            .update({ current_stock: (currentProduct.current_stock || 0) + update.quantity })
            .eq('id', update.productId)
            .select()
            .single();

          if (error) throw error;
          results.push(data);
        }

        return { results, originalStocks };
      },
      compensate: async (result) => {
        if (result?.originalStocks) {
          for (const { productId, originalStock } of result.originalStocks) {
            await supabase
              .from('products')
              .update({ current_stock: originalStock })
              .eq('id', productId);
          }
        }
      }
    });
  }

  // ステップ4: 在庫移動履歴記録
  addInventoryMovementStep(movements: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    transactionId: string;
    installmentNo: number;
  }[]) {
    this.steps.push({
      name: 'inventory-movement',
      execute: async () => {
        const movementRecords = movements.map(movement => ({
          id: movement.id,
          product_id: movement.productId,
          movement_type: 'in',
          quantity: movement.quantity,
          unit_price: movement.unitPrice,
          total_amount: movement.quantity * movement.unitPrice,
          transaction_id: movement.transactionId,
          installment_no: movement.installmentNo,
          memo: `第${movement.installmentNo}回分納入庫`,
          created_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
          .from('inventory_movements')
          .insert(movementRecords)
          .select();

        if (error) throw error;
        return data;
      },
      compensate: async (result) => {
        if (result && Array.isArray(result)) {
          const movementIds = result.map(r => r.id);
          await supabase
            .from('inventory_movements')
            .delete()
            .in('id', movementIds);
        }
      }
    });
  }

  // Saga実行
  async execute(): Promise<{ success: boolean; result?: any; error?: string }> {
    try {

      for (const step of this.steps) {
        try {
          const result = await step.execute();
          this.executedSteps.push({ step, result });
        } catch (stepError) {
          console.error(`❌ ステップ失敗: ${step.name}`, stepError);

          // 実行済みステップを逆順でロールバック
          await this.rollback();

          throw new Error(`Sagaステップ '${step.name}' で失敗: ${stepError instanceof Error ? stepError.message : '不明なエラー'}`);
        }
      }

      return { success: true, result: this.executedSteps };

    } catch (error) {
      console.error('💥 DeliveryTransactionSaga失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  // ロールバック実行
  private async rollback(): Promise<void> {

    // 実行済みステップを逆順で補償
    for (let i = this.executedSteps.length - 1; i >= 0; i--) {
      const { step, result } = this.executedSteps[i];

      try {
        await step.compensate(result);
      } catch (compensateError) {
        console.error(`❌ 補償失敗: ${step.name}`, compensateError);
        // 補償失敗でもロールバック処理は継続
      }
    }

    this.executedSteps = [];
  }
}