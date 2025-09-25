-- シンプルな税区分マイグレーション状態確認
-- Supabase SQL Editorで実行可能

-- 1. ENUM型の存在確認
SELECT
    'tax_category_enum' as check_item,
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_category_enum')
        THEN '✅ 存在'
        ELSE '❌ 存在しない'
    END as status;

-- 2. productsテーブルのカラム確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('tax_category', 'tax_category_updated_at', 'tax_category_updated_by')
ORDER BY column_name;

-- 3. インデックス確認
SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename = 'products'
AND indexname LIKE '%tax_category%';

-- 4. 商品データの税区分分布確認（カラムが存在する場合）
SELECT
    tax_category,
    COUNT(*) as count,
    ROUND((COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100), 1) as percentage
FROM products
WHERE tax_category IS NOT NULL
GROUP BY tax_category
ORDER BY tax_category;

-- 5. 総商品数と税区分設定状況
SELECT
    COUNT(*) as total_products,
    COUNT(tax_category) as with_tax_category,
    COUNT(*) - COUNT(tax_category) as without_tax_category,
    ROUND((COUNT(tax_category)::DECIMAL / COUNT(*) * 100), 1) as completion_rate
FROM products;

-- 6. 関数の存在確認
SELECT
    proname as function_name,
    prosrc as function_source_preview
FROM pg_proc
WHERE proname IN ('get_product_tax_rate', 'calculate_product_tax', 'validate_tax_category_setup');