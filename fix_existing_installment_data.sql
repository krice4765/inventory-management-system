-- 既存の分納データ修正スクリプト
-- 実行前に必ずデータベースのバックアップを取ること！

-- 1. transactionsテーブルの分納回数とメモを修正
WITH numbered_transactions AS (
  SELECT
    id,
    parent_order_id,
    ROW_NUMBER() OVER (
      PARTITION BY parent_order_id
      ORDER BY created_at ASC
    ) as correct_installment_no
  FROM transactions
  WHERE transaction_type = 'purchase'
    AND status = 'confirmed'
    AND parent_order_id IS NOT NULL
)
UPDATE transactions SET
  installment_no = nt.correct_installment_no,
  delivery_sequence = nt.correct_installment_no,
  memo = CASE
    WHEN memo LIKE '%分納%' THEN '第' || nt.correct_installment_no || '回'
    ELSE memo
  END
FROM numbered_transactions nt
WHERE transactions.id = nt.id;

-- 2. 修正結果を確認するクエリ
SELECT
  parent_order_id as order_id,
  installment_no,
  delivery_sequence,
  memo,
  total_amount,
  created_at
FROM transactions
WHERE transaction_type = 'purchase'
  AND status = 'confirmed'
  AND parent_order_id IS NOT NULL
ORDER BY parent_order_id, installment_no;

-- 3. 特定の発注書の分納履歴確認（PO250917015の例）
SELECT
  po.order_no,
  t.installment_no,
  t.memo,
  t.total_amount,
  t.created_at
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917015'
  AND t.transaction_type = 'purchase'
  AND t.status = 'confirmed'
ORDER BY t.installment_no;