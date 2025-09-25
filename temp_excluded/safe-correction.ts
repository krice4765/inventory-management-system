// より安全な分納修正ツール
import { supabase } from '../lib/supabase';

export const safeTaxAdjustment = async () => {

  try {
    // Step 1: 発注書を少しずつ確認

    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10); // まず10件のみ

    if (ordersError) {
      console.error('❌ 発注書取得エラー:', ordersError);
      return;
    }


    if (!orders || orders.length === 0) {
      return;
    }

    // Step 2: 各発注書の分納を個別に確認

    const adjustmentCandidates: Array<{
      id: string;
      orderNo: string;
      currentAmount: number;
      deliveredAmount: number;
      ratio: number;
      suggestedAmount: number;
    }> = [];

    for (const order of orders) {

      const { data: installments, error: installmentsError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (installmentsError) {
        console.error(`    ❌ 分納取得エラー: ${order.order_no}`, installmentsError);
        continue;
      }

      if (!installments || installments.length === 0) {
        continue;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;


      // 税込調整候補の判定
      if (ratio >= 1.08 && ratio <= 1.12) {
        const suggestedAmount = Math.round(order.total_amount * 1.1);
        const diffFromSuggested = Math.abs(deliveredTotal - suggestedAmount);

        if (diffFromSuggested < 1000) { // 1000円以内の差

          adjustmentCandidates.push({
            id: order.id,
            orderNo: order.order_no,
            currentAmount: order.total_amount,
            deliveredAmount: deliveredTotal,
            ratio,
            suggestedAmount
          });
        }
      }
    }


    if (adjustmentCandidates.length === 0) {
      return { status: 'no_candidates', checked: orders.length };
    }

    // Step 3: 調整候補の詳細表示
    adjustmentCandidates.forEach((candidate, index) => {
    });

    return {
      status: 'candidates_found',
      candidates: adjustmentCandidates,
      checked: orders.length
    };

  } catch (error) {
    console.error('❌ 安全調整エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 実際の調整実行（確認後）
export const executeApprovedAdjustments = async (candidates: Array<{id: string, orderNo: string, suggestedAmount: number}>) => {

  let successCount = 0;
  let errorCount = 0;

  for (const candidate of candidates) {

    const { error } = await supabase
      .from('purchase_orders')
      .update({
        total_amount: candidate.suggestedAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', candidate.id);

    if (error) {
      console.error(`    ❌ 調整失敗: ${candidate.orderNo}`, error.message);
      errorCount++;
    } else {
      successCount++;
    }
  }


  return { successCount, errorCount };
};

// 簡単な整合性確認
export const quickIntegrityCheck = async () => {

  try {
    const { data: recentOrders, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        total_amount,
        transactions!left(
          total_amount,
          installment_no
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ チェックエラー:', error);
      return;
    }

    if (!recentOrders) {
      return;
    }


    let perfect = 0;
    let minor = 0;
    let major = 0;

    recentOrders.forEach(order => {
      const installments = order.transactions || [];
      const deliveredTotal = installments.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);
      const difference = Math.abs(order.total_amount - deliveredTotal);

      let status = '';
      if (difference < 1) {
        status = '✅ 完全一致';
        perfect++;
      } else if (difference <= 100) {
        status = '⚠️ 軽微な差額';
        minor++;
      } else {
        status = '❌ 大きな差額';
        major++;
      }

    });

    const total = perfect + minor + major;
    const healthRate = Math.round(((perfect + minor) / total) * 100);


    return { perfect, minor, major, healthRate };

  } catch (error) {
    console.error('❌ チェックエラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    safeTaxAdjustment: typeof safeTaxAdjustment;
    executeApprovedAdjustments: typeof executeApprovedAdjustments;
    quickIntegrityCheck: typeof quickIntegrityCheck;
  }
}

if (typeof window !== 'undefined') {
  window.safeTaxAdjustment = safeTaxAdjustment;
  window.executeApprovedAdjustments = executeApprovedAdjustments;
  window.quickIntegrityCheck = quickIntegrityCheck;
}