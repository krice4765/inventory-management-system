-- 現在の状態を調査
-- 1. duplicate_detection_recordsテーブルの最近のレコード
SELECT
    id,
    operation_hash,
    session_id,
    operation_type,
    resource_id,
    created_at,
    expires_at,
    is_valid
FROM duplicate_detection_records
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 2. 特定のセッションIDのレコード（エラーで表示されたもの）
SELECT
    id,
    operation_hash,
    session_id,
    operation_type,
    resource_id,
    created_at,
    expires_at,
    is_valid
FROM duplicate_detection_records
WHERE session_id = 'ae41a1b4-5686-4dd1-abba-7d257c6a4e5e'
ORDER BY created_at DESC;

-- 3. transactionsテーブルの最近のレコード
SELECT
    id,
    parent_order_id,
    transaction_type,
    created_at
FROM transactions
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 5;

-- 4. RPC関数が存在するか確認
SELECT
    proname as function_name,
    prokind as function_type,
    prosrc as source_code_snippet
FROM pg_proc
WHERE proname = 'check_and_insert_duplicate_detection';