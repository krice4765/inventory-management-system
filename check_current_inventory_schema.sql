-- Day 7-8: 現在のinventory関連テーブル構造確認
-- 0922Youken.md Week 2 Phase 1: データベース基盤構築

-- ============================================
-- Step 1: 既存テーブル構造の確認
-- ============================================

-- 1. productsテーブルの現在の構造
SELECT
    'products' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 2. inventory関連テーブルの存在確認
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name LIKE '%inventory%'
   OR table_name LIKE '%stock%'
   OR table_name LIKE '%movement%'
ORDER BY table_name;

-- 3. purchase_orders関連の構造確認
SELECT
    'purchase_orders' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- 4. purchase_order_items関連の構造確認
SELECT
    'purchase_order_items' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_order_items'
ORDER BY ordinal_position;

-- 5. 出庫管理関連テーブルの確認
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name LIKE '%outbound%'
   OR table_name LIKE '%delivery%'
   OR table_name LIKE '%shipment%'
ORDER BY table_name;

-- ============================================
-- Step 2: インデックスとリレーションシップ確認
-- ============================================

-- 6. 既存のインデックス確認
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('products', 'purchase_orders', 'purchase_order_items')
ORDER BY tablename, indexname;

-- 7. 外部キー制約の確認
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('products', 'purchase_orders', 'purchase_order_items');

-- ============================================
-- Step 3: データ分析
-- ============================================

-- 8. 商品データの現在の状況
SELECT
    'products_analysis' as analysis_type,
    COUNT(*) as total_products,
    COUNT(current_stock) as with_stock_data,
    AVG(COALESCE(current_stock, 0)) as avg_stock,
    MAX(COALESCE(current_stock, 0)) as max_stock,
    MIN(COALESCE(current_stock, 0)) as min_stock
FROM products;

-- 9. 発注データの現在の状況
SELECT
    'purchase_orders_analysis' as analysis_type,
    COUNT(*) as total_orders,
    COUNT(DISTINCT partner_id) as unique_suppliers,
    AVG(total_amount) as avg_order_amount,
    COUNT(CASE WHEN status = '未納品' THEN 1 END) as undelivered_orders,
    COUNT(CASE WHEN status = '一部納品' THEN 1 END) as partial_orders,
    COUNT(CASE WHEN status = '納品完了' THEN 1 END) as completed_orders
FROM purchase_orders;

-- 10. 必要な拡張機能の確認
SELECT
    'required_extensions' as check_type,
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')
        THEN 'uuid-ossp: installed'
        ELSE 'uuid-ossp: not installed'
    END as uuid_extension,
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
        THEN 'pgcrypto: installed'
        ELSE 'pgcrypto: not installed'
    END as crypto_extension;