-- ===================================================================
-- 日次システムヘルスチェック実行スクリプト
-- 
-- 実行方法: Supabase Dashboard > SQL Editor でこのスクリプトを実行
-- 実行頻度: 毎日1回（推奨時間: 朝9:00）
-- 実行時間目安: 2-3分
-- ===================================================================

-- 実行開始のお知らせ
SELECT '🔍 日次システムヘルスチェック開始' as status, 
       now() at time zone 'Asia/Tokyo' as check_time;

-- ===================================================================
-- 1. システム全体ダッシュボード
-- ===================================================================
SELECT '📊 システム全体ダッシュボード' as section;

SELECT * FROM public.operational_dashboard();

-- ===================================================================
-- 2. データ整合性チェック
-- ===================================================================
SELECT '🔍 データ整合性チェック' as section;

SELECT * FROM public.comprehensive_integrity_check();

-- ===================================================================
-- 3. 分納システム特化チェック
-- ===================================================================
SELECT '💰 分納システム状態確認' as section;

-- 分納の状態別集計
SELECT 
    '分納状態別集計' as check_item,
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM installments 
GROUP BY status
ORDER BY count DESC;

-- 今日作成された分納
SELECT 
    '本日の分納作成状況' as check_item,
    COUNT(*) as created_today,
    SUM(amount) as total_amount_today,
    COUNT(DISTINCT order_id) as unique_orders
FROM installments 
WHERE created_at::date = CURRENT_DATE;

-- 超過リスクのある発注の検出
WITH order_totals AS (
    SELECT 
        po.id,
        po.order_number,
        po.total_amount as order_amount,
        COALESCE(SUM(i.amount), 0) as installment_total,
        po.total_amount - COALESCE(SUM(i.amount), 0) as remaining_amount,
        COUNT(i.id) as installment_count
    FROM purchase_orders po
    LEFT JOIN installments i ON po.id = i.order_id AND i.status != 'cancelled'
    WHERE po.status = 'confirmed'
    GROUP BY po.id, po.order_number, po.total_amount
)
SELECT 
    '超過リスク発注検出' as check_item,
    COUNT(*) as total_confirmed_orders,
    COUNT(*) FILTER (WHERE remaining_amount < 0) as orders_over_budget,
    COUNT(*) FILTER (WHERE remaining_amount = 0) as completed_orders,
    COUNT(*) FILTER (WHERE remaining_amount > 0 AND remaining_amount < order_amount * 0.1) as near_completion_orders
FROM order_totals;

-- ===================================================================
-- 4. エラー傾向分析（過去7日間）
-- ===================================================================
SELECT '⚠️ エラー傾向分析（過去7日間）' as section;

SELECT * FROM public.analyze_error_trends(7);

-- ===================================================================
-- 5. パフォーマンス監視
-- ===================================================================
SELECT '⚡ パフォーマンス監視' as section;

SELECT * FROM public.monitor_rpc_performance();

-- ===================================================================
-- 6. ストレージ使用状況
-- ===================================================================
SELECT '💾 ストレージ使用状況' as section;

SELECT 
    metric_name,
    metric_value,
    unit,
    measurement_time at time zone 'Asia/Tokyo' as measurement_time_jst
FROM operational_metrics 
WHERE metric_name LIKE '%size%' OR metric_name LIKE '%storage%'
ORDER BY measurement_time DESC 
LIMIT 10;

-- ===================================================================
-- 7. セキュリティ監視
-- ===================================================================
SELECT '🛡️ セキュリティ監視' as section;

-- RLS設定確認（重要テーブルのRLS有効性）
SELECT 
    'RLS設定確認' as check_item,
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ 有効' 
        ELSE '❌ 無効（要注意）' 
    END as rls_status
FROM pg_tables pt
JOIN pg_class pc ON pt.tablename = pc.relname
WHERE schemaname = 'public'
AND tablename IN ('purchase_orders', 'installments', 'transactions', 'staff_members')
ORDER BY tablename;

-- 最近のデータベース接続パターン
SELECT 
    'データベース接続監視' as check_item,
    COUNT(*) as active_connections,
    COUNT(DISTINCT usename) as unique_users,
    MAX(backend_start) as latest_connection
FROM pg_stat_activity 
WHERE state = 'active';

-- ===================================================================
-- 8. 自動修復の実行
-- ===================================================================
SELECT '🔧 軽微な問題の自動修復' as section;

SELECT * FROM public.auto_fix_minor_integrity_issues();

-- ===================================================================
-- 9. メンテナンスタスクの実行
-- ===================================================================
SELECT '🛠️ 定期メンテナンスタスク実行' as section;

-- 自動統計更新
SELECT 'PostgreSQL統計情報更新' as task, 'completed' as status;
ANALYZE;

-- 古いログの整理（30日以上前のエラーログ）
DELETE FROM error_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

SELECT 
    '古いエラーログ削除' as task, 
    'completed' as status,
    NOW() - INTERVAL '30 days' as cutoff_date;

-- ===================================================================
-- 10. 今日の健康度スコア算出
-- ===================================================================
SELECT '📈 今日の健康度スコア' as section;

WITH health_metrics AS (
    SELECT 
        -- データ整合性スコア（エラーがなければ100点）
        CASE 
            WHEN EXISTS (SELECT 1 FROM comprehensive_integrity_check() WHERE status LIKE '%ERROR%') 
            THEN 70
            ELSE 100 
        END as integrity_score,
        
        -- パフォーマンススコア（平均応答時間ベース）
        CASE 
            WHEN (SELECT AVG(avg_duration_ms) FROM monitor_rpc_performance()) > 1000 THEN 60
            WHEN (SELECT AVG(avg_duration_ms) FROM monitor_rpc_performance()) > 500 THEN 80
            ELSE 100
        END as performance_score,
        
        -- セキュリティスコア（RLS設定ベース）
        CASE 
            WHEN (SELECT COUNT(*) FROM pg_tables pt JOIN pg_class pc ON pt.tablename = pc.relname 
                  WHERE schemaname = 'public' AND tablename IN ('purchase_orders', 'installments') 
                  AND NOT pc.relrowsecurity) > 0 
            THEN 50
            ELSE 100
        END as security_score,
        
        -- 運用スコア（エラー発生頻度ベース）
        CASE 
            WHEN (SELECT COUNT(*) FROM analyze_error_trends(1) WHERE error_count > 10) > 0 THEN 70
            WHEN (SELECT COUNT(*) FROM analyze_error_trends(1) WHERE error_count > 5) > 0 THEN 85
            ELSE 100
        END as operational_score
)
SELECT 
    integrity_score,
    performance_score,
    security_score,
    operational_score,
    (integrity_score + performance_score + security_score + operational_score) / 4.0 as overall_health_score,
    CASE 
        WHEN (integrity_score + performance_score + security_score + operational_score) / 4.0 >= 95 THEN '🟢 優秀'
        WHEN (integrity_score + performance_score + security_score + operational_score) / 4.0 >= 85 THEN '🟡 良好'
        WHEN (integrity_score + performance_score + security_score + operational_score) / 4.0 >= 70 THEN '🟠 注意'
        ELSE '🔴 要対応'
    END as health_status,
    now() at time zone 'Asia/Tokyo' as evaluation_time
FROM health_metrics;

-- ===================================================================
-- 11. 実行完了とアクション項目
-- ===================================================================
SELECT '✅ 日次システムヘルスチェック完了' as status, 
       now() at time zone 'Asia/Tokyo' as completion_time;

-- 推奨アクション項目の表示
SELECT 
    '📋 推奨アクション項目' as section,
    CASE 
        WHEN (SELECT overall_health_score FROM (
            WITH health_metrics AS (
                SELECT 
                    CASE WHEN EXISTS (SELECT 1 FROM comprehensive_integrity_check() WHERE status LIKE '%ERROR%') THEN 70 ELSE 100 END as integrity_score,
                    CASE WHEN (SELECT AVG(avg_duration_ms) FROM monitor_rpc_performance()) > 1000 THEN 60 WHEN (SELECT AVG(avg_duration_ms) FROM monitor_rpc_performance()) > 500 THEN 80 ELSE 100 END as performance_score,
                    CASE WHEN (SELECT COUNT(*) FROM pg_tables pt JOIN pg_class pc ON pt.tablename = pc.relname WHERE schemaname = 'public' AND tablename IN ('purchase_orders', 'installments') AND NOT pc.relrowsecurity) > 0 THEN 50 ELSE 100 END as security_score,
                    CASE WHEN (SELECT COUNT(*) FROM analyze_error_trends(1) WHERE error_count > 10) > 0 THEN 70 WHEN (SELECT COUNT(*) FROM analyze_error_trends(1) WHERE error_count > 5) > 0 THEN 85 ELSE 100 END as operational_score
            )
            SELECT (integrity_score + performance_score + security_score + operational_score) / 4.0 as overall_health_score FROM health_metrics
        ) hs) < 85 THEN
            '⚠️  健康度スコアが85点未満です。詳細な調査と改善アクションを実行してください。'
        WHEN (SELECT COUNT(*) FROM analyze_error_trends(1) WHERE error_count > 5) > 0 THEN
            '📊 エラー発生が増加しています。エラー傾向を詳しく分析してください。'
        WHEN (SELECT AVG(avg_duration_ms) FROM monitor_rpc_performance()) > 500 THEN
            '⚡ API応答時間が遅くなっています。パフォーマンスチューニングを検討してください。'
        ELSE
            '✅ システムは正常に動作しています。引き続き監視を継続してください。'
    END as recommended_action;

-- ===================================================================
-- 📝 実行結果の記録
-- ===================================================================
-- メトリクス自動収集により実行履歴は自動記録されます
SELECT 'ℹ️ 本チェックの実行履歴は operational_metrics テーブルに自動記録されています' as info;