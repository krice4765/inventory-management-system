-- Deploy v4 installment function with enhanced validation and inventory integration
-- This replaces the problematic auto-transaction creation with proper installment-only processing

CREATE OR REPLACE FUNCTION public.add_purchase_installment_v4(
  purchase_order_id uuid,
  installment_amount numeric,
  delivered_quantity integer DEFAULT 0,
  memo text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  transaction_id uuid,
  installment_no integer,
  remaining_amount numeric,
  progress_percent numeric,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_total numeric;
  v_paid_total numeric;
  v_remaining_amount numeric;
  v_next_installment integer;
  v_order_no text;
  v_partner_id uuid;
  v_transaction_id uuid;
  v_transaction_no text;
  v_product_id uuid;
  v_progress_percent numeric;
BEGIN
  -- 1. 発注情報取得と検証
  SELECT po.total_amount, po.order_no, po.partner_id
  INTO v_order_total, v_order_no, v_partner_id
  FROM public.purchase_orders po
  WHERE po.id = purchase_order_id;

  IF v_order_total IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0, 0::numeric, 0::numeric, '指定された発注が見つかりません'::text;
    RETURN;
  END IF;

  -- 2. 既存分納合計計算
  SELECT COALESCE(SUM(t.total_amount), 0)
  INTO v_paid_total
  FROM public.transactions t
  WHERE t.parent_order_id = purchase_order_id
    AND t.transaction_type = 'purchase';

  -- 3. 残額計算
  v_remaining_amount := v_order_total - v_paid_total;

  -- 4. 金額制限チェック（厳密）
  IF installment_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 0, v_remaining_amount,
                        (v_paid_total / v_order_total * 100)::numeric,
                        '分納金額は0より大きい値を入力してください'::text;
    RETURN;
  END IF;

  IF installment_amount > v_remaining_amount THEN
    RETURN QUERY SELECT false, NULL::uuid, 0, v_remaining_amount,
                        (v_paid_total / v_order_total * 100)::numeric,
                        format('分納金額が残額を超過しています。残額: ¥%s', v_remaining_amount)::text;
    RETURN;
  END IF;

  -- 5. 分納番号計算（1から開始の連番）
  SELECT COALESCE(MAX(t.installment_no), 0) + 1
  INTO v_next_installment
  FROM public.transactions t
  WHERE t.parent_order_id = purchase_order_id
    AND t.transaction_type = 'purchase';

  -- 6. 伝票番号生成（v4識別）
  SELECT 'INST-V4-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || v_next_installment
  INTO v_transaction_no;

  -- 7. 分納取引レコード作成
  v_transaction_id := gen_random_uuid();

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
    v_transaction_id,
    'purchase',
    v_transaction_no,
    v_partner_id,
    purchase_order_id,
    v_next_installment,
    v_next_installment,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    'confirmed',
    installment_amount,
    COALESCE(memo, '第' || v_next_installment || '回分納'),
    NOW(),
    NOW()
  );

  -- 8. 在庫移動レコード作成（数量指定時のみ）
  IF delivered_quantity > 0 THEN
    -- 発注に含まれる商品を取得（簡略化：最初の商品を対象）
    SELECT poi.product_id INTO v_product_id
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = purchase_order_id
    LIMIT 1;

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.inventory_movements (
        id,
        product_id,
        movement_type,
        quantity,
        unit_price,
        total_amount,
        transaction_id,
        order_id,
        memo,
        movement_date,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_product_id,
        'in',
        delivered_quantity,
        (installment_amount / delivered_quantity),
        installment_amount,
        v_transaction_id,
        purchase_order_id,
        '第' || v_next_installment || '回分納による入庫',
        NOW(),
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  -- 9. 進捗率計算
  v_progress_percent := ((v_paid_total + installment_amount) / v_order_total * 100);

  -- 10. 発注ステータス更新
  UPDATE public.purchase_orders
  SET
    updated_at = NOW(),
    -- 完納時はステータス更新（カラムが存在する場合）
    memo = CASE
      WHEN (v_paid_total + installment_amount) >= v_order_total
      THEN COALESCE(memo || ' ', '') || '[完納済み]'
      ELSE memo
    END
  WHERE id = purchase_order_id;

  -- 11. 成功結果を返却
  RETURN QUERY SELECT
    true,
    v_transaction_id,
    v_next_installment,
    v_order_total - (v_paid_total + installment_amount),
    v_progress_percent,
    '分納登録が正常に完了しました'::text;
END;
$$;

-- 権限設定
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v4 TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v4 TO anon;

-- 使用例とテスト用コメント
/*
使用例:
SELECT * FROM add_purchase_installment_v4(
  '1deb0af8-266c-4166-8021-1beb72e48051'::uuid,  -- 発注ID
  5500,                                            -- 分納金額
  35,                                              -- 納品数量
  '第3回分納（完納）'                              -- メモ
);

期待される結果:
- success: true
- installment_no: 3
- remaining_amount: 0
- progress_percent: 100
- error_message: '分納登録が正常に完了しました'
*/