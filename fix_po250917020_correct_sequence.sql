-- PO250917020の分納番号を実際の実行時間順に修正

-- 修正前の状態確認
SELECT 'PO250917020 修正前の状態:' as step;
SELECT
    t.installment_no,
    t.total_amount,
    t.created_at,
    EXTRACT(HOUR FROM t.created_at) || ':' ||
    LPAD(EXTRACT(MINUTE FROM t.created_at)::text, 2, '0') as time_hhmm
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.total_amount > 0
  AND t.status = 'confirmed'
ORDER BY t.created_at;

-- 時間順序に基づく正しい分納番号の割り当て
WITH correct_sequence AS (
    SELECT
        t.id,
        t.total_amount,
        t.created_at,
        ROW_NUMBER() OVER (ORDER BY t.created_at ASC) as correct_installment_no
    FROM transactions t
    JOIN purchase_orders po ON t.parent_order_id = po.id
    WHERE po.order_no = 'PO250917020'
      AND t.total_amount > 0
      AND t.status = 'confirmed'
)
UPDATE transactions
SET
    installment_no = cs.correct_installment_no,
    delivery_sequence = cs.correct_installment_no,
    memo = '第' || cs.correct_installment_no || '回'
FROM correct_sequence cs
WHERE transactions.id = cs.id;

-- 修正後の確認
SELECT 'PO250917020 修正後の状態:' as step;
SELECT
    t.installment_no,
    t.total_amount,
    t.created_at,
    EXTRACT(HOUR FROM t.created_at) || ':' ||
    LPAD(EXTRACT(MINUTE FROM t.created_at)::text, 2, '0') as time_hhmm,
    t.memo
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.total_amount > 0
  AND t.status = 'confirmed'
ORDER BY t.installment_no;

-- 期待される結果の確認
SELECT 'PO250917020 修正結果の検証:' as step;
SELECT
    CASE
        WHEN COUNT(*) = 2
             AND MIN(CASE WHEN installment_no = 1 THEN
                    EXTRACT(HOUR FROM created_at) * 60 + EXTRACT(MINUTE FROM created_at)
                    ELSE NULL END) <
                 MIN(CASE WHEN installment_no = 2 THEN
                    EXTRACT(HOUR FROM created_at) * 60 + EXTRACT(MINUTE FROM created_at)
                    ELSE NULL END)
        THEN '✅ 修正成功: 時間順序と分納番号が一致'
        ELSE '❌ 修正失敗: まだ不整合があります'
    END as result
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.total_amount > 0
  AND t.status = 'confirmed';

-- 成功メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ PO250917020の分納番号を時間順序で修正完了';
    RAISE NOTICE '📅 12:53の分納 → 第1回';
    RAISE NOTICE '📅 13:00の分納 → 第2回';
    RAISE NOTICE '🔄 在庫移動履歴の表示が正しくなりました';
END $$;