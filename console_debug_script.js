// 🔧 Console Debug Script for RPC Function
// 本番サイトのConsoleで実行してください

console.log('🚀 RPC Function Debug - Starting...');

// Supabase client should already be available on the page
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✅ Supabase client detected');
} else {
  console.error('❌ Supabase client not found - check if page loaded correctly');
}

async function debugRPC() {
  try {
    // Test 1: Get sample order data
    console.log('📊 Test 1: Getting sample order data...');

    const { data: orders, error: orderError } = await supabase
      .from('purchase_orders')
      .select('id, partner_id')
      .limit(1);

    if (orderError) {
      console.error('❌ Order query error:', orderError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.error('❌ No orders found');
      return;
    }

    const sampleOrder = orders[0];
    console.log('✅ Sample order found:', sampleOrder);

    // Test 2: Call create_safe_installment RPC
    console.log('📊 Test 2: Calling create_safe_installment...');

    const params = {
      p_parent_order_id: sampleOrder.id,
      p_partner_id: sampleOrder.partner_id,
      p_transaction_date: '2025-09-16',
      p_due_date: '2025-09-23',
      p_total_amount: 5000.00,
      p_memo: 'Debug Test Call'
    };

    console.log('📝 Parameters:', params);

    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('create_safe_installment', params);

    if (rpcError) {
      console.error('❌ RPC Error Details:');
      console.error('  Code:', rpcError.code);
      console.error('  Message:', rpcError.message);
      console.error('  Details:', rpcError.details);
      console.error('  Full Error:', rpcError);

      // Specific error analysis
      if (rpcError.code === '42883') {
        console.log('🔍 Analysis: Function does not exist or parameter mismatch');
      } else if (rpcError.code === '42501') {
        console.log('🔍 Analysis: Permission denied');
      } else {
        console.log('🔍 Analysis: Unknown error type');
      }
    } else {
      console.log('✅ RPC Success!', rpcResult);
      console.log('🎉 Function is working correctly!');
    }

    // Test 3: Check available functions
    console.log('📊 Test 3: Checking available RPC functions...');

    try {
      // This might fail but gives us insight
      const { data: functions, error: funcError } = await supabase
        .from('information_schema.routines')
        .select('routine_name')
        .ilike('routine_name', '%installment%');

      if (funcError) {
        console.log('ℹ️  Cannot query schema (expected in production)');
      } else {
        console.log('✅ Available installment functions:', functions);
      }
    } catch (err) {
      console.log('ℹ️  Schema query not available (normal in production)');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the debug
debugRPC();