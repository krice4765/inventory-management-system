-- PO250917020の分納番号問題調査

-- 1. 発注書の基本情報確認
SELECT 'PO250917020 発注書情報:' as info;
SELECT
    id,
    order_no,
    total_amount,
    created_at,
    status
FROM purchase_orders
WHERE order_no = 'PO250917020';

-- 2. 関連する全取引の詳細確認
SELECT 'PO250917020 関連取引一覧:' as info;
SELECT
    t.id,
    t.transaction_no,
    t.installment_no,
    t.delivery_sequence,
    t.total_amount,
    t.memo,
    t.status,
    t.created_at,
    t.parent_order_id,
    po.order_no
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
ORDER BY t.created_at, t.installment_no;

-- 3. 分納回次の重複や欠番チェック
SELECT 'installment_no 分析:' as info;
SELECT
    installment_no,
    COUNT(*) as count,
    STRING_AGG(total_amount::text, ', ') as amounts,
    STRING_AGG(memo, ', ') as memos
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
GROUP BY installment_no
ORDER BY installment_no;

-- 4. 0円や空データの存在確認
SELECT '不正データチェック:' as info;
SELECT
    t.id,
    t.installment_no,
    t.total_amount,
    t.memo,
    t.status,
    CASE
        WHEN t.total_amount <= 0 THEN '❌ 0円以下'
        WHEN t.memo = '' OR t.memo IS NULL THEN '❌ 空メモ'
        WHEN t.status != 'confirmed' THEN '❌ 未確定'
        ELSE '✅ 正常'
    END as status_check
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020';

-- 5. 期待される状態 vs 実際の状態
SELECT '期待値 vs 実際の値:' as info;
SELECT
    '期待値: 第1回のみ存在、金額=¥16,720、installment_no=1' as expected,
    '実際値: ' || COUNT(*) || '件の取引、installment_no範囲=' ||
    MIN(installment_no) || '~' || MAX(installment_no) as actual
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020';