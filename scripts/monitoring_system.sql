-- ===============================================================
-- 📊 Phase 5: 監視・診断システム - リアルタイム品質保証
-- ===============================================================
-- 目的: 継続的品質監視と早期問題発見による運用安定性確保

BEGIN;

-- ===============================================================
-- 1. システムログテーブルの拡張
-- ===============================================================

-- システムログテーブル（存在しない場合のみ作成）
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_level text DEFAULT 'INFO' CHECK (event_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  user_id uuid,
  session_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW(),
  
  -- インデックス用フィールド
  date_partition date GENERATED ALWAYS AS (created_at::date) STORED
);

-- パフォーマンス最適化インデックス
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type_created_at 
  ON public.system_logs (event_type, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created_at 
  ON public.system_logs (event_level, created_at DESC) 
  WHERE event_level IN ('ERROR', 'CRITICAL');

-- 分納関連エラーログテーブル
CREATE TABLE IF NOT EXISTS public.installment_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  order_no text,
  transaction_id uuid,
  error_code text NOT NULL,
  error_message text NOT NULL,
  error_details jsonb DEFAULT '{}',
  attempted_amount numeric,
  current_allocated numeric,
  order_total numeric,
  user_action text,
  resolution_status text DEFAULT 'PENDING' CHECK (resolution_status IN ('PENDING', 'RESOLVED', 'IGNORED')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz DEFAULT NOW()
);

-- ===============================================================
-- 2. 監視関数群
-- ===============================================================

-- 2.1 分納エラーログ記録関数
CREATE OR REPLACE FUNCTION public.log_installment_error(
  p_order_id uuid,
  p_order_no text,
  p_transaction_id uuid,
  p_error_code text,
  p_error_message text,
  p_error_details jsonb DEFAULT '{}',
  p_attempted_amount numeric DEFAULT NULL,
  p_user_action text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id uuid;
  v_order_info record;
BEGIN
  -- 発注情報の取得
  SELECT 
    po.total_amount,
    COALESCE(SUM(t.total_amount), 0) as allocated_total
  INTO v_order_info
  FROM public.purchase_orders po
  LEFT JOIN public.transactions t ON po.id = t.parent_order_id 
    AND t.transaction_type = 'purchase'
  WHERE po.id = p_order_id
  GROUP BY po.id, po.total_amount;
  
  -- エラーログの挿入
  INSERT INTO public.installment_error_logs (
    order_id, order_no, transaction_id, error_code, error_message,
    error_details, attempted_amount, current_allocated, order_total, user_action
  ) VALUES (
    p_order_id, p_order_no, p_transaction_id, p_error_code, p_error_message,
    p_error_details, p_attempted_amount, v_order_info.allocated_total, v_order_info.total_amount, p_user_action
  ) RETURNING id INTO v_log_id;
  
  -- システムログにも記録
  INSERT INTO public.system_logs (event_type, event_level, message, details)
  VALUES (
    'INSTALLMENT_ERROR',
    CASE 
      WHEN p_error_code IN ('P0001', 'AMOUNT_EXCEEDED') THEN 'ERROR'
      WHEN p_error_code IN ('VALIDATION_FAILED') THEN 'WARN'
      ELSE 'INFO'
    END,
    format('分納エラー発生: %s - %s', p_error_code, p_error_message),
    jsonb_build_object(
      'order_id', p_order_id,
      'order_no', p_order_no,
      'error_code', p_error_code,
      'attempted_amount', p_attempted_amount
    )
  );
  
  RETURN v_log_id;
END;
$$;

-- 2.2 日次品質レポート生成関数
CREATE OR REPLACE FUNCTION public.generate_daily_quality_report(
  p_target_date date DEFAULT CURRENT_DATE
) 
RETURNS TABLE (
  report_date date,
  total_orders bigint,
  total_installments bigint,
  error_count bigint,
  error_rate numeric,
  top_errors jsonb,
  system_health_score numeric,
  recommendations jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_orders bigint;
  v_total_installments bigint;
  v_error_count bigint;
  v_health_score numeric;
BEGIN
  -- 基本統計の収集
  SELECT COUNT(*) INTO v_total_orders
  FROM public.purchase_orders 
  WHERE created_at::date = p_target_date;
  
  SELECT COUNT(*) INTO v_total_installments
  FROM public.transactions 
  WHERE transaction_type = 'purchase' 
    AND created_at::date = p_target_date;
  
  SELECT COUNT(*) INTO v_error_count
  FROM public.installment_error_logs 
  WHERE created_at::date = p_target_date;
  
  -- システム健康度スコア計算（0-100）
  v_health_score := CASE 
    WHEN v_error_count = 0 THEN 100
    WHEN v_total_installments = 0 THEN 90
    ELSE GREATEST(0, 100 - (v_error_count::numeric / GREATEST(v_total_installments, 1) * 100))
  END;
  
  RETURN QUERY
  SELECT 
    p_target_date,
    v_total_orders,
    v_total_installments,
    v_error_count,
    CASE 
      WHEN v_total_installments > 0 
      THEN ROUND((v_error_count::numeric / v_total_installments * 100), 2)
      ELSE 0
    END,
    -- トップエラーの集計
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'error_code', error_code,
          'count', error_count,
          'percentage', ROUND((error_count::numeric / v_error_count * 100), 1)
        ) ORDER BY error_count DESC
      )
      FROM (
        SELECT error_code, COUNT(*) as error_count
        FROM public.installment_error_logs
        WHERE created_at::date = p_target_date
        GROUP BY error_code
        LIMIT 5
      ) top_errors
    ),
    v_health_score,
    -- 推奨アクション
    jsonb_build_array(
      CASE 
        WHEN v_health_score >= 95 THEN '✅ システム状態良好'
        WHEN v_health_score >= 80 THEN '⚠️ 軽微な問題あり - 定期監視継続'
        WHEN v_health_score >= 60 THEN '🔶 注意が必要 - エラー原因の調査推奨'
        ELSE '🚨 緊急対応必要 - システム管理者への連絡を推奨'
      END,
      CASE 
        WHEN v_error_count > 10 THEN '📊 エラーパターン分析の実施'
        WHEN v_error_count > 5 THEN '🔍 個別エラーケースの確認'
        ELSE '👍 現状維持で問題なし'
      END
    );
END;
$$;

-- 2.3 リアルタイム異常検知関数
CREATE OR REPLACE FUNCTION public.detect_anomalies()
RETURNS TABLE (
  anomaly_type text,
  severity text,
  description text,
  affected_count bigint,
  detection_time timestamptz,
  recommended_action text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 異常パターン1: 金額超過エラーの急増
  RETURN QUERY
  SELECT 
    'AMOUNT_EXCEEDED_SPIKE'::text,
    'HIGH'::text,
    '金額超過エラーが過去1時間で急増しています'::text,
    COUNT(*)::bigint,
    NOW(),
    'データベース制約とRPC関数の確認が必要です'::text
  FROM public.installment_error_logs
  WHERE error_code IN ('P0001', 'AMOUNT_EXCEEDED')
    AND created_at > NOW() - INTERVAL '1 hour'
  HAVING COUNT(*) > 5;
  
  -- 異常パターン2: 大量の同時分納作成
  RETURN QUERY
  SELECT 
    'BULK_CREATION_DETECTED'::text,
    'MEDIUM'::text,
    '短時間での大量分納作成を検知しました'::text,
    COUNT(*)::bigint,
    NOW(),
    '自動化処理または異常なユーザー操作の可能性があります'::text
  FROM public.transactions
  WHERE transaction_type = 'purchase'
    AND created_at > NOW() - INTERVAL '10 minutes'
  HAVING COUNT(*) > 20;
  
  -- 異常パターン3: データ整合性エラー
  RETURN QUERY
  SELECT 
    'DATA_INTEGRITY_ERROR'::text,
    'CRITICAL'::text,
    '分納合計が発注金額を超過している発注があります'::text,
    COUNT(*)::bigint,
    NOW(),
    '緊急: データベース整合性の手動確認と修正が必要です'::text
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
END;
$$;

-- ===============================================================
-- 3. 監視トリガーシステム
-- ===============================================================

-- 3.1 分納作成時の自動ログ記録トリガー
CREATE OR REPLACE FUNCTION public.trigger_log_installment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 正常な分納作成のログ記録
  INSERT INTO public.system_logs (event_type, event_level, message, details)
  VALUES (
    'INSTALLMENT_CREATED',
    'INFO',
    format('分納作成: %s (¥%s)', NEW.transaction_no, NEW.total_amount),
    jsonb_build_object(
      'transaction_id', NEW.id,
      'parent_order_id', NEW.parent_order_id,
      'amount', NEW.total_amount,
      'status', NEW.status,
      'installment_no', NEW.installment_no
    )
  );
  
  RETURN NEW;
END;
$$;

-- トリガーの設定
DROP TRIGGER IF EXISTS trigger_log_installment_creation ON public.transactions;
CREATE TRIGGER trigger_log_installment_creation
  AFTER INSERT ON public.transactions
  FOR EACH ROW 
  WHEN (NEW.transaction_type = 'purchase')
  EXECUTE FUNCTION public.trigger_log_installment_activity();

-- 3.2 エラー自動記録トリガー（既存の検証トリガーを拡張）
CREATE OR REPLACE FUNCTION public.trigger_enhanced_installment_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  validation_result record;
  error_log_id uuid;
BEGIN
  -- purchase取引のみ検証
  IF NEW.transaction_type = 'purchase' AND NEW.parent_order_id IS NOT NULL THEN
    SELECT * FROM public.validate_installment_amount(
      NEW.parent_order_id, NEW.total_amount
    ) INTO validation_result;
    
    IF NOT validation_result.is_valid THEN
      -- エラーログの記録
      SELECT public.log_installment_error(
        NEW.parent_order_id,
        (SELECT order_no FROM public.purchase_orders WHERE id = NEW.parent_order_id),
        NEW.id,
        validation_result.error_code,
        validation_result.error_message,
        jsonb_build_object(
          'order_total', validation_result.order_total,
          'allocated_total', validation_result.allocated_total,
          'remaining_amount', validation_result.remaining_amount
        ),
        NEW.total_amount,
        'INSERT_TRIGGER'
      ) INTO error_log_id;
      
      -- 例外発生
      RAISE EXCEPTION '%', validation_result.error_message
        USING ERRCODE = validation_result.error_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 既存の検証トリガーを更新
DROP TRIGGER IF EXISTS trigger_installment_insert_validation ON public.transactions;
CREATE TRIGGER trigger_installment_insert_validation
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_enhanced_installment_validation();

-- ===============================================================
-- 4. パフォーマンス監視
-- ===============================================================

-- 4.1 RPC関数のパフォーマンス監視
CREATE OR REPLACE FUNCTION public.monitor_rpc_performance()
RETURNS TABLE (
  function_name text,
  avg_execution_time_ms numeric,
  total_calls bigint,
  success_rate numeric,
  last_24h_calls bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- システムログからRPCパフォーマンス情報を集計
  RETURN QUERY
  SELECT 
    sl.event_type,
    ROUND(AVG(EXTRACT(epoch FROM (sl.details->>'duration')::interval) * 1000), 2),
    COUNT(*),
    ROUND(
      (COUNT(*) FILTER (WHERE sl.event_level = 'INFO')::numeric / COUNT(*) * 100), 2
    ),
    COUNT(*) FILTER (WHERE sl.created_at > NOW() - INTERVAL '24 hours')
  FROM public.system_logs sl
  WHERE sl.event_type LIKE 'RPC_%'
    AND sl.created_at > NOW() - INTERVAL '7 days'
  GROUP BY sl.event_type
  ORDER BY total_calls DESC;
END;
$$;

-- ===============================================================
-- 5. 自動化された定期タスク
-- ===============================================================

-- 5.1 日次品質チェック関数（定期実行用）
CREATE OR REPLACE FUNCTION public.daily_automated_check()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  quality_report record;
  anomaly_record record;
  notification_payload jsonb;
BEGIN
  -- 品質レポート生成
  SELECT * FROM public.generate_daily_quality_report() INTO quality_report;
  
  -- 健康度スコアが低い場合の通知
  IF quality_report.system_health_score < 80 THEN
    notification_payload := jsonb_build_object(
      'type', 'QUALITY_ALERT',
      'severity', CASE 
        WHEN quality_report.system_health_score < 60 THEN 'CRITICAL'
        ELSE 'WARNING'
      END,
      'health_score', quality_report.system_health_score,
      'error_count', quality_report.error_count,
      'recommendations', quality_report.recommendations
    );
    
    -- システムログに記録
    INSERT INTO public.system_logs (event_type, event_level, message, details)
    VALUES (
      'DAILY_QUALITY_CHECK',
      CASE WHEN quality_report.system_health_score < 60 THEN 'ERROR' ELSE 'WARN' END,
      format('システム健康度スコア: %s%% - 対応が必要です', quality_report.system_health_score),
      notification_payload
    );
  END IF;
  
  -- 異常検知の実行
  FOR anomaly_record IN 
    SELECT * FROM public.detect_anomalies()
  LOOP
    INSERT INTO public.system_logs (event_type, event_level, message, details)
    VALUES (
      'ANOMALY_DETECTED',
      CASE anomaly_record.severity
        WHEN 'CRITICAL' THEN 'CRITICAL'
        WHEN 'HIGH' THEN 'ERROR'
        ELSE 'WARN'
      END,
      format('異常検知: %s - %s', anomaly_record.anomaly_type, anomaly_record.description),
      jsonb_build_object(
        'anomaly_type', anomaly_record.anomaly_type,
        'affected_count', anomaly_record.affected_count,
        'recommended_action', anomaly_record.recommended_action
      )
    );
  END LOOP;
  
  -- 古いログの定期削除（30日以上前）
  DELETE FROM public.system_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM public.installment_error_logs 
  WHERE created_at < NOW() - INTERVAL '90 days' 
    AND resolution_status = 'RESOLVED';
END;
$$;

-- ===============================================================
-- 6. 監視ダッシュボード用ビュー
-- ===============================================================

-- 6.1 リアルタイムシステム状態ビュー
CREATE OR REPLACE VIEW public.v_system_status AS
SELECT 
  -- 基本統計
  (SELECT COUNT(*) FROM public.purchase_orders WHERE created_at::date = CURRENT_DATE) as orders_today,
  (SELECT COUNT(*) FROM public.transactions WHERE transaction_type = 'purchase' AND created_at::date = CURRENT_DATE) as installments_today,
  (SELECT COUNT(*) FROM public.installment_error_logs WHERE created_at::date = CURRENT_DATE) as errors_today,
  
  -- 過去24時間の傾向
  (SELECT COUNT(*) FROM public.transactions WHERE transaction_type = 'purchase' AND created_at > NOW() - INTERVAL '24 hours') as installments_24h,
  (SELECT COUNT(*) FROM public.installment_error_logs WHERE created_at > NOW() - INTERVAL '24 hours') as errors_24h,
  
  -- システム健康度
  CASE 
    WHEN (SELECT COUNT(*) FROM public.installment_error_logs WHERE created_at > NOW() - INTERVAL '1 hour') > 5 THEN 'CRITICAL'
    WHEN (SELECT COUNT(*) FROM public.installment_error_logs WHERE created_at > NOW() - INTERVAL '6 hours') > 10 THEN 'WARNING'
    ELSE 'HEALTHY'
  END as system_status,
  
  -- 最新の異常
  (SELECT COUNT(*) FROM public.detect_anomalies()) as active_anomalies,
  
  -- データ整合性状態
  (SELECT COUNT(*) FROM public.audit_order_consistency() WHERE status = '超過エラー') as integrity_errors,
  
  NOW() as last_updated;

-- 6.2 エラー傾向分析ビュー
CREATE OR REPLACE VIEW public.v_error_trends AS
SELECT 
  error_code,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  ROUND(AVG(attempted_amount), 2) as avg_attempted_amount,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as latest_occurrence,
  COUNT(DISTINCT order_id) as affected_orders
FROM public.installment_error_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY error_code
ORDER BY total_count DESC;

-- ===============================================================
-- 7. 権限設定とスキーマ更新
-- ===============================================================

-- 監視関数の権限設定
GRANT EXECUTE ON FUNCTION public.generate_daily_quality_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_anomalies TO authenticated;
GRANT EXECUTE ON FUNCTION public.monitor_rpc_performance TO authenticated;

-- ビューの権限設定
GRANT SELECT ON public.v_system_status TO authenticated;
GRANT SELECT ON public.v_error_trends TO authenticated;

-- システムログテーブルの権限（読み取りのみ）
GRANT SELECT ON public.system_logs TO authenticated;
GRANT SELECT ON public.installment_error_logs TO authenticated;

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- 完了ログ記録
INSERT INTO public.system_logs (event_type, event_level, message, details)
VALUES (
  'MONITORING_SYSTEM_DEPLOYED',
  'INFO',
  'Phase 5: 監視・診断システムの実装完了',
  jsonb_build_object(
    'functions_created', 7,
    'triggers_updated', 2,
    'views_created', 2,
    'tables_created', 2
  )
);

DO $$ BEGIN
  RAISE NOTICE '📊 Phase 5完了: 監視・診断システムが正常に実装されました';
  RAISE NOTICE '🔍 利用可能な監視機能:';
  RAISE NOTICE '  - generate_daily_quality_report(): 日次品質レポート';
  RAISE NOTICE '  - detect_anomalies(): リアルタイム異常検知';
  RAISE NOTICE '  - monitor_rpc_performance(): RPC性能監視';
  RAISE NOTICE '  - v_system_status: システム状態ダッシュボード';
  RAISE NOTICE '  - v_error_trends: エラー傾向分析';
  RAISE NOTICE '🚀 包括的多層防御システムの全フェーズが完了しました!';
END $$;

COMMIT;