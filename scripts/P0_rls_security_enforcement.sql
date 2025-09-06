-- ===============================================================
-- 🔒 P0緊急対応: RLS による書込統一とセキュリティ強化
-- ===============================================================
-- 問題: テーブル直接書込による整合性違反、権限管理の不備
-- 解決: RLS + SECURITY DEFINER関数による統一API化

BEGIN;

-- ===============================================================
-- 1. 現状分析と影響調査
-- ===============================================================

-- 1.1 現在のテーブル権限状況を記録
CREATE TEMP TABLE current_table_permissions AS
SELECT 
  schemaname,
  tablename,
  usename,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges tp
JOIN pg_user u ON tp.grantee = u.usename
WHERE schemaname = 'public' 
  AND tablename IN ('purchase_orders', 'transactions', 'products', 'partners', 'staff_members')
GROUP BY schemaname, tablename, usename
ORDER BY tablename, usename;

-- 1.2 既存のRLS状況確認
CREATE TEMP TABLE current_rls_status AS
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('purchase_orders', 'transactions', 'products', 'partners', 'staff_members');

-- ===============================================================
-- 2. 段階的RLS導入戦略
-- ===============================================================

-- 2.1 重要テーブルのRLS有効化
DO $$ 
DECLARE
  table_name text;
  tables_to_secure text[] := ARRAY[
    'purchase_orders',
    'transactions', 
    'transaction_items',
    'purchase_order_items',
    'products',
    'partners',
    'staff_members',
    'inventory_movements'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_secure LOOP
    -- RLS有効化
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    
    RAISE NOTICE 'RLS有効化: %', table_name;
  END LOOP;
END $$;

-- ===============================================================
-- 3. 読み取り専用ポリシー（全テーブル共通）
-- ===============================================================

-- 3.1 purchase_orders のポリシー
DROP POLICY IF EXISTS purchase_orders_select_policy ON public.purchase_orders;
CREATE POLICY purchase_orders_select_policy ON public.purchase_orders
  FOR SELECT USING (true);  -- 全件読み取り可能

DROP POLICY IF EXISTS purchase_orders_write_policy ON public.purchase_orders;
CREATE POLICY purchase_orders_write_policy ON public.purchase_orders
  FOR ALL USING (false);  -- 直接書込禁止

-- 3.2 transactions のポリシー  
DROP POLICY IF EXISTS transactions_select_policy ON public.transactions;
CREATE POLICY transactions_select_policy ON public.transactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS transactions_write_policy ON public.transactions;  
CREATE POLICY transactions_write_policy ON public.transactions
  FOR ALL USING (false);

-- 3.3 transaction_items のポリシー
DROP POLICY IF EXISTS transaction_items_select_policy ON public.transaction_items;
CREATE POLICY transaction_items_select_policy ON public.transaction_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS transaction_items_write_policy ON public.transaction_items;
CREATE POLICY transaction_items_write_policy ON public.transaction_items
  FOR ALL USING (false);

-- 3.4 purchase_order_items のポリシー
DROP POLICY IF EXISTS purchase_order_items_select_policy ON public.purchase_order_items;
CREATE POLICY purchase_order_items_select_policy ON public.purchase_order_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS purchase_order_items_write_policy ON public.purchase_order_items;
CREATE POLICY purchase_order_items_write_policy ON public.purchase_order_items
  FOR ALL USING (false);

-- 3.5 products のポリシー
DROP POLICY IF EXISTS products_select_policy ON public.products;
CREATE POLICY products_select_policy ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS products_write_policy ON public.products;
CREATE POLICY products_write_policy ON public.products
  FOR ALL USING (false);

-- 3.6 partners のポリシー
DROP POLICY IF EXISTS partners_select_policy ON public.partners;
CREATE POLICY partners_select_policy ON public.partners
  FOR SELECT USING (true);

DROP POLICY IF EXISTS partners_write_policy ON public.partners;
CREATE POLICY partners_write_policy ON public.partners
  FOR ALL USING (false);

-- 3.7 inventory_movements のポリシー
DROP POLICY IF EXISTS inventory_movements_select_policy ON public.inventory_movements;
CREATE POLICY inventory_movements_select_policy ON public.inventory_movements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS inventory_movements_write_policy ON public.inventory_movements;
CREATE POLICY inventory_movements_write_policy ON public.inventory_movements
  FOR ALL USING (false);

-- ===============================================================
-- 4. SECURITY DEFINER関数によるAPI統一
-- ===============================================================

-- 4.1 発注作成関数（統一API）
CREATE OR REPLACE FUNCTION public.create_purchase_order_secure(
  p_partner_id uuid,
  p_assignee_id uuid,
  p_order_items jsonb,
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  order_id uuid,
  order_no text,
  total_amount numeric,
  message text,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER  -- 権限昇格で実行
AS $$
DECLARE
  v_order_id uuid;
  v_order_no text;
  v_total_amount numeric := 0;
  v_item record;
BEGIN
  -- バリデーション
  IF p_partner_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric,
      '取引先が指定されていません'::text, '{}'::jsonb;
    RETURN;
  END IF;
  
  IF p_assignee_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric,
      '担当者が指定されていません'::text, '{}'::jsonb;
    RETURN;
  END IF;
  
  -- 注文番号生成
  v_order_no := 'PO' || to_char(NOW(), 'YYMMDD') || 
    LPAD((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint % 100000::bigint, 5, '0');
  
  -- 合計金額計算
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items) LOOP
    v_total_amount := v_total_amount + (v_item.value->>'quantity')::numeric * (v_item.value->>'unit_price')::numeric;
  END LOOP;
  
  -- 発注作成
  INSERT INTO public.purchase_orders (
    id, order_no, partner_id, assignee_id, total_amount, status, memo, created_at
  ) VALUES (
    gen_random_uuid(), v_order_no, p_partner_id, p_assignee_id, v_total_amount, 'draft', p_memo, NOW()
  ) RETURNING id INTO v_order_id;
  
  -- アイテム追加
  INSERT INTO public.purchase_order_items (
    id, purchase_order_id, product_id, quantity, unit_price, total_price, created_at
  )
  SELECT 
    gen_random_uuid(),
    v_order_id,
    (item.value->>'product_id')::uuid,
    (item.value->>'quantity')::numeric,
    (item.value->>'unit_price')::numeric,
    (item.value->>'quantity')::numeric * (item.value->>'unit_price')::numeric,
    NOW()
  FROM jsonb_array_elements(p_order_items) AS item;
  
  -- 成功レスポンス
  RETURN QUERY SELECT 
    true,
    v_order_id,
    v_order_no,
    v_total_amount,
    '発注を正常に作成しました'::text,
    jsonb_build_object(
      'order_id', v_order_id,
      'items_count', jsonb_array_length(p_order_items),
      'created_at', NOW()
    );
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false, NULL::uuid, NULL::text, NULL::numeric,
    format('発注作成エラー: %s', SQLERRM),
    jsonb_build_object('error_code', SQLSTATE, 'error_detail', SQLERRM);
END;
$$;

-- 4.2 取引作成関数（統一API）  
CREATE OR REPLACE FUNCTION public.create_transaction_secure(
  p_transaction_type text,
  p_partner_id uuid,
  p_assignee_id uuid DEFAULT NULL,
  p_parent_order_id uuid DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  transaction_id uuid,
  transaction_no text,
  total_amount numeric,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_transaction_no text;
  v_calculated_amount numeric := 0;
  v_item record;
BEGIN
  -- バリデーション
  IF p_transaction_type NOT IN ('purchase', 'sale', 'adjustment') THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::numeric,
      '無効な取引種別です'::text;
    RETURN;
  END IF;
  
  -- 取引番号生成
  v_transaction_no := 'TX-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || 
    '-' || substr(md5(random()::text), 1, 6);
  
  -- 金額計算（itemsから計算またはp_total_amount使用）
  IF jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_calculated_amount := v_calculated_amount + 
        (v_item.value->>'quantity')::numeric * (v_item.value->>'unit_price')::numeric;
    END LOOP;
  ELSE
    v_calculated_amount := COALESCE(p_total_amount, 0);
  END IF;
  
  -- 取引作成
  INSERT INTO public.transactions (
    id, transaction_type, transaction_no, partner_id, assignee_id, 
    parent_order_id, total_amount, status, memo, created_at
  ) VALUES (
    gen_random_uuid(), p_transaction_type, v_transaction_no, p_partner_id, p_assignee_id,
    p_parent_order_id, v_calculated_amount, 'draft', p_memo, NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- アイテム追加（存在する場合）
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.transaction_items (
      id, transaction_id, product_id, quantity, unit_price, total_price, created_at
    )
    SELECT 
      gen_random_uuid(),
      v_transaction_id,
      (item.value->>'product_id')::uuid,
      (item.value->>'quantity')::numeric,
      (item.value->>'unit_price')::numeric,
      (item.value->>'quantity')::numeric * (item.value->>'unit_price')::numeric,
      NOW()
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
  
  RETURN QUERY SELECT 
    true,
    v_transaction_id,
    v_transaction_no,
    v_calculated_amount,
    '取引を正常に作成しました'::text;
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false, NULL::uuid, NULL::text, NULL::numeric,
    format('取引作成エラー: %s', SQLERRM);
END;
$$;

-- 4.3 商品管理関数（統一API）
CREATE OR REPLACE FUNCTION public.manage_product_secure(
  p_action text,  -- 'create', 'update', 'deactivate'
  p_product_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL,
  p_current_stock integer DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  product_id uuid,
  name text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  CASE p_action
    WHEN 'create' THEN
      IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::text, '商品名は必須です'::text;
        RETURN;
      END IF;
      
      INSERT INTO public.products (
        id, name, sku, category, unit_price, current_stock, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), trim(p_name), p_sku, p_category, 
        COALESCE(p_unit_price, 0), COALESCE(p_current_stock, 0), 'active', NOW(), NOW()
      ) RETURNING id INTO v_product_id;
      
      RETURN QUERY SELECT true, v_product_id, trim(p_name), '商品を作成しました'::text;
      
    WHEN 'update' THEN
      IF p_product_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::text, '商品IDは必須です'::text;
        RETURN;
      END IF;
      
      UPDATE public.products SET
        name = COALESCE(p_name, name),
        sku = COALESCE(p_sku, sku),
        category = COALESCE(p_category, category),
        unit_price = COALESCE(p_unit_price, unit_price),
        current_stock = COALESCE(p_current_stock, current_stock),
        updated_at = NOW()
      WHERE id = p_product_id
      RETURNING id, name INTO v_product_id, p_name;
      
      IF v_product_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::text, '指定された商品が見つかりません'::text;
        RETURN;
      END IF;
      
      RETURN QUERY SELECT true, v_product_id, p_name, '商品を更新しました'::text;
      
    WHEN 'deactivate' THEN
      UPDATE public.products SET
        status = 'inactive',
        updated_at = NOW()
      WHERE id = p_product_id
      RETURNING id, name INTO v_product_id, p_name;
      
      RETURN QUERY SELECT true, v_product_id, p_name, '商品を非アクティブにしました'::text;
      
    ELSE
      RETURN QUERY SELECT false, NULL::uuid, NULL::text, '無効なアクションです'::text;
  END CASE;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false, NULL::uuid, NULL::text,
    format('商品管理エラー: %s', SQLERRM);
END;
$$;

-- ===============================================================
-- 5. 既存RPC関数のSECURITY DEFINER化
-- ===============================================================

-- 5.1 既存の分納関数をSECURITY DEFINER化
CREATE OR REPLACE FUNCTION public.add_purchase_installment_v2_secure(
  p_parent_order_id uuid,
  p_amount numeric,
  p_status text DEFAULT 'draft',
  p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days',
  p_memo text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  installment_id uuid,
  parent_order_id uuid,
  installment_no integer,
  transaction_no text,
  status text,
  total_amount numeric,
  memo text,
  transaction_date date,
  due_date date,
  created_at timestamptz,
  validation_info jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER  -- 重要: 権限昇格
AS $$
-- 既存のadd_purchase_installment_v2ロジックをSECURITY DEFINERで再実装
DECLARE
  v_next_installment integer;
  v_validation_result record;
  v_order_no text;
  v_new_transaction_id uuid;
  v_transaction_no text;
  v_retry_count integer := 0;
  v_max_retries integer := 3;
BEGIN
  -- 排他ロック: 同時実行制御
  PERFORM 1 FROM public.purchase_orders WHERE id = p_parent_order_id FOR UPDATE;
  
  -- 統一バリデーション関数による検証
  SELECT * FROM public.validate_installment_amount(p_parent_order_id, p_amount)
  INTO v_validation_result;
  
  IF NOT v_validation_result.is_valid THEN
    RETURN QUERY SELECT 
      false,
      NULL::uuid,
      p_parent_order_id,
      NULL::integer,
      NULL::text,
      p_status,
      p_amount,
      p_memo,
      CURRENT_DATE,
      p_due_date,
      NULL::timestamptz,
      jsonb_build_object(
        'error_code', v_validation_result.error_code,
        'error_message', v_validation_result.error_message,
        'order_total', v_validation_result.order_total,
        'allocated_total', v_validation_result.allocated_total,
        'remaining_amount', v_validation_result.remaining_amount,
        'validation_timestamp', NOW()
      );
    RETURN;
  END IF;
  
  -- 発注番号取得
  SELECT order_no INTO v_order_no
  FROM public.purchase_orders WHERE id = p_parent_order_id;
  
  -- 競合制御ループによる安全な挿入
  <<retry_loop>>
  LOOP
    v_retry_count := v_retry_count + 1;
    
    -- 次の分納回次を計算
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_next_installment
    FROM public.transactions
    WHERE parent_order_id = p_parent_order_id 
      AND transaction_type = 'purchase';
    
    -- 一意な取引番号生成
    v_transaction_no := 'TX-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') || '-' || 
                       substr(md5(random()::text || v_retry_count::text), 1, 6);
    
    v_new_transaction_id := gen_random_uuid();
    
    BEGIN
      -- 分納トランザクションの挿入
      INSERT INTO public.transactions (
        id, transaction_type, transaction_no, partner_id, transaction_date, due_date,
        status, total_amount, memo, parent_order_id, installment_no, created_at, assignee_id
      )
      SELECT
        v_new_transaction_id, 'purchase', v_transaction_no, po.partner_id, CURRENT_DATE, p_due_date,
        p_status, p_amount, COALESCE(p_memo, '第' || v_next_installment || '回分納 - ' || po.order_no || ' (Secure v2.0)'),
        p_parent_order_id, v_next_installment, NOW(), po.assignee_id
      FROM public.purchase_orders po
      WHERE po.id = p_parent_order_id;
      
      -- 成功時はループ終了
      EXIT retry_loop;
      
    EXCEPTION 
      WHEN unique_violation THEN
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION '分納番号の競合が解決できません。しばらくしてから再実行してください。'
            USING ERRCODE = 'P0002';
        END IF;
        PERFORM pg_sleep(0.01 * v_retry_count);
      WHEN others THEN
        RAISE;
    END;
  END LOOP;
  
  -- 成功レスポンス返却
  RETURN QUERY
  SELECT 
    true,
    v_new_transaction_id,
    p_parent_order_id,
    v_next_installment,
    v_transaction_no,
    p_status,
    p_amount,
    COALESCE(p_memo, '第' || v_next_installment || '回分納 - ' || v_order_no || ' (Secure v2.0)'),
    CURRENT_DATE,
    p_due_date,
    NOW(),
    jsonb_build_object(
      'validation_passed', true,
      'order_total', v_validation_result.order_total,
      'allocated_total', v_validation_result.allocated_total,
      'remaining_amount', v_validation_result.remaining_amount - p_amount,
      'installment_no', v_next_installment,
      'retry_count', v_retry_count,
      'processing_timestamp', NOW(),
      'security_mode', 'DEFINER'
    );
END;
$$;

-- ===============================================================
-- 6. 権限設定とアクセス制御
-- ===============================================================

-- 6.1 既存の直接テーブル権限を制限
REVOKE INSERT, UPDATE, DELETE ON public.purchase_orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transaction_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.purchase_order_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.partners FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_movements FROM anon, authenticated;

-- 6.2 読み取り権限は維持
GRANT SELECT ON public.purchase_orders TO anon, authenticated;
GRANT SELECT ON public.transactions TO anon, authenticated;
GRANT SELECT ON public.transaction_items TO anon, authenticated;
GRANT SELECT ON public.purchase_order_items TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.partners TO anon, authenticated;
GRANT SELECT ON public.staff_members TO anon, authenticated;
GRANT SELECT ON public.inventory_movements TO anon, authenticated;

-- 6.3 新しいSECURITY DEFINER関数への権限付与
GRANT EXECUTE ON FUNCTION public.create_purchase_order_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transaction_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_product_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2_secure TO authenticated;

-- 6.4 既存RPC関数も継続利用可能（段階移行のため）
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_installment TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_purchase_installment TO authenticated;

-- ===============================================================
-- 7. 移行確認とモニタリング
-- ===============================================================

-- 7.1 RLS導入確認関数
CREATE OR REPLACE FUNCTION public.rls_security_status_report()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policies_count bigint,
  direct_access_blocked boolean,
  api_functions_available text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH table_policies AS (
    SELECT 
      pt.tablename,
      pt.rowsecurity as rls_enabled,
      COUNT(pp.policyname) as policies_count
    FROM pg_tables pt
    LEFT JOIN pg_policies pp ON pt.tablename = pp.tablename AND pt.schemaname = pp.schemaname
    WHERE pt.schemaname = 'public' 
      AND pt.tablename IN ('purchase_orders', 'transactions', 'products', 'partners', 'staff_members')
    GROUP BY pt.tablename, pt.rowsecurity
  ),
  function_availability AS (
    SELECT 
      'purchase_orders' as table_name,
      ARRAY['create_purchase_order_secure', 'add_purchase_installment_v2_secure'] as functions
    UNION ALL
    SELECT 
      'transactions' as table_name,
      ARRAY['create_transaction_secure', 'add_purchase_installment_v2_secure'] as functions
    UNION ALL
    SELECT 
      'products' as table_name,
      ARRAY['manage_product_secure'] as functions
  )
  SELECT 
    tp.tablename,
    tp.rls_enabled,
    tp.policies_count,
    tp.policies_count > 0 as direct_access_blocked,
    COALESCE(fa.functions, ARRAY[]::text[]) as api_functions_available
  FROM table_policies tp
  LEFT JOIN function_availability fa ON tp.tablename = fa.table_name
  ORDER BY tp.tablename;
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
  'RLS_SECURITY_ENFORCEMENT',
  'CRITICAL',
  'P0緊急対応: RLS による書込統一とセキュリティ強化完了',
  jsonb_build_object(
    'tables_secured', 8,
    'security_definer_functions_created', 4,
    'direct_table_access_blocked', true,
    'rls_policies_created', (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'),
    'security_level', 'ENTERPRISE'
  )
);

-- 完了メッセージ
DO $$ BEGIN
  RAISE NOTICE '🔒 P0緊急対応完了: RLS セキュリティ強化システム';
  RAISE NOTICE '📊 セキュリティ状況: SELECT * FROM rls_security_status_report();';
  RAISE NOTICE '🛡️ 全テーブルの直接書込がブロックされました';
  RAISE NOTICE '🔧 新API利用: create_purchase_order_secure(), create_transaction_secure()';
  RAISE NOTICE '⚠️  重要: フロントエンドを新しいSECURITY DEFINER関数に切り替えてください';
  RAISE NOTICE '📚 段階移行: 既存RPC関数も当面利用可能（後日廃止予定）';
END $$;

COMMIT;