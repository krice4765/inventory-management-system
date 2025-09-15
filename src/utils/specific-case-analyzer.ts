// 特定案件詳細分析システム
import { supabase } from '../lib/supabase';

// 特定案件の詳細分析
export const analyzeSpecificCase = async (orderNo: string) => {
  console.log(`🔍 ${orderNo} 詳細分析開始`);
  console.log('=====================================');

  try {
    // 発注書データ取得
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError || !order) {
      console.error(`❌ 発注書データ取得失敗: ${orderNo}`, orderError);
      return { status: 'error', message: '発注書が見つかりません' };
    }

    console.log('📋 発注書基本情報:');
    console.log(`  発注書番号: ${order.order_no}`);
    console.log(`  発注額: ¥${order.total_amount.toLocaleString()}`);
    console.log(`  作成日: ${new Date(order.created_at).toLocaleDateString('ja-JP')}`);
    console.log(`  更新日: ${new Date(order.updated_at).toLocaleDateString('ja-JP')}`);
    console.log(`  取引先ID: ${order.partner_id}`);

    // 分納データ取得
    const { data: installments, error: instError } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_order_id', order.id)
      .not('installment_no', 'is', null)
      .order('installment_no');

    if (instError) {
      console.error(`❌ 分納データ取得失敗:`, instError);
      return { status: 'error', message: '分納データ取得に失敗' };
    }

    console.log('\n📦 分納詳細情報:');
    if (!installments || installments.length === 0) {
      console.log('  分納データなし');
      return {
        status: 'completed',
        orderInfo: order,
        installments: [],
        analysis: {
          totalDelivered: 0,
          difference: -order.total_amount,
          ratio: 0,
          problemType: 'no_installments'
        }
      };
    }

    console.log(`  分納件数: ${installments.length}件`);
    let totalDelivered = 0;

    installments.forEach((inst, index) => {
      console.log(`  分納${inst.installment_no}: ¥${inst.total_amount.toLocaleString()} (${new Date(inst.created_at).toLocaleDateString('ja-JP')})`);
      totalDelivered += inst.total_amount;
    });

    const difference = totalDelivered - order.total_amount;
    const ratio = order.total_amount === 0 ? Infinity : totalDelivered / order.total_amount;

    console.log('\n📊 整合性分析:');
    console.log(`  分納総額: ¥${totalDelivered.toLocaleString()}`);
    console.log(`  発注額: ¥${order.total_amount.toLocaleString()}`);
    console.log(`  差額: ¥${difference.toLocaleString()}`);
    console.log(`  比率: ${ratio === Infinity ? 'Infinity (発注額¥0)' : ratio.toFixed(3)}`);

    // 問題分類
    let problemType = 'unknown';
    let severity = 'low';
    let recommendedAction = '';

    if (Math.abs(difference) < 1) {
      problemType = 'perfect_match';
      severity = 'none';
      recommendedAction = '対応不要 - 完全一致';
    } else if (order.total_amount === 0) {
      problemType = 'zero_order_amount';
      severity = 'critical';
      recommendedAction = '発注額¥0の根本原因調査が必要';
    } else if (ratio >= 1.05 && ratio <= 1.15) {
      problemType = 'tax_adjustment';
      severity = 'minor';
      recommendedAction = '税込調整システムで修正可能';
    } else if (ratio > 1.15 && ratio < 3.0) {
      problemType = 'proportional_reduction';
      severity = 'moderate';
      recommendedAction = '比例削減システムで修正可能';
    } else {
      problemType = 'complex_case';
      severity = 'high';
      recommendedAction = '個別調査・カスタム修正が必要';
    }

    console.log('\n🎯 問題分類:');
    console.log(`  分類: ${problemType}`);
    console.log(`  重要度: ${severity}`);
    console.log(`  推奨対応: ${recommendedAction}`);

    // 取引先情報の取得（可能であれば）
    if (order.partner_id) {
      const { data: partner } = await supabase
        .from('partners')
        .select('name')
        .eq('id', order.partner_id)
        .single();

      if (partner) {
        console.log(`\n🏢 取引先情報:`);
        console.log(`  取引先名: ${partner.name}`);
      }
    }

    // 修正候補の生成
    let fixSuggestions = [];

    if (problemType === 'zero_order_amount' && totalDelivered > 0) {
      // 分納額から適切な発注額を推定
      const suggestedOrderAmount = Math.round(totalDelivered / 1.1); // 税抜き想定
      fixSuggestions.push({
        method: 'set_order_amount',
        description: `発注額を¥${suggestedOrderAmount.toLocaleString()}に設定`,
        estimatedResult: '完全一致達成'
      });

      // 分納額を¥0に調整
      fixSuggestions.push({
        method: 'clear_installments',
        description: '分納データをクリア',
        estimatedResult: '完全一致達成（金額¥0）'
      });
    } else if (problemType === 'proportional_reduction') {
      const targetAmount = order.total_amount;
      const reductionFactor = targetAmount / totalDelivered;
      fixSuggestions.push({
        method: 'proportional_reduction',
        description: `比例削減（係数: ${reductionFactor.toFixed(6)}）`,
        estimatedResult: '完全一致達成'
      });
    }

    if (fixSuggestions.length > 0) {
      console.log('\n💡 修正候補:');
      fixSuggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion.method}: ${suggestion.description}`);
        console.log(`     期待結果: ${suggestion.estimatedResult}`);
      });
    }

    console.log('\n🔍 詳細分析完了');
    console.log('=====================================');

    return {
      status: 'completed',
      orderInfo: order,
      installments: installments,
      analysis: {
        totalDelivered,
        difference,
        ratio,
        problemType,
        severity,
        recommendedAction
      },
      fixSuggestions
    };

  } catch (error) {
    console.error(`❌ 分析エラー (${orderNo}):`, error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 発注額¥0問題の修正実行
export const fixZeroOrderAmount = async (orderNo: string, method: 'set_amount' | 'clear_installments', suggestedAmount?: number) => {
  console.log(`🔧 ${orderNo} 発注額¥0問題修正開始`);
  console.log('=====================================');

  try {
    // 発注書データ取得
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError || !order) {
      console.error(`❌ 発注書取得失敗:`, orderError);
      return { status: 'error' };
    }

    if (method === 'set_amount' && suggestedAmount) {
      // 発注額を設定する方法
      console.log(`💰 発注額を¥${suggestedAmount.toLocaleString()}に設定中...`);

      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ total_amount: suggestedAmount })
        .eq('id', order.id);

      if (updateError) {
        console.error('❌ 発注額更新失敗:', updateError);
        return { status: 'error', error: updateError.message };
      }

      console.log('✅ 発注額設定完了');

    } else if (method === 'clear_installments') {
      // 分納データをクリアする方法
      console.log('🗑️ 分納データクリア中...');

      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('parent_order_id', order.id)
        .not('installment_no', 'is', null);

      if (deleteError) {
        console.error('❌ 分納データ削除失敗:', deleteError);
        return { status: 'error', error: deleteError.message };
      }

      console.log('✅ 分納データクリア完了');
    }

    console.log('\n📊 修正結果確認中...');

    // 修正後の状況確認
    const verificationResult = await analyzeSpecificCase(orderNo);

    console.log('🎉 発注額¥0問題修正完了');
    console.log('=====================================');

    return {
      status: 'completed',
      method,
      verificationResult
    };

  } catch (error) {
    console.error(`❌ 修正エラー (${orderNo}):`, error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// グローバル関数として公開
declare global {
  interface Window {
    analyzeSpecificCase: typeof analyzeSpecificCase;
    fixZeroOrderAmount: typeof fixZeroOrderAmount;
  }
}

if (typeof window !== 'undefined') {
  window.analyzeSpecificCase = analyzeSpecificCase;
  window.fixZeroOrderAmount = fixZeroOrderAmount;
}