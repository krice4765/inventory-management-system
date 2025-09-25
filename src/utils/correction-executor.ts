// 分納修正実行ツール
import { supabase } from '../lib/supabase';

export const executeInstallmentCorrection = async () => {

  try {
    // Phase 1: バックアップ確認

    // まず現在の問題状況を再確認
    const { data: currentIssues } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        total_amount,
        transactions!inner(
          total_amount,
          installment_no
        )
      `)
      .not('transactions.parent_order_id', 'is', null);

    if (!currentIssues) {
      console.error('❌ データ取得失敗');
      return;
    }

    let problematicOrders = 0;
    let totalExcess = 0;
    let taxRelatedCases = 0;

    currentIssues.forEach(order => {
      const deliveredTotal = order.transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);
      const excess = deliveredTotal - order.total_amount;
      const ratio = deliveredTotal / order.total_amount;

      if (excess > 0.01) {
        problematicOrders++;
        totalExcess += excess;
        if (ratio >= 1.08 && ratio <= 1.12) {
          taxRelatedCases++;
        }
      }
    });


    if (problematicOrders === 0) {
      return { status: 'no_issues', message: '問題は検出されませんでした' };
    }

    // Phase 2: 税込調整の実行

    const taxAdjustmentCandidates = currentIssues.filter(order => {
      const deliveredTotal = order.transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;
      const diffFromTax = Math.abs(deliveredTotal - (order.total_amount * 1.1));

      return ratio >= 1.08 && ratio <= 1.12 && diffFromTax < 1000;
    });


    let taxAdjustmentSuccess = 0;

    for (const order of taxAdjustmentCandidates) {
      const newAmount = Math.round(order.total_amount * 1.1);


      const { error } = await supabase
        .from('purchase_orders')
        .update({
          total_amount: newAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) {
        console.error(`❌ 調整失敗 ${order.order_no}:`, error.message);
      } else {
        taxAdjustmentSuccess++;
      }
    }


    // Phase 3: 調整後の確認

    const { data: afterAdjustment } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        total_amount,
        transactions!inner(
          total_amount,
          installment_no
        )
      `)
      .not('transactions.parent_order_id', 'is', null);

    if (afterAdjustment) {
      let remainingIssues = 0;
      let remainingExcess = 0;

      afterAdjustment.forEach(order => {
        const deliveredTotal = order.transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);
        const excess = deliveredTotal - order.total_amount;

        if (excess > 1) { // 1円以上の差額
          remainingIssues++;
          remainingExcess += excess;
        }
      });


      if (remainingIssues === 0) {
      } else if (remainingIssues < problematicOrders / 2) {
      } else {
      }

      return {
        status: 'completed',
        beforeFix: {
          problematicOrders,
          totalExcess: Math.round(totalExcess)
        },
        afterFix: {
          problematicOrders: remainingIssues,
          totalExcess: Math.round(remainingExcess)
        },
        taxAdjustments: {
          attempted: taxAdjustmentCandidates.length,
          successful: taxAdjustmentSuccess
        },
        resolutionRate: Math.round((1 - remainingIssues / problematicOrders) * 100)
      };
    }

  } catch (error) {
    console.error('❌ 修正実行エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 修正状況の詳細確認
export const checkCorrectionStatus = async () => {

  try {
    const { data: orders } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        total_amount,
        status,
        updated_at,
        transactions!left(
          total_amount,
          installment_no
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (!orders) {
      console.error('❌ データ取得失敗');
      return;
    }


    let perfectlyAligned = 0;
    let minorDifferences = 0;
    let majorDifferences = 0;

    orders.forEach((order, index) => {
      const installments = order.transactions || [];
      const deliveredTotal = installments.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);
      const difference = Math.abs(order.total_amount - deliveredTotal);

      let status = '';
      if (difference < 1) {
        status = '✅ 完全一致';
        perfectlyAligned++;
      } else if (difference <= 100) {
        status = '⚠️ 軽微な差額';
        minorDifferences++;
      } else {
        status = '❌ 大きな差額';
        majorDifferences++;
      }

      if (index < 10) { // 上位10件詳細表示
      }
    });


    const totalChecked = perfectlyAligned + minorDifferences + majorDifferences;
    const healthyRate = Math.round(((perfectlyAligned + minorDifferences) / totalChecked) * 100);

    return {
      perfectlyAligned,
      minorDifferences,
      majorDifferences,
      healthyRate,
      totalChecked
    };

  } catch (error) {
    console.error('❌ 状況確認エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    executeInstallmentCorrection: typeof executeInstallmentCorrection;
    checkCorrectionStatus: typeof checkCorrectionStatus;
  }
}

if (typeof window !== 'undefined') {
  window.executeInstallmentCorrection = executeInstallmentCorrection;
  window.checkCorrectionStatus = checkCorrectionStatus;
}