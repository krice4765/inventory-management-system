-- ===============================================================
-- 🚨 包括的多層防御システム - Phase 1: データベース基盤強化
-- ===============================================================
-- 実行順序: この全体を一括実行（原子性保証）
-- 目的: P0001類似エラーの完全防止と運用品質向上

BEGIN;

-- ===============================================================
-- 1. 統一バリデーション関数群 - ビジネスロジックの中央化
-- ===============================================================

-- 分納金額検証の統一関数（全システムで使用）
CREATE OR REPLACE FUNCTION public.validate_installment_amount(
  p_parent_order_id uuid,
  p_amount numeric,
  p_exclude_transaction_id uuid DEFAULT NULL
) RETURNS TABLE (
  is_valid boolean,
  error_code text,
  error_message text,
  order_total numeric,
  allocated_total numeric,
  remaining_amount numeric
) LANGUAGE plpgsql AS $$
DECLARE
  v_order_total numeric;
  v_allocated_total numeric;
  v_order_no text;
BEGIN
  -- 発注情報の取得
  SELECT total_amount, order_no INTO v_order_total, v_order_no
  FROM public.purchase_orders WHERE id = p_parent_order_id;
  
  IF v_order_total IS NULL THEN
    RETURN QUERY SELECT 
      false, 'ORDER_NOT_FOUND'::text, 
      format('指定された発注が見つかりません: %s', p_parent_order_id),
      0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  
  -- 既存分納の合計計算（除外対象があれば除外）
  SELECT COALESCE(SUM(total_amount), 0) INTO v_allocated_total
  FROM public.transactions
  WHERE parent_order_id = p_parent_order_id 
    AND transaction_type = 'purchase'
    AND (p_exclude_transaction_id IS NULL OR id != p_exclude_transaction_id);
  
  -- 金額検証
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT 
      false, 'INVALID_AMOUNT'::text,
      '分納金額は0より大きい必要があります',
      v_order_total, v_allocated_total, (v_order_total - v_allocated_total);
    RETURN;
  END IF;
  
  IF (v_allocated_total + p_amount) > v_order_total THEN
    RETURN QUERY SELECT 
      false, 'AMOUNT_EXCEEDED'::text,
      format('[P0001] 分納合計が発注金額を超過します | 発注: %s | 超過額: ¥%.2f | 発注額: ¥%.2f | 既存分納: ¥%.2f | 今回分納: ¥%.2f', 
        v_order_no, (v_allocated_total + p_amount - v_order_total), v_order_total, v_allocated_total, p_amount),
      v_order_total, v_allocated_total, (v_order_total - v_allocated_total);
    RETURN;
  END IF;
  
  -- 検証成功
  RETURN QUERY SELECT 
    true, 'SUCCESS'::text, 'バリデーション成功',
    v_order_total, v_allocated_total, (v_order_total - v_allocated_total);
END;
$$;

-- ===============================================================
-- 2. データ整合性制約の強化 - 物理的防御層
-- ===============================================================

-- 2.1 分納番号のユニーク制約（既存がなければ追加）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_installment_unique'
  ) THEN
    ALTER TABLE public.transactions 
    ADD CONSTRAINT transactions_installment_unique 
    UNIQUE (parent_order_id, transaction_type, installment_no);
  END IF;
END $$;

-- 2.2 購入取引の分納番号必須制約
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_purchase_installment_required'
  ) THEN
    ALTER TABLE public.transactions 
    ADD CONSTRAINT transactions_purchase_installment_required 
    CHECK (transaction_type != 'purchase' OR installment_no IS NOT NULL);
  END IF;
END $$;

-- 2.3 分納金額の正値制約
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_positive_amount'
  ) THEN
    ALTER TABLE public.transactions 
    ADD CONSTRAINT transactions_positive_amount 
    CHECK (total_amount > 0);
  END IF;
END $$;

-- ===============================================================
-- 3. トリガーベースの自動検証 - 完全防御層
-- ===============================================================

-- 3.1 分納挿入前検証トリガー関数
CREATE OR REPLACE FUNCTION public.trigger_validate_installment_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  validation_result record;
BEGIN
  -- purchase取引のみ検証
  IF NEW.transaction_type = 'purchase' AND NEW.parent_order_id IS NOT NULL THEN
    SELECT * FROM public.validate_installment_amount(
      NEW.parent_order_id, NEW.total_amount
    ) INTO validation_result;
    
    IF NOT validation_result.is_valid THEN
      RAISE EXCEPTION '%', validation_result.error_message
        USING ERRCODE = validation_result.error_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3.2 分納更新前検証トリガー関数
CREATE OR REPLACE FUNCTION public.trigger_validate_installment_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  validation_result record;
BEGIN
  -- purchase取引で金額・発注が変更された場合のみ検証
  IF NEW.transaction_type = 'purchase' AND NEW.parent_order_id IS NOT NULL 
     AND (OLD.total_amount != NEW.total_amount OR OLD.parent_order_id != NEW.parent_order_id) THEN
    
    SELECT * FROM public.validate_installment_amount(
      NEW.parent_order_id, NEW.total_amount, NEW.id
    ) INTO validation_result;
    
    IF NOT validation_result.is_valid THEN
      RAISE EXCEPTION '%', validation_result.error_message
        USING ERRCODE = validation_result.error_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3.3 トリガーの設定
DROP TRIGGER IF EXISTS trigger_installment_insert_validation ON public.transactions;
CREATE TRIGGER trigger_installment_insert_validation
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_validate_installment_insert();

DROP TRIGGER IF EXISTS trigger_installment_update_validation ON public.transactions;
CREATE TRIGGER trigger_installment_update_validation
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_validate_installment_update();

-- ===============================================================
-- 4. 監査・診断関数 - 運用品質保証
-- ===============================================================

-- 4.1 発注整合性監査関数
CREATE OR REPLACE FUNCTION public.audit_order_consistency()
RETURNS TABLE (
  order_id uuid,
  order_no text,
  order_total numeric,
  allocated_total numeric,
  remaining_amount numeric,
  installment_count bigint,
  status text,
  issues text[]
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH order_summary AS (
    SELECT 
      po.id,
      po.order_no,
      po.total_amount,
      COALESCE(SUM(t.total_amount), 0) as allocated,
      COUNT(t.id) as installments
    FROM public.purchase_orders po
    LEFT JOIN public.transactions t ON po.id = t.parent_order_id 
      AND t.transaction_type = 'purchase'
    GROUP BY po.id, po.order_no, po.total_amount
  )
  SELECT 
    os.id,
    os.order_no,
    os.total_amount,
    os.allocated,
    os.total_amount - os.allocated,
    os.installments,
    CASE 
      WHEN os.allocated = 0 THEN '未分納'
      WHEN os.allocated = os.total_amount THEN '完了'
      WHEN os.allocated > os.total_amount THEN '超過エラー'
      ELSE '分納中'
    END,
    ARRAY(
      SELECT issue FROM (
        SELECT '超過金額: ¥' || (os.allocated - os.total_amount) as issue
        WHERE os.allocated > os.total_amount
        UNION ALL
        SELECT '分納回数: ' || os.installments || '回' as issue
        WHERE os.installments > 10
      ) issues WHERE issue IS NOT NULL
    )
  FROM order_summary os
  ORDER BY 
    CASE 
      WHEN os.allocated > os.total_amount THEN 1  -- エラー優先
      ELSE 2 
    END,
    os.order_no;
END;
$$;

-- 4.2 日次整合性チェック関数
CREATE OR REPLACE FUNCTION public.daily_consistency_check()
RETURNS TABLE (
  check_date date,
  total_orders bigint,
  error_orders bigint,
  error_rate numeric,
  max_excess_amount numeric,
  recommendations text[]
) LANGUAGE plpgsql AS $$
DECLARE
  v_total_orders bigint;
  v_error_orders bigint;
  v_max_excess numeric;
BEGIN
  -- 統計情報の収集
  WITH audit_results AS (
    SELECT * FROM public.audit_order_consistency()
  )
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = '超過エラー'),
    COALESCE(MAX(allocated_total - order_total), 0)
  INTO v_total_orders, v_error_orders, v_max_excess
  FROM audit_results;
  
  RETURN QUERY
  SELECT 
    CURRENT_DATE,
    v_total_orders,
    v_error_orders,
    CASE WHEN v_total_orders > 0 THEN 
      ROUND((v_error_orders::numeric / v_total_orders * 100), 2)
    ELSE 0 END,
    v_max_excess,
    ARRAY(
      SELECT rec FROM (
        SELECT '緊急対応: 超過エラーが ' || v_error_orders || ' 件発生' as rec
        WHERE v_error_orders > 0
        UNION ALL
        SELECT 'システム正常: エラー0件を維持' as rec
        WHERE v_error_orders = 0
        UNION ALL
        SELECT '予防保守: 分納設計レビューを推奨' as rec
        WHERE v_total_orders > 100 AND v_error_orders = 0
      ) recommendations WHERE rec IS NOT NULL
    );
END;
$$;

-- ===============================================================
-- 5. 既存データの整合性修正 - 運用継続性保証
-- ===============================================================

-- 5.1 現在のデータ状況分析
DO $$ 
DECLARE
  audit_record record;
  fix_count integer := 0;
BEGIN
  RAISE NOTICE '=== 既存データ整合性分析開始 ===';
  
  FOR audit_record IN 
    SELECT * FROM public.audit_order_consistency() 
    WHERE status = '超過エラー'
  LOOP
    RAISE NOTICE '超過エラー検出: % (超過額: ¥%)', 
      audit_record.order_no, 
      (audit_record.allocated_total - audit_record.order_total);
    fix_count := fix_count + 1;
  END LOOP;
  
  IF fix_count = 0 THEN
    RAISE NOTICE '✅ 既存データに整合性エラーはありません';
  ELSE
    RAISE NOTICE '⚠️  %件の整合性エラーが検出されました。手動修正が必要です。', fix_count;
  END IF;
END $$;

-- ===============================================================
-- 6. パフォーマンス最適化 - 高速化インデックス
-- ===============================================================

-- 分納検索の高速化インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_installment_lookup 
ON public.transactions (parent_order_id, transaction_type, total_amount) 
WHERE transaction_type = 'purchase';

-- 発注サマリーの高速化インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_summary 
ON public.purchase_orders (id, order_no, total_amount, created_at);

-- ===============================================================
-- 7. 完了確認とスキーマ更新
-- ===============================================================

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- 実装完了のログ記録
INSERT INTO public.system_logs (event_type, message, created_at)
VALUES (
  'SYSTEM_UPGRADE',
  'Phase 1: データベース基盤強化完了 - 統一バリデーション・制約・トリガー・監査機能を実装',
  NOW()
) ON CONFLICT DO NOTHING;

-- 成功メッセージ
DO $$ BEGIN
  RAISE NOTICE '🎯 Phase 1完了: データベース基盤強化システムが正常に実装されました';
  RAISE NOTICE '📊 次のステップ: 改良版RPC関数の実装 (Phase 2)';
  RAISE NOTICE '🔍 確認コマンド: SELECT * FROM public.daily_consistency_check();';
END $$;

COMMIT;