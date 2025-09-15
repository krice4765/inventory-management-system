// 直接的な分納修正ツール
import { supabase } from '../lib/supabase';

// 確認された調整候補を直接実行
export const executeDirectCorrection = async () => {
  console.log('🔧 直接修正実行開始');

  // 確認された調整対象（safeTaxAdjustmentの結果から）
  const adjustmentCandidates = [
    {
      orderNo: 'PO250913008',
      id: '', // IDは実行時に取得
      currentAmount: 2800,
      suggestedAmount: 3080
    },
    {
      orderNo: 'PO250913007',
      id: '',
      currentAmount: 2000,
      suggestedAmount: 2200
    },
    {
      orderNo: 'PO250913006',
      id: '',
      currentAmount: 3000,
      suggestedAmount: 3300
    }
  ];

  console.log(`🎯 修正対象: ${adjustmentCandidates.length}件`);

  try {
    let successCount = 0;
    let errorCount = 0;

    for (const candidate of adjustmentCandidates) {
      console.log(`📋 処理中: ${candidate.orderNo}`);

      // まずIDを取得
      const { data: orderData, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('id, total_amount')
        .eq('order_no', candidate.orderNo)
        .single();

      if (fetchError) {
        console.error(`❌ ID取得失敗 ${candidate.orderNo}:`, fetchError);
        errorCount++;
        continue;
      }

      if (!orderData) {
        console.error(`❌ 発注書が見つかりません: ${candidate.orderNo}`);
        errorCount++;
        continue;
      }

      // 現在の金額を確認
      if (orderData.total_amount !== candidate.currentAmount) {
        console.warn(`⚠️ 金額が変更されています ${candidate.orderNo}: 予想¥${candidate.currentAmount} 実際¥${orderData.total_amount}`);
      }

      console.log(`  現在額: ¥${orderData.total_amount.toLocaleString()}`);
      console.log(`  修正額: ¥${candidate.suggestedAmount.toLocaleString()}`);
      console.log(`  調整額: ¥${(candidate.suggestedAmount - orderData.total_amount).toLocaleString()}`);

      // 金額を更新
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          total_amount: candidate.suggestedAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderData.id);

      if (updateError) {
        console.error(`❌ 更新失敗 ${candidate.orderNo}:`, updateError);
        errorCount++;
      } else {
        console.log(`✅ 修正完了: ${candidate.orderNo}`);
        successCount++;
      }
    }

    console.log('📊 修正結果:');
    console.log(`  成功: ${successCount}件`);
    console.log(`  失敗: ${errorCount}件`);
    console.log(`  修正率: ${Math.round((successCount / adjustmentCandidates.length) * 100)}%`);

    if (successCount > 0) {
      console.log('🎉 一部の過剰分納問題が解決されました！');
      console.log('📋 次のステップ: 他の発注書も確認してください');
    }

    return {
      status: 'completed',
      successCount,
      errorCount,
      totalAdjusted: adjustmentCandidates.reduce((sum, c) => sum + (c.suggestedAmount - c.currentAmount), 0)
    };

  } catch (error) {
    console.error('❌ 修正エラー:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 修正後の確認
export const verifyCorrections = async () => {
  console.log('🔍 修正結果確認');

  const verifyOrders = ['PO250913008', 'PO250913007', 'PO250913006'];

  try {
    for (const orderNo of verifyOrders) {
      console.log(`📋 確認中: ${orderNo}`);

      // 発注書情報を取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, total_amount')
        .eq('order_no', orderNo)
        .single();

      if (orderError || !order) {
        console.error(`❌ 発注書取得失敗: ${orderNo}`);
        continue;
      }

      // 分納情報を取得
      const { data: installments, error: installmentError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (installmentError) {
        console.error(`❌ 分納取得失敗: ${orderNo}`);
        continue;
      }

      const deliveredTotal = (installments || []).reduce((sum, inst) => sum + inst.total_amount, 0);
      const difference = Math.abs(order.total_amount - deliveredTotal);

      console.log(`  発注額: ¥${order.total_amount.toLocaleString()}`);
      console.log(`  分納額: ¥${deliveredTotal.toLocaleString()}`);
      console.log(`  差額: ¥${difference.toLocaleString()}`);

      if (difference < 1) {
        console.log(`  ✅ 完全一致: ${orderNo}`);
      } else if (difference <= 10) {
        console.log(`  ⚠️ 軽微な差額: ${orderNo}`);
      } else {
        console.log(`  ❌ 問題継続: ${orderNo}`);
      }

      console.log('---');
    }

    return { status: 'verified' };

  } catch (error) {
    console.error('❌ 確認エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// より多くの発注書を確認（段階的）
export const expandedTaxAdjustment = async () => {
  console.log('🔍 拡張税込調整確認');

  try {
    // 次の10件を確認
    const { data: nextOrders, error } = await supabase
      .from('purchase_orders')
      .select('id, order_no, total_amount, created_at')
      .order('created_at', { ascending: false })
      .range(10, 19); // 11-20件目

    if (error) {
      console.error('❌ データ取得エラー:', error);
      return;
    }

    if (!nextOrders || nextOrders.length === 0) {
      console.log('📝 追加の発注書がありません');
      return;
    }

    console.log(`📋 追加確認: ${nextOrders.length}件`);

    const additionalCandidates: Array<{
      orderNo: string;
      currentAmount: number;
      deliveredAmount: number;
      suggestedAmount: number;
    }> = [];

    for (const order of nextOrders) {
      const { data: installments } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (!installments || installments.length === 0) continue;

      const deliveredTotal = installments.reduce((sum, inst) => sum + inst.total_amount, 0);
      const ratio = deliveredTotal / order.total_amount;

      console.log(`  ${order.order_no}: 比率 ${ratio.toFixed(3)}`);

      if (ratio >= 1.08 && ratio <= 1.12) {
        const suggestedAmount = Math.round(order.total_amount * 1.1);
        const diffFromSuggested = Math.abs(deliveredTotal - suggestedAmount);

        if (diffFromSuggested < 1000) {
          console.log(`    🎯 追加候補: ${order.order_no}`);
          additionalCandidates.push({
            orderNo: order.order_no,
            currentAmount: order.total_amount,
            deliveredAmount: deliveredTotal,
            suggestedAmount
          });
        }
      }
    }

    console.log(`📊 追加税込調整候補: ${additionalCandidates.length}件`);

    if (additionalCandidates.length > 0) {
      console.log('🔍 追加候補詳細:');
      additionalCandidates.forEach((candidate, index) => {
        console.log(`${index + 1}. ${candidate.orderNo}`);
        console.log(`   調整額: ¥${(candidate.suggestedAmount - candidate.currentAmount).toLocaleString()}`);
      });
    }

    return {
      status: 'found_additional',
      candidates: additionalCandidates,
      checked: nextOrders.length
    };

  } catch (error) {
    console.error('❌ 拡張確認エラー:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// グローバルに公開
declare global {
  interface Window {
    executeDirectCorrection: typeof executeDirectCorrection;
    verifyCorrections: typeof verifyCorrections;
    expandedTaxAdjustment: typeof expandedTaxAdjustment;
  }
}

if (typeof window !== 'undefined') {
  window.executeDirectCorrection = executeDirectCorrection;
  window.verifyCorrections = verifyCorrections;
  window.expandedTaxAdjustment = expandedTaxAdjustment;
}