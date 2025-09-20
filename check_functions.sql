-- データベース関数の存在確認と修正
-- 分納番号バグ修正用

-- 1. 現在の関数一覧確認
SELECT
    routine_name,
    routine_type,
    created
FROM information_schema.routines
WHERE routine_name LIKE '%installment%'
ORDER BY routine_name;

-- 2. add_purchase_installment_v2の存在確認
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_name = 'add_purchase_installment_v2'
        ) THEN '✅ add_purchase_installment_v2が存在します'
        ELSE '❌ add_purchase_installment_v2が存在しません'
    END as v2_function_status;

-- 3. 現在のPO250920003の分納状況確認
SELECT
    t.id,
    t.transaction_no,
    t.installment_no,
    t.total_amount,
    t.memo,
    t.created_at,
    po.order_no
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250920003'
    AND t.transaction_type = 'purchase'
ORDER BY t.created_at;