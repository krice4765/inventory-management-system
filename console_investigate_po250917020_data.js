// PO250917020のデータ状況詳細調査
// 分納番号重複問題の実態を把握

console.log('🔍 PO250917020のデータ状況詳細調査開始...');

try {
  // 1. 発注書情報取得
  const { data: orders } = await supabase
    .from('purchase_orders')
    .select('id, order_no, total_amount, created_at')
    .eq('order_no', 'PO250917020');

  if (!orders || orders.length === 0) {
    console.error('❌ PO250917020が見つかりません');
    return;
  }

  const order = orders[0];
  console.log('📋 発注書情報:');
  console.log(`  発注番号: ${order.order_no}`);
  console.log(`  発注金額: ¥${order.total_amount}`);
  console.log(`  作成日時: ${new Date(order.created_at).toLocaleString('ja-JP')}`);

  // 2. 全分納取引の詳細取得
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, transaction_no, installment_no, delivery_sequence, total_amount, memo, status, created_at')
    .eq('parent_order_id', order.id)
    .order('created_at');

  console.log('\n📊 全分納取引一覧（作成時間順）:');
  if (transactions && transactions.length > 0) {
    transactions.forEach((t, index) => {
      const time = new Date(t.created_at).toLocaleString('ja-JP');
      console.log(`${index + 1}. ${time}`);
      console.log(`   分納番号: ${t.installment_no} | 金額: ¥${t.total_amount} | ステータス: ${t.status}`);
      console.log(`   メモ: ${t.memo || '(なし)'}`);
      console.log(`   取引ID: ${t.id.substring(0, 8)}...`);
    });

    // 3. 分納番号の重複チェック
    const installmentCounts = {};
    transactions.forEach(t => {
      if (t.installment_no) {
        installmentCounts[t.installment_no] = (installmentCounts[t.installment_no] || 0) + 1;
      }
    });

    console.log('\n🔢 分納番号の重複チェック:');
    Object.keys(installmentCounts).forEach(num => {
      const count = installmentCounts[num];
      if (count > 1) {
        console.log(`❌ 第${num}回: ${count}件の重複`);
      } else {
        console.log(`✅ 第${num}回: 正常（1件）`);
      }
    });

    // 4. 理想的な分納番号順序の提案
    console.log('\n💡 理想的な分納番号順序:');
    transactions.forEach((t, index) => {
      const time = new Date(t.created_at).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const idealNo = index + 1;
      const isCorrect = t.installment_no === idealNo;
      console.log(`${time} の ¥${t.total_amount} → 第${idealNo}回 ${isCorrect ? '✅' : '❌ (現在:第' + t.installment_no + '回)'}`);
    });

  } else {
    console.log('ℹ️ 分納取引が見つかりません');
  }

  // 5. データベース制約の確認
  console.log('\n🔧 データベース制約チェック:');
  console.log('分納番号の一意制約が有効かどうかは、SQLで確認する必要があります');
  console.log('制約がない場合、同じ分納番号が複数作成される可能性があります');

} catch (error) {
  console.error('❌ 調査中にエラーが発生:', error);
}

console.log('\n✅ PO250917020データ調査完了');
console.log('📝 次のステップ: データベース制約の追加と分納番号の修正');