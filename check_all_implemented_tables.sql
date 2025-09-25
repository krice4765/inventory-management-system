-- 本プロジェクトで実装されているすべてのテーブル確認
-- Supabaseダッシュボードで実行してください

-- =====================================================
-- 1. 全テーブル一覧（詳細情報付き）
-- =====================================================
SELECT
    t.table_name,
    t.table_type,
    COALESCE(c.column_count, 0) as column_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)) as table_size,
    obj_description(quote_ident(t.table_name)::regclass) as table_comment
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

-- =====================================================
-- 2. プロジェクト主要テーブルの詳細状況
-- =====================================================
SELECT
    'Core Tables' as category,
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = main_tables.table_name)
         THEN '✓ 存在' ELSE '✗ 不在' END as status,
    description
FROM (VALUES
    ('products', '商品マスタ - 商品情報の管理'),
    ('partners', 'パートナー情報 - 取引先企業管理'),
    ('orders', '注文管理 - 顧客からの注文'),
    ('order_items', '注文明細 - 注文に含まれる商品詳細'),
    ('purchase_orders', '発注管理 - 仕入先への発注'),
    ('purchase_order_items', '発注明細 - 発注商品詳細'),
    ('inventory', '在庫管理 - 商品在庫状況'),
    ('inventory_movements', '在庫移動履歴 - 入出庫記録')
) as main_tables(table_name, description)

UNION ALL

SELECT
    'Outbound Management' as category,
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = outbound_tables.table_name)
         THEN '✓ 存在' ELSE '✗ 不在' END as status,
    description
FROM (VALUES
    ('outbound_orders', '出庫管理 - 出庫指示と出荷管理'),
    ('outbound_order_items', '出庫明細 - 出庫商品詳細')
) as outbound_tables(table_name, description)

UNION ALL

SELECT
    'User Management' as category,
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = user_tables.table_name)
         THEN '✓ 存在' ELSE '✗ 不在' END as status,
    description
FROM (VALUES
    ('profiles', 'ユーザープロファイル - ユーザー詳細情報'),
    ('user_profiles', 'ユーザープロファイル（別名）'),
    ('user_applications', 'ユーザー申請 - アカウント申請管理'),
    ('user_invitations', 'ユーザー招待 - 招待リンク管理'),
    ('system_notifications', 'システム通知 - 通知メッセージ管理'),
    ('system_settings', 'システム設定 - システム全体の設定値')
) as user_tables(table_name, description)

UNION ALL

SELECT
    'Financial & Tax' as category,
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = financial_tables.table_name)
         THEN '✓ 存在' ELSE '✗ 不在' END as status,
    description
FROM (VALUES
    ('purchase_installments', '分納管理 - 発注分納情報'),
    ('installment_transactions', '分納取引 - 分納ごとの取引記録'),
    ('tax_display_settings', '税表示設定 - 税込/税抜表示設定'),
    ('shipping_cost_settings', '送料設定 - 送料計算設定'),
    ('tax_categories', '税区分マスタ - 税率区分管理')
) as financial_tables(table_name, description)

UNION ALL

SELECT
    'FIFO & Advanced Inventory' as category,
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = fifo_tables.table_name)
         THEN '✓ 存在' ELSE '✗ 不在' END as status,
    description
FROM (VALUES
    ('inventory_fifo_layers', 'FIFO計算層 - 先入先出法計算管理'),
    ('inventory_reservations', '在庫予約 - 在庫の予約管理'),
    ('inventory_adjustments', '在庫調整 - 在庫数量調整履歴')
) as fifo_tables(table_name, description)
ORDER BY category, status DESC, table_name;

-- =====================================================
-- 3. テーブル間のリレーション（外部キー）確認
-- =====================================================
SELECT
    tc.table_name as "From Table",
    kcu.column_name as "From Column",
    ccu.table_name as "To Table",
    ccu.column_name as "To Column",
    tc.constraint_name as "Constraint Name"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- 4. インデックス一覧
-- =====================================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- 5. RLS (Row Level Security) 設定状況
-- =====================================================
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

-- =====================================================
-- 6. トリガー一覧
-- =====================================================
SELECT
    event_object_table as table_name,
    trigger_name,
    event_manipulation as trigger_event,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- 7. ストアドファンション一覧
-- =====================================================
SELECT
    routine_name as function_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- =====================================================
-- 8. カラム詳細情報（主要テーブル）
-- =====================================================
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE
        WHEN c.data_type = 'character varying' THEN c.character_maximum_length::text
        WHEN c.data_type = 'numeric' THEN c.numeric_precision::text || ',' || c.numeric_scale::text
        ELSE null
    END as type_details,
    col_description(pgc.oid, c.ordinal_position) as column_comment
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name IN ('products', 'orders', 'inventory', 'outbound_orders', 'purchase_orders', 'partners')
ORDER BY t.table_name, c.ordinal_position;

-- =====================================================
-- 9. データ件数概要
-- =====================================================
DO $$
DECLARE
    table_record RECORD;
    sql_text TEXT;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '=== Table Row Counts ===';
    FOR table_record IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        sql_text := 'SELECT COUNT(*) FROM ' || quote_ident(table_record.table_name);
        EXECUTE sql_text INTO row_count;
        RAISE NOTICE '% : % rows', table_record.table_name, row_count;
    END LOOP;
END $$;

-- =====================================================
-- 10. 実装状況サマリー
-- =====================================================
WITH table_status AS (
    SELECT
        CASE
            WHEN table_name IN ('products', 'partners', 'purchase_orders', 'user_profiles') THEN 'Existing'
            WHEN table_name IN ('orders', 'inventory', 'outbound_orders') THEN 'Missing (Priority 1)'
            ELSE 'Other'
        END as status_category,
        COUNT(*) as table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    GROUP BY status_category
)
SELECT
    '=== プロジェクト実装状況サマリー ===' as summary_title,
    '' as spacer1
UNION ALL
SELECT
    status_category || ': ' || table_count::text || ' tables' as summary_title,
    '' as spacer1
FROM table_status
ORDER BY summary_title;