-- ===============================================================
-- 修正版: 修正内容のテストスクリプト（正しいテーブル構造対応）
-- 実装日: 2025-09-14
-- 目的: パフォーマンス関数と整合性修正のテスト（products.current_stock使用）
-- ===============================================================

-- テスト1: パフォーマンス関数が正常に動作することを確認
SELECT '=== パフォーマンス関数テスト ===' as test_section;

-- analyze_api_performance関数のテスト
SELECT 'API分析関数テスト' as test_name, analyze_api_performance(7) as result;

-- get_realtime_performance関数のテスト
SELECT 'リアルタイムデータ関数テスト' as test_name, get_realtime_performance() as result;

-- analyze_query_performance関数のテスト（既存）
SELECT 'クエリ分析関数テスト' as test_name;
-- analyze_query_performance()は大きな結果を返すため、存在確認のみ
SELECT CASE WHEN analyze_query_performance() IS NOT NULL THEN '✅ 正常動作' ELSE '❌ エラー' END as status;

-- テスト2: データ整合性の確認（修正版）
SELECT '=== データ整合性チェック ===' as test_section;

-- 発注書金額の整合性チェック
SELECT
    '発注書金額整合性' as check_type,
    COUNT(*) as issues_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 問題なし'
        ELSE CONCAT('❌ ', COUNT(*), '件の問題あり')
    END as status
FROM (
    SELECT po.id
    FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    GROUP BY po.id, po.total_amount
    HAVING ABS(po.total_amount - COALESCE(SUM(poi.quantity * poi.unit_price), 0)) > 0.01
) as inconsistent_orders;

-- 在庫数量の整合性チェック（修正版 - products.current_stock使用）
SELECT
    '在庫数量整合性' as check_type,
    COUNT(*) as issues_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 問題なし'
        ELSE CONCAT('❌ ', COUNT(*), '件の問題あり')
    END as status
FROM (
    SELECT p.id
    FROM products p
    WHERE ABS(COALESCE(p.current_stock, 0) - COALESCE(
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
        ELSE CONCAT('❌ ', COUNT(*), '件の問題あり')
    END as status
FROM (
    SELECT po.id
    FROM purchase_orders po
    LEFT JOIN installments inst ON po.id = inst.purchase_order_id
    GROUP BY po.id, po.total_amount
    HAVING ABS((po.total_amount - COALESCE(SUM(inst.amount), 0)) -
        COALESCE(po.remaining_amount, po.total_amount)) > 0.01
) as inconsistent_installments;

-- テスト3: テーブル存在確認とデータ概要
SELECT '=== テーブル構造確認 ===' as test_section;

-- 主要テーブルの存在確認とレコード数
SELECT
    'テーブル統計' as info_type,
    table_name,
    (xpath('/row/count/text()', xml_count))[1]::text::integer as row_count
FROM (
    SELECT
        'products' as table_name,
        query_to_xml('SELECT COUNT(*) as count FROM products', false, true, '') as xml_count
    UNION ALL
    SELECT
        'purchase_orders' as table_name,
        query_to_xml('SELECT COUNT(*) as count FROM purchase_orders', false, true, '') as xml_count
    UNION ALL
    SELECT
        'purchase_order_items' as table_name,
        query_to_xml('SELECT COUNT(*) as count FROM purchase_order_items', false, true, '') as xml_count
    UNION ALL
    SELECT
        'installments' as table_name,
        query_to_xml('SELECT COUNT(*) as count FROM installments', false, true, '') as xml_count
    UNION ALL
    SELECT
        'inventory_movements' as table_name,
        query_to_xml('SELECT COUNT(*) as count FROM inventory_movements', false, true, '') as xml_count
) t;

-- productsテーブルのcurrent_stockカラム確認
SELECT
    'productsカラム確認' as info_type,
    COUNT(*) as total_products,
    COUNT(current_stock) as products_with_stock,
    AVG(COALESCE(current_stock, 0)) as avg_stock,
    SUM(COALESCE(current_stock, 0)) as total_stock
FROM products;

-- テスト4: システム統計情報
SELECT '=== システム統計 ===' as test_section;

-- データベース基本情報
SELECT
    'データベース情報' as info_type,
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections;

-- パフォーマンス関数の権限確認
SELECT
    'パフォーマンス関数権限' as info_type,
    prokind,
    proname,
    array_to_string(proacl, ', ') as permissions
FROM pg_proc
WHERE proname IN ('analyze_api_performance', 'get_realtime_performance', 'analyze_query_performance')
ORDER BY proname;

-- テスト完了メッセージ
SELECT
    '✅ テスト完了（修正版）' as status,
    '正しいテーブル構造に基づいた修正が適用されました' as message,
    NOW() as test_completion_time;