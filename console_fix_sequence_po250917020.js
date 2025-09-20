// ブラウザコンソールでPO250917020の分納順序を修正
// 実際の分納実行時間に基づいて正しい番号を割り当て

console.log('🔧 PO250917020の分納順序修正を開始...');

try {
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

    // 2. 現在の分納取引を時間順で取得
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, installment_no, total_amount, created_at, memo')
      .eq('parent_order_id', orderId)
      .eq('transaction_type', 'purchase')
      .eq('status', 'confirmed')
      .gt('total_amount', 0)
      .order('created_at', { ascending: true });

    console.log('📊 現在の分納取引（時間順）:');
    console.table(transactions?.map((t, index) => ({
      現在番号: t.installment_no,
      正しい番号: index + 1,
      金額: t.total_amount,
      作成時間: new Date(t.created_at).toLocaleString('ja-JP'),
      修正必要: t.installment_no !== (index + 1) ? '❌ Yes' : '✅ No'
    })));

    // 3. 分納番号を時間順に修正
    if (transactions && transactions.length > 0) {
      console.log('🔄 分納番号を時間順序で修正中...');

      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        const correctNumber = i + 1;

        if (transaction.installment_no !== correctNumber) {
          const { error } = await supabase
            .from('transactions')
            .update({
              installment_no: correctNumber,
              delivery_sequence: correctNumber,
              memo: `第${correctNumber}回`
            })
            .eq('id', transaction.id);

          if (error) {
            console.error(`❌ 取引${transaction.id}の修正エラー:`, error);
          } else {
            console.log(`✅ 取引${transaction.id}: 第${transaction.installment_no}回 → 第${correctNumber}回`);
          }
        }
      }

      console.log('🎉 PO250917020の分納順序修正完了！');
      console.log('📅 期待される結果:');
      console.log('  - 12:53の分納 → 第1回');
      console.log('  - 13:00の分納 → 第2回');
      console.log('🔄 在庫移動履歴ページをリロードして確認してください');

    } else {
      console.log('ℹ️ 修正対象の分納取引が見つかりません');
    }
  }
} catch (error) {
  console.error('❌ 修正中にエラーが発生:', error);
}

console.log('✅ PO250917020分納順序修正スクリプト完了');