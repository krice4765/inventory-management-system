-- 分納追加RPC関数 - Web UIから何回でも分納を安全に追加
-- 自動採番・金額超過防止・競合制御を内包

CREATE OR REPLACE FUNCTION public.add_purchase_installment(
  p_parent_order_id uuid,
  p_amount numeric,
  p_status text DEFAULT 'draft',
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
AS $$
DECLARE
  v_next_installment integer;
  v_order_total numeric;
  v_allocated_total numeric;
  v_order_no text;
BEGIN
  -- 排他ロック: 同時追加による競合を防止
  PERFORM 1 FROM public.purchase_orders WHERE id = p_parent_order_id FOR UPDATE;
  
  -- 発注情報の取得
  SELECT total_amount, order_no 
  INTO v_order_total, v_order_no
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
  
  -- 金額超過チェック（全ステータス対象）
  IF (v_allocated_total + p_amount) > v_order_total THEN
    RAISE EXCEPTION '[P0001] 分納合計が発注金額を超過します | 発注: % | 超過額: ¥%.2f | 発注額: ¥%.2f | 既存分納: ¥%.2f | 今回分納: ¥%.2f', 
      v_order_no,
      (v_allocated_total + p_amount - v_order_total),
      v_order_total,
      v_allocated_total,
      p_amount
      USING ERRCODE = 'P0001';
  END IF;
  
  -- 競合制御ループ: installment_no自動採番
  LOOP
    -- 次の分納回次を計算
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_next_installment
    FROM public.transactions
    WHERE parent_order_id = p_parent_order_id 
      AND transaction_type = 'purchase';
    
    BEGIN
      -- 分納トランザクションの挿入
      RETURN QUERY
      INSERT INTO public.transactions (
        id,
        transaction_type,
        transaction_no,
        partner_id,
        transaction_date,
        due_date,
        status,
        total_amount,
        memo,
        parent_order_id,
        installment_no,
        created_at
      )
      SELECT
        gen_random_uuid(),
        'purchase',
        'TX-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text), 1, 6),
        po.partner_id,
        CURRENT_DATE,
        p_due_date,
        p_status,
        p_amount,
        COALESCE(p_memo, '第' || v_next_installment || '回分納 - ' || po.order_no),
        p_parent_order_id,
        v_next_installment,
        now()
      FROM public.purchase_orders po
      WHERE po.id = p_parent_order_id
      RETURNING 
        id, parent_order_id, installment_no, transaction_no, 
        status, total_amount, memo, transaction_date, due_date, created_at;
      
      -- 成功時はループ終了
      EXIT;
      
    EXCEPTION 
      WHEN unique_violation THEN
        -- 分納番号競合時は短時間待機してリトライ
        PERFORM pg_sleep(0.05);
      WHEN others THEN
        -- その他のエラーは即座に再発生
        RAISE;
    END;
  END LOOP;
END;
$$;

-- 推奨制約（まだ存在しない場合）
-- ALTER TABLE public.transactions 
-- ADD CONSTRAINT transactions_installment_unique 
-- UNIQUE (parent_order_id, transaction_type, installment_no);

-- ALTER TABLE public.transactions 
-- ADD CONSTRAINT transactions_purchase_installment_required 
-- CHECK (transaction_type <> 'purchase' OR installment_no IS NOT NULL);

-- PostgREST スキーマ再読み込み通知
NOTIFY pgrst, 'reload schema';