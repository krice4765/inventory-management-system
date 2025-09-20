// ブラウザコンソールでPO250917020を修正
// 開発者ツールのコンソールで以下を実行してください

console.log('🔧 PO250917020の分納番号問題を修正開始...');

// 1. 発注書IDを取得
const { data: orders } = await supabase
  .from('purchase_orders')
  .select('id, order_no')
  .eq('order_no', 'PO250917020');

if (!orders || orders.length === 0) {
  console.error('❌ PO250917020が見つかりません');
} else {
  const orderId = orders[0].id;
  console.log('📋 発注書ID:', orderId);

  // 2. EnhancedInstallmentServiceで修正
  if (typeof window.EnhancedInstallmentService !== 'undefined') {
    console.log('🛠️ EnhancedInstallmentServiceで修正実行...');

    const result = await window.EnhancedInstallmentService.validateInstallmentData(orderId);

    console.log('修正結果:', result);
    console.log('✅ 修正完了:', result.fixedIssues);
    console.log('❌ 残存問題:', result.issues);

    if (result.fixedIssues.length > 0) {
      console.log('🎉 PO250917020の分納番号問題が修正されました！');
      console.log('🔄 ページをリロードして確認してください');
    }
  } else {
    console.error('❌ EnhancedInstallmentServiceが利用できません');
  }
}

// 3. 修正後の状態確認
console.log('📊 修正後の状態確認...');
const { data: transactions } = await supabase
  .from('transactions')
  .select('*')
  .eq('parent_order_id', orders[0]?.id)
  .order('created_at');

console.table(transactions?.map(t => ({
  installment_no: t.installment_no,
  amount: t.total_amount,
  memo: t.memo,
  status: t.status
})));

console.log('✅ PO250917020修正スクリプト完了');