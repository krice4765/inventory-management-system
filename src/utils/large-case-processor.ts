// 大型案件緊急処理システム
import { supabase } from '../lib/supabase';

// 大型案件の特定・処理システム
export const processLargeCases = async (caseIds: string[] = ['PO250911013', 'PO250911014', 'PO250911005']) => {

  const results = {
    processed: 0,
    fixed: 0,
    errors: 0,
    totalSavings: 0,
    details: [] as Array<{
      orderNo: string;
      status: 'success' | 'partial' | 'error';
      beforeAmount: number;
      afterAmount: number;
      savings: number;
      method: string;
    }>
  };

  for (const caseId of caseIds) {
    try {

      // 発注書データ取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, order_no, total_amount')
        .eq('order_no', caseId)
        .single();

      if (orderError || !order) {
        console.error(`❌ ${caseId}: 発注書取得失敗`, orderError);
        results.errors++;
        continue;
      }

      // 分納データ取得
      const { data: installments, error: instError } = await supabase
        .from('transactions')
        .select('id, total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (instError) {
        console.error(`❌ ${caseId}: 分納データ取得失敗`, instError);
        results.errors++;
        continue;
      }

      if (!installments || installments.length === 0) {
        continue;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = deliveredTotal - order.total_amount;
      const ratio = deliveredTotal / order.total_amount;


      const processResult = {
        orderNo: caseId,
        status: 'error' as const,
        beforeAmount: difference,
        afterAmount: difference,
        savings: 0,
        method: 'none'
      };

      // 処理方法の決定と実行
      if (Math.abs(difference) < 1) {
        processResult.status = 'success';
        processResult.method = 'already_perfect';
      } else if (order.total_amount === 0) {
        processResult.status = 'partial';
        processResult.method = 'needs_investigation';
      } else if (ratio > 1.12 && ratio < 2.5) {
        // 比例削減による修正

        const targetTotal = order.total_amount;
        const reductionFactor = targetTotal / deliveredTotal;


        for (const installment of installments) {
          const newAmount = Math.round(installment.total_amount * reductionFactor);

          const { error: updateError } = await supabase
            .from('transactions')
            .update({ total_amount: newAmount })
            .eq('id', installment.id);

          if (updateError) {
            console.error(`❌ ${caseId}: 分納${installment.installment_no}更新失敗`, updateError);
            throw updateError;
          }

        }

        const newDeliveredTotal = installments.reduce((sum, inst) => sum + Math.round(inst.total_amount * reductionFactor), 0);
        const newDifference = newDeliveredTotal - order.total_amount;


        processResult.status = Math.abs(newDifference) < 100 ? 'success' : 'partial';
        processResult.afterAmount = newDifference;
        processResult.savings = difference - newDifference;
        processResult.method = 'proportional_reduction';

      } else {
        processResult.status = 'partial';
        processResult.method = 'needs_custom_analysis';
      }

      results.details.push(processResult);
      results.processed++;

      if (processResult.status === 'success') {
        results.fixed++;
        results.totalSavings += processResult.savings;
      }

    } catch (error) {
      console.error(`❌ ${caseId}: 処理中エラー`, error);
      results.errors++;
    }
  }


  results.details.forEach((detail, index) => {
    const statusIcon = detail.status === 'success' ? '✅' : detail.status === 'partial' ? '⚠️' : '❌';
  });

  return results;
};

// 残存案件の分類分析
export const classifyRemainingIssues = async () => {

  try {
    // 最新30件の発注書を取得して分析
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount')
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error || !orders) {
      console.error('❌ データ取得エラー:', error);
      return { status: 'error' };
    }

    const classification = {
      perfect: [] as string[],
      taxAdjustment: [] as string[],
      proportionalReduction: [] as string[],
      zeroAmount: [] as string[],
      complex: [] as string[]
    };

    for (const order of orders) {
      // 分納データ取得
      const { data: installments } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (!installments || installments.length === 0) {
        classification.perfect.push(order.order_no);
        continue;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = deliveredTotal - order.total_amount;
      const ratio = deliveredTotal / order.total_amount;

      if (Math.abs(difference) < 1) {
        classification.perfect.push(order.order_no);
      } else if (order.total_amount === 0) {
        classification.zeroAmount.push(order.order_no);
      } else if (ratio >= 1.05 && ratio <= 1.15) {
        classification.taxAdjustment.push(order.order_no);
      } else if (ratio > 1.15 && ratio < 3.0) {
        classification.proportionalReduction.push(order.order_no);
      } else {
        classification.complex.push(order.order_no);
      }
    }


    // 具体的な案件番号も表示
    if (classification.taxAdjustment.length > 0) {
      classification.taxAdjustment.slice(0, 5).forEach((orderNo, index) => {
      });
    }

    if (classification.proportionalReduction.length > 0) {
      classification.proportionalReduction.slice(0, 5).forEach((orderNo, index) => {
      });
    }

    return {
      status: 'completed',
      classification,
      totalIssues: orders.length - classification.perfect.length
    };

  } catch (error) {
    console.error('❌ 分類分析エラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// グローバル関数として公開
declare global {
  interface Window {
    processLargeCases: typeof processLargeCases;
    classifyRemainingIssues: typeof classifyRemainingIssues;
  }
}

if (typeof window !== 'undefined') {
  window.processLargeCases = processLargeCases;
  window.classifyRemainingIssues = classifyRemainingIssues;
}