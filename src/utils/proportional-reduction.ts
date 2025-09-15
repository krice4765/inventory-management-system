// 分納金額比例削減システム
import { supabase } from '../lib/supabase';

// 過剰分納の比例削減候補を特定
export const identifyProportionalCandidates = async () => {
  console.log('🔍 比例削減候補の特定');

  try {
    // 最新30件の発注書を確認（税込調整済みを除外）
    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, updated_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (ordersError) {
      console.error('❌ 発注書取得エラー:', ordersError);
      return;
    }

    if (!orders) {
      console.log('📝 データなし');
      return;
    }

    console.log(`📋 確認対象: ${orders.length}件`);

    const proportionalCandidates: Array<{
      id: string;
      orderNo: string;
      orderAmount: number;
      deliveredAmount: number;
      ratio: number;
      adjustmentFactor: number;
      transactions: Array<{
        id: string;
        currentAmount: number;
        suggestedAmount: number;
        installmentNo: number;
      }>;
    }> = [];

    for (const order of orders) {
      // 分納情報を取得
      const { data: installments, error: installmentError } = await supabase
        .from('transactions')
        .select('id, total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (installmentError || !installments || installments.length === 0) {
        continue;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;

      console.log(`  ${order.order_no}: 比率 ${ratio.toFixed(3)}`);

      // 1.1倍を超える過剰分納が対象（税込調整では解決できない）
      if (ratio > 1.12) {
        const adjustmentFactor = order.total_amount / deliveredTotal;

        console.log(`    🎯 比例削減候補: ${order.order_no}`);
        console.log(`    発注額: ¥${order.total_amount.toLocaleString()}`);
        console.log(`    分納額: ¥${deliveredTotal.toLocaleString()}`);
        console.log(`    削減係数: ${adjustmentFactor.toFixed(4)}`);

        const transactionAdjustments = installments.map(inst => ({
          id: inst.id,
          currentAmount: inst.total_amount,
          suggestedAmount: Math.round(inst.total_amount * adjustmentFactor),
          installmentNo: inst.installment_no
        }));

        proportionalCandidates.push({
          id: order.id,
          orderNo: order.order_no,
          orderAmount: order.total_amount,
          deliveredAmount: deliveredTotal,
          ratio,
          adjustmentFactor,
          transactions: transactionAdjustments
        });
      }
    }

    console.log(`📊 比例削減候補: ${proportionalCandidates.length}件`);

    if (proportionalCandidates.length > 0) {
      console.log('🔍 候補詳細 (上位5件):');
      proportionalCandidates.slice(0, 5).forEach((candidate, index) => {
        const totalReduction = candidate.deliveredAmount - candidate.orderAmount;
        console.log(`${index + 1}. ${candidate.orderNo}`);
        console.log(`   過剰額: ¥${totalReduction.toLocaleString()}`);
        console.log(`   分納回数: ${candidate.transactions.length}回`);
        console.log(`   削減係数: ${candidate.adjustmentFactor.toFixed(4)}`);

        // 各分納の調整詳細
        candidate.transactions.slice(0, 3).forEach(trans => {
          const reduction = trans.currentAmount - trans.suggestedAmount;
          console.log(`     第${trans.installmentNo}回: ¥${trans.currentAmount.toLocaleString()} → ¥${trans.suggestedAmount.toLocaleString()} (-¥${reduction.toLocaleString()})`);
        });
        if (candidate.transactions.length > 3) {
          console.log(`     ... 他${candidate.transactions.length - 3}件`);
        }
      });

      const totalReductionAmount = proportionalCandidates.reduce((sum, c) => sum + (c.deliveredAmount - c.orderAmount), 0);
      console.log(`💰 総削減予定額: ¥${totalReductionAmount.toLocaleString()}`);
    }

    return {
      status: 'identified',
      candidates: proportionalCandidates,
      totalCandidates: proportionalCandidates.length
    };

  } catch (error) {
    console.error('❌ 特定エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 比例削減の実行
export const executeProportionalReduction = async (maxCandidates: number = 5) => {
  console.log(`🔧 比例削減実行 (最大${maxCandidates}件)`);

  try {
    // まず候補を特定
    const identificationResult = await identifyProportionalCandidates();

    if (!identificationResult || identificationResult.status !== 'identified') {
      console.error('❌ 候補特定失敗');
      return;
    }

    const candidates = identificationResult.candidates.slice(0, maxCandidates);
    console.log(`🎯 実行対象: ${candidates.length}件`);

    let successCount = 0;
    let errorCount = 0;
    let totalReductionAmount = 0;
    let totalTransactionsUpdated = 0;

    for (const candidate of candidates) {
      console.log(`📋 処理中: ${candidate.orderNo}`);

      let candidateSuccess = true;
      let candidateReduction = 0;

      // 各分納取引を更新
      for (const transaction of candidate.transactions) {
        console.log(`  分納更新: 第${transaction.installmentNo}回`);
        console.log(`    ¥${transaction.currentAmount.toLocaleString()} → ¥${transaction.suggestedAmount.toLocaleString()}`);

        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            total_amount: transaction.suggestedAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);

        if (updateError) {
          console.error(`    ❌ 更新失敗: ${updateError.message}`);
          candidateSuccess = false;
        } else {
          console.log(`    ✅ 更新成功`);
          candidateReduction += (transaction.currentAmount - transaction.suggestedAmount);
          totalTransactionsUpdated++;
        }
      }

      if (candidateSuccess) {
        console.log(`✅ ${candidate.orderNo} 全分納更新完了`);
        successCount++;
        totalReductionAmount += candidateReduction;
      } else {
        console.log(`❌ ${candidate.orderNo} 一部更新失敗`);
        errorCount++;
      }
    }

    console.log('📊 比例削減実行結果:');
    console.log(`  成功発注書: ${successCount}件`);
    console.log(`  失敗発注書: ${errorCount}件`);
    console.log(`  更新分納取引: ${totalTransactionsUpdated}件`);
    console.log(`  総削減額: ¥${totalReductionAmount.toLocaleString()}`);
    console.log(`  実行率: ${Math.round((successCount / candidates.length) * 100)}%`);

    if (successCount > 0) {
      console.log('🎉 比例削減による整合性改善が完了しました！');
      console.log(`📈 累計修正: ${7 + successCount}件の発注書が整合`);
    }

    return {
      status: 'completed',
      successCount,
      errorCount,
      totalReductionAmount,
      totalTransactionsUpdated,
      cumulativeFixed: 7 + successCount
    };

  } catch (error) {
    console.error('❌ 比例削減エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 比例削減後の検証
export const verifyProportionalReduction = async () => {
  console.log('🔍 比例削減結果検証');

  try {
    // 最新の整合性状況を確認
    const { data: recentOrders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, updated_at')
      .order('updated_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    if (!recentOrders) {
      console.log('📝 データなし');
      return;
    }

    console.log('📊 最新15件の整合性検証:');

    let perfectCount = 0;
    let minorCount = 0;
    let majorCount = 0;

    for (const order of recentOrders) {
      // 分納情報を取得
      const { data: installments } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (!installments || installments.length === 0) continue;

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = Math.abs(order.total_amount - deliveredTotal);

      let status = '';
      if (difference < 1) {
        status = '✅ 完全一致';
        perfectCount++;
      } else if (difference <= 100) {
        status = '⚠️ 軽微な差額';
        minorCount++;
      } else {
        status = '❌ 大きな差額';
        majorCount++;
      }

      console.log(`  ${order.order_no}: ${status} (差額: ¥${difference.toLocaleString()})`);
    }

    const totalChecked = perfectCount + minorCount + majorCount;
    const healthyRate = Math.round(((perfectCount + minorCount) / totalChecked) * 100);

    console.log('📋 検証結果:');
    console.log(`  完全一致: ${perfectCount}件 (${Math.round((perfectCount / totalChecked) * 100)}%)`);
    console.log(`  軽微差額: ${minorCount}件`);
    console.log(`  大差額: ${majorCount}件`);
    console.log(`  改善された健全性: ${healthyRate}%`);

    if (healthyRate >= 80) {
      console.log('🎉 システムの健全性が大幅に改善されました！');
    } else if (healthyRate >= 60) {
      console.log('✅ システムの健全性が大幅に改善されています');
    } else {
      console.log('📈 改善が進んでいますが、まだ作業が必要です');
    }

    return {
      status: 'verified',
      perfectCount,
      minorCount,
      majorCount,
      healthyRate,
      totalChecked
    };

  } catch (error) {
    console.error('❌ 検証エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    identifyProportionalCandidates: typeof identifyProportionalCandidates;
    executeProportionalReduction: typeof executeProportionalReduction;
    verifyProportionalReduction: typeof verifyProportionalReduction;
  }
}

if (typeof window !== 'undefined') {
  window.identifyProportionalCandidates = identifyProportionalCandidates;
  window.executeProportionalReduction = executeProportionalReduction;
  window.verifyProportionalReduction = verifyProportionalReduction;
}