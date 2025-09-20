-- add_purchase_installment_v2関数のデプロイ
-- 分納番号が正しく1から始まるように修正

CREATE OR REPLACE FUNCTION public.add_purchase_installment_v2(
  p_parent_order_id uuid,
  p_amount numeric,
  p_status text DEFAULT 'confirmed',
  p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days',
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  parent_order_id uuid,
  installment_no integer,
  transaction_no text,
  status text,
  total_amount numeric,
  memo text,
  transaction_date date,
  due_date date,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_total numeric;
  v_allocated_total numeric;
  v_next_installment integer;
  v_order_no text;
  v_transaction_no text;
  v_partner_id uuid;
  v_transaction_date date := CURRENT_DATE;
  max_retries integer := 5;
  retry_count integer := 0;
BEGIN
  -- 🔒 排他ロック: 同時追加による競合を防止
  PERFORM 1 FROM public.purchase_orders WHERE id = p_parent_order_id FOR UPDATE;

  -- 発注情報の取得
  SELECT total_amount, order_no, partner_id
  INTO v_order_total, v_order_no, v_partner_id
  FROM public.purchase_orders
  WHERE id = p_parent_order_id;

  IF v_order_total IS NULL THEN
    RAISE EXCEPTION '指定された発注が見つかりません: %', p_parent_order_id
      USING ERRCODE = 'P0003';
  END IF;

  -- 既存分納の合計金額を計算
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_allocated_total
  FROM public.transactions
  WHERE parent_order_id = p_parent_order_id
    AND transaction_type = 'purchase';

  -- 金額超過チェック
  IF (v_allocated_total + p_amount) > v_order_total THEN
    RAISE EXCEPTION '[P0001] 分納合計が発注金額を超過します | 発注: % | 超過額: ¥% | 発注額: ¥% | 既存分納: ¥% | 今回分納: ¥%',
      v_order_no,
      (v_allocated_total + p_amount - v_order_total),
      v_order_total,
      v_allocated_total,
      p_amount
      USING ERRCODE = 'P0001';
  END IF;

  -- 🚨 重要: 分納番号を1から正しく採番
  SELECT COALESCE(MAX(installment_no), 0) + 1
  INTO v_next_installment
  FROM public.transactions
  WHERE parent_order_id = p_parent_order_id
    AND transaction_type = 'purchase';

  -- 伝票番号生成
  SELECT 'TXN' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(EXTRACT(EPOCH FROM NOW())::bigint % 100000, 5, '0')
  INTO v_transaction_no;

  -- 🔥 分納トランザクションの挿入（確実なRETURN QUERY）
  RETURN QUERY
  INSERT INTO public.transactions (
    id,
    transaction_type,
    transaction_no,
    partner_id,
    parent_order_id,
    installment_no,
    delivery_sequence,
    transaction_date,
    due_date,
    status,
    total_amount,
    memo,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'purchase',
    v_transaction_no,
    v_partner_id,
    p_parent_order_id,
    v_next_installment,
    v_next_installment,
    v_transaction_date,
    p_due_date,
    p_status,
    p_amount,
    COALESCE(p_memo, '第' || v_next_installment || '回'),
    NOW(),
    NOW()
  )
  RETURNING
    transactions.id,
    transactions.parent_order_id,
    transactions.installment_no,
    transactions.transaction_no,
    transactions.status,
    transactions.total_amount,
    transactions.memo,
    transactions.transaction_date,
    transactions.due_date,
    transactions.created_at;

  RAISE NOTICE '✅ 分納追加完了: %回目 (¥%)', v_next_installment, p_amount;
END;
$$;

-- 権限設定
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO anon;

-- 確認メッセージ
SELECT '🎯 add_purchase_installment_v2関数をデプロイしました' as status;