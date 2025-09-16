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
   * 重複検出なしのシンプルな分納処理
   * 既存の重複検出システムを完全にバイパス
   */
  static async createInstallmentTransaction(data: SimplifiedInstallmentData): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      console.log('🚀 シンプル分納処理開始:', {
        orderId: data.orderId,
        amount: data.amount,
        userId: data.userId
      });

      // 1. 一意のトランザクションIDを生成（UUID形式）
      const transactionId = globalThis.crypto.randomUUID();

      // 2. 次の分納番号を取得
      const { data: existingTransactions, error: countError } = await supabase
        .from('transactions')
        .select('id')
        .eq('parent_order_id', data.orderId)
        .eq('transaction_type', 'purchase');

      if (countError) {
        console.error('❌ 既存分納数の取得エラー:', countError);
        return { success: false, error: `既存分納数の取得に失敗: ${countError.message}` };
      }

      const installmentNumber = (existingTransactions?.length || 0) + 1;

      // 3. 分納トランザクションを直接作成（重複検出なし）
      const { data: transaction, error: insertError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          transaction_type: 'purchase',
          transaction_no: `SIMPLE-${Date.now()}-${installmentNumber}`,
          parent_order_id: data.orderId,
          transaction_date: new Date().toISOString().split('T')[0],
          status: 'confirmed',
          total_amount: data.amount,
          memo: data.memo || `第${installmentNumber}回分納 (簡略化処理)`,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ 分納トランザクション作成エラー:', insertError);

        // 409エラーの場合は重複として処理
        if (insertError.code === '23505') {
          return {
            success: false,
            error: '重複した分納処理が検出されました。しばらく待ってから再試行してください。'
          };
        }

        return { success: false, error: `分納作成失敗: ${insertError.message}` };
      }

      console.log('✅ シンプル分納処理成功:', {
        transactionId: transaction.id,
        installmentNumber,
        amount: data.amount,
        transaction_no: transaction.transaction_no
      });

      return {
        success: true,
        transactionId: transaction.id
      };

    } catch (error) {
      console.error('❌ シンプル分納処理で予期しないエラー:', error);
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
          console.log('🧹 重複分納削除完了:', duplicateIds.length, '件');
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
    // 事前にクリーンアップを実行
    await SimplifiedInstallmentService.cleanupTodaysDuplicates(data.orderId);

    // シンプルな分納処理を実行
    return await SimplifiedInstallmentService.createInstallmentTransaction(data);
  };

  return {
    createInstallment,
    cleanupDuplicates: SimplifiedInstallmentService.cleanupTodaysDuplicates
  };
}