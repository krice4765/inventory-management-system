-- 現在のRPC関数とテーブル構成を確認

-- 1. 現在存在するinstallment関連の関数を確認
SELECT
    proname as function_name,
    prosrc as source_snippet,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '%installment%' OR proname LIKE '%create_%';

-- 2. transaction_itemsテーブルの構造確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transaction_items'
ORDER BY ordinal_position;

-- 3. 現在のtransactionsテーブルの構造確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- 4. 現在のRLSポリシー確認
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('transactions', 'transaction_items', 'inventory_balances')
ORDER BY tablename, cmd;

-- 5. 最近の分納データサンプル確認
SELECT
    t.id,
    t.transaction_no,
    t.installment_no,
    t.total_amount,
    t.created_at,
    COUNT(ti.id) as item_count
FROM transactions t
LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
WHERE t.transaction_type = 'purchase'
GROUP BY t.id, t.transaction_no, t.installment_no, t.total_amount, t.created_at
ORDER BY t.created_at DESC
LIMIT 5;