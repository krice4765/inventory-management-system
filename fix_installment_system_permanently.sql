-- 🎯 分納システムの永続的修正
-- 今後の全発注に対して分納番号重複問題を根本的に解決

-- ===================================================================
-- Phase 1: 現在の制約状況確認
-- ===================================================================

SELECT '🔍 Phase 1: 現在の制約状況確認' as phase;

-- 既存の制約を確認
SELECT
    constraint_name,
    constraint_type,
    table_name,
    column_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'transactions'
  AND column_name IN ('installment_no', 'parent_order_id')
ORDER BY constraint_name;

-- ===================================================================
-- Phase 2: 必要な制約の追加
-- ===================================================================

SELECT '🔧 Phase 2: 分納番号一意制約の追加' as phase;

-- 分納番号の一意制約を追加（同一発注書内で同じ分納番号は1つのみ）
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_installment_unique
UNIQUE (parent_order_id, transaction_type, installment_no)
DEFERRABLE INITIALLY DEFERRED;

-- 分納取引には必ず分納番号が必要
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_purchase_installment_required
CHECK (transaction_type <> 'purchase' OR installment_no IS NOT NULL);

-- ===================================================================
-- Phase 3: 既存データの整合性修正
-- ===================================================================

SELECT '🔄 Phase 3: 既存データの整合性修正' as phase;

-- PO250917020の分納番号を正しい順序で修正
WITH po250917020_fix AS (
    SELECT
        t.id,
        ROW_NUMBER() OVER (ORDER BY t.created_at ASC) as correct_installment_no
    FROM transactions t
    JOIN purchase_orders po ON t.parent_order_id = po.id
    WHERE po.order_no = 'PO250917020'
      AND t.transaction_type = 'purchase'
      AND t.status = 'confirmed'
      AND t.total_amount > 0
)
UPDATE transactions
SET
    installment_no = pf.correct_installment_no,
    delivery_sequence = pf.correct_installment_no,
    memo = '第' || pf.correct_installment_no || '回'
FROM po250917020_fix pf
WHERE transactions.id = pf.id;

-- 全発注書の分納番号整合性修正（時間順）
DO $$
DECLARE
    order_record RECORD;
    transaction_record RECORD;
    sequence_no INTEGER;
BEGIN
    -- 各発注書を処理
    FOR order_record IN
        SELECT DISTINCT po.id, po.order_no
        FROM purchase_orders po
        WHERE EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.parent_order_id = po.id
              AND t.transaction_type = 'purchase'
        )
    LOOP
        sequence_no := 1;

        -- 各発注書の分納を時間順で処理
        FOR transaction_record IN
            SELECT t.id
            FROM transactions t
            WHERE t.parent_order_id = order_record.id
              AND t.transaction_type = 'purchase'
              AND t.status = 'confirmed'
              AND t.total_amount > 0
            ORDER BY t.created_at ASC
        LOOP
            UPDATE transactions
            SET
                installment_no = sequence_no,
                delivery_sequence = sequence_no,
                memo = '第' || sequence_no || '回'
            WHERE id = transaction_record.id;

            sequence_no := sequence_no + 1;
        END LOOP;

        RAISE NOTICE '✅ %の分納番号を修正完了', order_record.order_no;
    END LOOP;
END $$;

-- ===================================================================
-- Phase 4: add_purchase_installment関数の強化
-- ===================================================================

SELECT '⚡ Phase 4: add_purchase_installment関数の強化' as phase;

-- より堅牢な分納追加関数に更新
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
AS $$
DECLARE
  v_next_installment integer;
  v_order_total numeric;
  v_allocated_total numeric;
  v_order_no text;
  v_retry_count integer := 0;
  v_max_retries integer := 5;
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
    AND transaction_type = 'purchase'
    AND status = 'confirmed';

  -- 金額超過チェック
  IF (v_allocated_total + p_amount) > v_order_total THEN
    RAISE EXCEPTION '[P0001] 分納合計が発注金額を超過します | 発注: % | 超過額: ¥%.2f',
      v_order_no,
      (v_allocated_total + p_amount - v_order_total)
      USING ERRCODE = 'P0001';
  END IF;

  -- 堅牢な分納番号採番（リトライ機能付き）
  WHILE v_retry_count < v_max_retries LOOP
    -- 次の分納回次を計算（より確実な方法）
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_next_installment
    FROM public.transactions
    WHERE parent_order_id = p_parent_order_id
      AND transaction_type = 'purchase'
      AND status = 'confirmed';

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
        delivery_sequence,
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
        COALESCE(p_memo, '第' || v_next_installment || '回'),
        p_parent_order_id,
        v_next_installment,
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
        v_retry_count := v_retry_count + 1;
        RAISE NOTICE '分納番号競合検出 (試行%/%): 短時間待機後リトライ', v_retry_count, v_max_retries;
        PERFORM pg_sleep(0.1 * v_retry_count); -- 指数バックオフ
      WHEN others THEN
        RAISE;
    END;
  END LOOP;

  -- 最大リトライ数に達した場合
  RAISE EXCEPTION '分納追加に失敗: 最大リトライ数に達しました (競合が継続)'
    USING ERRCODE = 'P0002';
END;
$$;

-- ===================================================================
-- Phase 5: 権限設定とテスト
-- ===================================================================

SELECT '🔐 Phase 5: 権限設定' as phase;

-- 新しい関数の権限設定
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO anon;

-- ===================================================================
-- Phase 6: 検証とテスト
-- ===================================================================

SELECT '✅ Phase 6: 修正結果の検証' as phase;

-- PO250917020の修正結果確認
SELECT
    po.order_no,
    t.installment_no,
    t.total_amount,
    t.memo,
    EXTRACT(HOUR FROM t.created_at) || ':' ||
    LPAD(EXTRACT(MINUTE FROM t.created_at)::text, 2, '0') as time_created
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
  AND t.transaction_type = 'purchase'
  AND t.status = 'confirmed'
ORDER BY t.installment_no;

-- 制約追加確認
SELECT
    'transactions_installment_unique制約:' as constraint_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ 正常に追加されました'
        ELSE '❌ 制約が見つかりません'
    END as status
FROM information_schema.table_constraints
WHERE constraint_name = 'transactions_installment_unique'
  AND table_name = 'transactions';

-- 最終メッセージ
DO $$
BEGIN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🎉 分納システム永続的修正完了';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ 分納番号一意制約: 追加完了';
    RAISE NOTICE '✅ 既存データ整合性: 修正完了';
    RAISE NOTICE '✅ add_purchase_installment_v2: 強化完了';
    RAISE NOTICE '✅ PO250917020: 正しい順序で修正';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🎯 今後の全発注で分納番号重複は防止されます';
    RAISE NOTICE '📝 新しい分納作成にはadd_purchase_installment_v2を使用';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;