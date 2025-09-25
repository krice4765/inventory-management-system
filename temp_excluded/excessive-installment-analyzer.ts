// 過剰分納の詳細分析ツール
import { supabase } from '../lib/supabase';

export const analyzeExcessiveInstallments = async () => {

  try {
    // 1. 全ての発注書と分納の関係を詳細に分析
    const { data: detailedData } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        total_amount,
        status,
        created_at,
        transactions!left(
          id,
          total_amount,
          installment_no,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (!detailedData) {
      console.error('❌ データ取得失敗');
      return;
    }


    // 2. 過剰分納分析
    const excessiveOrders: Array<{
      id: string;
      orderNo: string;
      orderAmount: number;
      deliveredAmount: number;
      installmentCount: number;
      excess: number;
      excessPercentage: number;
      status: string;
      createdAt: string;
      installments: any[];
    }> = [];

    detailedData.forEach(order => {
      const installments = order.transactions || [];
      const installmentTotal = installments.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      if (installmentTotal > order.total_amount) {
        const excess = installmentTotal - order.total_amount;
        const excessPercentage = (excess / order.total_amount) * 100;

        excessiveOrders.push({
          id: order.id,
          orderNo: order.order_no,
          orderAmount: order.total_amount,
          deliveredAmount: installmentTotal,
          installmentCount: installments.length,
          excess,
          excessPercentage,
          status: order.status,
          createdAt: order.created_at,
          installments: installments
        });
      }
    });


    if (excessiveOrders.length > 0) {
      // 重篤度別に分類
      const severe = excessiveOrders.filter(o => o.excessPercentage > 50); // 50%以上過剰
      const moderate = excessiveOrders.filter(o => o.excessPercentage > 10 && o.excessPercentage <= 50); // 10-50%過剰
      const minor = excessiveOrders.filter(o => o.excessPercentage <= 10); // 10%以下過剰


      // 上位10件の詳細表示
      const top10 = excessiveOrders
        .sort((a, b) => b.excess - a.excess)
        .slice(0, 10);

      top10.forEach((order, index) => {

        // 分納詳細
        if (order.installments.length > 0) {
          order.installments
            .sort((a: any, b: any) => (a.installment_no || 0) - (b.installment_no || 0))
            .forEach((inst: any) => {
            });
        }
      });

      // 統計情報
      const totalExcess = excessiveOrders.reduce((sum, order) => sum + order.excess, 0);
      const avgExcessPercentage = excessiveOrders.reduce((sum, order) => sum + order.excessPercentage, 0) / excessiveOrders.length;


      // 日付別分析
      const dateGroups: Record<string, number> = {};
      excessiveOrders.forEach(order => {
        const date = order.createdAt.split('T')[0];
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      });

      Object.entries(dateGroups)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([date, count]) => {
        });

    } else {
    }

    return {
      totalOrders: detailedData.length,
      excessiveOrders: excessiveOrders.length,
      totalInstallments: detailedData.reduce((sum, order) => sum + (order.transactions?.length || 0), 0),
      analysis: 'completed'
    };

  } catch (error) {
    console.error('❌ 分析エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    analyzeExcessiveInstallments: typeof analyzeExcessiveInstallments;
  }
}

if (typeof window !== 'undefined') {
  window.analyzeExcessiveInstallments = analyzeExcessiveInstallments;
}