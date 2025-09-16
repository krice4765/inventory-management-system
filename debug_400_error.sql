-- duplicate_detection_records テーブルの400エラーを調査

-- 1. テーブル構造確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'duplicate_detection_records'
ORDER BY ordinal_position;

-- 2. 制約確認
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'duplicate_detection_records';

-- 3. RLSポリシー確認
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'duplicate_detection_records';

-- 4. インデックス確認
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'duplicate_detection_records';

-- 5. 既存重複レコードの確認
SELECT
    parent_order_id,
    transaction_type,
    installment_number,
    COUNT(*) as count,
    string_agg(id::text, ', ') as ids
FROM transactions
WHERE parent_order_id IS NOT NULL
GROUP BY parent_order_id, transaction_type, installment_number
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 10;

-- 6. 問題のある特定レコード確認（エラーで言及された注文ID）
SELECT
    id,
    parent_order_id,
    transaction_type,
    installment_number,
    created_at
FROM transactions
WHERE parent_order_id LIKE '%1d81325f-867d-4da4-8c0d-0d27fa459672%'
    OR parent_order_id LIKE '%867d-4da4-8c0d%'
ORDER BY created_at DESC;