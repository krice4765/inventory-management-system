import { supabase } from '../lib/supabase'

// 開発環境でブラウザコンソールから使用できるように
if (typeof window !== 'undefined') {
  (window as any).fixInstallmentData = {
    // PO250917015の分納番号修正: fixInstallmentData.fixOrder('PO250917015')
    fixOrder: async (orderNo: string) => {
      const { data: order, error } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('order_no', orderNo)
        .single();

      if (error || !order) {
        console.error('発注書が見つかりません:', orderNo);
        return;
      }

      return await InstallmentDataFixer.fixInstallmentNumbers(order.id);
    },

    // 全発注書修正: fixInstallmentData.fixAll()
    fixAll: () => InstallmentDataFixer.fixAllInstallmentNumbers(),

    // データ確認: fixInstallmentData.check('PO250917015')
    check: async (orderNo: string) => {
      const { data: order, error } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('order_no', orderNo)
        .single();

      if (error || !order) {
        console.error('発注書が見つかりません:', orderNo);
        return;
      }

      return await InstallmentDataFixer.checkInstallmentData(order.id);
    }
  };
}

/**
 * 既存の分納データを修正する管理機能
 * 注意: この機能は管理者のみが使用すること
 */
export class InstallmentDataFixer {

  /**
   * 特定の発注書の分納番号を修正
   */
  static async fixInstallmentNumbers(orderId: string) {
    console.log('🔧 分納番号修正開始:', orderId);

    try {
      // 既存の分納取得（時系列順）
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('id, installment_no, memo, created_at')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      if (!transactions || transactions.length === 0) {
        console.log('📝 修正対象の分納がありません');
        return { success: true, message: '修正対象なし' };
      }

      console.log('📊 修正前データ:', transactions);

      // 各分納の番号を正しい順序で更新
      const updates = transactions.map((transaction, index) => {
        const correctNumber = index + 1;
        return supabase
          .from('transactions')
          .update({
            installment_no: correctNumber,
            delivery_sequence: correctNumber,
            memo: transaction.memo?.includes('分納')
              ? `第${correctNumber}回`
              : transaction.memo
          })
          .eq('id', transaction.id);
      });

      // 全て並行実行
      const results = await Promise.all(updates);

      // エラーチェック
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('❌ 更新エラー:', errors);
        throw new Error(`${errors.length}件の更新に失敗`);
      }

      console.log('✅ 分納番号修正完了:', orderId);
      return {
        success: true,
        message: `${transactions.length}件の分納番号を修正しました`,
        fixed: transactions.length
      };

    } catch (error) {
      console.error('❌ 分納番号修正エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  /**
   * 全発注書の分納番号を一括修正
   * 注意: 大量データの場合は時間がかかる
   */
  static async fixAllInstallmentNumbers() {
    console.log('🔧 全分納番号一括修正開始');

    try {
      // 分納がある発注書を取得
      const { data: orders, error: ordersError } = await supabase
        .from('transactions')
        .select('parent_order_id')
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .not('parent_order_id', 'is', null);

      if (ordersError) throw ordersError;

      const uniqueOrderIds = [...new Set(orders?.map(o => o.parent_order_id))];
      console.log('📋 修正対象発注書数:', uniqueOrderIds.length);

      let successCount = 0;
      let errorCount = 0;

      // 各発注書を順次修正
      for (const orderId of uniqueOrderIds) {
        const result = await this.fixInstallmentNumbers(orderId);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error('❌ 発注書修正失敗:', orderId, result.error);
        }
      }

      console.log('✅ 一括修正完了:', { successCount, errorCount });
      return {
        success: true,
        message: `${successCount}件修正、${errorCount}件エラー`,
        successCount,
        errorCount
      };

    } catch (error) {
      console.error('❌ 一括修正エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  /**
   * 修正確認用：発注書の分納状況確認
   */
  static async checkInstallmentData(orderId: string) {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('installment_no, delivery_sequence, memo, total_amount, created_at')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .order('installment_no', { ascending: true });

      if (error) throw error;

      console.log('📊 分納データ確認:', orderId, transactions);
      return { success: true, data: transactions };
    } catch (error) {
      console.error('❌ データ確認エラー:', error);
      return { success: false, error };
    }
  }
}