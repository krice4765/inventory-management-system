-- プロジェクト全体のテーブル状況確認
-- このプロジェクトで使用されている主要テーブルの存在確認

-- 1. 主要テーブルの存在確認
SELECT
    'products' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products')
         THEN '✓ 存在' ELSE '✗ 不在' END as status
UNION ALL
SELECT
    'inventory',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory')
         THEN '✓ 存在' ELSE '✗ 不在' END
UNION ALL
SELECT
    'orders',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders')
         THEN '✓ 存在' ELSE '✗ 不在' END
UNION ALL
SELECT
    'purchase_orders',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders')
         THEN '✓ 存在' ELSE '✗ 不在' END
UNION ALL
SELECT
    'partners',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partners')
         THEN '✓ 存在' ELSE '✗ 不在' END
UNION ALL
SELECT
    'outbound_orders',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outbound_orders')
         THEN '✓ 存在' ELSE '✗ 不在' END
UNION ALL
SELECT
    'outbound_order_items',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outbound_order_items')
         THEN '✓ 存在' ELSE '✗ 不在' END
UNION ALL
SELECT
    'user_profiles',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles')
         THEN '✓ 存在' ELSE '✗ 不在' END;

-- 2. テーブル数とレコード数の概要
SELECT
    t.table_name,
    COALESCE(c.column_count, 0) as column_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)) as table_size
FROM information_schema.tables t
LEFT JOIN (
    SELECT table_name, COUNT(*) as column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
) c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- 3. RLS（Row Level Security）の設定状況
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) as policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'  -- regular tables only
ORDER BY tablename;