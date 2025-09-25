// シンプルな分納整合性チェック
import { supabase } from '../lib/supabase';

export const checkInstallmentIntegrity = async () => {

  try {
    // 1. 発注書の基本情報を取得
    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20); // まず20件で確認

    if (ordersError) {
      console.error('❌ 発注書取得エラー:', ordersError);
      return;
    }

    if (orders && orders.length > 0) {
      orders.slice(0, 3).forEach((order, index) => {
      });
    }

    // 2. 分納取引を個別に確認
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('id, parent_order_id, total_amount, installment_no, created_at')
      .not('parent_order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // 50件の分納取引

    if (transError) {
      console.error('❌ 分納取引取得エラー:', transError);
      return;
    }


    if (!orders || !transactions) {
      console.error('❌ データが取得できませんでした');
      return;
    }

    // 3. 整合性チェック

    const orderMap = new Map(orders.map(order => [order.id, order]));
    const installmentMap = new Map<string, any[]>();

    // 分納を発注書別にグループ化
    transactions.forEach(transaction => {
      const orderId = transaction.parent_order_id;
      if (!installmentMap.has(orderId)) {
        installmentMap.set(orderId, []);
      }
      installmentMap.get(orderId)?.push(transaction);
    });


    // 過剰分納をチェック
    let excessiveCount = 0;
    const excessiveDetails: Array<{
      orderNo: string;
      orderAmount: number;
      deliveredAmount: number;
      excess: number;
      installmentCount: number;
    }> = [];

    installmentMap.forEach((installments, orderId) => {
      const order = orderMap.get(orderId);
      if (!order) {
        return;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const excess = deliveredTotal - order.total_amount;

      if (excess > 0.01) { // 1円以上の過剰
        excessiveCount++;
        excessiveDetails.push({
          orderNo: order.order_no,
          orderAmount: order.total_amount,
          deliveredAmount: deliveredTotal,
          excess,
          installmentCount: installments.length
        });


        // 分納詳細
        installments
          .sort((a, b) => (a.installment_no || 0) - (b.installment_no || 0))
          .forEach(inst => {
          });
      }
    });


    if (excessiveCount > 0) {
      const totalExcess = excessiveDetails.reduce((sum, detail) => sum + detail.excess, 0);
    } else {
    }

    return {
      ordersChecked: orders.length,
      transactionsChecked: transactions.length,
      excessiveCount,
      status: 'completed'
    };

  } catch (error) {
    console.error('❌ チェックエラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    checkInstallmentIntegrity: typeof checkInstallmentIntegrity;
  }
}

if (typeof window !== 'undefined') {
  window.checkInstallmentIntegrity = checkInstallmentIntegrity;
}