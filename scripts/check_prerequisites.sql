-- outbound_ordersテーブル作成前の前提条件確認

-- 1. productsテーブルの存在確認
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'products'
        )
        THEN '✅ productsテーブルが存在します'
        ELSE '❌ productsテーブルが存在しません - 先に作成が必要'
    END as products_status;

-- 2. productsテーブルの構造確認（存在する場合）
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'id'
ORDER BY ordinal_position;

-- 3. auth.usersテーブルの存在確認（Supabaseデフォルト）
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = 'users'
        )
        THEN '✅ auth.usersテーブルが存在します'
        ELSE '❌ auth.usersテーブルが存在しません'
    END as auth_users_status;

-- 4. 既存のoutbound関連テーブル確認
SELECT
    table_name,
    CASE
        WHEN table_name = 'outbound_orders' THEN '出庫管理テーブル'
        WHEN table_name = 'outbound_order_items' THEN '出庫明細テーブル'
        ELSE 'その他のoutbound関連テーブル'
    END as description
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name LIKE '%outbound%';

-- 5. 関連する外部キー制約の確認
SELECT
    constraint_name,
    table_name,
    column_name,
    foreign_table_schema,
    foreign_table_name,
    foreign_column_name
FROM information_schema.referential_constraints rc
JOIN information_schema.key_column_usage kcu_local
    ON rc.constraint_name = kcu_local.constraint_name
JOIN information_schema.key_column_usage kcu_foreign
    ON rc.unique_constraint_name = kcu_foreign.constraint_name
WHERE kcu_local.table_schema = 'public'
    AND (kcu_local.table_name LIKE '%outbound%'
         OR kcu_foreign.table_name LIKE '%outbound%'
         OR kcu_foreign.table_name = 'products');

-- 6. サンプル商品データの存在確認（outbound_order_items作成時に必要）
SELECT
    COUNT(*) as product_count,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ 商品データが存在します (' || COUNT(*) || '件)'
        ELSE '⚠️ 商品データがありません - テスト用商品の作成を推奨'
    END as product_data_status
FROM products
WHERE is_active = true;