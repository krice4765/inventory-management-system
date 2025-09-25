// バッチ修正ツール（追加の税込調整）
import { supabase } from '../lib/supabase';

// 第2段階の税込調整実行
export const executeBatchCorrection = async () => {

  // expandedTaxAdjustmentで特定された追加候補
  const additionalCandidates = [
    {
      orderNo: 'PO250913005',
      expectedCurrentAmount: 2000, // 2000 * 1.1 = 2200
      suggestedAmount: 2200
    },
    {
      orderNo: 'PO250913004',
      expectedCurrentAmount: 5000, // 5000 * 1.1 = 5500
      suggestedAmount: 5500
    },
    {
      orderNo: 'PO250913003',
      expectedCurrentAmount: 37000, // 37000 * 1.1 = 40700
      suggestedAmount: 40700
    },
    {
      orderNo: 'PO250913002',
      expectedCurrentAmount: 27900, // 27900 * 1.1 = 30690
      suggestedAmount: 30690
    }
  ];


  try {
    let successCount = 0;
    let errorCount = 0;
    let actualAdjustmentTotal = 0;

    for (const candidate of additionalCandidates) {

      // IDと現在の金額を取得
      const { data: orderData, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('id, total_amount')
        .eq('order_no', candidate.orderNo)
        .single();

      if (fetchError) {
        console.error(`❌ ID取得失敗 ${candidate.orderNo}:`, fetchError);
        errorCount++;
        continue;
      }

      if (!orderData) {
        console.error(`❌ 発注書が見つかりません: ${candidate.orderNo}`);
        errorCount++;
        continue;
      }


      const actualAdjustment = candidate.suggestedAmount - orderData.total_amount;

      // 予想と実際の金額が大きく異なる場合は警告
      if (Math.abs(orderData.total_amount - candidate.expectedCurrentAmount) > 100) {
        console.warn(`⚠️ 予想金額と異なります ${candidate.orderNo}: 予想¥${candidate.expectedCurrentAmount} 実際¥${orderData.total_amount}`);
      }

      // 金額を更新
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          total_amount: candidate.suggestedAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderData.id);

      if (updateError) {
        console.error(`❌ 更新失敗 ${candidate.orderNo}:`, updateError);
        errorCount++;
      } else {
        successCount++;
        actualAdjustmentTotal += actualAdjustment;
      }
    }


    if (successCount > 0) {
    }

    return {
      status: 'completed',
      successCount,
      errorCount,
      actualAdjustmentTotal,
      cumulativeFixed: successCount + 3 // 第1段階の3件を含む
    };

  } catch (error) {
    console.error('❌ バッチ修正エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 第2段階修正結果の確認
export const verifyBatchCorrections = async () => {

  const verifyOrders = ['PO250913005', 'PO250913004', 'PO250913003', 'PO250913002'];

  try {
    let perfectMatches = 0;

    for (const orderNo of verifyOrders) {

      // 発注書情報を取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, total_amount')
        .eq('order_no', orderNo)
        .single();

      if (orderError || !order) {
        console.error(`❌ 発注書取得失敗: ${orderNo}`);
        continue;
      }

      // 分納情報を取得
      const { data: installments, error: installmentError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (installmentError) {
        console.error(`❌ 分納取得失敗: ${orderNo}`);
        continue;
      }

      const deliveredTotal = (installments || []).reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = Math.abs(order.total_amount - deliveredTotal);


      if (difference < 1) {
        perfectMatches++;
      } else if (difference <= 10) {
      } else {
      }

    }


    return {
      status: 'verified',
      perfectMatches,
      totalPerfectMatches: perfectMatches + 3
    };

  } catch (error) {
    console.error('❌ 確認エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// 全体の整合性状況確認
export const overallIntegrityStatus = async () => {

  try {
    // 最新20件の発注書を確認
    const { data: recentOrders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    if (!recentOrders) {
      return;
    }


    let perfectCount = 0;
    let minorCount = 0;
    let majorCount = 0;
    let totalExcessAmount = 0;

    for (const order of recentOrders) {
      // 分納情報を取得
      const { data: installments } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (!installments || installments.length === 0) continue;

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = deliveredTotal - order.total_amount;

      if (Math.abs(difference) < 1) {
        perfectCount++;
      } else if (Math.abs(difference) <= 100) {
        minorCount++;
      } else {
        majorCount++;
        if (difference > 0) {
          totalExcessAmount += difference;
        }
      }
    }

    const totalChecked = perfectCount + minorCount + majorCount;
    const healthyRate = Math.round(((perfectCount + minorCount) / totalChecked) * 100);


    if (healthyRate >= 80) {
    } else if (healthyRate >= 60) {
    } else {
    }

    return {
      status: 'analyzed',
      totalChecked,
      perfectCount,
      minorCount,
      majorCount,
      healthyRate,
      totalExcessAmount
    };

  } catch (error) {
    console.error('❌ 全体確認エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    executeBatchCorrection: typeof executeBatchCorrection;
    verifyBatchCorrections: typeof verifyBatchCorrections;
    overallIntegrityStatus: typeof overallIntegrityStatus;
  }
}

if (typeof window !== 'undefined') {
  window.executeBatchCorrection = executeBatchCorrection;
  window.verifyBatchCorrections = verifyBatchCorrections;
  window.overallIntegrityStatus = overallIntegrityStatus;
}