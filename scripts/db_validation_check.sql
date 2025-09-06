-- ============================================================================
-- DB関数・ビュー存在確認スクリプト
-- 実行方法: Supabase Dashboard > SQL Editor で実行
-- ============================================================================

-- 実行開始のお知らせ
SELECT '🔍 DB関数・ビュー存在確認スクリプト開始' as status, 
       now() at time zone 'Asia/Tokyo' as check_time;

-- ============================================================================
-- 1. 分納関連RPC関数の確認
-- ============================================================================
SELECT '📋 分納関連RPC関数の存在確認' as section;

SELECT 
    proname as function_name,
    CASE 
        WHEN proname LIKE '%installment%' THEN '✅ 存在'
        ELSE '❓ その他'
    END as status,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname LIKE '%installment%' 
   OR proname IN ('add_purchase_installment_secure', 'list_staff_members')
ORDER BY proname;

-- ============================================================================
-- 2. システム監視関連ビューの確認  
-- ============================================================================
SELECT '📊 システム監視ビューの存在確認' as section;

SELECT 
    table_name,
    CASE 
        WHEN table_name LIKE '%system%' OR table_name LIKE '%dashboard%' OR table_name LIKE '%order_payment%' THEN '✅ 存在'
        ELSE '❓ その他'
    END as status,
    view_definition IS NOT NULL as is_view
FROM information_schema.views 
WHERE table_schema = 'public'
  AND (table_name LIKE '%system%' 
       OR table_name LIKE '%dashboard%' 
       OR table_name LIKE '%order_payment%'
       OR table_name LIKE '%staff%')
ORDER BY table_name;

-- ============================================================================
-- 3. 重要テーブルの存在とRLS設定確認
-- ============================================================================
SELECT '🔐 重要テーブルとRLS設定確認' as section;

SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS有効'
        ELSE '⚠️ RLS無効'
    END as rls_status,
    CASE 
        WHEN tablename IN ('purchase_orders', 'installments', 'staff_members', 'transactions') THEN '🎯 重要テーブル'
        ELSE '📋 一般テーブル'
    END as importance
FROM pg_tables pt
JOIN pg_class pc ON pt.tablename = pc.relname
WHERE schemaname = 'public'
  AND tablename IN ('purchase_orders', 'installments', 'staff_members', 'transactions', 'products')
ORDER BY tablename;

-- ============================================================================
-- 4. 実際のテストデータの確認
-- ============================================================================
SELECT '📦 テストデータ確認' as section;

-- 発注データ数
SELECT 
    'purchase_orders' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE total_amount > 0) as valid_amount_records,
    MAX(created_at) as latest_record
FROM purchase_orders
WHERE total_amount IS NOT NULL;

-- 分納データ数  
SELECT 
    'installments' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE amount > 0) as valid_amount_records,
    MAX(created_at) as latest_record
FROM installments
WHERE amount IS NOT NULL;

-- 担当者データ数
SELECT 
    'staff_members' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_active = true) as active_records,
    MAX(created_at) as latest_record
FROM staff_members
WHERE name IS NOT NULL;

-- ============================================================================
-- 5. 主要RPC関数の動作確認（セーフ実行）
-- ============================================================================
SELECT '🧪 主要RPC関数の動作確認' as section;

-- list_staff_members 関数の確認
DO $$
BEGIN
    BEGIN
        PERFORM public.list_staff_members(true);
        RAISE NOTICE '✅ list_staff_members 関数: 実行可能';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ list_staff_members 関数: %', SQLERRM;
    END;
    
    -- add_purchase_installment_secure 関数の存在確認（実行はしない）
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'add_purchase_installment_secure'
    ) THEN
        RAISE NOTICE '✅ add_purchase_installment_secure 関数: 存在';
    ELSE
        RAISE NOTICE '❌ add_purchase_installment_secure 関数: 不存在';
    END IF;
END $$;

-- ============================================================================
-- 6. ビュー動作確認（セーフ実行）
-- ============================================================================
SELECT '📈 ビュー動作確認' as section;

-- v_order_payment_summary の確認
DO $$
BEGIN
    BEGIN
        PERFORM 1 FROM v_order_payment_summary LIMIT 1;
        RAISE NOTICE '✅ v_order_payment_summary ビュー: アクセス可能';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ v_order_payment_summary ビュー: %', SQLERRM;
    END;
    
    BEGIN
        PERFORM 1 FROM v_system_dashboard LIMIT 1;
        RAISE NOTICE '✅ v_system_dashboard ビュー: アクセス可能';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ v_system_dashboard ビュー: %', SQLERRM;
    END;
END $$;

-- ============================================================================
-- 7. 権限設定確認
-- ============================================================================
SELECT '🔑 権限設定確認' as section;

-- RPC関数の権限確認
SELECT 
    routine_name,
    routine_type,
    security_type,
    CASE 
        WHEN security_type = 'DEFINER' THEN '✅ SECURITY DEFINER'
        ELSE '⚠️ その他'
    END as security_status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%installment%'
ORDER BY routine_name;

-- ============================================================================
-- 8. 統計情報とパフォーマンス指標
-- ============================================================================
SELECT '📊 統計情報' as section;

-- テーブルサイズ確認
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_tup_ins as inserted_rows,
    n_tup_upd as updated_rows,
    n_tup_del as deleted_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename IN ('purchase_orders', 'installments', 'staff_members', 'transactions')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 9. 最終判定結果
-- ============================================================================
SELECT '🎯 最終判定結果' as section;

WITH validation_summary AS (
    SELECT 
        -- RPC関数の存在確認
        (SELECT COUNT(*) FROM pg_proc WHERE proname = 'add_purchase_installment_secure') as installment_rpc_exists,
        (SELECT COUNT(*) FROM pg_proc WHERE proname = 'list_staff_members') as staff_rpc_exists,
        
        -- ビューの存在確認
        (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'v_order_payment_summary' AND table_schema = 'public') as payment_view_exists,
        (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'v_system_dashboard' AND table_schema = 'public') as dashboard_view_exists,
        
        -- テーブルとRLS確認
        (SELECT COUNT(*) FROM pg_tables pt JOIN pg_class pc ON pt.tablename = pc.relname 
         WHERE schemaname = 'public' AND tablename IN ('purchase_orders', 'installments', 'staff_members') 
         AND pc.relrowsecurity) as rls_enabled_tables,
         
        -- データ存在確認
        (SELECT COUNT(*) FROM purchase_orders WHERE total_amount > 0) as valid_orders,
        (SELECT COUNT(*) FROM staff_members WHERE is_active = true) as active_staff
)
SELECT 
    CASE 
        WHEN installment_rpc_exists > 0 AND staff_rpc_exists > 0 THEN '✅ RPC関数'
        ELSE '❌ RPC関数不足'
    END as rpc_status,
    CASE 
        WHEN payment_view_exists > 0 AND dashboard_view_exists > 0 THEN '✅ ビュー'
        ELSE '❌ ビュー不足'
    END as view_status,
    CASE 
        WHEN rls_enabled_tables >= 3 THEN '✅ セキュリティ'
        ELSE '⚠️ RLS設定要確認'
    END as security_status,
    CASE 
        WHEN valid_orders > 0 AND active_staff > 0 THEN '✅ テストデータ'
        ELSE '⚠️ テストデータ不足'
    END as data_status,
    CASE 
        WHEN installment_rpc_exists > 0 AND staff_rpc_exists > 0 
         AND payment_view_exists > 0 AND dashboard_view_exists > 0
         AND rls_enabled_tables >= 3 
         AND valid_orders > 0 AND active_staff > 0
        THEN '🎉 API統合テスト実行可能！'
        ELSE '⚠️ 修正が必要です'
    END as final_judgment
FROM validation_summary;

-- ============================================================================
-- 実行完了とアクション項目
-- ============================================================================
SELECT '✅ DB関数・ビュー存在確認完了' as status, 
       now() at time zone 'Asia/Tokyo' as completion_time;

-- 次に実行すべきアクション
SELECT 
    '📋 次のアクション項目' as section,
    '1. 上記の最終判定結果を確認してください' as action_1,
    '2. ❌や⚠️の項目がある場合は、該当するSQLスクリプトを実行してください' as action_2,
    '3. すべて✅になったら、PostgRESTスキーマキャッシュをリロードしてください' as action_3,
    '4. フロントエンドでAPIテストを実行してください' as action_4;