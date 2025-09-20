-- PO250917019の初期取引自動生成問題調査
-- 実行時刻: 2025-09-17

-- 1. PO250917019関連の発注書情報を確認
SELECT
    id,
    order_no,
    partner_id,
    order_date,
    delivery_deadline,
    total_amount,
    status,
    memo,
    created_at,
    updated_at
FROM purchase_orders
WHERE order_no = 'PO250917019';

-- 2. PO250917019に関連する全ての取引レコードを確認（初期取引含む）
SELECT
    t.id,
    t.transaction_type,
    t.transaction_no,
    t.parent_order_id,
    t.partner_id,
    t.transaction_date,
    t.due_date,
    t.status,
    t.total_amount,
    t.memo,
    t.installment_no,
    t.created_at,
    t.updated_at,

    -- 発注書情報も結合
    po.order_no as parent_order_no,
    po.total_amount as parent_total_amount
FROM transactions t
LEFT JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917019'
ORDER BY t.created_at ASC;

-- 3. 発注書作成と同じタイムスタンプで作られた取引を確認
SELECT
    po.order_no,
    po.created_at as order_created,
    t.transaction_no,
    t.total_amount,
    t.created_at as transaction_created,
    (t.created_at - po.created_at) as time_diff_seconds,
    t.memo
FROM purchase_orders po
LEFT JOIN transactions t ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917019'
ORDER BY po.created_at, t.created_at;

-- 4. 同様のパターンで初期取引が作られている他の発注書を確認
SELECT
    po.order_no,
    po.created_at as order_created,
    COUNT(t.id) as transaction_count,
    STRING_AGG(t.total_amount::text, ', ' ORDER BY t.created_at) as amounts,
    STRING_AGG(t.memo, ' | ' ORDER BY t.created_at) as memos
FROM purchase_orders po
LEFT JOIN transactions t ON t.parent_order_id = po.id
WHERE po.created_at >= '2025-09-16'  -- 最近の発注書を調査
GROUP BY po.id, po.order_no, po.created_at
HAVING COUNT(t.id) > 0  -- 取引が存在するもののみ
ORDER BY po.created_at DESC
LIMIT 10;

-- 5. 現在のトリガー状況を確認
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table IN ('purchase_orders', 'transactions')
ORDER BY event_object_table, trigger_name;

-- 6. 分納関連の関数を確認
SELECT
    routine_name,
    routine_type,
    specific_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%installment%'
   OR routine_name LIKE '%purchase%'
   OR routine_name LIKE '%transaction%'
ORDER BY routine_name;

-- 7. ビューの定義を確認（自動取引生成の可能性）
SELECT
    table_name,
    view_definition
FROM information_schema.views
WHERE table_name LIKE '%purchase%'
   OR table_name LIKE '%transaction%';