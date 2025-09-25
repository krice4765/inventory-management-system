-- 現在の税区分データ内容確認
-- existing tax_category implementation analysis

-- 1. 現在設定されている税区分値の確認
SELECT
    tax_category,
    COUNT(*) as count,
    ROUND((COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100), 1) as percentage
FROM products
WHERE tax_category IS NOT NULL AND tax_category != ''
GROUP BY tax_category
ORDER BY count DESC;

-- 2. 税区分が設定されていない商品の確認
SELECT
    COUNT(*) as total_products,
    COUNT(tax_category) as with_tax_category,
    COUNT(*) - COUNT(tax_category) as null_tax_category,
    SUM(CASE WHEN tax_category = '' THEN 1 ELSE 0 END) as empty_tax_category
FROM products;

-- 3. 税区分の値の詳細分析
SELECT
    'tax_category値の種類' as analysis,
    array_agg(DISTINCT tax_category) as unique_values
FROM products
WHERE tax_category IS NOT NULL;

-- 4. 最近更新された税区分の確認
SELECT
    COUNT(*) as recently_updated,
    MAX(tax_category_updated_at) as latest_update,
    MIN(tax_category_updated_at) as earliest_update
FROM products
WHERE tax_category_updated_at IS NOT NULL;

-- 5. サンプル商品データ（税区分含む）
SELECT
    product_code,
    product_name,
    tax_category,
    tax_category_updated_at,
    created_at
FROM products
WHERE tax_category IS NOT NULL
ORDER BY tax_category_updated_at DESC NULLS LAST
LIMIT 10;