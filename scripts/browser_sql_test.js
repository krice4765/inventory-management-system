// ブラウザコンソールで実行するためのSQLテストコード
// 開発者ツール > コンソールでこのコードを実行

// Step 1: まず基本的なデータ確認
const testBasicData = async () => {
  console.log('🔄 基本データ確認中...');

  try {
    // 総発注書数
    const { data: orders, count: orderCount } = await window.supabase
      .from('purchase_orders')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log('📊 総発注書数:', orderCount);

    // 大額取引の確認
    const { data: largeOrders, count: largeCount } = await window.supabase
      .from('purchase_orders')
      .select('id, total_amount', { count: 'exact' })
      .gt('total_amount', 10000000);

    console.log('💰 1000万円以上の発注書:', largeCount);
    if (largeCount > 0) {
      console.log('📝 大額取引例:', largeOrders.slice(0, 3));
    }

    // 分納取引の確認
    const { data: transactions, count: transCount } = await window.supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .not('parent_order_id', 'is', null)
      .limit(1);

    console.log('📦 分納取引数:', transCount);

    return {
      totalOrders: orderCount,
      largeOrders: largeCount,
      installments: transCount
    };

  } catch (error) {
    console.error('❌ エラー:', error);
  }
};

// Step 2: 過剰分納の確認
const checkExcessiveInstallments = async () => {
  console.log('🔄 過剰分納確認中...');

  try {
    // RPC関数が必要な場合は作成
    const { data, error } = await window.supabase.rpc('check_installment_integrity');

    if (error) {
      console.log('ℹ️ RPC関数が存在しません。直接クエリで確認します。');

      // 手動で過剰分納をチェック
      const { data: orders } = await window.supabase
        .from('purchase_orders')
        .select(`
          id,
          total_amount,
          transactions!inner(
            total_amount
          )
        `)
        .not('transactions.parent_order_id', 'is', null);

      console.log('📊 分納付き発注書:', orders?.length || 0);
      return orders;
    }

    console.log('✅ 整合性チェック結果:', data);
    return data;

  } catch (error) {
    console.error('❌ エラー:', error);
  }
};

// 実行
console.log('🚀 データ分析開始');
testBasicData().then(result => {
  console.log('📋 基本データ分析完了:', result);
  return checkExcessiveInstallments();
}).then(installmentResult => {
  console.log('📋 分納分析完了');
  console.log('✅ 全分析完了');
});