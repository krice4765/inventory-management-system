-- 現在のデータベーススキーマを確認するSQL
-- Supabase SQL Editorで実行してください

-- 1. 全テーブル一覧の確認
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. outbound関連のテーブル存在確認
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name LIKE '%outbound%'
ORDER BY table_name;

-- 3. 主要テーブルの存在確認（想定されるテーブル）
SELECT
    table_name,
    CASE
        WHEN table_name = 'products' THEN '✅ 商品テーブル'
        WHEN table_name = 'partners' THEN '✅ 仕入先テーブル'
        WHEN table_name = 'purchase_orders' THEN '✅ 発注管理テーブル'
        WHEN table_name = 'purchase_order_items' THEN '✅ 発注明細テーブル'
        WHEN table_name = 'outbound_orders' THEN '✅ 出庫管理テーブル'
        WHEN table_name = 'outbound_order_items' THEN '✅ 出庫明細テーブル'
        WHEN table_name = 'inventory_movements' THEN '✅ 在庫移動テーブル'
        ELSE '📋 その他'
    END as description
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'products',
        'partners',
        'purchase_orders',
        'purchase_order_items',
        'outbound_orders',
        'outbound_order_items',
        'inventory_movements'
    )
ORDER BY table_name;

-- 4. 既存テーブルの外部キー制約確認（参照関係の把握）
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema='public'
ORDER BY tc.table_name, kcu.column_name;

-- 5. productsテーブルの構造確認（outbound_ordersで参照される想定）
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'products'
ORDER BY ordinal_position;

-- 6. purchase_ordersテーブルの構造確認（類似構造の参考）
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'purchase_orders'
ORDER BY ordinal_position;