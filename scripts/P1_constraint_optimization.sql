-- ===============================================================
-- ⚡ P1短期対応: 制約最適化と分納超過防御システム強化
-- ===============================================================
-- 問題: purchase_order_items重複FK、分納超過の物理防御不足
-- 解決: 制約整理 + 強化トリガー + データ整合性保証

BEGIN;

-- ===============================================================
-- 1. 現状制約の分析とバックアップ
-- ===============================================================

-- 1.1 現在の制約状況を分析
CREATE TEMP TABLE constraint_analysis AS
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc 
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name IN ('purchase_order_items', 'transaction_items', 'transactions', 'purchase_orders')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 1.2 重複制約の検出
CREATE TEMP TABLE duplicate_constraints AS
SELECT 
  table_name,
  column_name,
  foreign_table_name,
  COUNT(*) as constraint_count,
  string_agg(constraint_name, ', ') as constraint_names
FROM constraint_analysis
WHERE constraint_type = 'FOREIGN KEY'
GROUP BY table_name, column_name, foreign_table_name
HAVING COUNT(*) > 1;

-- 1.3 現在のインデックス状況
CREATE TEMP TABLE current_indexes AS
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('purchase_order_items', 'transaction_items', 'transactions', 'purchase_orders')
ORDER BY tablename, indexname;

-- ===============================================================
-- 2. purchase_order_items制約の整理
-- ===============================================================

-- 2.1 重複制約の特定と削除
DO $$
DECLARE
  constraint_rec record;
  keep_constraint text;
BEGIN
  -- purchase_order_items の重複外部キーを処理
  FOR constraint_rec IN 
    SELECT DISTINCT table_name, column_name, foreign_table_name, constraint_names
    FROM duplicate_constraints
    WHERE table_name = 'purchase_order_items'
  LOOP
    RAISE NOTICE '重複制約検出: テーブル=%, 列=%, 参照先=%, 制約名=%', 
      constraint_rec.table_name, constraint_rec.column_name, 
      constraint_rec.foreign_table_name, constraint_rec.constraint_names;
    
    -- 最初の制約以外を削除（例：より適切な命名の制約を保持）
    DECLARE
      constraint_to_drop text;
      constraint_list text[];
      i integer;
    BEGIN
      constraint_list := string_to_array(constraint_rec.constraint_names, ', ');
      
      -- 最初の制約を保持、残りを削除
      FOR i IN 2..array_length(constraint_list, 1) LOOP
        constraint_to_drop := trim(constraint_list[i]);
        BEGIN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                        constraint_rec.table_name, constraint_to_drop);
          RAISE NOTICE '削除完了: %', constraint_to_drop;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE '削除スキップ (存在しない): %', constraint_to_drop;
        END;
      END LOOP;
    END;
  END LOOP;
END $$;

-- 2.2 必要な外部キー制約の確認・再作成
DO $$
BEGIN
  -- purchase_order_items → purchase_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'purchase_order_items' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%purchase_order_id%'
  ) THEN
    ALTER TABLE public.purchase_order_items 
    ADD CONSTRAINT fk_purchase_order_items_purchase_order_id 
    FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
    
    RAISE NOTICE '外部キー作成: purchase_order_items.purchase_order_id';
  END IF;
  
  -- purchase_order_items → products
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'purchase_order_items' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%product_id%'
  ) THEN
    ALTER TABLE public.purchase_order_items 
    ADD CONSTRAINT fk_purchase_order_items_product_id 
    FOREIGN KEY (product_id) REFERENCES public.products(id) 
    ON DELETE RESTRICT ON UPDATE CASCADE;
    
    RAISE NOTICE '外部キー作成: purchase_order_items.product_id';
  END IF;
END $$;

-- 2.3 パフォーマンス最適化インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_items_purchase_order_id 
ON public.purchase_order_items (purchase_order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_items_product_id 
ON public.purchase_order_items (product_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_items_composite 
ON public.purchase_order_items (purchase_order_id, product_id, quantity);

-- ===============================================================
-- 3. 分納超過防御の強化トリガーシステム
-- ===============================================================

-- 3.1 強化版分納検証トリガー関数
CREATE OR REPLACE FUNCTION public.trigger_strict_installment_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  validation_result record;
  error_log_id uuid;
  order_info record;
BEGIN
  -- purchase取引のみ検証対象
  IF NEW.transaction_type = 'purchase' AND NEW.parent_order_id IS NOT NULL THEN
    
    -- 発注情報の取得（ロック付き）
    SELECT po.id, po.order_no, po.total_amount, po.status
    INTO order_info
    FROM public.purchase_orders po
    WHERE po.id = NEW.parent_order_id
    FOR UPDATE;
    
    IF order_info.id IS NULL THEN
      RAISE EXCEPTION '[P0003] 親発注が見つかりません: %', NEW.parent_order_id
        USING ERRCODE = 'P0003';
    END IF;
    
    -- 統一バリデーション関数による厳密検証
    SELECT * FROM public.validate_installment_amount(
      NEW.parent_order_id, 
      NEW.total_amount,
      CASE TG_OP WHEN 'UPDATE' THEN OLD.id ELSE NULL END
    ) INTO validation_result;
    
    IF NOT validation_result.is_valid THEN
      -- エラーログの詳細記録
      SELECT public.log_installment_error(
        NEW.parent_order_id,
        order_info.order_no,
        NEW.id,
        validation_result.error_code,
        validation_result.error_message,
        jsonb_build_object(
          'trigger_operation', TG_OP,
          'trigger_when', TG_WHEN,
          'order_status', order_info.status,
          'order_total', validation_result.order_total,
          'allocated_total', validation_result.allocated_total,
          'remaining_amount', validation_result.remaining_amount,
          'attempted_amount', NEW.total_amount,
          'transaction_status', NEW.status,
          'validation_timestamp', NOW()
        ),
        NEW.total_amount,
        'STRICT_TRIGGER_VALIDATION'
      ) INTO error_log_id;
      
      -- 詳細例外メッセージで終了
      RAISE EXCEPTION '%', validation_result.error_message
        USING ERRCODE = validation_result.error_code,
              DETAIL = format('検証詳細: 発注=%s, エラーログID=%s', order_info.order_no, error_log_id);
    END IF;
    
    -- 成功時のログ記録（INFO レベル）
    INSERT INTO public.system_logs (event_type, event_level, message, details)
    VALUES (
      'INSTALLMENT_VALIDATION_SUCCESS',
      'INFO',
      format('分納検証成功: %s ¥%s (%s)', order_info.order_no, NEW.total_amount, NEW.status),
      jsonb_build_object(
        'order_id', NEW.parent_order_id,
        'transaction_id', NEW.id,
        'amount', NEW.total_amount,
        'remaining_after', validation_result.remaining_amount - NEW.total_amount,
        'trigger_operation', TG_OP
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3.2 既存トリガーの置換
DROP TRIGGER IF EXISTS trigger_installment_insert_validation ON public.transactions;
DROP TRIGGER IF EXISTS trigger_installment_update_validation ON public.transactions;
DROP TRIGGER IF EXISTS trigger_enhanced_installment_validation ON public.transactions;

-- 3.3 新しい強化トリガーの設定
CREATE TRIGGER trigger_strict_installment_insert_validation
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_strict_installment_validation();

CREATE TRIGGER trigger_strict_installment_update_validation
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_strict_installment_validation();

-- ===============================================================
-- 4. 商品・在庫整合性トリガー
-- ===============================================================

-- 4.1 商品参照整合性確認トリガー
CREATE OR REPLACE FUNCTION public.trigger_product_reference_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 商品存在確認
  IF NEW.product_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = NEW.product_id AND status = 'active') THEN
      RAISE EXCEPTION '[P0004] 指定された商品が見つからないか、非アクティブです: %', NEW.product_id
        USING ERRCODE = 'P0004';
    END IF;
  END IF;
  
  -- 数量の妥当性確認
  IF NEW.quantity IS NOT NULL AND NEW.quantity <= 0 THEN
    RAISE EXCEPTION '[P0005] 数量は0より大きい必要があります: %', NEW.quantity
      USING ERRCODE = 'P0005';
  END IF;
  
  -- 単価の妥当性確認
  IF NEW.unit_price IS NOT NULL AND NEW.unit_price < 0 THEN
    RAISE EXCEPTION '[P0006] 単価は0以上である必要があります: %', NEW.unit_price
      USING ERRCODE = 'P0006';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4.2 商品参照トリガーの設定
CREATE TRIGGER trigger_purchase_order_items_product_validation
  BEFORE INSERT OR UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_product_reference_validation();

CREATE TRIGGER trigger_transaction_items_product_validation
  BEFORE INSERT OR UPDATE ON public.transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_product_reference_validation();

-- ===============================================================
-- 5. 担当者参照整合性トリガー
-- ===============================================================

-- 5.1 担当者参照確認トリガー関数
CREATE OR REPLACE FUNCTION public.trigger_assignee_reference_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- assignee_id が指定されている場合の検証
  IF NEW.assignee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_members 
      WHERE id = NEW.assignee_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION '[P0007] 指定された担当者が見つからないか、非アクティブです: %', NEW.assignee_id
        USING ERRCODE = 'P0007';
    END IF;
    
    -- 発注の場合は発注権限確認
    IF TG_TABLE_NAME = 'purchase_orders' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_members 
        WHERE id = NEW.assignee_id AND can_create_orders = true
      ) THEN
        RAISE EXCEPTION '[P0008] 指定された担当者には発注権限がありません: %', NEW.assignee_id
          USING ERRCODE = 'P0008';
      END IF;
    END IF;
    
    -- 取引確定の場合は確定権限確認
    IF TG_TABLE_NAME = 'transactions' AND NEW.status = 'confirmed' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_members 
        WHERE id = NEW.assignee_id AND can_confirm_transactions = true
      ) THEN
        RAISE EXCEPTION '[P0009] 指定された担当者には取引確定権限がありません: %', NEW.assignee_id
          USING ERRCODE = 'P0009';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5.2 担当者参照トリガーの設定
CREATE TRIGGER trigger_purchase_orders_assignee_validation
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_assignee_reference_validation();

CREATE TRIGGER trigger_transactions_assignee_validation
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_assignee_reference_validation();

-- ===============================================================
-- 6. データ整合性診断関数の拡張
-- ===============================================================

-- 6.1 包括的整合性チェック関数
CREATE OR REPLACE FUNCTION public.comprehensive_integrity_check()
RETURNS TABLE (
  check_category text,
  check_name text,
  status text,
  issue_count bigint,
  details text,
  recommended_action text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. 分納整合性チェック
  RETURN QUERY
  SELECT 
    '分納整合性'::text,
    '分納超過エラー'::text,
    CASE WHEN COUNT(*) = 0 THEN '正常' ELSE '要対応' END,
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 
      '発注額を超過した分納が ' || COUNT(*) || ' 件存在' 
    ELSE '全発注で分納額が適正' END,
    CASE WHEN COUNT(*) > 0 THEN 
      '該当発注の分納を手動調整または削除が必要'
    ELSE '対応不要' END
  FROM (
    SELECT 
      po.id,
      po.total_amount,
      COALESCE(SUM(t.total_amount), 0) as allocated_total
    FROM public.purchase_orders po
    LEFT JOIN public.transactions t ON po.id = t.parent_order_id 
      AND t.transaction_type = 'purchase'
    GROUP BY po.id, po.total_amount
    HAVING COALESCE(SUM(t.total_amount), 0) > po.total_amount
  ) integrity_issues;
  
  -- 2. 外部キー整合性チェック
  RETURN QUERY
  SELECT 
    '外部キー整合性'::text,
    '孤児レコード検出'::text,
    CASE WHEN COUNT(*) = 0 THEN '正常' ELSE '要確認' END,
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 
      '参照先が存在しないレコードが ' || COUNT(*) || ' 件'
    ELSE '外部キー制約違反なし' END,
    CASE WHEN COUNT(*) > 0 THEN 
      '該当レコードの削除または参照先データの復旧'
    ELSE '対応不要' END
  FROM (
    -- purchase_order_items の孤児チェック
    SELECT poi.id
    FROM public.purchase_order_items poi
    LEFT JOIN public.purchase_orders po ON poi.purchase_order_id = po.id
    WHERE po.id IS NULL
    UNION
    -- transactions の孤児チェック  
    SELECT t.id
    FROM public.transactions t
    LEFT JOIN public.purchase_orders po ON t.parent_order_id = po.id
    WHERE t.parent_order_id IS NOT NULL AND po.id IS NULL
  ) orphan_records;
  
  -- 3. 担当者参照整合性
  RETURN QUERY
  SELECT 
    '担当者参照'::text,
    '無効担当者参照'::text,
    CASE WHEN COUNT(*) = 0 THEN '正常' ELSE '要修正' END,
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 
      '無効な担当者を参照するレコードが ' || COUNT(*) || ' 件'
    ELSE '担当者参照は全て有効' END,
    CASE WHEN COUNT(*) > 0 THEN 
      '担当者マスタの整備または参照の更新'
    ELSE '対応不要' END
  FROM (
    SELECT po.id
    FROM public.purchase_orders po
    LEFT JOIN public.staff_members sm ON po.assignee_id = sm.id
    WHERE po.assignee_id IS NOT NULL AND sm.id IS NULL
    UNION
    SELECT t.id
    FROM public.transactions t
    LEFT JOIN public.staff_members sm ON t.assignee_id = sm.id
    WHERE t.assignee_id IS NOT NULL AND sm.id IS NULL
  ) invalid_assignee_refs;
  
  -- 4. 制約・インデックス状況
  RETURN QUERY
  SELECT 
    '制約・パフォーマンス'::text,
    'インデックス最適化'::text,
    '情報'::text,
    COUNT(*),
    'データベース制約: ' || COUNT(*) || ' 個',
    '定期的なインデックス再構築とクエリ最適化'
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' 
    AND table_name IN ('purchase_orders', 'transactions', 'products', 'staff_members');
END;
$$;

-- ===============================================================
-- 7. 制約修復・データクリーンアップ関数
-- ===============================================================

-- 7.1 自動修復関数（安全な範囲のみ）
CREATE OR REPLACE FUNCTION public.auto_fix_minor_integrity_issues()
RETURNS TABLE (
  fix_category text,
  fix_description text,
  records_affected bigint,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count bigint;
BEGIN
  -- 1. NULLの assignee_name を assignee_id から復元
  UPDATE public.purchase_orders 
  SET assignee_name = sm.name
  FROM public.staff_members sm
  WHERE purchase_orders.assignee_id = sm.id 
    AND (purchase_orders.assignee_name IS NULL OR purchase_orders.assignee_name = '');
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    '担当者名復元'::text,
    'assignee_id から assignee_name を復元'::text,
    affected_count,
    true;
  
  -- 2. 同様にtransactionsテーブルも修復
  UPDATE public.transactions 
  SET assignee_name = sm.name
  FROM public.staff_members sm
  WHERE transactions.assignee_id = sm.id 
    AND (transactions.assignee_name IS NULL OR transactions.assignee_name = '');
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    '取引担当者名復元'::text,
    'assignee_id から assignee_name を復元（取引）'::text,
    affected_count,
    true;
  
  -- 3. 空文字やスペースのクリーンアップ
  UPDATE public.staff_members 
  SET name = trim(name)
  WHERE name != trim(name) AND trim(name) != '';
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    'データクリーンアップ'::text,
    '担当者名の前後空白除去'::text,
    affected_count,
    true;
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    'エラー'::text,
    format('修復中にエラー: %s', SQLERRM),
    0::bigint,
    false;
END;
$$;

-- ===============================================================
-- 8. 完了処理とログ記録
-- ===============================================================

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- システムログ記録
INSERT INTO public.system_logs (event_type, event_level, message, details)
VALUES (
  'CONSTRAINT_OPTIMIZATION',
  'INFO',
  'P1短期対応: 制約最適化と分納超過防御システム強化完了',
  jsonb_build_object(
    'duplicate_constraints_removed', (SELECT COUNT(*) FROM duplicate_constraints),
    'new_triggers_created', 6,
    'indexes_optimized', 3,
    'validation_functions_enhanced', 4,
    'integrity_check_functions_created', 2
  )
);

-- 完了メッセージとレポート
DO $$ 
DECLARE
  constraint_summary record;
BEGIN
  RAISE NOTICE '⚡ P1短期対応完了: 制約最適化と分納超過防御強化';
  RAISE NOTICE '📊 整合性チェック: SELECT * FROM comprehensive_integrity_check();';
  RAISE NOTICE '🔧 自動修復実行: SELECT * FROM auto_fix_minor_integrity_issues();';
  RAISE NOTICE '⚠️  重要: 新しいトリガーによりデータ整合性が厳格に検証されます';
  
  -- 制約サマリーの表示
  FOR constraint_summary IN 
    SELECT table_name, COUNT(*) as constraint_count
    FROM constraint_analysis
    GROUP BY table_name
    ORDER BY table_name
  LOOP
    RAISE NOTICE '📋 %: % 個の制約', constraint_summary.table_name, constraint_summary.constraint_count;
  END LOOP;
END $$;

COMMIT;