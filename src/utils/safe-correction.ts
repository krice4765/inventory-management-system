// より安全な分納修正ツール
import { supabase } from '../lib/supabase';

export const safeTaxAdjustment = async () => {
  console.log('🛡️ 安全な税込調整開始');

  try {
    // Step 1: 発注書を少しずつ確認
    console.log('📋 Step 1: 発注書データ確認');

    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10); // まず10件のみ

    if (ordersError) {
      console.error('❌ 発注書取得エラー:', ordersError);
      return;
    }

    console.log(`✅ 発注書取得: ${orders?.length}件`);

    if (!orders || orders.length === 0) {
      console.log('📝 発注書がありません');
      return;
    }

    // Step 2: 各発注書の分納を個別に確認
    console.log('📦 Step 2: 分納状況確認');

    const adjustmentCandidates: Array<{
      id: string;
      orderNo: string;
      currentAmount: number;
      deliveredAmount: number;
      ratio: number;
      suggestedAmount: number;
    }> = [];

    for (const order of orders) {
      console.log(`  確認中: ${order.order_no}`);

      const { data: installments, error: installmentsError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (installmentsError) {
        console.error(`    ❌ 分納取得エラー: ${order.order_no}`, installmentsError);
        continue;
      }

      if (!installments || installments.length === 0) {
        console.log(`    ℹ️ 分納なし: ${order.order_no}`);
        continue;
      }

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;

      console.log(`    発注額: ¥${order.total_amount.toLocaleString()}`);
      console.log(`    分納額: ¥${deliveredTotal.toLocaleString()}`);
      console.log(`    比率: ${ratio.toFixed(3)}`);

      // 税込調整候補の判定
      if (ratio >= 1.08 && ratio <= 1.12) {
        const suggestedAmount = Math.round(order.total_amount * 1.1);
        const diffFromSuggested = Math.abs(deliveredTotal - suggestedAmount);

        if (diffFromSuggested < 1000) { // 1000円以内の差
          console.log(`    🎯 税込調整候補: ${order.order_no}`);
          console.log(`    推奨金額: ¥${suggestedAmount.toLocaleString()}`);

          adjustmentCandidates.push({
            id: order.id,
            orderNo: order.order_no,
            currentAmount: order.total_amount,
            deliveredAmount: deliveredTotal,
            ratio,
            suggestedAmount
          });
        }
      }
    }

    console.log(`📊 税込調整候補: ${adjustmentCandidates.length}件`);

    if (adjustmentCandidates.length === 0) {
      console.log('✅ この範囲では調整対象がありませんでした');
      return { status: 'no_candidates', checked: orders.length };
    }

    // Step 3: 調整候補の詳細表示
    console.log('🔍 Step 3: 調整候補詳細');
    adjustmentCandidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.orderNo}`);
      console.log(`   現在額: ¥${candidate.currentAmount.toLocaleString()}`);
      console.log(`   分納額: ¥${candidate.deliveredAmount.toLocaleString()}`);
      console.log(`   推奨額: ¥${candidate.suggestedAmount.toLocaleString()}`);
      console.log(`   調整額: ¥${(candidate.suggestedAmount - candidate.currentAmount).toLocaleString()}`);
    });

    return {
      status: 'candidates_found',
      candidates: adjustmentCandidates,
      checked: orders.length
    };

  } catch (error) {
    console.error('❌ 安全調整エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 実際の調整実行（確認後）
export const executeApprovedAdjustments = async (candidates: Array<{id: string, orderNo: string, suggestedAmount: number}>) => {
  console.log('🔧 承認済み調整実行');

  let successCount = 0;
  let errorCount = 0;

  for (const candidate of candidates) {
    console.log(`  調整中: ${candidate.orderNo} → ¥${candidate.suggestedAmount.toLocaleString()}`);

    const { error } = await supabase
      .from('purchase_orders')
      .update({
        total_amount: candidate.suggestedAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', candidate.id);

    if (error) {
      console.error(`    ❌ 調整失敗: ${candidate.orderNo}`, error.message);
      errorCount++;
    } else {
      console.log(`    ✅ 調整成功: ${candidate.orderNo}`);
      successCount++;
    }
  }

  console.log('📊 調整結果:');
  console.log(`  成功: ${successCount}件`);
  console.log(`  失敗: ${errorCount}件`);

  return { successCount, errorCount };
};

// 簡単な整合性確認
export const quickIntegrityCheck = async () => {
  console.log('🔍 簡易整合性チェック');

  try {
    const { data: recentOrders, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        total_amount,
        transactions!left(
          total_amount,
          installment_no
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ チェックエラー:', error);
      return;
    }

    if (!recentOrders) {
      console.log('📝 データなし');
      return;
    }

    console.log('📊 最新5件の整合性:');

    let perfect = 0;
    let minor = 0;
    let major = 0;

    recentOrders.forEach(order => {
      const installments = order.transactions || [];
      const deliveredTotal = installments.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);
      const difference = Math.abs(order.total_amount - deliveredTotal);

      let status = '';
      if (difference < 1) {
        status = '✅ 完全一致';
        perfect++;
      } else if (difference <= 100) {
        status = '⚠️ 軽微な差額';
        minor++;
      } else {
        status = '❌ 大きな差額';
        major++;
      }

      console.log(`  ${order.order_no}: ${status}`);
      console.log(`    発注額: ¥${order.total_amount.toLocaleString()}`);
      console.log(`    分納額: ¥${deliveredTotal.toLocaleString()}`);
      console.log(`    差額: ¥${difference.toLocaleString()}`);
    });

    const total = perfect + minor + major;
    const healthRate = Math.round(((perfect + minor) / total) * 100);

    console.log('📋 チェック結果:');
    console.log(`  完全一致: ${perfect}件`);
    console.log(`  軽微差額: ${minor}件`);
    console.log(`  大差額: ${major}件`);
    console.log(`  健全性: ${healthRate}%`);

    return { perfect, minor, major, healthRate };

  } catch (error) {
    console.error('❌ チェックエラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    safeTaxAdjustment: typeof safeTaxAdjustment;
    executeApprovedAdjustments: typeof executeApprovedAdjustments;
    quickIntegrityCheck: typeof quickIntegrityCheck;
  }
}

if (typeof window !== 'undefined') {
  window.safeTaxAdjustment = safeTaxAdjustment;
  window.executeApprovedAdjustments = executeApprovedAdjustments;
  window.quickIntegrityCheck = quickIntegrityCheck;
}