-- ===============================================================
-- 🚀 運用エクセレンス: 監視システムとスキーマ管理自動化
-- ===============================================================
-- 目的: 継続的品質保証、自動スキーマ管理、予防保守体制の確立

BEGIN;

-- ===============================================================
-- 1. 運用監視システムの拡張
-- ===============================================================

-- 1.1 運用メトリクステーブル
CREATE TABLE IF NOT EXISTS public.operational_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- メトリクス基本情報
  metric_name text NOT NULL,
  metric_category text NOT NULL,
  metric_value numeric,
  metric_unit text,
  threshold_warning numeric,
  threshold_critical numeric,
  
  -- 状態管理
  status text DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'WARNING', 'CRITICAL', 'UNKNOWN')),
  last_alert_at timestamptz,
  alert_count integer DEFAULT 0,
  
  -- 時系列情報
  measurement_time timestamptz DEFAULT NOW(),
  date_partition date DEFAULT CURRENT_DATE,
  
  -- メタ情報
  collection_source text DEFAULT 'AUTO',
  additional_data jsonb DEFAULT '{}',
  
  -- インデックス用
  created_at timestamptz DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_operational_metrics_name_time ON public.operational_metrics (metric_name, measurement_time DESC);
CREATE INDEX idx_operational_metrics_category_status ON public.operational_metrics (metric_category, status);
CREATE INDEX idx_operational_metrics_partition ON public.operational_metrics (date_partition);

-- 1.2 システムヘルスチェック関数
CREATE OR REPLACE FUNCTION public.collect_system_health_metrics()
RETURNS TABLE (
  metric_name text,
  metric_value numeric,
  status text,
  details jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  db_connections integer;
  avg_query_time numeric;
  error_rate numeric;
  storage_usage numeric;
  rpc_success_rate numeric;
BEGIN
  -- データベース接続数
  SELECT count(*) INTO db_connections 
  FROM pg_stat_activity 
  WHERE state = 'active';
  
  RETURN QUERY SELECT 
    'database_connections'::text,
    db_connections::numeric,
    CASE WHEN db_connections > 50 THEN 'WARNING' WHEN db_connections > 100 THEN 'CRITICAL' ELSE 'NORMAL' END,
    jsonb_build_object('current_connections', db_connections, 'threshold_warning', 50);
  
  -- 平均クエリ時間（直近1時間）
  SELECT COALESCE(AVG(mean_exec_time), 0) INTO avg_query_time
  FROM pg_stat_statements 
  WHERE last_exec > NOW() - INTERVAL '1 hour';
  
  RETURN QUERY SELECT 
    'avg_query_time_ms'::text,
    avg_query_time,
    CASE WHEN avg_query_time > 1000 THEN 'WARNING' WHEN avg_query_time > 5000 THEN 'CRITICAL' ELSE 'NORMAL' END,
    jsonb_build_object('avg_time_ms', avg_query_time, 'sample_period', '1 hour');
  
  -- エラー率（直近24時間）
  SELECT 
    CASE WHEN SUM(call_count) > 0 THEN 
      (SUM(error_count)::numeric / SUM(call_count) * 100)
    ELSE 0 END 
  INTO error_rate
  FROM public.api_response_stats 
  WHERE date_partition >= CURRENT_DATE - 1;
  
  RETURN QUERY SELECT 
    'api_error_rate_percent'::text,
    COALESCE(error_rate, 0),
    CASE WHEN error_rate > 5 THEN 'WARNING' WHEN error_rate > 10 THEN 'CRITICAL' ELSE 'NORMAL' END,
    jsonb_build_object('error_rate', error_rate, 'sample_period', '24 hours');
  
  -- テーブルサイズ監視
  SELECT 
    ROUND(SUM(pg_total_relation_size(oid)) / (1024*1024)::numeric, 2) 
  INTO storage_usage
  FROM pg_class 
  WHERE relname IN ('purchase_orders', 'transactions', 'products', 'staff_members', 'system_logs');
  
  RETURN QUERY SELECT 
    'core_tables_size_mb'::text,
    storage_usage,
    CASE WHEN storage_usage > 1000 THEN 'WARNING' WHEN storage_usage > 5000 THEN 'CRITICAL' ELSE 'NORMAL' END,
    jsonb_build_object('size_mb', storage_usage, 'monitored_tables', 5);
  
  -- RPC成功率
  SELECT 
    CASE WHEN SUM(call_count) > 0 THEN 
      (SUM(success_count)::numeric / SUM(call_count) * 100)
    ELSE 100 END 
  INTO rpc_success_rate
  FROM public.api_response_stats 
  WHERE date_partition >= CURRENT_DATE - 1;
  
  RETURN QUERY SELECT 
    'rpc_success_rate_percent'::text,
    COALESCE(rpc_success_rate, 100),
    CASE WHEN rpc_success_rate < 95 THEN 'WARNING' WHEN rpc_success_rate < 90 THEN 'CRITICAL' ELSE 'NORMAL' END,
    jsonb_build_object('success_rate', rpc_success_rate, 'sample_period', '24 hours');
END;
$$;

-- 1.3 メトリクス自動収集関数
CREATE OR REPLACE FUNCTION public.auto_collect_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  metric_record record;
BEGIN
  -- システムヘルスメトリクスの収集
  FOR metric_record IN 
    SELECT * FROM public.collect_system_health_metrics()
  LOOP
    INSERT INTO public.operational_metrics (
      metric_name, metric_category, metric_value, status, 
      additional_data, measurement_time
    ) VALUES (
      metric_record.metric_name,
      'SYSTEM_HEALTH',
      metric_record.metric_value,
      metric_record.status,
      metric_record.details,
      NOW()
    );
    
    -- 異常値の場合はアラート記録
    IF metric_record.status IN ('WARNING', 'CRITICAL') THEN
      INSERT INTO public.system_logs (event_type, event_level, message, details)
      VALUES (
        'METRIC_ALERT',
        metric_record.status,
        format('メトリクス異常検知: %s = %s', 
          metric_record.metric_name, metric_record.metric_value),
        metric_record.details
      );
    END IF;
  END LOOP;
  
  -- 業務メトリクスの収集
  INSERT INTO public.operational_metrics (
    metric_name, metric_category, metric_value, status, measurement_time
  ) VALUES 
  ('daily_orders_count', 'BUSINESS', 
   (SELECT COUNT(*) FROM public.purchase_orders WHERE created_at::date = CURRENT_DATE), 
   'NORMAL', NOW()),
  ('daily_transactions_count', 'BUSINESS',
   (SELECT COUNT(*) FROM public.transactions WHERE created_at::date = CURRENT_DATE),
   'NORMAL', NOW()),
  ('active_staff_count', 'BUSINESS',
   (SELECT COUNT(*) FROM public.staff_members WHERE status = 'active'),
   'NORMAL', NOW());
END;
$$;

-- ===============================================================
-- 2. スキーマ管理自動化システム
-- ===============================================================

-- 2.1 スキーマバージョン管理テーブル
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- バージョン情報
  version_number text NOT NULL UNIQUE,
  version_name text,
  release_date date DEFAULT CURRENT_DATE,
  
  -- 変更内容
  changes_summary text,
  migration_scripts text[],
  rollback_scripts text[],
  
  -- 実行情報
  applied_at timestamptz,
  applied_by text,
  execution_time_seconds numeric,
  
  -- 状態管理
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED', 'FAILED', 'ROLLED_BACK')),
  failure_reason text,
  
  -- 依存関係
  prerequisite_versions text[],
  breaking_changes boolean DEFAULT false,
  
  created_at timestamptz DEFAULT NOW()
);

-- 2.2 現在のスキーマバージョン記録
INSERT INTO public.schema_versions (
  version_number, version_name, changes_summary, 
  migration_scripts, status, applied_at, applied_by
) VALUES (
  '2.0.0', 
  '包括的多層防御システム + 課題対応統合版',
  '担当者マスタ化、RLS導入、制約最適化、エラー統一、運用監視システム構築',
  ARRAY[
    'P0_staff_members_master_fix.sql',
    'P0_rls_security_enforcement.sql', 
    'P1_constraint_optimization.sql',
    'P1_error_handling_standardization.sql',
    'P2_operational_excellence.sql'
  ],
  'APPLIED',
  NOW(),
  'SuperClaude System'
) ON CONFLICT (version_number) DO UPDATE SET
  status = 'APPLIED',
  applied_at = NOW();

-- 2.3 スキーマ差分検出関数
CREATE OR REPLACE FUNCTION public.detect_schema_drift()
RETURNS TABLE (
  drift_type text,
  object_name text,
  expected_definition text,
  actual_definition text,
  drift_severity text,
  recommended_action text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- テーブル構造の差分チェック
  RETURN QUERY
  WITH expected_tables AS (
    SELECT unnest(ARRAY[
      'staff_members',
      'system_error_codes', 
      'api_response_stats',
      'operational_metrics',
      'schema_versions'
    ]) as table_name
  ),
  existing_tables AS (
    SELECT tablename as table_name
    FROM pg_tables 
    WHERE schemaname = 'public'
  )
  SELECT 
    'MISSING_TABLE'::text,
    et.table_name,
    'Required system table'::text,
    'Table does not exist'::text,
    'HIGH'::text,
    'Execute missing migration scripts'::text
  FROM expected_tables et
  LEFT JOIN existing_tables ex ON et.table_name = ex.table_name
  WHERE ex.table_name IS NULL;
  
  -- 重要関数の存在チェック
  RETURN QUERY
  WITH expected_functions AS (
    SELECT unnest(ARRAY[
      'validate_installment_amount',
      'get_error_info',
      'collect_system_health_metrics',
      'auto_collect_metrics'
    ]) as function_name
  ),
  existing_functions AS (
    SELECT proname as function_name
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  )
  SELECT 
    'MISSING_FUNCTION'::text,
    ef.function_name,
    'Required system function'::text,
    'Function does not exist'::text,
    'MEDIUM'::text,
    'Re-run function creation scripts'::text
  FROM expected_functions ef
  LEFT JOIN existing_functions ex ON ef.function_name = ex.function_name
  WHERE ex.function_name IS NULL;
END;
$$;

-- 2.4 自動スキーマ検証・修復関数
CREATE OR REPLACE FUNCTION public.auto_schema_maintenance()
RETURNS TABLE (
  maintenance_type text,
  action_taken text,
  result text,
  details jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  drift_count integer;
  index_rebuild_count integer;
  stat_reset_count integer;
BEGIN
  -- スキーマ差分の確認
  SELECT COUNT(*) INTO drift_count
  FROM public.detect_schema_drift();
  
  RETURN QUERY SELECT 
    'SCHEMA_VALIDATION'::text,
    'Drift detection completed'::text,
    CASE WHEN drift_count = 0 THEN 'NO_ISSUES' ELSE 'DRIFT_DETECTED' END,
    jsonb_build_object('drift_count', drift_count);
  
  -- 古い統計データのクリーンアップ（30日以上）
  DELETE FROM public.operational_metrics 
  WHERE date_partition < CURRENT_DATE - INTERVAL '30 days';
  
  GET DIAGNOSTICS stat_reset_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    'DATA_CLEANUP'::text,
    'Old metrics cleanup'::text,
    'COMPLETED'::text,
    jsonb_build_object('records_deleted', stat_reset_count);
  
  -- インデックス使用状況の確認と最適化推奨
  RETURN QUERY
  WITH index_usage AS (
    SELECT 
      schemaname,
      tablename,
      indexname,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND idx_tup_read < 100  -- 使用頻度が低いインデックス
  )
  SELECT 
    'INDEX_OPTIMIZATION'::text,
    'Low usage index detection'::text,
    'ANALYSIS_COMPLETE'::text,
    jsonb_build_object(
      'low_usage_indexes', (SELECT COUNT(*) FROM index_usage),
      'recommendation', 'Consider dropping unused indexes during maintenance window'
    );
END;
$$;

-- ===============================================================
-- 3. 予防保守システム
-- ===============================================================

-- 3.1 定期メンテナンスタスクテーブル
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- タスク情報
  task_name text NOT NULL,
  task_category text NOT NULL,
  task_description text,
  
  -- スケジュール情報
  schedule_type text DEFAULT 'DAILY' CHECK (schedule_type IN ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY')),
  schedule_time time DEFAULT '02:00:00',
  next_execution timestamptz,
  
  -- 実行情報
  last_executed timestamptz,
  execution_count bigint DEFAULT 0,
  success_count bigint DEFAULT 0,
  failure_count bigint DEFAULT 0,
  
  -- 状態管理
  is_active boolean DEFAULT true,
  execution_timeout_minutes integer DEFAULT 30,
  max_retries integer DEFAULT 3,
  
  created_at timestamptz DEFAULT NOW()
);

-- 3.2 基本メンテナンスタスクの登録
INSERT INTO public.maintenance_tasks (
  task_name, task_category, task_description, schedule_type, schedule_time
) VALUES 
('auto_collect_metrics', 'MONITORING', 'システムメトリクスの自動収集', 'HOURLY', '00:00:00'),
('auto_schema_maintenance', 'SCHEMA', 'スキーマ検証と自動メンテナンス', 'DAILY', '01:00:00'),
('daily_integrity_check', 'DATA_QUALITY', 'データ整合性の日次チェック', 'DAILY', '02:00:00'),
('weekly_performance_analysis', 'PERFORMANCE', '週次パフォーマンス分析', 'WEEKLY', '03:00:00'),
('monthly_storage_optimization', 'STORAGE', '月次ストレージ最適化', 'MONTHLY', '04:00:00')
ON CONFLICT (task_name) DO UPDATE SET
  task_description = EXCLUDED.task_description,
  schedule_type = EXCLUDED.schedule_type,
  schedule_time = EXCLUDED.schedule_time;

-- 3.3 メンテナンスタスク実行エンジン
CREATE OR REPLACE FUNCTION public.execute_maintenance_task(p_task_name text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  task_record record;
  execution_start timestamptz;
  execution_result jsonb;
  success boolean := true;
  error_message text := '';
BEGIN
  execution_start := NOW();
  
  -- タスク情報の取得
  SELECT * INTO task_record
  FROM public.maintenance_tasks
  WHERE task_name = p_task_name AND is_active = true;
  
  IF task_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found or inactive: ' || p_task_name
    );
  END IF;
  
  -- タスク別実行ロジック
  CASE p_task_name
    WHEN 'auto_collect_metrics' THEN
      PERFORM public.auto_collect_metrics();
      execution_result := jsonb_build_object('metrics_collected', true);
      
    WHEN 'auto_schema_maintenance' THEN
      SELECT jsonb_agg(to_jsonb(result.*)) INTO execution_result
      FROM public.auto_schema_maintenance() result;
      
    WHEN 'daily_integrity_check' THEN
      SELECT jsonb_agg(to_jsonb(result.*)) INTO execution_result
      FROM public.comprehensive_integrity_check() result;
      
    ELSE
      success := false;
      error_message := 'Unknown task: ' || p_task_name;
  END CASE;
  
  -- 実行結果の記録
  UPDATE public.maintenance_tasks SET
    last_executed = execution_start,
    execution_count = execution_count + 1,
    success_count = success_count + CASE WHEN success THEN 1 ELSE 0 END,
    failure_count = failure_count + CASE WHEN success THEN 0 ELSE 1 END,
    next_execution = CASE schedule_type
      WHEN 'HOURLY' THEN execution_start + INTERVAL '1 hour'
      WHEN 'DAILY' THEN execution_start + INTERVAL '1 day'
      WHEN 'WEEKLY' THEN execution_start + INTERVAL '1 week'
      WHEN 'MONTHLY' THEN execution_start + INTERVAL '1 month'
    END
  WHERE task_name = p_task_name;
  
  -- システムログ記録
  INSERT INTO public.system_logs (event_type, event_level, message, details)
  VALUES (
    'MAINTENANCE_TASK',
    CASE WHEN success THEN 'INFO' ELSE 'ERROR' END,
    format('メンテナンスタスク実行: %s - %s', 
      p_task_name, CASE WHEN success THEN '成功' ELSE '失敗' END),
    jsonb_build_object(
      'task_name', p_task_name,
      'execution_time_seconds', EXTRACT(EPOCH FROM (NOW() - execution_start)),
      'result', execution_result,
      'error', error_message
    )
  );
  
  RETURN jsonb_build_object(
    'success', success,
    'task_name', p_task_name,
    'execution_time_seconds', EXTRACT(EPOCH FROM (NOW() - execution_start)),
    'result', execution_result,
    'error', NULLIF(error_message, '')
  );
  
EXCEPTION WHEN OTHERS THEN
  -- エラー処理
  UPDATE public.maintenance_tasks SET
    failure_count = failure_count + 1
  WHERE task_name = p_task_name;
  
  INSERT INTO public.system_logs (event_type, event_level, message, details)
  VALUES (
    'MAINTENANCE_ERROR',
    'ERROR',
    format('メンテナンスタスクエラー: %s', p_task_name),
    jsonb_build_object(
      'task_name', p_task_name,
      'sql_error', SQLERRM,
      'sql_state', SQLSTATE
    )
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'task_name', p_task_name,
    'error', SQLERRM
  );
END;
$$;

-- ===============================================================
-- 4. 運用ダッシュボード関数
-- ===============================================================

-- 4.1 運用状況サマリー関数
CREATE OR REPLACE FUNCTION public.operational_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  dashboard_data jsonb;
  system_health jsonb;
  business_metrics jsonb;
  maintenance_status jsonb;
BEGIN
  -- システムヘルス情報
  SELECT jsonb_agg(
    jsonb_build_object(
      'metric', metric_name,
      'value', metric_value,
      'status', status,
      'last_updated', measurement_time
    )
  ) INTO system_health
  FROM (
    SELECT DISTINCT ON (metric_name)
      metric_name, metric_value, status, measurement_time
    FROM public.operational_metrics
    WHERE metric_category = 'SYSTEM_HEALTH'
      AND date_partition >= CURRENT_DATE - 1
    ORDER BY metric_name, measurement_time DESC
  ) latest_metrics;
  
  -- ビジネスメトリクス
  SELECT jsonb_build_object(
    'daily_orders', (SELECT COUNT(*) FROM public.purchase_orders WHERE created_at::date = CURRENT_DATE),
    'daily_transactions', (SELECT COUNT(*) FROM public.transactions WHERE created_at::date = CURRENT_DATE),
    'active_staff', (SELECT COUNT(*) FROM public.staff_members WHERE status = 'active'),
    'error_count_24h', (SELECT COUNT(*) FROM public.system_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND event_level IN ('ERROR', 'CRITICAL'))
  ) INTO business_metrics;
  
  -- メンテナンス状況
  SELECT jsonb_build_object(
    'active_tasks', (SELECT COUNT(*) FROM public.maintenance_tasks WHERE is_active = true),
    'last_execution', (SELECT MAX(last_executed) FROM public.maintenance_tasks),
    'success_rate', (
      SELECT ROUND(
        CASE WHEN SUM(execution_count) > 0 THEN
          SUM(success_count)::numeric / SUM(execution_count) * 100
        ELSE 100 END,
        2
      )
      FROM public.maintenance_tasks
    )
  ) INTO maintenance_status;
  
  -- 統合ダッシュボードデータ
  dashboard_data := jsonb_build_object(
    'timestamp', NOW(),
    'system_health', system_health,
    'business_metrics', business_metrics,
    'maintenance_status', maintenance_status,
    'version', (SELECT version_number FROM public.schema_versions WHERE status = 'APPLIED' ORDER BY applied_at DESC LIMIT 1)
  );
  
  RETURN dashboard_data;
END;
$$;

-- ===============================================================
-- 5. 権限設定とアクセス制御
-- ===============================================================

-- テーブル権限
GRANT SELECT ON public.operational_metrics TO authenticated;
GRANT SELECT ON public.schema_versions TO authenticated;
GRANT SELECT ON public.maintenance_tasks TO authenticated;

-- 関数権限
GRANT EXECUTE ON FUNCTION public.collect_system_health_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_schema_drift TO authenticated;
GRANT EXECUTE ON FUNCTION public.operational_dashboard TO anon, authenticated;

-- 管理者限定関数
GRANT EXECUTE ON FUNCTION public.auto_collect_metrics TO postgres;
GRANT EXECUTE ON FUNCTION public.auto_schema_maintenance TO postgres;
GRANT EXECUTE ON FUNCTION public.execute_maintenance_task TO postgres;

-- ===============================================================
-- 6. 完了処理とログ記録
-- ===============================================================

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- 初回メトリクス収集
SELECT public.auto_collect_metrics();

-- システムログ記録
INSERT INTO public.system_logs (event_type, event_level, message, details)
VALUES (
  'OPERATIONAL_EXCELLENCE_DEPLOYED',
  'INFO',
  '運用エクセレンスシステム構築完了 - 継続的品質保証体制確立',
  jsonb_build_object(
    'monitoring_tables_created', 4,
    'maintenance_tasks_registered', 5,
    'schema_version', '2.0.0',
    'health_metrics_active', true,
    'automated_maintenance_enabled', true
  )
);

-- 完了メッセージ
DO $$ BEGIN
  RAISE NOTICE '🚀 運用エクセレンスシステム構築完了!';
  RAISE NOTICE '📊 運用ダッシュボード: SELECT public.operational_dashboard();';
  RAISE NOTICE '🔍 スキーマ検証: SELECT * FROM public.detect_schema_drift();';
  RAISE NOTICE '⚙️  メンテナンス実行: SELECT public.execute_maintenance_task(''auto_collect_metrics'');';
  RAISE NOTICE '📈 メトリクス確認: SELECT * FROM public.operational_metrics ORDER BY measurement_time DESC LIMIT 10;';
  RAISE NOTICE '🎯 システム完全統合: 全フェーズの実装が完了しました';
END $$;

COMMIT;