-- Deploy v3 installment function for Phase 3 testing
-- This creates a simplified v3 function that matches the expected parameter signature

CREATE OR REPLACE FUNCTION public.add_purchase_installment_v3(
  purchase_order_id uuid,
  total_amount numeric,
  memo text DEFAULT NULL
)
RETURNS TABLE (
  transaction_id uuid,
  parent_order_id uuid,
  installment_no integer,
  transaction_no text,
  status text,
  total_amount_result numeric,
  memo_result text,
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
  v_transaction_id uuid;
  v_due_date date := CURRENT_DATE + INTERVAL '30 days';
BEGIN
  -- 発注情報取得
  SELECT po.total_amount, po.order_no, po.partner_id
  INTO v_order_total, v_order_no, v_partner_id
  FROM public.purchase_orders po
  WHERE po.id = purchase_order_id;

  IF v_order_total IS NULL THEN
    RAISE EXCEPTION '指定された発注が見つかりません: %', purchase_order_id;
  END IF;

  -- 既存分納合計計算
  SELECT COALESCE(SUM(t.total_amount), 0)
  INTO v_allocated_total
  FROM public.transactions t
  WHERE t.parent_order_id = purchase_order_id
    AND t.transaction_type = 'purchase';

  -- 金額超過チェック
  IF (v_allocated_total + total_amount) > v_order_total THEN
    RAISE EXCEPTION '分納合計が発注金額を超過します。現在: %, 追加: %, 上限: %',
                    v_allocated_total, total_amount, v_order_total;
  END IF;

  -- 分納番号計算（1から開始）
  SELECT COALESCE(MAX(t.installment_no), 0) + 1
  INTO v_next_installment
  FROM public.transactions t
  WHERE t.parent_order_id = purchase_order_id
    AND t.transaction_type = 'purchase';

  -- 伝票番号生成
  SELECT 'INST-V3-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(EXTRACT(EPOCH FROM NOW())::bigint % 100000, 5, '0')
  INTO v_transaction_no;

  -- 分納挿入
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
    purchase_order_id,
    v_next_installment,
    v_next_installment,
    v_transaction_date,
    v_due_date,
    'confirmed',
    total_amount,
    COALESCE(memo, '第' || v_next_installment || '回'),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- 結果返却
  RETURN QUERY
  SELECT
    v_transaction_id,
    purchase_order_id,
    v_next_installment,
    v_transaction_no,
    'confirmed'::text,
    total_amount,
    COALESCE(memo, '第' || v_next_installment || '回'),
    v_transaction_date,
    v_due_date,
    NOW();
END;
$$;

-- 権限設定
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v3 TO anon;