-- 実際に不足しているテーブルの特定
-- 既存transactionsテーブル構造に基づく正確な不足テーブル調査

-- =====================================================
-- 1. 全テーブル存在確認（更新版）
-- =====================================================
WITH required_tables AS (
    SELECT table_name, description, priority FROM (VALUES
        -- 最重要テーブル
        ('products', '商品マスタ', 1),
        ('transactions', '取引管理（分納対応）', 1),
        ('partners', 'パートナー管理', 1),
        ('user_profiles', 'ユーザー管理', 1),
        ('purchase_orders', '発注管理', 1),

        -- 重要テーブル
        ('inventory', '在庫管理', 2),
        ('inventory_movements', '在庫移動履歴', 2),
        ('orders', '注文管理', 2),
        ('order_items', '注文明細', 2),
        ('transaction_items', '取引明細', 2),
        ('purchase_order_items', '発注明細', 2),

        -- 機能テーブル
        ('outbound_orders', '出庫管理', 3),
        ('outbound_order_items', '出庫明細', 3),
        ('tax_display_settings', '税表示設定', 3),
        ('shipping_cost_settings', '送料設定', 3),

        -- システムテーブル
        ('user_applications', 'ユーザー申請', 4),
        ('system_notifications', 'システム通知', 4),
        ('system_settings', 'システム設定', 4)
    ) AS t(table_name, description, priority)
)
SELECT
    rt.priority,
    rt.table_name,
    rt.description,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = rt.table_name
    )
    THEN '✅ 存在'
    ELSE '❌ 不足'
    END as status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = rt.table_name
    )
    THEN (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = rt.table_name)
    ELSE 0
    END as column_count
FROM required_tables rt
ORDER BY rt.priority, rt.table_name;

-- =====================================================
-- 2. 不足テーブルのみ表示
-- =====================================================
WITH required_tables AS (
    SELECT table_name, description, priority FROM (VALUES
        ('products', '商品マスタ', 1),
        ('transactions', '取引管理（分納対応）', 1),
        ('partners', 'パートナー管理', 1),
        ('user_profiles', 'ユーザー管理', 1),
        ('purchase_orders', '発注管理', 1),
        ('inventory', '在庫管理', 2),
        ('inventory_movements', '在庫移動履歴', 2),
        ('orders', '注文管理', 2),
        ('order_items', '注文明細', 2),
        ('transaction_items', '取引明細', 2),
        ('purchase_order_items', '発注明細', 2),
        ('outbound_orders', '出庫管理', 3),
        ('outbound_order_items', '出庫明細', 3),
        ('tax_display_settings', '税表示設定', 3),
        ('shipping_cost_settings', '送料設定', 3)
    ) AS t(table_name, description, priority)
)
SELECT
    '=== 不足テーブル一覧 ===' as title,
    '' as separator
UNION ALL
SELECT
    'Priority ' || rt.priority || ': ' || rt.table_name as title,
    rt.description as separator
FROM required_tables rt
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = rt.table_name
)
ORDER BY title;

-- =====================================================
-- 3. transactionsテーブルの関連テーブル確認
-- =====================================================
SELECT
    'transaction_items テーブル状況' as check_type,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_items')
         THEN '✅ 存在 - transactions との関連OK'
         ELSE '❌ 不足 - transactions との関連が不完全'
    END as status
UNION ALL
SELECT
    'purchase_order_items テーブル状況',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items')
         THEN '✅ 存在 - purchase_orders との関連OK'
         ELSE '❌ 不足 - purchase_orders との関連が不完全'
    END
UNION ALL
SELECT
    'inventory テーブル状況',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory')
         THEN '✅ 存在 - 在庫管理機能OK'
         ELSE '❌ 不足 - 在庫管理機能が不完全'
    END
UNION ALL
SELECT
    'inventory_movements テーブル状況',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_movements')
         THEN '✅ 存在 - 在庫履歴管理OK'
         ELSE '❌ 不足 - 在庫履歴管理が不完全'
    END;

-- =====================================================
-- 4. 現在存在するテーブル数とカラム数概要
-- =====================================================
SELECT
    COUNT(*) as existing_table_count,
    SUM((SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name)) as total_columns
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE';

-- =====================================================
-- 5. 次に作成すべきテーブルの優先順位
-- =====================================================
WITH missing_tables AS (
    SELECT table_name, description, priority FROM (VALUES
        ('inventory', '在庫管理 - Inventory.tsx で必須', 1),
        ('inventory_movements', '在庫履歴 - 18回使用', 1),
        ('transaction_items', '取引明細 - transactions との関連', 2),
        ('orders', '注文管理 - Orders.tsx で必須', 2),
        ('order_items', '注文明細 - orders との関連', 2),
        ('outbound_orders', '出庫管理 - 詳細ボタン修正用', 3),
        ('outbound_order_items', '出庫明細 - outbound_orders との関連', 3)
    ) AS t(table_name, description, priority)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = t.table_name
    )
)
SELECT
    '=== 次に作成すべきテーブル（優先順） ===' as action_plan,
    '' as details
UNION ALL
SELECT
    'Priority ' || priority || ': ' || table_name,
    description
FROM missing_tables
ORDER BY action_plan DESC, priority, table_name;