-- ===============================================================
-- 🎯 エラーハンドリング統一とAPIレスポンス標準化システム
-- ===============================================================
-- 問題: DBエラー（P0001等）とUIエラーの表現が不統一、ユーザビリティ不足
-- 解決: 統一エラーコード + ユーザーフレンドリーメッセージ + 詳細技術情報

BEGIN;

-- ===============================================================
-- 1. エラーコード標準化テーブル
-- ===============================================================

-- 1.1 システムエラーコードマスタ
CREATE TABLE IF NOT EXISTS public.system_error_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- エラーコード分類
  error_code text NOT NULL UNIQUE,
  error_category text NOT NULL,
  severity_level text NOT NULL CHECK (severity_level IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  
  -- ユーザー向け表示
  user_message_ja text NOT NULL,
  user_message_en text NOT NULL,
  user_action_ja text,
  user_action_en text,
  
  -- 技術情報
  technical_description text,
  common_causes jsonb DEFAULT '[]',
  troubleshooting_steps jsonb DEFAULT '[]',
  
  -- システム情報
  is_user_fixable boolean DEFAULT false,
  is_retryable boolean DEFAULT false,
  auto_recovery_possible boolean DEFAULT false,
  
  -- メタ情報
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  version integer DEFAULT 1
);

-- 1.2 インデックス作成
CREATE INDEX idx_system_error_codes_error_code ON public.system_error_codes (error_code);
CREATE INDEX idx_system_error_codes_category ON public.system_error_codes (error_category);
CREATE INDEX idx_system_error_codes_severity ON public.system_error_codes (severity_level);

-- ===============================================================
-- 2. 標準エラーコードの初期データ
-- ===============================================================

-- 2.1 基本エラーコードの登録
INSERT INTO public.system_error_codes (
  error_code, error_category, severity_level,
  user_message_ja, user_message_en, user_action_ja, user_action_en,
  technical_description, common_causes, troubleshooting_steps,
  is_user_fixable, is_retryable, auto_recovery_possible
) VALUES 

-- 分納関連エラー
('P0001', 'INSTALLMENT', 'ERROR',
 '分納合計が発注金額を超過しています', 'Installment total exceeds order amount',
 '金額を確認して正しい分納額を入力してください', 'Please check the amount and enter correct installment amount',
 '分納の合計金額が親発注の総額を超過した場合に発生',
 '["金額入力ミス", "既存分納の重複計算", "発注額の変更"]',
 '["残額の再確認", "既存分納の確認", "発注詳細の確認"]',
 true, false, false),

('P0002', 'INSTALLMENT', 'ERROR',
 '分納番号の競合が発生しました', 'Installment number conflict occurred',
 'しばらく待ってから再度実行してください', 'Please wait a moment and try again',
 '同時実行による分納番号の競合',
 '["同時アクセス", "高負荷状態"]',
 '["少し待ってからリトライ", "ページ再読み込み"]',
 false, true, true),

('P0003', 'ORDER_REFERENCE', 'ERROR',
 '指定された発注が見つかりません', 'Specified order not found',
 '発注の存在を確認してください', 'Please verify the order exists',
 '存在しない発注IDが指定された',
 '["発注の削除", "IDの入力ミス", "権限不足"]',
 '["発注一覧での確認", "権限の確認"]',
 true, false, false),

-- 担当者関連エラー  
('P0007', 'STAFF_REFERENCE', 'ERROR',
 '指定された担当者が見つからないか非アクティブです', 'Specified staff member not found or inactive',
 'アクティブな担当者を選択してください', 'Please select an active staff member',
 '無効な担当者IDが指定された',
 '["担当者の退職", "IDの入力ミス", "非アクティブ化"]',
 '["担当者一覧での確認", "管理者への連絡"]',
 true, false, false),

('P0008', 'PERMISSION', 'ERROR',
 '指定された担当者には発注権限がありません', 'Specified staff member does not have order creation permission',
 '発注権限のある担当者を選択してください', 'Please select staff member with order creation permission',
 '発注権限のない担当者が指定された',
 '["権限設定の問題", "担当者の役割変更"]',
 '["権限の確認", "管理者への連絡"]',
 true, false, false),

-- システム関連エラー
('NETWORK_ERROR', 'SYSTEM', 'WARNING',
 'ネットワークエラーが発生しました', 'Network error occurred',
 '接続を確認して再度お試しください', 'Please check connection and try again',
 'ネットワーク通信の問題',
 '["接続不安定", "サーバー負荷", "タイムアウト"]',
 '["接続確認", "リトライ", "時間をおいて再実行"]',
 false, true, false),

('VALIDATION_FAILED', 'VALIDATION', 'WARNING',
 '入力内容に問題があります', 'Input validation failed',
 '入力内容を確認して修正してください', 'Please review and correct your input',
 '入力データのバリデーションエラー',
 '["必須項目の未入力", "形式不正", "範囲外の値"]',
 '["入力内容の確認", "形式の修正"]',
 true, false, false),

('SUCCESS', 'SUCCESS', 'INFO',
 '正常に完了しました', 'Operation completed successfully',
 '', '',
 '処理が正常に完了',
 '[]', '[]',
 false, false, false);

-- ===============================================================
-- 3. 統一エラーハンドリング関数
-- ===============================================================

-- 3.1 エラー情報取得関数
CREATE OR REPLACE FUNCTION public.get_error_info(
  p_error_code text,
  p_language text DEFAULT 'ja'
)
RETURNS TABLE (
  error_code text,
  severity_level text,
  user_message text,
  user_action text,
  is_user_fixable boolean,
  is_retryable boolean,
  troubleshooting_steps jsonb,
  error_details jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sec.error_code,
    sec.severity_level,
    CASE p_language 
      WHEN 'en' THEN sec.user_message_en
      ELSE sec.user_message_ja 
    END as user_message,
    CASE p_language 
      WHEN 'en' THEN sec.user_action_en
      ELSE sec.user_action_ja 
    END as user_action,
    sec.is_user_fixable,
    sec.is_retryable,
    sec.troubleshooting_steps,
    jsonb_build_object(
      'category', sec.error_category,
      'technical_description', sec.technical_description,
      'common_causes', sec.common_causes,
      'auto_recovery_possible', sec.auto_recovery_possible
    ) as error_details
  FROM public.system_error_codes sec
  WHERE sec.error_code = p_error_code;
  
  -- エラーコードが見つからない場合の汎用エラー
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p_error_code,
      'ERROR'::text,
      CASE p_language 
        WHEN 'en' THEN 'An unexpected error occurred'
        ELSE '予期しないエラーが発生しました'
      END,
      CASE p_language 
        WHEN 'en' THEN 'Please contact support if the issue persists'
        ELSE '問題が続く場合はサポートにお問い合わせください'
      END,
      false,
      false,
      '["サポートへの連絡"]'::jsonb,
      jsonb_build_object(
        'category', 'UNKNOWN',
        'original_code', p_error_code
      );
  END IF;
END;
$$;

-- 3.2 標準エラーレスポンス生成関数
CREATE OR REPLACE FUNCTION public.create_error_response(
  p_error_code text,
  p_context_data jsonb DEFAULT '{}',
  p_language text DEFAULT 'ja'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  error_info record;
  response_json jsonb;
BEGIN
  -- エラー情報の取得
  SELECT * FROM public.get_error_info(p_error_code, p_language) INTO error_info;
  
  -- 標準レスポンス形式
  response_json := jsonb_build_object(
    'success', false,
    'error', jsonb_build_object(
      'code', error_info.error_code,
      'severity', error_info.severity_level,
      'message', error_info.user_message,
      'user_action', error_info.user_action,
      'is_user_fixable', error_info.is_user_fixable,
      'is_retryable', error_info.is_retryable,
      'troubleshooting', error_info.troubleshooting_steps,
      'timestamp', NOW(),
      'request_id', gen_random_uuid()
    ),
    'data', NULL,
    'meta', jsonb_build_object(
      'language', p_language,
      'version', '1.0'
    )
  );
  
  -- コンテキストデータの追加
  IF p_context_data != '{}' THEN
    response_json := jsonb_set(
      response_json,
      '{error,context}',
      p_context_data
    );
  END IF;
  
  RETURN response_json;
END;
$$;

-- 3.3 成功レスポンス生成関数
CREATE OR REPLACE FUNCTION public.create_success_response(
  p_data jsonb DEFAULT '{}',
  p_message text DEFAULT NULL,
  p_language text DEFAULT 'ja'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'error', NULL,
    'data', p_data,
    'message', COALESCE(
      p_message, 
      CASE p_language WHEN 'en' THEN 'Operation completed successfully' ELSE '正常に完了しました' END
    ),
    'meta', jsonb_build_object(
      'language', p_language,
      'version', '1.0',
      'timestamp', NOW(),
      'request_id', gen_random_uuid()
    )
  );
END;
$$;

-- ===============================================================
-- 4. 既存RPC関数の標準レスポンス対応
-- ===============================================================

-- 4.1 改良版分納追加関数（標準レスポンス形式）
CREATE OR REPLACE FUNCTION public.add_purchase_installment_v3_standard(
  p_parent_order_id uuid,
  p_amount numeric,
  p_status text DEFAULT 'draft',
  p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days',
  p_memo text DEFAULT NULL,
  p_language text DEFAULT 'ja'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation_result record;
  v_installment_data jsonb;
  v_context_data jsonb;
BEGIN
  -- バリデーション実行
  SELECT * FROM public.validate_installment_amount(p_parent_order_id, p_amount)
  INTO v_validation_result;
  
  -- バリデーション失敗時
  IF NOT v_validation_result.is_valid THEN
    v_context_data := jsonb_build_object(
      'order_id', p_parent_order_id,
      'attempted_amount', p_amount,
      'order_total', v_validation_result.order_total,
      'allocated_total', v_validation_result.allocated_total,
      'remaining_amount', v_validation_result.remaining_amount
    );
    
    RETURN public.create_error_response(
      v_validation_result.error_code,
      v_context_data,
      p_language
    );
  END IF;
  
  -- 分納実行（既存のadd_purchase_installment_v2_secureを内部呼び出し）
  SELECT jsonb_agg(to_jsonb(result.*)) -> 0 INTO v_installment_data
  FROM public.add_purchase_installment_v2_secure(
    p_parent_order_id, p_amount, p_status, p_due_date, p_memo
  ) result;
  
  -- 成功時レスポンス
  IF (v_installment_data->>'success')::boolean THEN
    RETURN public.create_success_response(
      jsonb_build_object(
        'installment', v_installment_data,
        'remaining_amount', v_validation_result.remaining_amount - p_amount
      ),
      CASE p_language 
        WHEN 'en' THEN format('Installment created: %s', v_installment_data->>'transaction_no')
        ELSE format('分納を作成しました: %s', v_installment_data->>'transaction_no')
      END,
      p_language
    );
  ELSE
    -- 実行時エラー
    RETURN public.create_error_response(
      'VALIDATION_FAILED',
      jsonb_build_object(
        'internal_error', v_installment_data->'validation_info'
      ),
      p_language
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  -- 予期しないエラー
  RETURN public.create_error_response(
    'UNKNOWN_ERROR',
    jsonb_build_object(
      'sql_error_code', SQLSTATE,
      'sql_error_message', SQLERRM
    ),
    p_language
  );
END;
$$;

-- 4.2 担当者作成関数（標準レスポンス形式）
CREATE OR REPLACE FUNCTION public.create_staff_member_v2_standard(
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_language text DEFAULT 'ja'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_data jsonb;
  v_result record;
BEGIN
  -- 既存の create_staff_member を呼び出し
  SELECT * FROM public.create_staff_member(
    p_name, p_email, p_phone, p_department
  ) INTO v_result;
  
  IF v_result.success THEN
    v_staff_data := jsonb_build_object(
      'id', v_result.id,
      'name', v_result.name,
      'email', v_result.email,
      'created_at', v_result.created_at
    );
    
    RETURN public.create_success_response(
      jsonb_build_object('staff_member', v_staff_data),
      v_result.message,
      p_language
    );
  ELSE
    RETURN public.create_error_response(
      'VALIDATION_FAILED',
      jsonb_build_object(
        'field', 'name',
        'attempted_value', p_name
      ),
      p_language
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RETURN public.create_error_response(
    'UNKNOWN_ERROR',
    jsonb_build_object(
      'sql_error_code', SQLSTATE,
      'sql_error_message', SQLERRM
    ),
    p_language
  );
END;
$$;

-- ===============================================================
-- 5. APIレスポンス監視・分析システム
-- ===============================================================

-- 5.1 APIレスポンス統計テーブル
CREATE TABLE IF NOT EXISTS public.api_response_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- API情報
  function_name text NOT NULL,
  error_code text,
  language text DEFAULT 'ja',
  
  -- 統計情報
  call_count bigint DEFAULT 1,
  success_count bigint DEFAULT 0,
  error_count bigint DEFAULT 0,
  
  -- パフォーマンス
  avg_response_time_ms numeric,
  last_call_at timestamptz DEFAULT NOW(),
  
  -- 日付パーティション
  date_partition date DEFAULT CURRENT_DATE,
  
  -- 制約
  UNIQUE (function_name, error_code, language, date_partition)
);

-- 5.2 APIレスポンス記録トリガー
CREATE OR REPLACE FUNCTION public.log_api_response_stats(
  p_function_name text,
  p_error_code text DEFAULT NULL,
  p_language text DEFAULT 'ja',
  p_response_time_ms numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.api_response_stats (
    function_name, error_code, language, 
    success_count, error_count, avg_response_time_ms
  ) VALUES (
    p_function_name, p_error_code, p_language,
    CASE WHEN p_error_code IS NULL OR p_error_code = 'SUCCESS' THEN 1 ELSE 0 END,
    CASE WHEN p_error_code IS NOT NULL AND p_error_code != 'SUCCESS' THEN 1 ELSE 0 END,
    p_response_time_ms
  )
  ON CONFLICT (function_name, error_code, language, date_partition)
  DO UPDATE SET
    call_count = api_response_stats.call_count + 1,
    success_count = api_response_stats.success_count + 
      CASE WHEN p_error_code IS NULL OR p_error_code = 'SUCCESS' THEN 1 ELSE 0 END,
    error_count = api_response_stats.error_count + 
      CASE WHEN p_error_code IS NOT NULL AND p_error_code != 'SUCCESS' THEN 1 ELSE 0 END,
    avg_response_time_ms = COALESCE(
      (api_response_stats.avg_response_time_ms + COALESCE(p_response_time_ms, 0)) / 2,
      p_response_time_ms
    ),
    last_call_at = NOW();
END;
$$;

-- ===============================================================
-- 6. エラー分析・レポート関数
-- ===============================================================

-- 6.1 エラー傾向分析関数
CREATE OR REPLACE FUNCTION public.analyze_error_trends(
  p_days_back integer DEFAULT 7,
  p_language text DEFAULT 'ja'
)
RETURNS TABLE (
  error_code text,
  error_message text,
  occurrence_count bigint,
  affected_functions text[],
  trend_direction text,
  recommended_action text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH error_stats AS (
    SELECT 
      ars.error_code,
      SUM(ars.error_count) as total_errors,
      array_agg(DISTINCT ars.function_name) as functions,
      AVG(ars.error_count) as avg_daily_errors
    FROM public.api_response_stats ars
    WHERE ars.date_partition >= CURRENT_DATE - INTERVAL '%d days'
      AND ars.error_code IS NOT NULL
      AND ars.error_code != 'SUCCESS'
    GROUP BY ars.error_code
  )
  SELECT 
    es.error_code,
    COALESCE(sec.user_message_ja, es.error_code) as error_message,
    es.total_errors,
    es.functions,
    CASE 
      WHEN es.avg_daily_errors > 10 THEN '増加傾向'
      WHEN es.avg_daily_errors > 5 THEN '注意レベル'
      ELSE '正常範囲'
    END as trend_direction,
    COALESCE(sec.user_action_ja, '詳細調査が必要') as recommended_action
  FROM error_stats es
  LEFT JOIN public.system_error_codes sec ON es.error_code = sec.error_code
  ORDER BY es.total_errors DESC;
END;
$$;

-- ===============================================================
-- 7. 権限設定とアクセス制御
-- ===============================================================

-- テーブル権限
GRANT SELECT ON public.system_error_codes TO anon, authenticated;
GRANT SELECT ON public.api_response_stats TO authenticated;

-- 関数権限
GRANT EXECUTE ON FUNCTION public.get_error_info TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_error_response TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_success_response TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchase_installment_v3_standard TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_member_v2_standard TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_error_trends TO authenticated;

-- ===============================================================
-- 8. 完了処理とログ記録
-- ===============================================================

-- PostgREST スキーマリロード
NOTIFY pgrst, 'reload schema';

-- システムログ記録
INSERT INTO public.system_logs (event_type, event_level, message, details)
VALUES (
  'ERROR_HANDLING_STANDARDIZATION',
  'INFO',
  'エラーハンドリング統一とAPIレスポンス標準化完了',
  jsonb_build_object(
    'error_codes_registered', (SELECT COUNT(*) FROM public.system_error_codes),
    'standard_functions_created', 6,
    'response_format_version', '1.0',
    'languages_supported', '["ja", "en"]',
    'monitoring_enabled', true
  )
);

-- 完了メッセージ
DO $$ BEGIN
  RAISE NOTICE '🎯 エラーハンドリング統一システム構築完了';
  RAISE NOTICE '📊 エラー分析: SELECT * FROM analyze_error_trends();';
  RAISE NOTICE '🔧 新API利用: add_purchase_installment_v3_standard()';
  RAISE NOTICE '📱 標準レスポンス形式: {success, error, data, meta}';
  RAISE NOTICE '🌐 多言語対応: ja/en サポート';
  RAISE NOTICE '📈 API統計: SELECT * FROM api_response_stats;';
END $$;

COMMIT;