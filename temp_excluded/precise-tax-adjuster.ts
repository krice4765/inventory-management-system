// 精密税込調整システム
import { supabase } from '../lib/supabase';

// 1.1倍税込問題の精密修正
export const adjustTaxPrecisely = async (orderNo: string) => {

  try {
    // 発注書データ取得
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError || !order) {
      console.error(`❌ 発注書取得失敗:`, orderError);
      return { status: 'error' };
    }

    // 分納データ取得
    const { data: installments, error: instError } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_order_id', order.id)
      .not('installment_no', 'is', null);

    if (instError || !installments || installments.length === 0) {
      console.error(`❌ 分納データ取得失敗:`, instError);
      return { status: 'error' };
    }

    const totalDelivered = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
    const difference = totalDelivered - order.total_amount;
    const ratio = totalDelivered / order.total_amount;


    // 1.1倍問題の確認
    if (Math.abs(ratio - 1.1) > 0.01) {
      return { status: 'not_applicable' };
    }


    // 分納額を発注額に合わせて調整
    const targetTotal = order.total_amount;
    const currentTotal = totalDelivered;
    const adjustmentFactor = targetTotal / currentTotal;


    let adjustedTotal = 0;

    for (const installment of installments) {
      const newAmount = Math.round(installment.total_amount * adjustmentFactor);

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ total_amount: newAmount })
        .eq('id', installment.id);

      if (updateError) {
        console.error(`❌ 分納${installment.installment_no}更新失敗:`, updateError);
        return { status: 'error', error: updateError.message };
      }

      adjustedTotal += newAmount;
    }

    const finalDifference = adjustedTotal - order.total_amount;


    const success = Math.abs(finalDifference) < 1;

    if (success) {
    } else {
    }


    return {
      status: 'completed',
      success,
      beforeAmount: currentTotal,
      afterAmount: adjustedTotal,
      difference: finalDifference,
      reductionAmount: difference - finalDifference
    };

  } catch (error) {
    console.error(`❌ 精密調整エラー (${orderNo}):`, error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// グローバル関数として公開
declare global {
  interface Window {
    adjustTaxPrecisely: typeof adjustTaxPrecisely;
  }
}

if (typeof window !== 'undefined') {
  window.adjustTaxPrecisely = adjustTaxPrecisely;
}