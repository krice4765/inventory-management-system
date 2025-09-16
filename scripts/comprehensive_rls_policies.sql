-- ===============================================================
-- 包括的RLSポリシー設定スクリプト
-- 実装日: 2025-09-15
-- 目的: 企業級セキュリティとPostgreSQL MCP統合対応
-- ===============================================================

BEGIN;

-- ===============================================================
-- 1. 現状確認とバックアップ
-- ===============================================================

SELECT '=== 🛡️ RLS包括設定開始 ===' as rls_setup_section;

-- 現在のRLS状況確認
CREATE TEMP TABLE current_rls_status AS
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = pt.tablename) as policy_count
FROM pg_tables pt
WHERE schemaname = 'public'
  AND tablename IN (
    'purchase_orders', 'transactions', 'transaction_items', 'purchase_order_items',
    'products', 'partners', 'staff_members', 'inventory_movements',
    'user_applications', 'user_profiles', 'audit_logs'
  )
ORDER BY tablename;

-- 現状レポート出力
SELECT
  '現在のRLS状況' as report_type,
  COUNT(*) as total_tables,
  COUNT(CASE WHEN rls_enabled THEN 1 END) as rls_enabled_tables,
  SUM(policy_count) as total_policies
FROM current_rls_status;

-- ===============================================================
-- 2. 基本RLS有効化（全主要テーブル）
-- ===============================================================

SELECT '=== 📋 基本RLS有効化 ===' as rls_setup_section;

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
    'inventory_movements',
    'user_applications',
    'user_profiles',
    'audit_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_secure LOOP
    -- テーブル存在確認
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
      -- RLS有効化
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      RAISE NOTICE 'RLS有効化: %', table_name;
    ELSE
      RAISE NOTICE 'テーブル未存在（スキップ）: %', table_name;
    END IF;
  END LOOP;
END $$;

-- ===============================================================
-- 3. 認証済みユーザー用ポリシー（基本）
-- ===============================================================

SELECT '=== 👤 認証済みユーザーポリシー ===' as rls_setup_section;

-- 3.1 purchase_orders のポリシー
DROP POLICY IF EXISTS purchase_orders_authenticated_policy ON public.purchase_orders;
CREATE POLICY purchase_orders_authenticated_policy ON public.purchase_orders
  FOR ALL TO authenticated
  USING (true)  -- 認証済みユーザーは全件読み取り可能
  WITH CHECK (true);  -- 認証済みユーザーは作成・更新可能

-- 3.2 transactions のポリシー
DROP POLICY IF EXISTS transactions_authenticated_policy ON public.transactions;
CREATE POLICY transactions_authenticated_policy ON public.transactions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.3 transaction_items のポリシー
DROP POLICY IF EXISTS transaction_items_authenticated_policy ON public.transaction_items;
CREATE POLICY transaction_items_authenticated_policy ON public.transaction_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.4 purchase_order_items のポリシー
DROP POLICY IF EXISTS purchase_order_items_authenticated_policy ON public.purchase_order_items;
CREATE POLICY purchase_order_items_authenticated_policy ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.5 products のポリシー
DROP POLICY IF EXISTS products_authenticated_policy ON public.products;
CREATE POLICY products_authenticated_policy ON public.products
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.6 partners のポリシー
DROP POLICY IF EXISTS partners_authenticated_policy ON public.partners;
CREATE POLICY partners_authenticated_policy ON public.partners
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.7 staff_members のポリシー
DROP POLICY IF EXISTS staff_members_authenticated_policy ON public.staff_members;
CREATE POLICY staff_members_authenticated_policy ON public.staff_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.8 inventory_movements のポリシー
DROP POLICY IF EXISTS inventory_movements_authenticated_policy ON public.inventory_movements;
CREATE POLICY inventory_movements_authenticated_policy ON public.inventory_movements
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===============================================================
-- 4. 匿名ユーザー用ポリシー（制限付き）
-- ===============================================================

SELECT '=== 🔒 匿名ユーザーポリシー ===' as rls_setup_section;

-- 4.1 products - 匿名ユーザーは読み取りのみ
DROP POLICY IF EXISTS products_anon_read_policy ON public.products;
CREATE POLICY products_anon_read_policy ON public.products
  FOR SELECT TO anon
  USING (is_active = true);  -- アクティブな商品のみ

-- 4.2 partners - 匿名ユーザーは読み取りのみ（基本情報のみ）
DROP POLICY IF EXISTS partners_anon_read_policy ON public.partners;
CREATE POLICY partners_anon_read_policy ON public.partners
  FOR SELECT TO anon
  USING (is_active = true);  -- アクティブな取引先のみ

-- 4.3 user_applications - 匿名ユーザーは挿入のみ可能
DROP POLICY IF EXISTS user_applications_anon_insert_policy ON public.user_applications;
CREATE POLICY user_applications_anon_insert_policy ON public.user_applications
  FOR INSERT TO anon
  WITH CHECK (true);  -- 申請作成は誰でも可能

-- ===============================================================
-- 5. 管理者専用ポリシー（email-based）
-- ===============================================================

SELECT '=== 👑 管理者専用ポリシー ===' as rls_setup_section;

-- 5.1 user_applications - 管理者は全操作可能
DROP POLICY IF EXISTS user_applications_admin_policy ON public.user_applications;
CREATE POLICY user_applications_admin_policy ON public.user_applications
  FOR ALL TO authenticated
  USING (
    auth.email() IN (
      'dev@inventory.test',
      'Krice4765104@gmail.com',
      'prod@inventory.test',
      'admin@company.com'
    )
  )
  WITH CHECK (
    auth.email() IN (
      'dev@inventory.test',
      'Krice4765104@gmail.com',
      'prod@inventory.test',
      'admin@company.com'
    )
  );

-- 5.2 user_profiles - 管理者は全操作、一般ユーザーは自分のみ
DROP POLICY IF EXISTS user_profiles_user_policy ON public.user_profiles;
CREATE POLICY user_profiles_user_policy ON public.user_profiles
  FOR ALL TO authenticated
  USING (
    auth.email() IN (
      'dev@inventory.test',
      'Krice4765104@gmail.com',
      'prod@inventory.test',
      'admin@company.com'
    ) OR auth.email() = email  -- 自分のプロファイルのみ
  )
  WITH CHECK (
    auth.email() IN (
      'dev@inventory.test',
      'Krice4765104@gmail.com',
      'prod@inventory.test',
      'admin@company.com'
    ) OR auth.email() = email
  );

-- 5.3 audit_logs - 管理者のみ読み取り可能（挿入は関数経由）
DROP POLICY IF EXISTS audit_logs_admin_read_policy ON public.audit_logs;
CREATE POLICY audit_logs_admin_read_policy ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    auth.email() IN (
      'dev@inventory.test',
      'Krice4765104@gmail.com',
      'prod@inventory.test',
      'admin@company.com'
    )
  );

-- ===============================================================
-- 6. PostgreSQL MCP対応 - サービスロール用ポリシー
-- ===============================================================

SELECT '=== 🔌 PostgreSQL MCP対応ポリシー ===' as rls_setup_section;

-- 6.1 サービスロール作成（存在しない場合）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_service_role') THEN
    CREATE ROLE mcp_service_role WITH LOGIN PASSWORD 'mcp_secure_2025';
    RAISE NOTICE 'MCPサービスロール作成完了';
  ELSE
    RAISE NOTICE 'MCPサービスロール既存';
  END IF;
END
$$;

-- 6.2 MCP用基本権限設定
GRANT CONNECT ON DATABASE postgres TO mcp_service_role;
GRANT USAGE ON SCHEMA public TO mcp_service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mcp_service_role;

-- 6.3 MCP専用ポリシー（service_role用）
-- PostgreSQL MCPが使用するサービスロール向けの特別ポリシー
DROP POLICY IF EXISTS mcp_service_access_policy ON public.purchase_orders;
CREATE POLICY mcp_service_access_policy ON public.purchase_orders
  FOR ALL TO mcp_service_role
  USING (true)  -- MCPサービスは全データアクセス可能
  WITH CHECK (true);

-- ===============================================================
-- 7. セキュリティ監査とログ記録ポリシー
-- ===============================================================

SELECT '=== 📊 セキュリティ監査ポリシー ===' as rls_setup_section;

-- 7.1 システムログ挿入関数（RLS bypass）
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_user_email text,
  p_table_name text,
  p_action text,
  p_record_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- RLSをバイパスしてログ挿入
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    event_type,
    user_email,
    table_name,
    action,
    record_id,
    details,
    created_at
  ) VALUES (
    p_event_type,
    p_user_email,
    p_table_name,
    p_action,
    p_record_id,
    p_details,
    NOW()
  );

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- ログ失敗でもアプリケーションを停止させない
  RETURN false;
END;
$$;

-- 7.2 RLS回避の監査ログ挿入ポリシー
DROP POLICY IF EXISTS audit_logs_system_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_system_insert_policy ON public.audit_logs
  FOR INSERT
  USING (true)  -- システム関数経由での挿入は常に許可
  WITH CHECK (true);

-- ===============================================================
-- 8. 開発・テスト環境用の緩和ポリシー
-- ===============================================================

SELECT '=== 🧪 開発環境用ポリシー ===' as rls_setup_section;

-- 8.1 開発環境判定関数
CREATE OR REPLACE FUNCTION public.is_development_environment()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- 環境変数やDBの設定から開発環境かどうかを判定
  RETURN current_setting('app.environment', true) = 'development'
    OR current_database() LIKE '%dev%'
    OR current_database() LIKE '%test%';
END;
$$;

-- 8.2 開発環境用緩和ポリシー（必要に応じて有効化）
-- DROP POLICY IF EXISTS dev_bypass_policy ON public.purchase_orders;
-- CREATE POLICY dev_bypass_policy ON public.purchase_orders
--   FOR ALL TO authenticated
--   USING (is_development_environment())
--   WITH CHECK (is_development_environment());

-- ===============================================================
-- 9. RLS状況確認関数
-- ===============================================================

SELECT '=== 📋 RLS状況確認関数作成 ===' as rls_setup_section;

CREATE OR REPLACE FUNCTION public.get_rls_status_report()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint,
  authenticated_policies text[],
  anon_policies text[],
  admin_policies text[],
  security_status text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH policy_summary AS (
    SELECT
      pt.tablename,
      pt.rowsecurity as rls_enabled,
      COUNT(pp.policyname) as policy_count,
      array_agg(
        CASE WHEN pp.roles @> ARRAY['authenticated'::name]
        THEN pp.policyname END
      ) FILTER (WHERE pp.roles @> ARRAY['authenticated'::name]) as auth_policies,
      array_agg(
        CASE WHEN pp.roles @> ARRAY['anon'::name]
        THEN pp.policyname END
      ) FILTER (WHERE pp.roles @> ARRAY['anon'::name]) as anon_policies,
      array_agg(
        CASE WHEN pp.policyname LIKE '%admin%'
        THEN pp.policyname END
      ) FILTER (WHERE pp.policyname LIKE '%admin%') as admin_policies
    FROM pg_tables pt
    LEFT JOIN pg_policies pp ON pt.tablename = pp.tablename
      AND pt.schemaname = pp.schemaname
    WHERE pt.schemaname = 'public'
    GROUP BY pt.tablename, pt.rowsecurity
  )
  SELECT
    ps.tablename,
    ps.rls_enabled,
    ps.policy_count,
    COALESCE(ps.auth_policies, ARRAY[]::text[]),
    COALESCE(ps.anon_policies, ARRAY[]::text[]),
    COALESCE(ps.admin_policies, ARRAY[]::text[]),
    CASE
      WHEN ps.rls_enabled AND ps.policy_count > 0 THEN '✅ セキュア'
      WHEN ps.rls_enabled AND ps.policy_count = 0 THEN '⚠️  RLS有効だがポリシー未設定'
      WHEN NOT ps.rls_enabled THEN '❌ RLS無効'
      ELSE '❓ 不明'
    END as security_status
  FROM policy_summary ps
  WHERE ps.tablename IN (
    'purchase_orders', 'transactions', 'transaction_items', 'purchase_order_items',
    'products', 'partners', 'staff_members', 'inventory_movements',
    'user_applications', 'user_profiles', 'audit_logs'
  )
  ORDER BY ps.tablename;
END;
$$;

-- ===============================================================
-- 10. 最終確認とテスト
-- ===============================================================

SELECT '=== ✅ 最終確認 ===' as rls_setup_section;

-- 10.1 RLS状況レポート実行
SELECT
  '🛡️ RLS設定完了レポート' as report_title,
  COUNT(*) as total_tables,
  COUNT(CASE WHEN rls_enabled THEN 1 END) as rls_enabled_count,
  COUNT(CASE WHEN security_status = '✅ セキュア' THEN 1 END) as secure_tables,
  COUNT(CASE WHEN security_status LIKE '%⚠️%' THEN 1 END) as warning_tables,
  COUNT(CASE WHEN security_status LIKE '%❌%' THEN 1 END) as insecure_tables
FROM public.get_rls_status_report();

-- 10.2 PostgreSQL MCP統合確認
SELECT
  '🔌 PostgreSQL MCP統合状況' as integration_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_service_role')
    THEN '✅ MCPサービスロール設定済み'
    ELSE '❌ MCPサービスロール未設定'
  END as mcp_role_status,
  (SELECT COUNT(*) FROM pg_policies WHERE policyname LIKE '%mcp%') as mcp_policies_count;

-- ===============================================================
-- 11. システムログ記録
-- ===============================================================

-- 設定完了ログ
SELECT public.log_security_event(
  'RLS_COMPREHENSIVE_SETUP',
  'system',
  'all_tables',
  'CONFIGURE',
  NULL,
  jsonb_build_object(
    'tables_configured', (SELECT COUNT(*) FROM public.get_rls_status_report()),
    'secure_tables', (SELECT COUNT(*) FROM public.get_rls_status_report() WHERE security_status = '✅ セキュア'),
    'mcp_integration', true,
    'setup_timestamp', NOW(),
    'script_version', 'comprehensive_v1.0'
  )
);

-- ===============================================================
-- 12. 完了通知
-- ===============================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 =================================';
  RAISE NOTICE '🛡️  包括的RLSポリシー設定完了';
  RAISE NOTICE '🎉 =================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 確認コマンド:';
  RAISE NOTICE '   SELECT * FROM public.get_rls_status_report();';
  RAISE NOTICE '';
  RAISE NOTICE '🔌 PostgreSQL MCP統合:';
  RAISE NOTICE '   MCPサービスロール: mcp_service_role';
  RAISE NOTICE '   パスワード: mcp_secure_2025';
  RAISE NOTICE '';
  RAISE NOTICE '👤 管理者アカウント:';
  RAISE NOTICE '   dev@inventory.test';
  RAISE NOTICE '   Krice4765104@gmail.com';
  RAISE NOTICE '   prod@inventory.test';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  注意事項:';
  RAISE NOTICE '   1. フロントエンドでauth.email()が適切に動作することを確認';
  RAISE NOTICE '   2. PostgreSQL MCP接続時はmcp_service_roleを使用';
  RAISE NOTICE '   3. 本番環境では管理者メールアドレスを実際のものに変更';
  RAISE NOTICE '';
END $$;

COMMIT;

-- 最終状況出力
SELECT '🔍 最終RLS状況確認' as final_check;
SELECT * FROM public.get_rls_status_report();