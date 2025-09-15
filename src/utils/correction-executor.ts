// 分納修正実行ツール
import { supabase } from '../lib/supabase';

export const executeInstallmentCorrection = async () => {
  console.log('🛠️ 分納修正実行開始');

  try {
    // Phase 1: バックアップ確認
    console.log('📋 Phase 1: バックアップ状況確認');

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

    console.log('📊 修正前状況:');
    console.log(`  問題のある発注書: ${problematicOrders}件`);
    console.log(`  総過剰額: ¥${totalExcess.toLocaleString()}`);
    console.log(`  税関連と思われるケース: ${taxRelatedCases}件`);

    if (problematicOrders === 0) {
      console.log('✅ 修正対象がありません');
      return { status: 'no_issues', message: '問題は検出されませんでした' };
    }

    // Phase 2: 税込調整の実行
    console.log('💰 Phase 2: 税込調整実行');

    const taxAdjustmentCandidates = currentIssues.filter(order => {
      const deliveredTotal = order.transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;
      const diffFromTax = Math.abs(deliveredTotal - (order.total_amount * 1.1));

      return ratio >= 1.08 && ratio <= 1.12 && diffFromTax < 1000;
    });

    console.log(`🎯 税込調整対象: ${taxAdjustmentCandidates.length}件`);

    let taxAdjustmentSuccess = 0;

    for (const order of taxAdjustmentCandidates) {
      const newAmount = Math.round(order.total_amount * 1.1);

      console.log(`  調整中: ${order.order_no} ¥${order.total_amount.toLocaleString()} → ¥${newAmount.toLocaleString()}`);

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
        console.log(`  ✅ 調整完了: ${order.order_no}`);
      }
    }

    console.log(`📊 Phase 2結果: ${taxAdjustmentSuccess}/${taxAdjustmentCandidates.length}件調整完了`);

    // Phase 3: 調整後の確認
    console.log('🔍 Phase 3: 調整後確認');

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

      console.log('📋 調整後状況:');
      console.log(`  残存問題: ${remainingIssues}件`);
      console.log(`  残存過剰額: ¥${remainingExcess.toLocaleString()}`);
      console.log(`  解決率: ${Math.round((1 - remainingIssues / problematicOrders) * 100)}%`);

      if (remainingIssues === 0) {
        console.log('🎉 全ての過剰分納問題が解決されました！');
      } else if (remainingIssues < problematicOrders / 2) {
        console.log('✅ 大部分の問題が解決されました');
        console.log('📋 残存問題は個別対応が必要です');
      } else {
        console.log('⚠️ まだ多くの問題が残っています');
        console.log('🔧 追加の調整戦略が必要です');
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
  console.log('🔍 修正状況詳細確認');

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

    console.log('📊 最新30件の発注書状況:');

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
        console.log(`${index + 1}. ${order.order_no} ${status}`);
        console.log(`   発注額: ¥${order.total_amount.toLocaleString()}`);
        console.log(`   分納額: ¥${deliveredTotal.toLocaleString()}`);
        console.log(`   差額: ¥${difference.toLocaleString()}`);
        console.log(`   分納回数: ${installments.length}回`);
        console.log('---');
      }
    });

    console.log('📋 全体サマリー:');
    console.log(`  完全一致: ${perfectlyAligned}件`);
    console.log(`  軽微な差額: ${minorDifferences}件`);
    console.log(`  大きな差額: ${majorDifferences}件`);

    const totalChecked = perfectlyAligned + minorDifferences + majorDifferences;
    const healthyRate = Math.round(((perfectlyAligned + minorDifferences) / totalChecked) * 100);
    console.log(`  健全性: ${healthyRate}%`);

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