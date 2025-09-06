console.log('🏗️ データベースメンテナンス - 手動実行用SQL');
console.log('========================================\n');

console.log('📋 以下のSQLをSupabase SQLエディターで順番に実行してください：\n');

console.log('Phase A: transactions.transaction_noの冗長UNIQUE制約整理');
console.log('----------------------------------------');
console.log(`ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS uq_transactions_transaction_no_full;
NOTIFY pgrst, 'reload schema';\n`);

console.log('Phase B: fn_sync_transaction_from_po()のON CONFLICT修正');
console.log('----------------------------------------');
console.log(`CREATE OR REPLACE FUNCTION public.fn_sync_transaction_from_po()
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

NOTIFY pgrst, 'reload schema';\n`);

console.log('Phase C: 未配分発注への一括分納追加');
console.log('----------------------------------------');
console.log(`INSERT INTO public.transactions (
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
HAVING (po.total_amount - COALESCE(SUM(t.total_amount),0)) > 0;\n`);

console.log('Phase D: 検証クエリ（実行後確認用）');
console.log('----------------------------------------');

console.log('1. 直近追加分確認:');
console.log(`SELECT id, parent_order_id, installment_no, total_amount, created_at
FROM public.transactions
WHERE transaction_type='purchase'
  AND created_at >= now() - INTERVAL '10 minutes'
ORDER BY created_at DESC;\n`);

console.log('2. 金額整合確認:');
console.log(`SELECT
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
ORDER BY amount_status DESC, po.order_no
LIMIT 20;\n`);

console.log('3. installment_no重複チェック:');
console.log(`SELECT parent_order_id, COUNT(*) FROM public.transactions
WHERE transaction_type = 'purchase' AND installment_no = 1 AND parent_order_id IS NOT NULL
GROUP BY parent_order_id HAVING COUNT(*) > 1;\n`);

console.log('🔧 実行完了後、WebUIの動作確認も実施してください');
console.log('   - 分納追加ボタン → リスト反映 → バッジ色分け');
console.log('   - 担当者/日付/商品名フィルタ');
console.log('   - 新規発注 → 自動分納同期\n');