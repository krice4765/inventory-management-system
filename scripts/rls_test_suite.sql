-- ===============================================================
-- RLSポリシー動作テストスイート
-- 実装日: 2025-09-15
-- 目的: 設定したRLSポリシーの動作確認と検証
-- ===============================================================

-- ===============================================================
-- 1. テスト環境準備
-- ===============================================================

SELECT '=== 🧪 RLSポリシーテスト開始 ===' as test_section;

-- テスト用一時テーブル作成
CREATE TEMP TABLE IF NOT EXISTS rls_test_results (
  test_id serial PRIMARY KEY,
  test_name text NOT NULL,
  test_category text NOT NULL,
  expected_result text NOT NULL,
  actual_result text,
  status text DEFAULT 'PENDING',
  error_message text,
  execution_time timestamp DEFAULT NOW()
);

-- テスト実行関数
CREATE OR REPLACE FUNCTION run_rls_test(
  p_test_name text,
  p_category text,
  p_expected text,
  p_test_sql text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_result text;
  v_record_count integer;
  v_error_msg text;
BEGIN
  BEGIN
    -- SQLを実行して結果を取得
    EXECUTE p_test_sql INTO v_record_count;
    v_result := v_record_count::text || ' records';

    -- 結果を記録
    INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
    VALUES (p_test_name, p_category, p_expected, v_result,
      CASE WHEN v_result = p_expected THEN 'PASS' ELSE 'FAIL' END);

    RETURN v_result = p_expected;

  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    v_result := 'ERROR: ' || v_error_msg;

    INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status, error_message)
    VALUES (p_test_name, p_category, p_expected, v_result, 'ERROR', v_error_msg);

    RETURN false;
  END;
END;
$$;

-- ===============================================================
-- 2. RLS基本機能テスト
-- ===============================================================

SELECT '=== 🔍 RLS基本機能確認 ===' as test_section;

-- 2.1 RLS有効化確認テスト
DO $$
DECLARE
  v_table text;
  v_rls_enabled boolean;
  v_tables text[] := ARRAY[
    'purchase_orders', 'transactions', 'products', 'partners',
    'user_applications', 'user_profiles'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT rowsecurity INTO v_rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = v_table;

    INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
    VALUES (
      'RLS有効化確認_' || v_table,
      'RLS_BASIC',
      'true',
      COALESCE(v_rls_enabled::text, 'false'),
      CASE WHEN v_rls_enabled THEN 'PASS' ELSE 'FAIL' END
    );
  END LOOP;
END $$;

-- 2.2 ポリシー存在確認テスト
DO $$
DECLARE
  v_table text;
  v_policy_count integer;
  v_tables text[] := ARRAY[
    'purchase_orders', 'transactions', 'products', 'partners',
    'user_applications', 'user_profiles'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = v_table;

    INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
    VALUES (
      'ポリシー存在確認_' || v_table,
      'RLS_BASIC',
      '1以上',
      v_policy_count::text,
      CASE WHEN v_policy_count > 0 THEN 'PASS' ELSE 'FAIL' END
    );
  END LOOP;
END $$;

-- ===============================================================
-- 3. 認証済みユーザーアクセステスト
-- ===============================================================

SELECT '=== 👤 認証済みユーザーアクセステスト ===' as test_section;

-- 認証済みユーザーのコンテキスト設定をシミュレート
-- 注: 実際のテストでは auth.email() を使用

-- 3.1 商品データ読み取りテスト
SELECT run_rls_test(
  '認証ユーザー_商品読み取り',
  'AUTHENTICATED_ACCESS',
  '0以上',
  'SELECT COUNT(*) FROM products WHERE is_active = true'
);

-- 3.2 発注データ読み取りテスト
SELECT run_rls_test(
  '認証ユーザー_発注読み取り',
  'AUTHENTICATED_ACCESS',
  '0以上',
  'SELECT COUNT(*) FROM purchase_orders'
);

-- 3.3 取引データ読み取りテスト
SELECT run_rls_test(
  '認証ユーザー_取引読み取り',
  'AUTHENTICATED_ACCESS',
  '0以上',
  'SELECT COUNT(*) FROM transactions'
);

-- ===============================================================
-- 4. 匿名ユーザーアクセステスト
-- ===============================================================

SELECT '=== 🔒 匿名ユーザーアクセステスト ===' as test_section;

-- 匿名ユーザーのコンテキストをシミュレート
-- 注: 実際のテストでは anon ロールでの接続が必要

-- 4.1 匿名ユーザー商品読み取りテスト（アクティブのみ）
-- これは実際の環境でテストが必要
INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
VALUES (
  '匿名ユーザー_商品読み取り制限',
  'ANON_ACCESS',
  'アクティブ商品のみ',
  '実環境テスト要',
  'MANUAL'
);

-- 4.2 匿名ユーザー発注データアクセス制限テスト
INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
VALUES (
  '匿名ユーザー_発注データ制限',
  'ANON_ACCESS',
  'アクセス拒否',
  '実環境テスト要',
  'MANUAL'
);

-- ===============================================================
-- 5. PostgreSQL MCP統合テスト
-- ===============================================================

SELECT '=== 🔌 PostgreSQL MCP統合テスト ===' as test_section;

-- 5.1 MCPサービスロール存在確認
DO $$
DECLARE
  v_role_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'mcp_service_role')
  INTO v_role_exists;

  INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
  VALUES (
    'MCPサービスロール存在確認',
    'MCP_INTEGRATION',
    'true',
    v_role_exists::text,
    CASE WHEN v_role_exists THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- 5.2 MCP用ポリシー存在確認
DO $$
DECLARE
  v_mcp_policies integer;
BEGIN
  SELECT COUNT(*) INTO v_mcp_policies
  FROM pg_policies
  WHERE policyname LIKE '%mcp%';

  INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
  VALUES (
    'MCP専用ポリシー存在確認',
    'MCP_INTEGRATION',
    '1以上',
    v_mcp_policies::text,
    CASE WHEN v_mcp_policies > 0 THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ===============================================================
-- 6. セキュリティ関数テスト
-- ===============================================================

SELECT '=== 🛡️ セキュリティ関数テスト ===' as test_section;

-- 6.1 監査ログ関数テスト
DO $$
DECLARE
  v_log_success boolean;
BEGIN
  SELECT public.log_security_event(
    'TEST_EVENT',
    'test@example.com',
    'test_table',
    'TEST',
    'test_record_id',
    '{"test": "data"}'::jsonb
  ) INTO v_log_success;

  INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
  VALUES (
    'セキュリティログ関数',
    'SECURITY_FUNCTIONS',
    'true',
    v_log_success::text,
    CASE WHEN v_log_success THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- 6.2 RLS状況レポート関数テスト
DO $$
DECLARE
  v_report_count integer;
BEGIN
  SELECT COUNT(*) INTO v_report_count
  FROM public.get_rls_status_report();

  INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
  VALUES (
    'RLS状況レポート関数',
    'SECURITY_FUNCTIONS',
    '5以上',
    v_report_count::text,
    CASE WHEN v_report_count >= 5 THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ===============================================================
-- 7. パフォーマンステスト
-- ===============================================================

SELECT '=== ⚡ パフォーマンステスト ===' as test_section;

-- 7.1 RLS有効時のクエリパフォーマンス測定
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_record_count integer;
BEGIN
  v_start_time := clock_timestamp();

  SELECT COUNT(*) INTO v_record_count
  FROM purchase_orders po
  JOIN transactions t ON po.id = t.parent_order_id
  WHERE po.status = 'confirmed';

  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;

  INSERT INTO rls_test_results (test_name, test_category, expected_result, actual_result, status)
  VALUES (
    'RLS複合クエリパフォーマンス',
    'PERFORMANCE',
    '1秒以内',
    extract(milliseconds from v_duration)::text || 'ms',
    CASE WHEN v_duration < interval '1 second' THEN 'PASS' ELSE 'FAIL' END
  );
END $$;

-- ===============================================================
-- 8. テスト結果サマリー
-- ===============================================================

SELECT '=== 📊 テスト結果サマリー ===' as test_section;

-- 8.1 カテゴリ別結果サマリー
SELECT
  test_category,
  COUNT(*) as total_tests,
  COUNT(CASE WHEN status = 'PASS' THEN 1 END) as passed,
  COUNT(CASE WHEN status = 'FAIL' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as errors,
  COUNT(CASE WHEN status = 'MANUAL' THEN 1 END) as manual_tests,
  ROUND(
    COUNT(CASE WHEN status = 'PASS' THEN 1 END) * 100.0 /
    COUNT(CASE WHEN status IN ('PASS', 'FAIL') THEN 1 END), 2
  ) as pass_rate_percent
FROM rls_test_results
GROUP BY test_category
ORDER BY test_category;

-- 8.2 全体結果サマリー
SELECT
  '🧪 RLSテスト全体結果' as summary_type,
  COUNT(*) as total_tests,
  COUNT(CASE WHEN status = 'PASS' THEN 1 END) as passed,
  COUNT(CASE WHEN status = 'FAIL' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as errors,
  COUNT(CASE WHEN status = 'MANUAL' THEN 1 END) as manual_tests,
  ROUND(
    COUNT(CASE WHEN status = 'PASS' THEN 1 END) * 100.0 /
    NULLIF(COUNT(CASE WHEN status IN ('PASS', 'FAIL') THEN 1 END), 0), 2
  ) as overall_pass_rate
FROM rls_test_results;

-- 8.3 失敗したテストの詳細
SELECT
  '❌ 失敗テスト詳細' as failed_tests_title,
  test_name,
  test_category,
  expected_result,
  actual_result,
  error_message
FROM rls_test_results
WHERE status IN ('FAIL', 'ERROR')
ORDER BY test_category, test_name;

-- 8.4 手動テスト項目一覧
SELECT
  '📋 手動テスト項目' as manual_tests_title,
  test_name,
  test_category,
  expected_result,
  '実際の認証環境でテストが必要' as note
FROM rls_test_results
WHERE status = 'MANUAL'
ORDER BY test_category, test_name;

-- ===============================================================
-- 9. 実用的な検証コマンド
-- ===============================================================

SELECT '=== 🔧 実用的な検証コマンド ===' as verification_section;

-- 9.1 現在のRLS状況確認
SELECT '📋 現在のRLS状況:' as info;
SELECT * FROM public.get_rls_status_report();

-- 9.2 ポリシー一覧
SELECT '📜 設定済みポリシー一覧:' as info;
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as policy_type,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9.3 権限確認
SELECT '🔑 テーブル権限確認:' as info;
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('purchase_orders', 'transactions', 'products', 'partners')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- ===============================================================
-- 10. 次のステップ推奨事項
-- ===============================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎯 =================================';
  RAISE NOTICE '📋 RLSテスト完了 - 次のステップ';
  RAISE NOTICE '🎯 =================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 自動テスト完了項目:';
  RAISE NOTICE '   1. RLS基本機能確認';
  RAISE NOTICE '   2. ポリシー存在確認';
  RAISE NOTICE '   3. MCP統合確認';
  RAISE NOTICE '   4. セキュリティ関数確認';
  RAISE NOTICE '';
  RAISE NOTICE '📋 手動テスト要項目:';
  RAISE NOTICE '   1. 認証済みユーザーでのログイン後テスト';
  RAISE NOTICE '   2. 匿名ユーザーでのアクセス制限確認';
  RAISE NOTICE '   3. PostgreSQL MCP接続テスト';
  RAISE NOTICE '   4. フロントエンドからのCRUD操作確認';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 推奨検証コマンド:';
  RAISE NOTICE '   -- RLS状況確認';
  RAISE NOTICE '   SELECT * FROM public.get_rls_status_report();';
  RAISE NOTICE '';
  RAISE NOTICE '   -- テスト結果確認';
  RAISE NOTICE '   SELECT * FROM rls_test_results ORDER BY test_category;';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 プロダクション適用前:';
  RAISE NOTICE '   1. 本スクリプトを本番環境で実行';
  RAISE NOTICE '   2. フロントエンドの認証フロー確認';
  RAISE NOTICE '   3. PostgreSQL MCP設定確認';
  RAISE NOTICE '   4. 管理者メールアドレスの本番値への変更';
  RAISE NOTICE '';
END $$;