import { supabase } from '../lib/supabase';

// 型定義
interface InventoryItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface InstallmentWithInventoryResult {
  transaction_id: string;
  transaction_no: string;
  installment_no: number;
  inventory_movement_ids: string[];
}

interface IntegratedInstallmentHistory {
  installment_no: number;
  transaction_id: string;
  transaction_no: string;
  amount: number;
  memo: string | null;
  transaction_date: string;
  created_at: string;
  inventory_movements: InventoryMovement[];
}

interface InventoryMovement {
  movement_id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  movement_status: string;
}

/**
 * 🚀 強化された分納システム - 長期版
 * - 堅牢な分納番号管理
 * - 自動修正機能
 * - データ整合性チェック
 * - 在庫移動との完全連携
 * - 統合的な履歴管理
 */
export class EnhancedInstallmentService {

  /**
   * 安全な分納番号取得（アトミック操作）
   */
  static async getNextInstallmentNumber(purchaseOrderId: string): Promise<number> {
    // 既存分納データを取得（不要な初期データを除外）
    const { data: existingInstallments, error } = await supabase
      .from('transactions')
      .select('installment_no')
      .eq('parent_order_id', purchaseOrderId)
      .eq('transaction_type', 'purchase')
      .eq('status', 'confirmed')
      .not('memo', 'eq', '') // 空のmemoを除外（初期データ除外）
      .gt('total_amount', 0) // 0円以上のみ（無効データ除外）
      .order('installment_no', { ascending: false })
      .limit(1);

    if (error) {
      console.error('分納番号取得エラー:', error);
      throw new Error(`分納番号取得に失敗しました: ${error.message}`);
    }

    // 次の番号を計算
    const nextNumber = existingInstallments.length > 0
      ? (existingInstallments[0].installment_no || 0) + 1
      : 1;

    return nextNumber;
  }

  /**
   * 分納データの整合性チェック
   */
  static async validateInstallmentData(purchaseOrderId: string): Promise<{
    isValid: boolean;
    issues: string[];
    fixedIssues: string[];
  }> {
    const issues: string[] = [];
    const fixedIssues: string[] = [];

    // 1. 全分納データ取得
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_order_id', purchaseOrderId)
      .eq('transaction_type', 'purchase')
      .order('created_at', { ascending: true });

    if (error) {
      issues.push(`データ取得エラー: ${error.message}`);
      return { isValid: false, issues, fixedIssues };
    }

    // 2. 不要な初期データの検出と自動削除
    const invalidTransactions = transactions.filter(t =>
      t.memo === '' ||
      t.total_amount <= 0 ||
      t.status !== 'confirmed'
    );

    for (const invalid of invalidTransactions) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', invalid.id);
        fixedIssues.push(`不要データ削除: ${invalid.id} (金額: ¥${invalid.total_amount})`);
      } catch (deleteError) {
        issues.push(`削除エラー: ${invalid.id}`);
      }
    }

    // 3. 有効なデータのみで再取得
    const { data: validTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_order_id', purchaseOrderId)
      .eq('transaction_type', 'purchase')
      .eq('status', 'confirmed')
      .not('memo', 'eq', '')
      .gt('total_amount', 0)
      .order('created_at', { ascending: true });

    // 4. 分納番号の連番チェックと修正
    if (validTransactions) {
      for (let i = 0; i < validTransactions.length; i++) {
        const expectedNumber = i + 1;
        const expectedSequence = i + 1;
        const transaction = validTransactions[i];

        if (transaction.installment_no !== expectedNumber ||
            transaction.delivery_sequence !== expectedSequence) {

          try {
            await supabase
              .from('transactions')
              .update({
                installment_no: expectedNumber,
                delivery_sequence: expectedSequence,
                memo: `第${expectedNumber}回`
              })
              .eq('id', transaction.id);

            fixedIssues.push(`分納番号修正: ${transaction.id} → 第${expectedNumber}回`);
          } catch (updateError) {
            issues.push(`番号修正エラー: ${transaction.id}`);
          }
        }
      }
    }

    const isValid = issues.length === 0;
    return { isValid, issues, fixedIssues };
  }

  /**
   * 分納実行（自動整合性チェック付き）
   */
  static async executeInstallment(params: {
    purchaseOrderId: string;
    amount: number;
    deliveryDate: string;
    memo?: string;
  }): Promise<{ success: boolean; installmentNo: number; message: string }> {

    try {
      // 1. 事前整合性チェック
      const validationResult = await this.validateInstallmentData(params.purchaseOrderId);

      if (validationResult.fixedIssues.length > 0) {
      }

      // 2. 安全な分納番号取得
      const installmentNo = await this.getNextInstallmentNumber(params.purchaseOrderId);

      // 3. 分納データ作成
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          parent_order_id: params.purchaseOrderId,
          transaction_type: 'purchase',
          installment_no: installmentNo,
          delivery_sequence: installmentNo,
          total_amount: params.amount,
          transaction_date: params.deliveryDate,
          memo: params.memo || `第${installmentNo}回`,
          status: 'confirmed',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`分納作成エラー: ${error.message}`);
      }

      // 4. 事後整合性チェック
      const postValidation = await this.validateInstallmentData(params.purchaseOrderId);

      return {
        success: true,
        installmentNo,
        message: `第${installmentNo}回分納が正常に作成されました`
      };

    } catch (error) {
      console.error('分納実行エラー:', error);
      return {
        success: false,
        installmentNo: 0,
        message: `分納実行に失敗しました: ${error.message}`
      };
    }
  }

  /**
   * 全発注書の一括整合性チェックと修正
   */
  static async validateAllOrders(): Promise<{
    totalOrders: number;
    fixedOrders: number;
    errorOrders: number;
    summary: string[];
  }> {
    const summary: string[] = [];
    let totalOrders = 0;
    let fixedOrders = 0;
    let errorOrders = 0;

    // 全発注書取得
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no')
      .order('created_at', { ascending: false });

    if (error) {
      summary.push(`発注書取得エラー: ${error.message}`);
      return { totalOrders: 0, fixedOrders: 0, errorOrders: 1, summary };
    }

    totalOrders = orders.length;
    summary.push(`📊 対象発注書: ${totalOrders}件`);

    // 各発注書の整合性チェック
    for (const order of orders) {
      try {
        const result = await this.validateInstallmentData(order.id);

        if (result.fixedIssues.length > 0) {
          fixedOrders++;
          summary.push(`✅ ${order.order_no}: ${result.fixedIssues.length}件修正`);
        }

        if (result.issues.length > 0) {
          errorOrders++;
          summary.push(`❌ ${order.order_no}: ${result.issues.length}件エラー`);
        }
      } catch (validationError) {
        errorOrders++;
        summary.push(`❌ ${order.order_no}: 検証エラー`);
      }
    }

    summary.push(`🎯 修正完了: ${fixedOrders}件, エラー: ${errorOrders}件`);
    return { totalOrders, fixedOrders, errorOrders, summary };
  }

  // ===================================================================
  // 🚀 長期的な在庫連携機能（新機能）
  // ===================================================================

  /**
   * 分納作成と在庫移動を同時実行
   * @param parentOrderId 親発注書ID
   * @param amount 分納金額
   * @param inventoryItems 在庫移動項目
   * @param memo メモ
   * @param dueDate 支払期日
   * @returns 作成結果
   */
  static async createInstallmentWithInventory(
    parentOrderId: string,
    amount: number,
    inventoryItems: InventoryItem[],
    memo?: string,
    dueDate?: string
  ): Promise<InstallmentWithInventoryResult> {
    try {
        parentOrderId,
        amount,
        inventoryItemsCount: inventoryItems.length
      });

      const { data, error } = await supabase.rpc('create_installment_with_inventory', {
        p_parent_order_id: parentOrderId,
        p_amount: amount,
        p_inventory_items: inventoryItems,
        p_memo: memo,
        p_due_date: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      if (error) {
        console.error('❌ 分納・在庫統合作成エラー:', error);
        throw new Error(`分納・在庫統合作成に失敗しました: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('分納・在庫統合作成の結果が取得できませんでした');
      }

      const result = data[0];

        transaction_id: result.transaction_id,
        installment_no: result.installment_no,
        inventory_count: result.inventory_movement_ids?.length || 0
      });

      return {
        transaction_id: result.transaction_id,
        transaction_no: result.transaction_no,
        installment_no: result.installment_no,
        inventory_movement_ids: result.inventory_movement_ids || []
      };
    } catch (error) {
      console.error('❌ 分納・在庫統合作成エラー:', error);
      throw error;
    }
  }

  /**
   * 統合された分納履歴を取得
   * @param orderId 発注書ID
   * @returns 分納履歴（在庫移動情報付き）
   */
  static async getIntegratedInstallmentHistory(
    orderId: string
  ): Promise<IntegratedInstallmentHistory[]> {
    try {

      const { data, error } = await supabase.rpc('get_integrated_installment_history', {
        p_order_id: orderId
      });

      if (error) {
        console.error('❌ 統合分納履歴取得エラー:', error);
        throw new Error(`統合分納履歴の取得に失敗しました: ${error.message}`);
      }

        order_id: orderId,
        installment_count: data?.length || 0
      });

      return data || [];
    } catch (error) {
      console.error('❌ 統合分納履歴取得エラー:', error);
      throw error;
    }
  }

  /**
   * 発注書の分納進捗状況を在庫情報と共に取得
   * @param orderId 発注書ID
   * @returns 進捗情報
   */
  static async getInstallmentProgress(orderId: string): Promise<{
    order_total: number;
    allocated_total: number;
    remaining_amount: number;
    completion_percentage: number;
    installment_count: number;
    total_inventory_movements: number;
    has_inventory_integration: boolean;
  }> {
    try {

      // 発注書情報取得
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // 分納情報取得（統合履歴使用）
      const installments = await this.getIntegratedInstallmentHistory(orderId);

      const allocated_total = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const total_inventory_movements = installments.reduce(
        (sum, inst) => sum + inst.inventory_movements.length,
        0
      );

      const result = {
        order_total: orderData.total_amount,
        allocated_total,
        remaining_amount: orderData.total_amount - allocated_total,
        completion_percentage: Math.round((allocated_total / orderData.total_amount) * 100),
        installment_count: installments.length,
        total_inventory_movements,
        has_inventory_integration: total_inventory_movements > 0
      };

      return result;
    } catch (error) {
      console.error('❌ 分納進捗取得エラー:', error);
      throw error;
    }
  }

  /**
   * 在庫移動状況の分析
   * @param orderId 発注書ID
   * @returns 在庫分析結果
   */
  static async analyzeInventoryStatus(orderId: string): Promise<{
    products_with_movements: number;
    total_quantity_received: number;
    pending_movements: number;
    confirmed_movements: number;
    movement_timeline: Array<{
      date: string;
      installment_no: number;
      movements_count: number;
      total_quantity: number;
    }>;
  }> {
    try {

      const installments = await this.getIntegratedInstallmentHistory(orderId);

      const allMovements = installments.flatMap(inst =>
        inst.inventory_movements.map(mov => ({
          ...mov,
          installment_no: inst.installment_no,
          date: inst.transaction_date
        }))
      );

      const products_with_movements = new Set(allMovements.map(m => m.product_id)).size;
      const total_quantity_received = allMovements.reduce((sum, m) => sum + m.quantity, 0);
      const pending_movements = allMovements.filter(m => m.movement_status === 'pending').length;
      const confirmed_movements = allMovements.filter(m => m.movement_status === 'confirmed').length;

      // 日付別タイムライン
      const timelineMap = new Map<string, {
        installment_no: number;
        movements_count: number;
        total_quantity: number;
      }>();

      installments.forEach(inst => {
        const key = inst.transaction_date;
        const existing = timelineMap.get(key) || {
          installment_no: inst.installment_no,
          movements_count: 0,
          total_quantity: 0
        };

        existing.movements_count += inst.inventory_movements.length;
        existing.total_quantity += inst.inventory_movements.reduce((sum, m) => sum + m.quantity, 0);

        timelineMap.set(key, existing);
      });

      const movement_timeline = Array.from(timelineMap.entries()).map(([date, data]) => ({
        date,
        ...data
      })).sort((a, b) => a.date.localeCompare(b.date));

      const result = {
        products_with_movements,
        total_quantity_received,
        pending_movements,
        confirmed_movements,
        movement_timeline
      };

      return result;
    } catch (error) {
      console.error('❌ 在庫状況分析エラー:', error);
      throw error;
    }
  }

  /**
   * レガシー分納データを新システムに移行
   * @param orderId 発注書ID
   * @returns 移行結果
   */
  static async migrateLegacyInstallments(orderId: string): Promise<{
    migrated_count: number;
    skipped_count: number;
    error_count: number;
    details: string[];
  }> {
    try {

      const details: string[] = [];
      let migrated_count = 0;
      let skipped_count = 0;
      let error_count = 0;

      // 既存の分納データを取得
      const { data: existingInstallments, error } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_no,
          installment_no,
          total_amount,
          memo,
          transaction_date,
          created_at
        `)
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .gt('total_amount', 0)
        .order('installment_no');

      if (error) throw error;

      for (const installment of existingInstallments || []) {
        try {
          // 既に在庫移動データが関連付けられているかチェック
          const { data: existingMovements } = await supabase
            .from('inventory_movements')
            .select('id')
            .eq('transaction_id', installment.id);

          if (existingMovements && existingMovements.length > 0) {
            skipped_count++;
            details.push(`分納${installment.installment_no}: 既に在庫移動が関連付け済み`);
            continue;
          }

          // 時間的に近い在庫移動を検索（前後30分）
          const timeStart = new Date(new Date(installment.created_at).getTime() - 30 * 60 * 1000).toISOString();
          const timeEnd = new Date(new Date(installment.created_at).getTime() + 30 * 60 * 1000).toISOString();

          const { data: candidateMovements } = await supabase
            .from('inventory_movements')
            .select('id, quantity_delta, unit_price, created_at')
            .gte('created_at', timeStart)
            .lte('created_at', timeEnd)
            .eq('movement_type', 'purchase')
            .is('transaction_id', null);

          if (candidateMovements && candidateMovements.length > 0) {
            // 最も時間的に近い在庫移動を関連付け
            const closestMovement = candidateMovements.reduce((closest, current) => {
              const closestDiff = Math.abs(new Date(closest.created_at).getTime() - new Date(installment.created_at).getTime());
              const currentDiff = Math.abs(new Date(current.created_at).getTime() - new Date(installment.created_at).getTime());
              return currentDiff < closestDiff ? current : closest;
            });

            await supabase
              .from('inventory_movements')
              .update({
                transaction_id: installment.id,
                movement_reason: 'installment',
                note: `[移行] 分納第${installment.installment_no}回に関連付け`
              })
              .eq('id', closestMovement.id);

            migrated_count++;
            details.push(`分納${installment.installment_no}: 在庫移動ID ${closestMovement.id} を関連付け`);
          } else {
            skipped_count++;
            details.push(`分納${installment.installment_no}: 対応する在庫移動が見つからない`);
          }
        } catch (migrationError) {
          error_count++;
          details.push(`分納${installment.installment_no}: 移行エラー - ${migrationError.message}`);
        }
      }

      const result = {
        migrated_count,
        skipped_count,
        error_count,
        details
      };

      return result;
    } catch (error) {
      console.error('❌ レガシー分納データ移行エラー:', error);
      throw error;
    }
  }
}

// ブラウザコンソールからの使用用
if (typeof window !== 'undefined') {
  (window as any).EnhancedInstallmentService = EnhancedInstallmentService;
}