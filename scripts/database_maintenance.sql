-- データベースメンテナンススクリプト
-- 実行前に必ずバックアップを取得してください

-- ========================================
-- A. transactions.transaction_noの冗長UNIQUE制約を整理
-- ========================================

-- 冗長制約の削除（1つの制約のみ残す）
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS uq_transactions_transaction_no_full;

-- PostgRESTスキーマリロード
NOTIFY pgrst, 'reload schema';

-- ========================================
-- B. fn_sync_transaction_from_po()のON CONFLICT修正
-- ========================================

-- 関数を複合キー対応に修正
CREATE OR REPLACE FUNCTION public.fn_sync_transaction_from_po()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.transactions (
    id, transaction_no, transaction_type, partner_id,
    transaction_date, due_date, status, total_amount,
    memo, parent_order_id, installment_no, created_at
  )
  VALUES (
    gen_random_uuid(),
    'TX-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text),1,6),
    'purchase',
    NEW.partner_id,
    NEW.order_date,
    NEW.delivery_deadline,
    'draft',
    NEW.total_amount,
    NEW.memo,
    NEW.id,
    1,
    now()
  )
  ON CONFLICT (parent_order_id, transaction_type, installment_no) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- PostgRESTスキーマリロード
NOTIFY pgrst, 'reload schema';

-- ========================================
-- C. 未配分発注への一括分納追加実行
-- ========================================

-- 残額がある発注に対して自動で分納追加
INSERT INTO public.transactions (
  id, transaction_no, transaction_type, partner_id,
  transaction_date, due_date, status, total_amount,
  memo, parent_order_id, installment_no, created_at
)
SELECT
  gen_random_uuid(),
  'TX-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text),1,6),
  'purchase',
  po.partner_id,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  'draft',
  po.total_amount - COALESCE(SUM(t.total_amount),0),
  '第' || (COALESCE(MAX(t.installment_no),0) + 1) || '回分納 - ' || po.order_no,
  po.id,
  COALESCE(MAX(t.installment_no),0) + 1,
  now()
FROM public.purchase_orders po
LEFT JOIN public.transactions t
  ON t.parent_order_id = po.id AND t.transaction_type = 'purchase'
GROUP BY po.id, po.partner_id, po.order_no, po.total_amount
HAVING (po.total_amount - COALESCE(SUM(t.total_amount),0)) > 0;

-- ========================================
-- 検証クエリ（実行後の確認用）
-- ========================================

-- 直近で追加された取引を確認
SELECT id, parent_order_id, installment_no, total_amount, created_at
FROM public.transactions
WHERE transaction_type='purchase'
  AND created_at >= now() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 金額整合のサマリー確認
SELECT
  po.order_no,
  po.total_amount,
  COALESCE(SUM(t.total_amount), 0) AS installment_total,
  po.total_amount - COALESCE(SUM(t.total_amount), 0) AS remaining_amount,
  CASE
    WHEN COALESCE(SUM(t.total_amount), 0) = po.total_amount THEN '✅ 完全一致'
    WHEN COALESCE(SUM(t.total_amount), 0) > po.total_amount THEN '🔴 超過配分'
    ELSE '⚠️ 未配分あり'
  END AS amount_status
FROM public.purchase_orders po
LEFT JOIN public.transactions t
  ON t.parent_order_id = po.id AND t.transaction_type = 'purchase'
GROUP BY po.id, po.order_no, po.total_amount
ORDER BY amount_status DESC, po.order_no;

-- installment_no連番のチェック
SELECT parent_order_id, STRING_AGG(installment_no::text, ', ' ORDER BY installment_no) AS seq
FROM public.transactions
WHERE transaction_type = 'purchase'
GROUP BY parent_order_id
ORDER BY parent_order_id;

-- installment_no=1の重複監視
SELECT parent_order_id, COUNT(*) FROM public.transactions
WHERE transaction_type = 'purchase' AND installment_no = 1 AND parent_order_id IS NOT NULL
GROUP BY parent_order_id HAVING COUNT(*) > 1;