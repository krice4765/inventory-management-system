// 継続的な整合性監視システム
import { supabase } from '../lib/supabase';

// システム健全性の定期チェック
export const performHealthCheck = async () => {

  try {
    const checkTime = new Date();

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
      return { status: 'no_data' };
    }


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


    // 新規問題がある場合は詳細表示
    if (healthMetrics.newIssues > 0) {
      issues.filter(issue => issue.isNew).forEach((issue, index) => {
      });
    }

    // 最近修正されたものがある場合
    if (healthMetrics.recentlyFixed > 0) {
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
      return { status: 'no_new_transactions' };
    }


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

    }


    if (potentialIssues.length > 0) {
      potentialIssues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : '👀';
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


    // 高信頼度の候補を表示
    const highConfidenceTax = taxAdjustmentCandidates.filter(c => c.confidence === 'high');
    const highConfidenceProportional = proportionalCandidates.filter(c => c.confidence === 'high');

    if (highConfidenceTax.length > 0) {
      highConfidenceTax.slice(0, 3).forEach((candidate, index) => {
      });
    }

    if (highConfidenceProportional.length > 0) {
      highConfidenceProportional.slice(0, 3).forEach((candidate, index) => {
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

  try {
    // 各種チェックを並行実行
    const [healthResult, newIssuesResult, candidatesResult] = await Promise.all([
      performHealthCheck(),
      detectNewExcessiveInstallments(),
      identifyAutoCorrectionCandidates()
    ]);

    const reportTime = new Date().toLocaleString('ja-JP');


    // 健全性状況
    if (healthResult.status === 'completed') {
    }


    // 新規問題
    if (newIssuesResult.status === 'completed') {
      if (newIssuesResult.hasNewIssues) {
      } else {
      }
    }


    // 修正候補
    if (candidatesResult.status === 'completed') {
    }


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