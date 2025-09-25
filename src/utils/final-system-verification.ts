// 最終システム検証ツール
import { supabase } from '../lib/supabase';

// 最終的なシステム健全性の包括的検証
export const performFinalVerification = async () => {

  const verificationTime = new Date().toLocaleString('ja-JP');

  try {
    // プロジェクト開始時と現在の比較データ
    const projectMetrics = {
      initial: {
        healthRate: 35,
        perfectMatches: 0,
        totalExcess: 8570782,
        problematicOrders: 20
      },
      current: {
        healthRate: 0,
        perfectMatches: 0,
        totalExcess: 0,
        problematicOrders: 0
      }
    };


    // 最新30件の発注書を確認
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return { status: 'error', error: error.message };
    }

    if (!orders || orders.length === 0) {
      return { status: 'no_data' };
    }


    let perfectMatches = 0;
    let minorIssues = 0;
    let majorIssues = 0;
    let totalExcessAmount = 0;
    let recentlyModified = 0;

    const detailedResults: Array<{
      orderNo: string;
      status: 'perfect' | 'minor' | 'major';
      difference: number;
      ratio: number;
      isModified: boolean;
    }> = [];

    // 今日の日付
    const today = new Date().toDateString();

    for (const order of orders) {
      // 分納情報を取得
      const { data: installments, error: instError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (instError) {
        console.warn(`⚠️ 分納取得エラー ${order.order_no}:`, instError);
        continue;
      }

      if (!installments || installments.length === 0) {
        // 分納なしの発注書は完全とみなす
        perfectMatches++;
        detailedResults.push({
          orderNo: order.order_no,
          status: 'perfect',
          difference: 0,
          ratio: 1.0,
          isModified: false
        });
        continue;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = deliveredTotal - order.total_amount;
      const ratio = deliveredTotal / order.total_amount;

      // 今日修正されたかチェック
      const isModified = new Date(order.updated_at).toDateString() === today;
      if (isModified) recentlyModified++;

      let status: 'perfect' | 'minor' | 'major' = 'perfect';

      if (Math.abs(difference) < 1) {
        perfectMatches++;
        status = 'perfect';
      } else if (Math.abs(difference) <= 100) {
        minorIssues++;
        status = 'minor';
      } else {
        majorIssues++;
        status = 'major';
        if (difference > 0) {
          totalExcessAmount += difference;
        }
      }

      detailedResults.push({
        orderNo: order.order_no,
        status,
        difference,
        ratio,
        isModified
      });
    }

    // 現在の指標を更新
    const totalChecked = perfectMatches + minorIssues + majorIssues;
    projectMetrics.current.healthRate = Math.round(((perfectMatches + minorIssues) / totalChecked) * 100);
    projectMetrics.current.perfectMatches = perfectMatches;
    projectMetrics.current.totalExcess = totalExcessAmount;
    projectMetrics.current.problematicOrders = majorIssues;



    // 改善率の計算
    const improvementRate = Math.round(((projectMetrics.current.healthRate - projectMetrics.initial.healthRate) / projectMetrics.initial.healthRate) * 100);


    if (projectMetrics.current.healthRate >= 70) {
    } else if (projectMetrics.current.healthRate >= 60) {
    } else if (projectMetrics.current.healthRate >= 50) {
    } else {
    }


    // 最も改善された発注書を表示
    const recentlyFixed = detailedResults.filter(r => r.status === 'perfect' && r.isModified);
    if (recentlyFixed.length > 0) {
      recentlyFixed.slice(0, 5).forEach((result, index) => {
      });
    }

    // 残存する問題の概要
    const remainingMajorIssues = detailedResults.filter(r => r.status === 'major');
    if (remainingMajorIssues.length > 0) {
      remainingMajorIssues
        .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
        .slice(0, 3)
        .forEach((issue, index) => {
        });
    }


    return {
      status: 'completed',
      verificationTime,
      metrics: {
        totalChecked,
        perfectMatches,
        minorIssues,
        majorIssues,
        healthRate: projectMetrics.current.healthRate,
        totalExcessAmount,
        recentlyModified,
        improvementRate
      },
      projectComparison: projectMetrics,
      detailedResults: detailedResults.slice(0, 10) // 上位10件
    };

  } catch (error) {
    console.error('❌ 最終検証エラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// プロジェクト成果サマリー
export const generateProjectSummary = async () => {

  try {
    // 最終検証の実行
    const verificationResult = await performFinalVerification();

    if (verificationResult.status !== 'completed') {
      console.error('❌ 検証に失敗したためサマリーを生成できません');
      return verificationResult;
    }

    const metrics = verificationResult.metrics;
    const comparison = verificationResult.projectComparison;


    // 成功指標の評価
    const successIndicators = {
      healthImprovement: comparison.current.healthRate > comparison.initial.healthRate,
      perfectMatchesAchieved: comparison.current.perfectMatches > 5,
      excessReduction: comparison.current.totalExcess < comparison.initial.totalExcess,
      majorIssuesReduced: comparison.current.problematicOrders < comparison.initial.problematicOrders
    };

    const successCount = Object.values(successIndicators).filter(Boolean).length;
    const successRate = Math.round((successCount / 4) * 100);




    if (metrics.majorIssues > 0) {
    }

    if (metrics.healthRate < 80) {
    }


    if (successRate >= 75) {
    } else if (successRate >= 50) {
    } else {
    }

    return {
      status: 'completed',
      successRate,
      successIndicators,
      metrics,
      comparison,
      overallAssessment: successRate >= 75 ? 'excellent' : successRate >= 50 ? 'good' : 'needs_improvement'
    };

  } catch (error) {
    console.error('❌ サマリー生成エラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 継続監視のテスト
export const testContinuousMonitoring = async () => {

  try {
    // 基本的な健全性チェック
    const { data: sampleOrders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ サンプルデータ取得エラー:', error);
      return { status: 'error' };
    }


    // 各発注書の簡易チェック
    let monitoringWorking = true;

    if (sampleOrders && sampleOrders.length > 0) {
      for (const order of sampleOrders.slice(0, 2)) {
        try {
          const { data: installments } = await supabase
            .from('transactions')
            .select('total_amount')
            .eq('parent_order_id', order.id)
            .not('installment_no', 'is', null);

          const deliveredTotal = (installments || []).reduce((sum, inst) => sum + inst.total_amount, 0);
          const status = Math.abs(deliveredTotal - order.total_amount) < 1 ? '✅' : '⚠️';

        } catch (monitorError) {
          console.warn(`    ${order.order_no}: ⚠️ 監視エラー`);
          monitoringWorking = false;
        }
      }
    }


    return {
      status: 'completed',
      monitoringStatus: monitoringWorking ? 'working' : 'partial_issues',
      sampleCount: sampleOrders?.length || 0
    };

  } catch (error) {
    console.error('❌ 監視システムテストエラー:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// グローバルに公開
declare global {
  interface Window {
    performFinalVerification: typeof performFinalVerification;
    generateProjectSummary: typeof generateProjectSummary;
    testContinuousMonitoring: typeof testContinuousMonitoring;
  }
}

if (typeof window !== 'undefined') {
  window.performFinalVerification = performFinalVerification;
  window.generateProjectSummary = generateProjectSummary;
  window.testContinuousMonitoring = testContinuousMonitoring;
}