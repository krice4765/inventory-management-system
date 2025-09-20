// 分納データ確認スクリプト
// ブラウザコンソールで実行

console.log('🔍 分納データ確認開始...');

const checkData = async () => {
  try {
    // PO250920003のUUID取得
    const orderResult = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('order_no', 'PO250920003');

    console.log('📋 発注書検索結果:', orderResult);

    if (orderResult.data && orderResult.data.length > 0) {
      const orderId = orderResult.data[0].id;
      console.log('🎯 発注書ID:', orderId);

      // 分納履歴取得
      const deliveryResult = await supabase
        .from('transactions')
        .select('id, installment_no, delivery_sequence, total_amount, created_at, memo')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true });

      console.log('📊 分納履歴:', deliveryResult);

      if (deliveryResult.data) {
        deliveryResult.data.forEach((d, index) => {
          console.log(`履歴${index + 1}:`, {
            installment_no: d.installment_no,
            delivery_sequence: d.delivery_sequence,
            memo: d.memo,
            amount: d.total_amount
          });
        });
      }
    }
  } catch (error) {
    console.error('❌ エラー:', error);
  }
};

checkData();