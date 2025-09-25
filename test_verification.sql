-- 出庫管理システム実装確認用クエリ
-- テスト前にこれらを実行して実装状況を確認

-- 1. 新規テーブル存在確認
SELECT
    'テーブル存在確認' as check_type,
    table_name,
    CASE
        WHEN table_name IS NOT NULL THEN '✅ 存在'
        ELSE '❌ 未作成'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('outbound_orders', 'outbound_order_items', 'inventory_fifo_layers')
ORDER BY table_name;

-- 2. PostgreSQL関数存在確認
SELECT
    'PostgreSQL関数確認' as check_type,
    routine_name,
    CASE
        WHEN routine_name IS NOT NULL THEN '✅ 実装済み'
        ELSE '❌ 未実装'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('calculate_order_tax', 'calculate_fifo_valuation', 'update_inventory_with_lock', 'get_tax_display_preference')
ORDER BY routine_name;

-- 3. 既存テーブル拡張確認
SELECT
    'orders拡張確認' as check_type,
    column_name,
    data_type,
    CASE
        WHEN column_name IS NOT NULL THEN '✅ 追加済み'
        ELSE '❌ 未追加'
    END as status
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('due_date', 'shipping_cost', 'shipping_tax_rate', 'assigned_user_id')
ORDER BY column_name;

-- 4. inventory拡張確認
SELECT
    'inventory拡張確認' as check_type,
    column_name,
    data_type,
    CASE
        WHEN column_name IS NOT NULL THEN '✅ 追加済み'
        ELSE '❌ 未追加'
    END as status
FROM information_schema.columns
WHERE table_name = 'inventory'
AND column_name IN ('valuation_price_tax_excluded', 'valuation_price_tax_included', 'reserved_quantity', 'last_fifo_calculation')
ORDER BY column_name;

-- 5. RLSポリシー確認
SELECT
    'RLSポリシー確認' as check_type,
    tablename,
    policyname,
    '✅ 設定済み' as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('outbound_orders', 'outbound_order_items', 'inventory_fifo_layers')
ORDER BY tablename, policyname;

-- 6. インデックス確認
SELECT
    'インデックス確認' as check_type,
    tablename,
    indexname,
    '✅ 作成済み' as status
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
AND tablename IN ('orders', 'products', 'inventory_fifo_layers', 'outbound_orders', 'outbound_order_items')
ORDER BY tablename, indexname;