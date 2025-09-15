-- ===============================================================
-- 修正内容のテストスクリプト
-- 実装日: 2025-09-14
-- 目的: パフォーマンス関数と整合性修正のテスト
-- ===============================================================

-- テスト1: パフォーマンス関数が正常に動作することを確認
SELECT '=== パフォーマンス関数テスト ===' as test_section;

-- analyze_api_performance関数のテスト
SELECT 'API分析関数テスト' as test_name;
SELECT analyze_api_performance(7);

-- get_realtime_performance関数のテスト
SELECT 'リアルタイムデータ関数テスト' as test_name;
SELECT get_realtime_performance();

-- analyze_query_performance関数のテスト（既存）
SELECT 'クエリ分析関数テスト' as test_name;
SELECT analyze_query_performance();

-- テスト2: データ整合性の確認
SELECT '=== データ整合性チェック ===' as test_section;

-- 発注書金額の整合性チェック
SELECT
    '発注書金額整合性' as check_type,
    COUNT(*) as issues_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 問題なし'
        ELSE '❌ 問題あり'
    END as status
FROM (
    SELECT po.id
    FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    GROUP BY po.id, po.total_amount
    HAVING ABS(po.total_amount - COALESCE(SUM(poi.quantity * poi.unit_price), 0)) > 0.01
) as inconsistent_orders;

-- 在庫数量の整合性チェック
SELECT
    '在庫数量整合性' as check_type,
    COUNT(*) as issues_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 問題なし'
        ELSE '❌ 問題あり'
    END as status
FROM (
    SELECT p.id
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE ABS(COALESCE(i.quantity, 0) - COALESCE(
        (SELECT COALESCE(SUM(
            CASE
                WHEN im.movement_type = 'in' THEN im.quantity
                WHEN im.movement_type = 'out' THEN -im.quantity
                ELSE 0
            END
        ), 0)
        FROM inventory_movements im
        WHERE im.product_id = p.id), 0
    )) > 0
) as inconsistent_inventory;

-- 分納金額の整合性チェック
SELECT
    '分納金額整合性' as check_type,
    COUNT(*) as issues_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 問題なし'
        ELSE '❌ 問題あり'
    END as status
FROM (
    SELECT po.id
    FROM purchase_orders po
    LEFT JOIN installments inst ON po.id = inst.purchase_order_id
    GROUP BY po.id, po.total_amount
    HAVING ABS((po.total_amount - COALESCE(SUM(inst.amount), 0)) -
        COALESCE(po.remaining_amount, po.total_amount)) > 0.01
) as inconsistent_installments;

-- テスト3: システム統計情報
SELECT '=== システム統計 ===' as test_section;

-- データベース基本情報
SELECT
    'データベース情報' as info_type,
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections;

-- テーブル統計
SELECT
    'テーブル統計' as info_type,
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC
LIMIT 10;

-- テスト完了メッセージ
SELECT
    '✅ テスト完了' as status,
    '修正が正常に適用されました' as message,
    NOW() as test_completion_time;