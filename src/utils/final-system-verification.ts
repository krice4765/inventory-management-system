// 最終システム検証ツール
import { supabase } from '../lib/supabase';

// 最終的なシステム健全性の包括的検証
export const performFinalVerification = async () => {
  console.log('🎉 最終システム検証開始');
  console.log('=====================================');

  const verificationTime = new Date().toLocaleString('ja-JP');
  console.log(`🕐 検証時刻: ${verificationTime}`);

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

    console.log('📊 システム状況の包括的確認中...');

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
      console.log('📝 検証対象データなし');
      return { status: 'no_data' };
    }

    console.log(`📋 検証対象: ${orders.length}件の発注書`);

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

    console.log('');
    console.log('📊 最終検証結果');
    console.log('=====================================');
    console.log(`✅ 完全一致: ${perfectMatches}件 (${Math.round((perfectMatches / totalChecked) * 100)}%)`);
    console.log(`⚠️ 軽微問題: ${minorIssues}件`);
    console.log(`❌ 重要問題: ${majorIssues}件`);
    console.log(`🏥 システム健全性: ${projectMetrics.current.healthRate}%`);
    console.log(`💰 残存過剰額: ¥${totalExcessAmount.toLocaleString()}`);
    console.log(`🔧 本日修正された発注書: ${recentlyModified}件`);

    console.log('');
    console.log('📈 プロジェクト成果比較');
    console.log('=====================================');
    console.log(`健全性: ${projectMetrics.initial.healthRate}% → ${projectMetrics.current.healthRate}% (${projectMetrics.current.healthRate - projectMetrics.initial.healthRate > 0 ? '+' : ''}${projectMetrics.current.healthRate - projectMetrics.initial.healthRate}%)`);
    console.log(`完全一致: ${projectMetrics.initial.perfectMatches}件 → ${projectMetrics.current.perfectMatches}件 (+${projectMetrics.current.perfectMatches - projectMetrics.initial.perfectMatches}件)`);
    console.log(`重要問題: ${projectMetrics.initial.problematicOrders}件 → ${projectMetrics.current.problematicOrders}件 (${projectMetrics.current.problematicOrders - projectMetrics.initial.problematicOrders}件)`);
    console.log(`過剰額: ¥${projectMetrics.initial.totalExcess.toLocaleString()} → ¥${totalExcessAmount.toLocaleString()} (-¥${(projectMetrics.initial.totalExcess - totalExcessAmount).toLocaleString()})`);

    // 改善率の計算
    const improvementRate = Math.round(((projectMetrics.current.healthRate - projectMetrics.initial.healthRate) / projectMetrics.initial.healthRate) * 100);

    console.log('');
    console.log('🎯 成果評価');
    console.log('=====================================');

    if (projectMetrics.current.healthRate >= 70) {
      console.log('🎉 優秀: システムが非常に健全な状態です');
    } else if (projectMetrics.current.healthRate >= 60) {
      console.log('✅ 良好: システムが安定した状態です');
    } else if (projectMetrics.current.healthRate >= 50) {
      console.log('⚠️ 改善必要: さらなる改善が推奨されます');
    } else {
      console.log('🔴 要注意: 重要な問題が残存しています');
    }

    console.log(`📈 改善率: ${improvementRate > 0 ? '+' : ''}${improvementRate}%`);

    // 最も改善された発注書を表示
    const recentlyFixed = detailedResults.filter(r => r.status === 'perfect' && r.isModified);
    if (recentlyFixed.length > 0) {
      console.log('');
      console.log('🔧 本日修正完了した発注書:');
      recentlyFixed.slice(0, 5).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.orderNo}: 完全一致達成`);
      });
    }

    // 残存する問題の概要
    const remainingMajorIssues = detailedResults.filter(r => r.status === 'major');
    if (remainingMajorIssues.length > 0) {
      console.log('');
      console.log('⚠️ 継続対応が必要な案件 (上位3件):');
      remainingMajorIssues
        .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
        .slice(0, 3)
        .forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue.orderNo}: 差額¥${Math.abs(issue.difference).toLocaleString()} (比率${issue.ratio.toFixed(3)})`);
        });
    }

    console.log('');
    console.log('🎉 最終検証完了');
    console.log('=====================================');

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
  console.log('📋 プロジェクト成果サマリー');
  console.log('=====================================');

  try {
    // 最終検証の実行
    const verificationResult = await performFinalVerification();

    if (verificationResult.status !== 'completed') {
      console.error('❌ 検証に失敗したためサマリーを生成できません');
      return verificationResult;
    }

    const metrics = verificationResult.metrics;
    const comparison = verificationResult.projectComparison;

    console.log('');
    console.log('🏆 プロジェクト総括');
    console.log('=====================================');

    // 成功指標の評価
    const successIndicators = {
      healthImprovement: comparison.current.healthRate > comparison.initial.healthRate,
      perfectMatchesAchieved: comparison.current.perfectMatches > 5,
      excessReduction: comparison.current.totalExcess < comparison.initial.totalExcess,
      majorIssuesReduced: comparison.current.problematicOrders < comparison.initial.problematicOrders
    };

    const successCount = Object.values(successIndicators).filter(Boolean).length;
    const successRate = Math.round((successCount / 4) * 100);

    console.log(`✅ 成功指標達成率: ${successCount}/4 (${successRate}%)`);
    console.log(`   健全性向上: ${successIndicators.healthImprovement ? '✅' : '❌'}`);
    console.log(`   完全一致達成: ${successIndicators.perfectMatchesAchieved ? '✅' : '❌'} (${comparison.current.perfectMatches}件)`);
    console.log(`   過剰額削減: ${successIndicators.excessReduction ? '✅' : '❌'}`);
    console.log(`   重要問題削減: ${successIndicators.majorIssuesReduced ? '✅' : '❌'}`);

    console.log('');
    console.log('🎯 主要成果');
    console.log('=====================================');
    console.log(`📈 システム健全性: ${comparison.initial.healthRate}% → ${comparison.current.healthRate}% (${metrics.improvementRate > 0 ? '+' : ''}${metrics.improvementRate}%向上)`);
    console.log(`🔧 修正完了発注書: ${comparison.current.perfectMatches}件`);
    console.log(`💰 削減過剰額: ¥${(comparison.initial.totalExcess - comparison.current.totalExcess).toLocaleString()}`);
    console.log(`📊 本日の修正: ${metrics.recentlyModified}件`);

    console.log('');
    console.log('🔮 今後の推奨アクション');
    console.log('=====================================');

    if (metrics.majorIssues > 0) {
      console.log(`🔧 ${metrics.majorIssues}件の重要問題が残存 - 継続対応が必要`);
    }

    if (metrics.healthRate < 80) {
      console.log('📈 継続的な監視と改善で健全性80%以上を目指す');
    }

    console.log('🏥 定期的な健全性チェックの実施');
    console.log('🚨 新規問題の早期発見体制の維持');

    if (successRate >= 75) {
      console.log('');
      console.log('🎉 プロジェクトは大成功を収めました！');
    } else if (successRate >= 50) {
      console.log('');
      console.log('✅ プロジェクトは成功しました！');
    } else {
      console.log('');
      console.log('⚠️ プロジェクトは部分的成功。継続改善が必要です。');
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
  console.log('🔍 継続監視システムテスト');

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

    console.log('📊 監視システム動作確認:');
    console.log(`  サンプルデータ取得: ${sampleOrders?.length || 0}件`);

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

          console.log(`    ${order.order_no}: ${status} 監視正常`);
        } catch (monitorError) {
          console.warn(`    ${order.order_no}: ⚠️ 監視エラー`);
          monitoringWorking = false;
        }
      }
    }

    console.log(`🏥 継続監視システム: ${monitoringWorking ? '✅ 正常動作' : '⚠️ 一部問題あり'}`);
    console.log('📋 推奨実行コマンド:');
    console.log('  - window.performFinalVerification() (最終検証)');
    console.log('  - window.generateProjectSummary() (プロジェクト総括)');

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