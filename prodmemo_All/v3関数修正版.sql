-- v3関数のambiguous column問題修正版

CREATE OR REPLACE FUNCTION public.add_purchase_installment_v3(
  p_parent_order_id uuid,
  p_amount numeric,
  p_products jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT 'confirmed',
  p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days',
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  transaction_id uuid,
  parent_order_id uuid,
  installment_no integer,
  transaction_no text,
  status text,
  total_amount numeric,
  memo text,
  transaction_date date,
  due_date date,
  created_at timestamptz,
  inventory_movements_created integer
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
  v_movements_count integer := 0;
  v_product jsonb;
  v_movement_id uuid;
BEGIN
  -- 排他ロック
  PERFORM 1 FROM public.purchase_orders WHERE id = p_parent_order_id FOR UPDATE;

  -- 発注情報取得（テーブル名を明示）
  SELECT po.total_amount, po.order_no, po.partner_id
  INTO v_order_total, v_order_no, v_partner_id
  FROM public.purchase_orders po
  WHERE po.id = p_parent_order_id;

  IF v_order_total IS NULL THEN
    RAISE EXCEPTION '指定された発注が見つかりません: %', p_parent_order_id;
  END IF;

  -- 既存分納合計計算（テーブル名を明示）
  SELECT COALESCE(SUM(t.total_amount), 0)
  INTO v_allocated_total
  FROM public.transactions t
  WHERE t.parent_order_id = p_parent_order_id
    AND t.transaction_type = 'purchase';

  -- 金額超過チェック
  IF (v_allocated_total + p_amount) > v_order_total THEN
    RAISE EXCEPTION '分納合計が発注金額を超過します。現在: %, 追加: %, 上限: %',
                    v_allocated_total, p_amount, v_order_total;
  END IF;

  -- 正しい分納番号計算（1から開始）
  SELECT COALESCE(MAX(t.installment_no), 0) + 1
  INTO v_next_installment
  FROM public.transactions t
  WHERE t.parent_order_id = p_parent_order_id
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
  RETURNING id INTO v_transaction_id;

  -- 在庫移動自動作成
  IF jsonb_array_length(p_products) > 0 THEN
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
      INSERT INTO public.inventory_movements (
        id,
        product_id,
        movement_type,
        quantity,
        unit_price,
        total_amount,
        memo,
        transaction_id,
        installment_no,
        created_at
      ) VALUES (
        gen_random_uuid(),
        (v_product->>'product_id')::uuid,
        'in',
        (v_product->>'quantity')::integer,
        (v_product->>'unit_price')::numeric,
        (v_product->>'quantity')::integer * (v_product->>'unit_price')::numeric,
        COALESCE(p_memo, '第' || v_next_installment || '回') || ' - 自動連携v3',
        v_transaction_id,
        v_next_installment,
        NOW()
      )
      RETURNING id INTO v_movement_id;

      v_movements_count := v_movements_count + 1;

      RAISE NOTICE '在庫移動作成: ID=%, 商品=%, 数量=%, 単価=%',
                   v_movement_id,
                   v_product->>'product_id',
                   v_product->>'quantity',
                   v_product->>'unit_price';
    END LOOP;
  END IF;

  -- 結果返却
  RETURN QUERY
  SELECT
    v_transaction_id,
    p_parent_order_id,
    v_next_installment,
    v_transaction_no,
    p_status,
    p_amount,
    COALESCE(p_memo, '第' || v_next_installment || '回'),
    v_transaction_date,
    p_due_date,
    NOW(),
    v_movements_count;
END;
$$;

-- 権限再設定
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v3 TO anon;

SELECT '🔧 v3関数修正完了 - total_amount曖昧性解決' as status;