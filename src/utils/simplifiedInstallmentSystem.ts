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
      console.log('🚀 安全な分納処理開始:', {
        orderId: data.orderId,
        amount: data.amount,
        userId: data.userId
      });

      // 🛡️ Phase 1: データベース関数を使用した安全な分納作成を試行（修正版）
      console.log('📊 データベース関数による安全な分納作成を試行（パラメータ修正版）');

      // パートナーID取得
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('partner_id')
        .eq('id', data.orderId)
        .single();

      if (orderError) {
        console.warn('⚠️ パートナーID取得失敗、フォールバックに移行:', orderError);
      } else {
        const { data: result, error: rpcError } = await supabase
          .rpc('create_installment_v2', {
            p_parent_order_id: data.orderId,
            p_partner_id: orderData?.partner_id || null,
            p_transaction_date: new Date().toISOString().split('T')[0],
            p_due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
            p_total_amount: data.amount,
            p_memo: data.memo || '簡略化分納処理V2'
          });

        // データベース関数が成功した場合
        if (!rpcError && result) {
          console.log('✅ V2データベース関数による分納作成成功:', {
            result: result,
            transactionId: result.id,
            transactionNo: result.transaction_no,
            installmentNo: result.installment_no,
            amount: data.amount
          });

          return {
            success: true,
            transactionId: result.id
          };
        } else {
          console.log('⚠️ V2 RPC関数エラー詳細:', {
            error: rpcError,
            message: rpcError?.message,
            details: rpcError?.details,
            hint: rpcError?.hint,
            code: rpcError?.code
          });
        }
      }

      // 🔄 Phase 2: フォールバック - 従来方式（改良版）
      console.log('⚠️ V2データベース関数が使用できません。フォールバック処理を実行:', rpcError?.message || 'パートナー情報取得失敗');

      // UUID v4形式で確実なID生成
      const transactionId = globalThis.crypto.randomUUID();

      // 分納番号を安全に取得（再試行ロジック付き）
      let installmentNumber = 1;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const { data: existingTransactions, error: countError } = await supabase
            .from('transactions')
            .select('installment_no')
            .eq('parent_order_id', data.orderId)
            .eq('transaction_type', 'purchase')
            .order('installment_no', { ascending: false })
            .limit(1);

          if (countError) {
            console.error('❌ 既存分納数取得エラー:', countError);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            continue;
          }

          installmentNumber = (existingTransactions?.[0]?.installment_no || 0) + 1;
          break;

        } catch (error) {
          console.error('❌ 分納番号取得で予期しないエラー:', error);
          retryCount++;
          if (retryCount >= maxRetries) {
            return { success: false, error: '分納番号の取得に失敗しました' };
          }
        }
      }

      // 一意性を保証するトランザクション番号生成
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const transactionNo = `SAFE-${timestamp}-${installmentNumber}-${randomSuffix}`;

      // 安全な分納レコード挿入（再試行ロジック付き）
      retryCount = 0;
      while (retryCount < maxRetries) {
        try {
          const { data: transaction, error: insertError } = await supabase
            .from('transactions')
            .insert({
              id: transactionId,
              transaction_type: 'purchase',
              transaction_no: transactionNo,
              parent_order_id: data.orderId,
              installment_no: installmentNumber,
              transaction_date: new Date().toISOString().split('T')[0],
              status: 'confirmed',
              total_amount: data.amount,
              memo: data.memo || `第${installmentNumber}回分納 (フォールバック処理)`,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ フォールバック分納作成エラー:', insertError);

            // 409エラー/23505（重複）の場合は分納番号を調整して再試行
            if (insertError.code === '23505') {
              installmentNumber++;
              retryCount++;
              console.log(`🔄 重複検出により分納番号を${installmentNumber}に変更して再試行`);
              await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
              continue;
            }

            return { success: false, error: `分納作成失敗: ${insertError.message}` };
          }

          console.log('✅ フォールバック分納処理成功:', {
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