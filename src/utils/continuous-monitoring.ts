// 継続的な整合性監視システム
import { supabase } from '../lib/supabase';

// システム健全性の定期チェック
export const performHealthCheck = async () => {
  console.log('🏥 システム健全性チェック開始');

  try {
    const checkTime = new Date();
    console.log(`🕐 チェック時刻: ${checkTime.toLocaleString('ja-JP')}`);

    // 最新30件の発注書を確認
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return { status: 'error', error: error.message };
    }

    if (!orders || orders.length === 0) {
      console.log('📝 データなし');
      return { status: 'no_data' };
    }

    console.log(`📊 チェック対象: ${orders.length}件`);

    const healthMetrics = {
      perfect: 0,
      minor: 0,
      major: 0,
      critical: 0,
      newIssues: 0,
      recentlyFixed: 0,
      totalExcess: 0,
      maxExcess: 0,
      averageExcess: 0
    };

    const issues: Array<{
      orderNo: string;
      severity: 'minor' | 'major' | 'critical';
      excess: number;
      ratio: number;
      isNew: boolean;
    }> = [];

    // 各発注書の整合性をチェック
    for (const order of orders) {
      const { data: installments } = await supabase
        .from('transactions')
        .select('total_amount, installment_no, created_at')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (!installments || installments.length === 0) continue;

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = deliveredTotal - order.total_amount;
      const ratio = deliveredTotal / order.total_amount;

      // 最近作成された分納かチェック (24時間以内)
      const latestInstallment = new Date(Math.max(...installments.map(i => new Date(i.created_at).getTime())));
      const isRecentInstallment = (checkTime.getTime() - latestInstallment.getTime()) < 24 * 60 * 60 * 1000;

      if (Math.abs(difference) < 1) {
        healthMetrics.perfect++;
        if (isRecentInstallment) {
          healthMetrics.recentlyFixed++;
        }
      } else if (Math.abs(difference) <= 100) {
        healthMetrics.minor++;
        issues.push({
          orderNo: order.order_no,
          severity: 'minor',
          excess: difference,
          ratio,
          isNew: isRecentInstallment
        });
      } else if (Math.abs(difference) <= 10000) {
        healthMetrics.major++;
        if (isRecentInstallment) healthMetrics.newIssues++;
        issues.push({
          orderNo: order.order_no,
          severity: 'major',
          excess: difference,
          ratio,
          isNew: isRecentInstallment
        });
      } else {
        healthMetrics.critical++;
        if (isRecentInstallment) healthMetrics.newIssues++;
        issues.push({
          orderNo: order.order_no,
          severity: 'critical',
          excess: difference,
          ratio,
          isNew: isRecentInstallment
        });
      }

      if (difference > 0) {
        healthMetrics.totalExcess += difference;
        if (difference > healthMetrics.maxExcess) {
          healthMetrics.maxExcess = difference;
        }
      }
    }

    // 健全性率の計算
    const totalChecked = healthMetrics.perfect + healthMetrics.minor + healthMetrics.major + healthMetrics.critical;
    const healthyRate = Math.round(((healthMetrics.perfect + healthMetrics.minor) / totalChecked) * 100);

    // 平均過剰額の計算
    const issueCount = healthMetrics.minor + healthMetrics.major + healthMetrics.critical;
    healthMetrics.averageExcess = issueCount > 0 ? Math.round(healthMetrics.totalExcess / issueCount) : 0;

    console.log('📋 健全性チェック結果:');
    console.log(`  完全一致: ${healthMetrics.perfect}件 (${Math.round((healthMetrics.perfect / totalChecked) * 100)}%)`);
    console.log(`  軽微問題: ${healthMetrics.minor}件`);
    console.log(`  重要問題: ${healthMetrics.major}件`);
    console.log(`  重篤問題: ${healthMetrics.critical}件`);
    console.log(`  システム健全性: ${healthyRate}%`);

    // アラート判定
    let alertLevel = 'healthy';
    let alertMessage = '';

    if (healthMetrics.newIssues > 0) {
      alertLevel = 'warning';
      alertMessage = `🚨 新規問題 ${healthMetrics.newIssues}件が検出されました`;
    } else if (healthyRate < 50) {
      alertLevel = 'critical';
      alertMessage = `🔴 システム健全性が危険レベル (${healthyRate}%)`;
    } else if (healthyRate < 70) {
      alertLevel = 'warning';
      alertMessage = `⚠️ システム健全性が低下 (${healthyRate}%)`;
    } else {
      alertLevel = 'healthy';
      alertMessage = `✅ システム健全性良好 (${healthyRate}%)`;
    }

    console.log(`🏥 総合判定: ${alertMessage}`);

    // 新規問題がある場合は詳細表示
    if (healthMetrics.newIssues > 0) {
      console.log('🚨 新規問題詳細:');
      issues.filter(issue => issue.isNew).forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.orderNo}: ${issue.severity} (過剰額: ¥${issue.excess.toLocaleString()})`);
      });
    }

    // 最近修正されたものがある場合
    if (healthMetrics.recentlyFixed > 0) {
      console.log(`🎉 最近修正された発注書: ${healthMetrics.recentlyFixed}件`);
    }

    return {
      status: 'completed',
      checkTime: checkTime.toISOString(),
      metrics: healthMetrics,
      healthyRate,
      alertLevel,
      alertMessage,
      totalChecked,
      issues: issues.slice(0, 10) // 上位10件のみ
    };

  } catch (error) {
    console.error('❌ 健全性チェックエラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 新規過剰分納の早期発見
export const detectNewExcessiveInstallments = async () => {
  console.log('🔍 新規過剰分納検出');

  try {
    // 過去24時間に作成された分納を確認
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentTransactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        parent_order_id,
        total_amount,
        installment_no,
        created_at,
        purchase_orders!inner(
          order_no,
          total_amount
        )
      `)
      .gte('created_at', twentyFourHoursAgo)
      .not('installment_no', 'is', null);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return { status: 'error', error: error.message };
    }

    if (!recentTransactions || recentTransactions.length === 0) {
      console.log('📝 過去24時間に新規分納はありません');
      return { status: 'no_new_transactions' };
    }

    console.log(`📊 過去24時間の新規分納: ${recentTransactions.length}件`);

    // 発注書別にグループ化
    const orderGroups = new Map();
    recentTransactions.forEach(transaction => {
      const orderId = transaction.parent_order_id;
      if (!orderGroups.has(orderId)) {
        orderGroups.set(orderId, {
          orderNo: transaction.purchase_orders.order_no,
          orderAmount: transaction.purchase_orders.total_amount,
          transactions: []
        });
      }
      orderGroups.get(orderId).transactions.push(transaction);
    });

    const potentialIssues: Array<{
      orderNo: string;
      orderAmount: number;
      newInstallmentAmount: number;
      ratio: number;
      severity: 'watch' | 'warning' | 'critical';
    }> = [];

    // 各発注書の状況をチェック
    for (const [orderId, group] of orderGroups) {
      const { orderNo, orderAmount, transactions } = group;
      const newInstallmentTotal = transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);

      // 全体の分納状況を確認
      const { data: allInstallments } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('parent_order_id', orderId)
        .not('installment_no', 'is', null);

      const totalDelivered = (allInstallments || []).reduce((sum, inst) => sum + inst.total_amount, 0);
      const ratio = totalDelivered / orderAmount;

      let severity: 'watch' | 'warning' | 'critical' = 'watch';
      if (ratio > 1.5) {
        severity = 'critical';
      } else if (ratio > 1.1) {
        severity = 'warning';
      }

      if (ratio > 1.05) { // 5%以上の過剰
        potentialIssues.push({
          orderNo,
          orderAmount,
          newInstallmentAmount: newInstallmentTotal,
          ratio,
          severity
        });
      }

      console.log(`  ${orderNo}: 新規分納¥${newInstallmentTotal.toLocaleString()} (比率: ${ratio.toFixed(3)})`);
    }

    console.log(`🚨 要注意案件: ${potentialIssues.length}件`);

    if (potentialIssues.length > 0) {
      console.log('🔍 詳細:');
      potentialIssues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : '👀';
        console.log(`  ${index + 1}. ${icon} ${issue.orderNo}: 比率${issue.ratio.toFixed(3)} (新規分納: ¥${issue.newInstallmentAmount.toLocaleString()})`);
      });
    }

    return {
      status: 'completed',
      newTransactionsCount: recentTransactions.length,
      potentialIssues,
      hasNewIssues: potentialIssues.length > 0
    };

  } catch (error) {
    console.error('❌ 新規検出エラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 修正候補の自動特定
export const identifyAutoCorrectionCandidates = async () => {
  console.log('🤖 自動修正候補の特定');

  try {
    // 税込調整候補を特定
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return { status: 'error', error: error.message };
    }

    const taxAdjustmentCandidates: Array<{
      orderNo: string;
      currentAmount: number;
      suggestedAmount: number;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    const proportionalCandidates: Array<{
      orderNo: string;
      orderAmount: number;
      excessAmount: number;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    for (const order of orders) {
      const { data: installments } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (!installments || installments.length === 0) continue;

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;

      // 税込調整候補
      if (ratio >= 1.08 && ratio <= 1.12) {
        const suggestedAmount = Math.round(order.total_amount * 1.1);
        const diffFromSuggested = Math.abs(deliveredTotal - suggestedAmount);

        if (diffFromSuggested < 500) {
          taxAdjustmentCandidates.push({
            orderNo: order.order_no,
            currentAmount: order.total_amount,
            suggestedAmount,
            confidence: diffFromSuggested < 100 ? 'high' : diffFromSuggested < 300 ? 'medium' : 'low'
          });
        }
      }

      // 比例削減候補
      if (ratio > 1.15 && ratio <= 3.0) {
        const excessAmount = deliveredTotal - order.total_amount;
        let confidence: 'high' | 'medium' | 'low' = 'low';

        if (ratio >= 2.0 && ratio <= 2.3) confidence = 'high'; // 2.2倍パターン
        else if (ratio >= 1.5 && ratio <= 1.8) confidence = 'medium';

        proportionalCandidates.push({
          orderNo: order.order_no,
          orderAmount: order.total_amount,
          excessAmount,
          confidence
        });
      }
    }

    console.log(`📊 税込調整候補: ${taxAdjustmentCandidates.length}件`);
    console.log(`🔧 比例削減候補: ${proportionalCandidates.length}件`);

    // 高信頼度の候補を表示
    const highConfidenceTax = taxAdjustmentCandidates.filter(c => c.confidence === 'high');
    const highConfidenceProportional = proportionalCandidates.filter(c => c.confidence === 'high');

    if (highConfidenceTax.length > 0) {
      console.log('🎯 高信頼度税込調整候補:');
      highConfidenceTax.slice(0, 3).forEach((candidate, index) => {
        console.log(`  ${index + 1}. ${candidate.orderNo}: ¥${candidate.currentAmount.toLocaleString()} → ¥${candidate.suggestedAmount.toLocaleString()}`);
      });
    }

    if (highConfidenceProportional.length > 0) {
      console.log('🔧 高信頼度比例削減候補:');
      highConfidenceProportional.slice(0, 3).forEach((candidate, index) => {
        console.log(`  ${index + 1}. ${candidate.orderNo}: 過剰額 ¥${candidate.excessAmount.toLocaleString()}`);
      });
    }

    return {
      status: 'completed',
      taxAdjustmentCandidates,
      proportionalCandidates,
      highConfidenceCount: highConfidenceTax.length + highConfidenceProportional.length
    };

  } catch (error) {
    console.error('❌ 候補特定エラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 統合監視レポート
export const generateMonitoringReport = async () => {
  console.log('📊 統合監視レポート生成');

  try {
    // 各種チェックを並行実行
    const [healthResult, newIssuesResult, candidatesResult] = await Promise.all([
      performHealthCheck(),
      detectNewExcessiveInstallments(),
      identifyAutoCorrectionCandidates()
    ]);

    const reportTime = new Date().toLocaleString('ja-JP');

    console.log('📋 ========== 統合監視レポート ==========');
    console.log(`🕐 レポート作成時刻: ${reportTime}`);
    console.log('');

    // 健全性状況
    if (healthResult.status === 'completed') {
      console.log(`🏥 システム健全性: ${healthResult.healthyRate}%`);
      console.log(`   完全一致: ${healthResult.metrics.perfect}件`);
      console.log(`   要改善: ${healthResult.metrics.major + healthResult.metrics.critical}件`);
      console.log(`   ${healthResult.alertMessage}`);
    }

    console.log('');

    // 新規問題
    if (newIssuesResult.status === 'completed') {
      if (newIssuesResult.hasNewIssues) {
        console.log(`🚨 新規問題: ${newIssuesResult.potentialIssues.length}件`);
      } else {
        console.log('✅ 新規問題: なし');
      }
      console.log(`   過去24時間の新規分納: ${newIssuesResult.newTransactionsCount}件`);
    }

    console.log('');

    // 修正候補
    if (candidatesResult.status === 'completed') {
      console.log(`🛠️ 自動修正候補: ${candidatesResult.highConfidenceCount}件 (高信頼度)`);
      console.log(`   税込調整候補: ${candidatesResult.taxAdjustmentCandidates.length}件`);
      console.log(`   比例削減候補: ${candidatesResult.proportionalCandidates.length}件`);
    }

    console.log('==========================================');

    return {
      status: 'completed',
      reportTime,
      health: healthResult,
      newIssues: newIssuesResult,
      candidates: candidatesResult
    };

  } catch (error) {
    console.error('❌ レポート生成エラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// グローバルに公開
declare global {
  interface Window {
    performHealthCheck: typeof performHealthCheck;
    detectNewExcessiveInstallments: typeof detectNewExcessiveInstallments;
    identifyAutoCorrectionCandidates: typeof identifyAutoCorrectionCandidates;
    generateMonitoringReport: typeof generateMonitoringReport;
  }
}

if (typeof window !== 'undefined') {
  window.performHealthCheck = performHealthCheck;
  window.detectNewExcessiveInstallments = detectNewExcessiveInstallments;
  window.identifyAutoCorrectionCandidates = identifyAutoCorrectionCandidates;
  window.generateMonitoringReport = generateMonitoringReport;
}