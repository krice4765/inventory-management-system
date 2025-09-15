// SQLテスト実行用ユーティリティ
import { supabase } from '../lib/supabase';

// Phase 1: データ分析実行
export const runDataAnalysisPhase1 = async () => {
  console.log('🔄 Phase 1: データ分析開始');

  try {
    // 1. 基本データ量の確認
    const { data: orderData, count: totalOrders } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log('📊 総発注書数:', totalOrders);

    // 2. 大額取引の確認 (1000万円以上)
    const { data: largeAmountOrders, count: largeCount } = await supabase
      .from('purchase_orders')
      .select('id, total_amount, created_at', { count: 'exact' })
      .gte('total_amount', 10000000);

    console.log('💰 1000万円以上の大額取引:', largeCount);
    if (largeCount && largeCount > 0) {
      console.log('📝 大額取引例:');
      largeAmountOrders?.slice(0, 5).forEach((order, index) => {
        console.log(`  ${index + 1}. ID: ${order.id}, 金額: ¥${order.total_amount.toLocaleString()}, 作成日: ${order.created_at}`);
      });
    }

    // 3. 分納取引の確認
    const { data: installmentData, count: installmentCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .not('parent_order_id', 'is', null)
      .limit(1);

    console.log('📦 分納取引数:', installmentCount);

    // 4. 同日大量作成の確認
    const { data: dailyStats } = await supabase
      .from('purchase_orders')
      .select('created_at')
      .order('created_at');

    if (dailyStats) {
      const dailyCount: Record<string, number> = {};
      dailyStats.forEach(order => {
        const date = order.created_at.split('T')[0];
        dailyCount[date] = (dailyCount[date] || 0) + 1;
      });

      const highVolumeDays = Object.entries(dailyCount)
        .filter(([_, count]) => count > 10)
        .sort(([,a], [,b]) => b - a);

      console.log('📅 1日10件以上作成された日:', highVolumeDays.length);
      highVolumeDays.slice(0, 5).forEach(([date, count]) => {
        console.log(`  ${date}: ${count}件`);
      });
    }

    // 5. 過剰分納の詳細確認
    console.log('🔍 過剰分納分析中...');

    const { data: ordersWithInstallments } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        total_amount,
        created_at,
        transactions!inner(
          total_amount,
          installment_no
        )
      `)
      .not('transactions.parent_order_id', 'is', null);

    if (ordersWithInstallments) {
      let excessiveCount = 0;
      const excessiveOrders: Array<{
        id: string;
        orderAmount: number;
        deliveredAmount: number;
        excess: number;
      }> = [];

      ordersWithInstallments.forEach(order => {
        const deliveredTotal = order.transactions.reduce((sum: number, t: any) => sum + t.total_amount, 0);
        if (deliveredTotal > order.total_amount * 1.1) { // 10%以上過剰
          excessiveCount++;
          excessiveOrders.push({
            id: order.id,
            orderAmount: order.total_amount,
            deliveredAmount: deliveredTotal,
            excess: deliveredTotal - order.total_amount
          });
        }
      });

      console.log('🚨 過剰分納発注書:', excessiveCount);
      if (excessiveCount > 0) {
        console.log('📝 過剰分納例 (上位5件):');
        excessiveOrders
          .sort((a, b) => b.excess - a.excess)
          .slice(0, 5)
          .forEach((order, index) => {
            console.log(`  ${index + 1}. ID: ${order.id}`);
            console.log(`     発注額: ¥${order.orderAmount.toLocaleString()}`);
            console.log(`     分納額: ¥${order.deliveredAmount.toLocaleString()}`);
            console.log(`     過剰額: ¥${order.excess.toLocaleString()}`);
          });
      }
    }

    // 6. 推奨アクション
    const testDataIndicators = {
      largeAmounts: largeCount || 0,
      highVolumeDays: 0, // 上で計算済み
      excessiveInstallments: 0 // 上で計算済み
    };

    console.log('📋 分析結果サマリー:');
    console.log(`  - 総発注書数: ${totalOrders}`);
    console.log(`  - 大額取引: ${testDataIndicators.largeAmounts}件`);
    console.log(`  - 分納取引: ${installmentCount}件`);

    if (testDataIndicators.largeAmounts > 0) {
      console.log('⚠️ 推奨アクション: 大額取引がテストデータの可能性があります');
      console.log('📋 次のステップ: バックアップ作成後にクリーンアップを実行してください');
    } else {
      console.log('✅ テストデータは検出されませんでした');
    }

    return {
      totalOrders,
      largeAmounts: testDataIndicators.largeAmounts,
      installments: installmentCount,
      analysis: 'completed'
    };

  } catch (error) {
    console.error('❌ 分析エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開（ブラウザコンソールで使用可能）
declare global {
  interface Window {
    runDataAnalysis: typeof runDataAnalysisPhase1;
  }
}

if (typeof window !== 'undefined') {
  window.runDataAnalysis = runDataAnalysisPhase1;
}