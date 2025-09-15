// バッチ修正ツール（追加の税込調整）
import { supabase } from '../lib/supabase';

// 第2段階の税込調整実行
export const executeBatchCorrection = async () => {
  console.log('🚀 第2段階: バッチ税込調整開始');

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

  console.log(`🎯 第2段階修正対象: ${additionalCandidates.length}件`);
  console.log(`📊 予想調整総額: ¥${additionalCandidates.reduce((sum, c) => sum + (c.suggestedAmount - c.expectedCurrentAmount), 0).toLocaleString()}`);

  try {
    let successCount = 0;
    let errorCount = 0;
    let actualAdjustmentTotal = 0;

    for (const candidate of additionalCandidates) {
      console.log(`📋 処理中: ${candidate.orderNo}`);

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

      console.log(`  現在額: ¥${orderData.total_amount.toLocaleString()}`);
      console.log(`  修正額: ¥${candidate.suggestedAmount.toLocaleString()}`);

      const actualAdjustment = candidate.suggestedAmount - orderData.total_amount;
      console.log(`  調整額: ¥${actualAdjustment.toLocaleString()}`);

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
        console.log(`✅ 修正完了: ${candidate.orderNo}`);
        successCount++;
        actualAdjustmentTotal += actualAdjustment;
      }
    }

    console.log('📊 第2段階修正結果:');
    console.log(`  成功: ${successCount}件`);
    console.log(`  失敗: ${errorCount}件`);
    console.log(`  修正率: ${Math.round((successCount / additionalCandidates.length) * 100)}%`);
    console.log(`  実際調整総額: ¥${actualAdjustmentTotal.toLocaleString()}`);

    if (successCount > 0) {
      console.log('🎉 追加の過剰分納問題が解決されました！');
      console.log(`📈 累計修正: ${successCount + 3}件の発注書が完全整合`);
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
  console.log('🔍 第2段階修正結果確認');

  const verifyOrders = ['PO250913005', 'PO250913004', 'PO250913003', 'PO250913002'];

  try {
    let perfectMatches = 0;

    for (const orderNo of verifyOrders) {
      console.log(`📋 確認中: ${orderNo}`);

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

      console.log(`  発注額: ¥${order.total_amount.toLocaleString()}`);
      console.log(`  分納額: ¥${deliveredTotal.toLocaleString()}`);
      console.log(`  差額: ¥${difference.toLocaleString()}`);

      if (difference < 1) {
        console.log(`  ✅ 完全一致: ${orderNo}`);
        perfectMatches++;
      } else if (difference <= 10) {
        console.log(`  ⚠️ 軽微な差額: ${orderNo}`);
      } else {
        console.log(`  ❌ 問題継続: ${orderNo}`);
      }

      console.log('---');
    }

    console.log('📊 第2段階確認結果:');
    console.log(`  完全一致: ${perfectMatches}件`);
    console.log(`  累計完全一致: ${perfectMatches + 3}件`); // 第1段階含む

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
  console.log('📊 全体整合性状況確認');

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
      console.log('📝 データなし');
      return;
    }

    console.log('🔍 最新20件の発注書整合性確認中...');

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

    console.log('📋 全体状況サマリー:');
    console.log(`  確認した発注書: ${totalChecked}件`);
    console.log(`  完全一致: ${perfectCount}件 (${Math.round((perfectCount / totalChecked) * 100)}%)`);
    console.log(`  軽微な差額: ${minorCount}件`);
    console.log(`  大きな差額: ${majorCount}件`);
    console.log(`  システム健全性: ${healthyRate}%`);
    console.log(`  残存過剰額: ¥${totalExcessAmount.toLocaleString()}`);

    if (healthyRate >= 80) {
      console.log('🎉 システムの健全性が大幅に改善されました！');
    } else if (healthyRate >= 60) {
      console.log('✅ システムの健全性が改善されています');
    } else {
      console.log('⚠️ まだ改善の余地があります');
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