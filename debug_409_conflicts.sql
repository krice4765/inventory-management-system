-- 409 Conflict エラーの調査とクリーンアップ
-- uq_transactions_parent_type_installment 制約違反の原因特定

-- 1. 重複トランザクションレコードの特定
SELECT
    parent_order_id,
    transaction_type,
    installment_number,
    COUNT(*) as duplicate_count,
    string_agg(id::text, ', ') as duplicate_ids,
    string_agg(created_at::text, ', ') as creation_times
FROM transactions
WHERE parent_order_id IS NOT NULL
GROUP BY parent_order_id, transaction_type, installment_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, parent_order_id;

-- 2. 最近の分納トランザクション（エラーが発生している可能性の高いもの）
SELECT
    id,
    parent_order_id,
    transaction_type,
    installment_number,
    amount,
    created_at,
    updated_at
FROM transactions
WHERE transaction_type = 'installment'
    AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 3. uq_transactions_parent_type_installment 制約の詳細確認
SELECT
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'transactions'
    AND conname LIKE '%uq_transactions_parent_type_installment%';

-- 4. 特定の parent_order_id での重複確認（スクショから推測される問題のあるID）
SELECT
    id,
    parent_order_id,
    transaction_type,
    installment_number,
    amount,
    created_at
FROM transactions
WHERE parent_order_id IN (
    SELECT parent_order_id
    FROM transactions
    WHERE parent_order_id IS NOT NULL
    GROUP BY parent_order_id, transaction_type, installment_number
    HAVING COUNT(*) > 1
)
ORDER BY parent_order_id, installment_number, created_at;

-- 5. duplicate_detection_records テーブルの状況
SELECT
    operation_hash,
    operation_type,
    resource_id,
    session_id,
    created_at,
    expires_at,
    COUNT(*) as hash_count
FROM duplicate_detection_records
GROUP BY operation_hash, operation_type, resource_id, session_id, created_at, expires_at
HAVING COUNT(*) > 1
ORDER BY hash_count DESC
LIMIT 10;

-- 6. 最近24時間の duplicate_detection_records
SELECT
    id,
    operation_hash,
    operation_type,
    resource_id,
    created_at,
    expires_at,
    is_valid
FROM duplicate_detection_records
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;