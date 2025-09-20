-- PO250917020の分納番号問題の即座修正

-- 1. 現在のデータ状況確認
SELECT
    'PO250917020 修正前の状況:' as step,
    t.id,
    t.installment_no,
    t.delivery_sequence,
    t.total_amount,
    t.memo,
    t.created_at
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
ORDER BY t.created_at;

-- 2. 不要な初期データ（0円、空メモ、draft等）を削除
DELETE FROM transactions
WHERE id IN (
    SELECT t.id
    FROM transactions t
    JOIN purchase_orders po ON t.parent_order_id = po.id
    WHERE po.order_no = 'PO250917020'
      AND (
          t.total_amount <= 0 OR
          t.memo = '' OR
          t.memo IS NULL OR
          t.status = 'draft'
      )
);

-- 3. 残った有効な取引の分納番号を1から振り直し
WITH ordered_transactions AS (
    SELECT
        t.id,
        ROW_NUMBER() OVER (ORDER BY t.created_at) as new_installment_no
    FROM transactions t
    JOIN purchase_orders po ON t.parent_order_id = po.id
    WHERE po.order_no = 'PO250917020'
      AND t.total_amount > 0
      AND t.memo != ''
      AND t.status = 'confirmed'
)
UPDATE transactions
SET
    installment_no = ot.new_installment_no,
    delivery_sequence = ot.new_installment_no,
    memo = '第' || ot.new_installment_no || '回'
FROM ordered_transactions ot
WHERE transactions.id = ot.id;

-- 4. 修正後の確認
SELECT
    'PO250917020 修正後の状況:' as step,
    t.id,
    t.installment_no,
    t.delivery_sequence,
    t.total_amount,
    t.memo,
    t.created_at
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
ORDER BY t.installment_no;

-- 5. 結果確認
SELECT
    CASE
        WHEN COUNT(*) = 1 AND MIN(installment_no) = 1
        THEN '✅ 修正成功: 第1回のみ存在'
        ELSE '❌ 修正確認が必要: ' || COUNT(*) || '件存在、最小番号=' || MIN(installment_no)
    END as result
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020';