-- PO250917020の分納番号問題詳細調査

-- 1. PO250917020の全取引データ確認
SELECT 'PO250917020 全取引データ:' as info;
SELECT
    t.id,
    t.transaction_no,
    t.installment_no,
    t.delivery_sequence,
    t.total_amount,
    t.memo,
    t.status,
    t.created_at,
    EXTRACT(HOUR FROM t.created_at) || ':' ||
    LPAD(EXTRACT(MINUTE FROM t.created_at)::text, 2, '0') as time_display
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
ORDER BY t.created_at ASC;

-- 2. installment_no の重複チェック
SELECT 'installment_no重複チェック:' as info;
SELECT
    installment_no,
    COUNT(*) as duplicate_count,
    STRING_AGG(total_amount::text, ', ') as amounts,
    STRING_AGG(
        EXTRACT(HOUR FROM created_at) || ':' ||
        LPAD(EXTRACT(MINUTE FROM created_at)::text, 2, '0'),
        ', '
    ) as times
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.total_amount > 0
  AND t.status = 'confirmed'
GROUP BY installment_no
HAVING COUNT(*) > 1;

-- 3. getNextInstallmentNumber関数の動作シミュレーション
SELECT 'getNextInstallmentNumber関数シミュレーション:' as info;
SELECT
    MAX(installment_no) as current_max,
    MAX(installment_no) + 1 as next_would_be,
    COUNT(*) as total_transactions
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.transaction_type = 'purchase'
  AND t.status = 'confirmed'
  AND t.memo != ''
  AND t.total_amount > 0;

-- 4. 理想的な分納番号 vs 実際の番号
SELECT '理想 vs 実際の分納番号:' as info;
WITH ideal_sequence AS (
    SELECT
        t.id,
        t.installment_no as current_no,
        t.total_amount,
        t.created_at,
        ROW_NUMBER() OVER (ORDER BY t.created_at ASC) as ideal_no
    FROM transactions t
    JOIN purchase_orders po ON t.parent_order_id = po.id
    WHERE po.order_no = 'PO250917020'
      AND t.total_amount > 0
      AND t.status = 'confirmed'
)
SELECT
    id,
    current_no,
    ideal_no,
    total_amount,
    created_at,
    CASE
        WHEN current_no = ideal_no THEN '✅ 正常'
        ELSE '❌ 不整合 (現在:' || current_no || ' → 理想:' || ideal_no || ')'
    END as status
FROM ideal_sequence;

-- 5. 分納番号採番の競合状態チェック
SELECT '分納番号採番の競合状態分析:' as info;
SELECT
    '同時分納作成による競合の可能性:' as analysis,
    CASE
        WHEN COUNT(DISTINCT installment_no) < COUNT(*)
        THEN '❌ 分納番号に重複あり - 競合状態発生の可能性'
        ELSE '✅ 分納番号に重複なし'
    END as result,
    COUNT(*) as total_transactions,
    COUNT(DISTINCT installment_no) as unique_numbers
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.total_amount > 0
  AND t.status = 'confirmed';