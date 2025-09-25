// SQLテスト実行用ユーティリティ
import { supabase } from '../lib/supabase';

// Phase 1: データ分析実行
export const runDataAnalysisPhase1 = async () => {

  try {
    // 1. 基本データ量の確認
    const { data: orderData, count: totalOrders } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact' })
      .limit(1);


    // 2. 大額取引の確認 (1000万円以上)
    const { data: largeAmountOrders, count: largeCount } = await supabase
      .from('purchase_orders')
      .select('id, total_amount, created_at', { count: 'exact' })
      .gte('total_amount', 10000000);

    if (largeCount && largeCount > 0) {
      largeAmountOrders?.slice(0, 5).forEach((order, index) => {
      });
    }

    // 3. 分納取引の確認
    const { data: installmentData, count: installmentCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .not('parent_order_id', 'is', null)
      .limit(1);


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

      highVolumeDays.slice(0, 5).forEach(([date, count]) => {
      });
    }

    // 5. 過剰分納の詳細確認

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

      if (excessiveCount > 0) {
        excessiveOrders
          .sort((a, b) => b.excess - a.excess)
          .slice(0, 5)
          .forEach((order, index) => {
          });
      }
    }

    // 6. 推奨アクション
    const testDataIndicators = {
      largeAmounts: largeCount || 0,
      highVolumeDays: 0, // 上で計算済み
      excessiveInstallments: 0 // 上で計算済み
    };


    if (testDataIndicators.largeAmounts > 0) {
    } else {
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