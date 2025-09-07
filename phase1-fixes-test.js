// 🧪 Phase 1残存問題修正確認テスト
(async () => {
  console.log('🧪 Phase 1残存問題修正確認開始');
  
  const w = window;
  
  if (!w.supabase || !w.__db) {
    console.error('❌ グローバル変数未設定');
    return;
  }
  
  // 1. Products機能確認（カラムマッピング修正確認）
  try {
    console.log('\n--- 📦 Products機能確認 ---');
    
    const { data: products, error } = await w.supabase
      .from('products')
      .select('product_name, product_code, standard_price')
      .limit(1);
    
    if (!error && products) {
      console.log('✅ Products テーブルアクセス成功');
      console.log('📋 商品データサンプル:', products[0]);
    } else {
      console.error('❌ Products エラー:', error?.message);
    }
  } catch (productError) {
    console.error('❌ Products テストエラー:', productError);
  }
  
  // 2. 検索・フィルター機能確認（強化版API）
  if (w.__db?.stableViews?.getPurchaseOrdersStable) {
    console.log('\n--- 🔍 検索・フィルター機能確認 ---');
    
    // 未確定フィルターテスト
    const draftResult = await w.__db.stableViews.getPurchaseOrdersStable({
      status: 'draft',
      limit: 5
    });
    
    if (draftResult.success) {
      console.log(`✅ 未確定フィルター動作: ${draftResult.data.length}件`);
    } else {
      console.error('❌ 未確定フィルターエラー:', draftResult.error?.message);
    }
    
    // 検索機能テスト
    const searchResult = await w.__db.stableViews.getPurchaseOrdersStable({
      q: '富士',
      limit: 5
    });
    
    if (searchResult.success) {
      console.log(`✅ キーワード検索動作: ${searchResult.data.length}件`);
    } else {
      console.error('❌ 検索機能エラー:', searchResult.error?.message);
    }

    // 確定済みフィルターテスト
    const confirmedResult = await w.__db.stableViews.getPurchaseOrdersStable({
      status: 'confirmed',
      limit: 5
    });
    
    if (confirmedResult.success) {
      console.log(`✅ 確定済みフィルター動作: ${confirmedResult.data.length}件`);
    }
  }
  
  // 3. 担当者名確認（安定化ビューから）
  try {
    console.log('\n--- 👤 担当者名確認 ---');
    
    const { data: ordersWithManager } = await w.supabase
      .from('purchase_orders_stable_v1')
      .select('order_no, manager_name')
      .limit(3);
    
    if (ordersWithManager) {
      console.log('📋 担当者名サンプル:');
      ordersWithManager.forEach(order => {
        console.log(`- ${order.order_no}: ${order.manager_name}`);
      });
    }
  } catch (managerError) {
    console.log('⚠️ 担当者名確認エラー:', managerError.message);
  }
  
  // 4. N/A表示撲滅確認
  try {
    console.log('\n--- 🚫 N/A表示撲滅確認 ---');
    
    const result = await w.__db.stableViews.getPurchaseOrdersStable({ limit: 5 });
    
    if (result.success && result.data) {
      let naCount = 0;
      result.data.forEach(order => {
        Object.keys(order).forEach(key => {
          if (order[key] === 'N/A' || order[key] === null) {
            naCount++;
            console.warn(`⚠️ N/A発見: ${key} = ${order[key]} (order: ${order.order_no})`);
          }
        });
      });
      
      if (naCount === 0) {
        console.log('✅ N/A表示完全撲滅確認！');
      } else {
        console.log(`⚠️ N/A表示が ${naCount} 箇所発見`);
      }
    }
  } catch (naError) {
    console.error('❌ N/A確認エラー:', naError);
  }
  
  console.log('\n🎯 Phase 1修正確認完了');
  console.log('🚀 Phase 2実装準備完了！');
})();