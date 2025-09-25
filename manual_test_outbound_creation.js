// 手動テスト: 出庫指示作成システムの動作確認
// ブラウザのデベロッパーツールで実行

console.log('🧪 出庫指示作成システム手動テスト開始');

// テスト1: 基本的な出庫指示作成
const testCreateOutboundOrder = async () => {
  console.log('📝 テスト1: 基本的な出庫指示作成');

  try {
    // まず利用可能な商品を確認
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, product_name, product_code, current_stock, selling_price')
      .gt('current_stock', 0)
      .limit(3);

    if (productError) throw productError;

    console.log('🛒 利用可能商品:', products);

    if (products && products.length > 0) {
      // 出庫指示データ作成
      const testRequest = {
        customer_name: 'テスト顧客株式会社',
        request_date: '2025-09-25',
        due_date: '2025-09-28',
        notes: '手動テスト用出庫指示',
        items: products.slice(0, 2).map(product => ({
          product_id: product.id,
          quantity_requested: 2,
          unit_price_tax_excluded: Math.round(product.selling_price / 1.1)
        }))
      };

      console.log('📤 作成リクエスト:', testRequest);

      // 実際にAPIを呼び出し
      // 注意: この部分は実際のuseOutboundManagement.tsのcreateOutboundOrder関数を使用する必要があります
      console.log('✅ テストリクエスト準備完了');
      console.log('⚠️ 実際の作成には、ReactコンポーネントからAPIを呼び出してください');

      return testRequest;
    } else {
      console.log('❌ テスト可能な商品がありません');
      return null;
    }
  } catch (error) {
    console.error('❌ テスト1失敗:', error);
    return null;
  }
};

// テスト2: 在庫不足時のエラーハンドリング
const testStockShortage = async () => {
  console.log('📝 テスト2: 在庫不足エラーハンドリング');

  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, product_name, current_stock')
      .limit(1);

    if (products && products.length > 0) {
      const testRequest = {
        customer_name: '在庫不足テスト顧客',
        request_date: '2025-09-25',
        items: [{
          product_id: products[0].id,
          quantity_requested: products[0].current_stock + 100, // 在庫を超える数量
          unit_price_tax_excluded: 1000
        }]
      };

      console.log('📤 在庫不足テスト:', testRequest);
      console.log('✅ 在庫不足テストリクエスト準備完了');
      console.log('⚠️ この操作はエラーになるはずです');

      return testRequest;
    }
  } catch (error) {
    console.error('❌ テスト2失敗:', error);
    return null;
  }
};

// テスト3: 既存の出庫指示データ確認
const testFetchExistingOrders = async () => {
  console.log('📝 テスト3: 既存出庫指示データ確認');

  try {
    const { data: orders, error } = await supabase
      .from('outbound_orders')
      .select(`
        id,
        order_number,
        customer_name,
        request_date,
        status,
        total_amount,
        created_at,
        items:outbound_order_items(
          id,
          quantity_requested,
          unit_price_tax_included,
          product:products(product_name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    console.log('📋 既存出庫指示データ:', orders);
    console.log(`✅ ${orders?.length || 0}件の出庫指示が確認できました`);

    return orders;
  } catch (error) {
    console.error('❌ テスト3失敗:', error);
    return null;
  }
};

// 全テスト実行
const runAllTests = async () => {
  console.log('🚀 全テスト実行開始');

  const results = {
    test1: await testCreateOutboundOrder(),
    test2: await testStockShortage(),
    test3: await testFetchExistingOrders()
  };

  console.log('📊 テスト結果サマリー:', results);
  console.log('🏁 全テスト実行完了');

  return results;
};

// 実行方法の案内
console.log(`
🎯 テスト実行方法:
1. ブラウザで http://localhost:5174/ を開く
2. F12でデベロッパーツールを開く
3. Consoleタブで以下のコマンドを実行:

// 全テスト実行
runAllTests();

// 個別テスト実行
testCreateOutboundOrder();
testStockShortage();
testFetchExistingOrders();

// 実際の出庫指示作成ページ確認
// http://localhost:5174/outbound-orders/new
`);

// グローバルに関数を露出
window.testCreateOutboundOrder = testCreateOutboundOrder;
window.testStockShortage = testStockShortage;
window.testFetchExistingOrders = testFetchExistingOrders;
window.runAllTests = runAllTests;