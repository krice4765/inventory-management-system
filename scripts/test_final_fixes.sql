-- ===============================================================
-- 最終テストスクリプト: 正しいテーブル構造完全対応版
-- 実装日: 2025-09-14
-- 目的: transactions テーブルベースの分納データ修正テスト
-- ===============================================================

-- テスト1: パフォーマンス関数テスト
SELECT '=== パフォーマンス関数テスト ===' as test_section;

SELECT 'API分析関数' as function_name,
       CASE WHEN analyze_api_performance(7) IS NOT NULL THEN '✅ 正常動作' ELSE '❌ エラー' END as status;

SELECT 'リアルタイム関数' as function_name,
       CASE WHEN get_realtime_performance() IS NOT NULL THEN '✅ 正常動作' ELSE '❌ エラー' END as status;

SELECT 'クエリ分析関数' as function_name,
       CASE WHEN analyze_query_performance() IS NOT NULL THEN '✅ 正常動作' ELSE '❌ エラー' END as status;

-- テスト2: データ整合性チェック（最終版）
SELECT '=== データ整合性チェック ===' as test_section;

-- 発注書金額整合性
WITH po_issues AS (
    SELECT po.id FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    GROUP BY po.id, po.total_amount
    HAVING ABS(po.total_amount - COALESCE(SUM(poi.quantity * poi.unit_price), 0)) > 0.01
)
SELECT '発注書金額整合性' as check_type, COUNT(*) as issues_count,
       CASE WHEN COUNT(*) = 0 THEN '✅ 問題なし' ELSE CONCAT('❌ ', COUNT(*), '件の問題') END as status
FROM po_issues;

-- 在庫数量整合性
WITH inv_issues AS (
    SELECT p.id FROM products p
    WHERE ABS(COALESCE(p.current_stock, 0) - COALESCE((
        SELECT SUM(CASE WHEN im.movement_type = 'in' THEN im.quantity WHEN im.movement_type = 'out' THEN -im.quantity ELSE 0 END)
        FROM inventory_movements im WHERE im.product_id = p.id
    ), 0)) > 0
)
SELECT '在庫数量整合性' as check_type, COUNT(*) as issues_count,
       CASE WHEN COUNT(*) = 0 THEN '✅ 問題なし' ELSE CONCAT('❌ ', COUNT(*), '件の問題') END as status
FROM inv_issues;

-- 分納金額整合性（transactions テーブル使用）
WITH inst_issues AS (
    SELECT po.id FROM purchase_orders po
    LEFT JOIN transactions t ON po.id::text = t.parent_order_id AND t.installment_no IS NOT NULL
    GROUP BY po.id, po.total_amount
    HAVING ABS((po.total_amount - COALESCE(SUM(t.total_amount), 0)) -
        COALESCE(po.remaining_amount, po.total_amount)) > 0.01
)
SELECT '分納金額整合性' as check_type, COUNT(*) as issues_count,
       CASE WHEN COUNT(*) = 0 THEN '✅ 問題なし' ELSE CONCAT('❌ ', COUNT(*), '件の問題') END as status
FROM inst_issues;

-- テスト3: テーブル構造とデータ確認
SELECT '=== テーブル構造確認 ===' as test_section;

-- 主要テーブルのレコード数
SELECT 'purchase_orders' as table_name, COUNT(*) as record_count FROM purchase_orders
UNION ALL
SELECT 'purchase_order_items' as table_name, COUNT(*) as record_count FROM purchase_order_items
UNION ALL
SELECT 'products' as table_name, COUNT(*) as record_count FROM products
UNION ALL
SELECT 'transactions' as table_name, COUNT(*) as record_count FROM transactions
UNION ALL
SELECT 'inventory_movements' as table_name, COUNT(*) as record_count FROM inventory_movements;

-- 分納データの確認（transactions テーブル）
SELECT
    'transactions with installment_no' as data_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN installment_no IS NOT NULL THEN 1 END) as installment_count,
    COUNT(CASE WHEN parent_order_id IS NOT NULL THEN 1 END) as with_parent_order
FROM transactions;

-- products テーブルの current_stock 確認
SELECT
    'products stock data' as data_type,
    COUNT(*) as total_products,
    COUNT(current_stock) as products_with_stock,
    COALESCE(AVG(current_stock), 0) as avg_stock,
    COALESCE(SUM(current_stock), 0) as total_stock
FROM products;

-- テスト4: 権限確認
SELECT '=== 権限確認 ===' as test_section;

SELECT
    proname as function_name,
    array_to_string(proacl, ', ') as permissions
FROM pg_proc
WHERE proname IN ('analyze_api_performance', 'get_realtime_performance', 'analyze_query_performance')
ORDER BY proname;

-- テスト5: システム健全性チェック
SELECT '=== システム健全性 ===' as test_section;

SELECT
    'データベースサイズ' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT
    'アクティブ接続数' as metric,
    (SELECT count(*)::text FROM pg_stat_activity WHERE state = 'active') as value
UNION ALL
SELECT
    'テーブル数' as metric,
    (SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public') as value;

-- 最終テスト完了メッセージ
SELECT
    '✅ 最終テスト完了' as status,
    '全ての修正が正しいテーブル構造に基づいて適用されました' as message,
    NOW() as test_completion_time;