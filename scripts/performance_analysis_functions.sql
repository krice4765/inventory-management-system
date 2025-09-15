-- ===============================================================
-- パフォーマンス分析用PostgreSQL関数
-- 実装日: 2025-09-14
-- 目的: システムパフォーマンス監視と最適化提案の自動化
-- ===============================================================

-- 1. クエリパフォーマンス分析関数
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS jsonb AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    query_row RECORD;
    performance_grade TEXT;
    recommendations TEXT[];
BEGIN
    -- pg_stat_statements が有効か確認
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        RETURN jsonb_build_object(
            'error', 'pg_stat_statements extension is not enabled',
            'recommendation', 'Execute: CREATE EXTENSION pg_stat_statements;'
        );
    END IF;

    -- クエリパフォーマンス分析
    FOR query_row IN
        SELECT
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            max_exec_time,
            min_exec_time,
            rows,
            shared_blks_hit,
            shared_blks_read,
            shared_blks_dirtied,
            shared_blks_written
        FROM pg_stat_statements
        WHERE calls > 5  -- 5回以上実行されたクエリのみ
        ORDER BY total_exec_time DESC
        LIMIT 20
    LOOP
        -- パフォーマンスグレード判定
        performance_grade := CASE
            WHEN query_row.mean_exec_time <= 10 THEN 'A'
            WHEN query_row.mean_exec_time <= 50 THEN 'B'
            WHEN query_row.mean_exec_time <= 100 THEN 'C'
            WHEN query_row.mean_exec_time <= 500 THEN 'D'
            ELSE 'F'
        END;

        -- 推奨事項生成
        recommendations := ARRAY[]::TEXT[];

        IF query_row.mean_exec_time > 100 THEN
            recommendations := array_append(recommendations, 'インデックス追加を検討');
        END IF;

        IF (query_row.shared_blks_read::float / NULLIF(query_row.shared_blks_hit + query_row.shared_blks_read, 0)) > 0.1 THEN
            recommendations := array_append(recommendations, 'キャッシュヒット率改善が必要');
        END IF;

        IF query_row.calls > 1000 AND query_row.mean_exec_time > 50 THEN
            recommendations := array_append(recommendations, 'クエリキャッシュの活用を検討');
        END IF;

        -- 結果に追加
        result := result || jsonb_build_object(
            'query_hash', md5(query_row.query),
            'query_text', left(query_row.query, 200),
            'avg_execution_time_ms', round(query_row.mean_exec_time::numeric, 2),
            'max_execution_time_ms', round(query_row.max_exec_time::numeric, 2),
            'min_execution_time_ms', round(query_row.min_exec_time::numeric, 2),
            'execution_count', query_row.calls,
            'total_time_ms', round(query_row.total_exec_time::numeric, 2),
            'performance_grade', performance_grade,
            'recommendations', recommendations,
            'cache_hit_ratio', round((query_row.shared_blks_hit::float / NULLIF(query_row.shared_blks_hit + query_row.shared_blks_read, 0))::numeric, 3)
        );
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. データベース接続と使用量分析
CREATE OR REPLACE FUNCTION analyze_database_performance()
RETURNS jsonb AS $$
DECLARE
    db_stats RECORD;
    connection_info jsonb;
    performance_metrics jsonb;
BEGIN
    -- データベース統計取得
    SELECT
        pg_database_size(current_database()) as db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as idle_in_transaction
    INTO db_stats;

    -- パフォーマンスメトリクス
    performance_metrics := jsonb_build_object(
        'database_size_mb', round((db_stats.db_size / 1024.0 / 1024.0)::numeric, 2),
        'active_connections', db_stats.active_connections,
        'idle_connections', db_stats.idle_connections,
        'idle_in_transaction', db_stats.idle_in_transaction,
        'total_connections', db_stats.active_connections + db_stats.idle_connections + db_stats.idle_in_transaction,
        'connection_utilization', round((db_stats.active_connections::float / NULLIF(db_stats.active_connections + db_stats.idle_connections + db_stats.idle_in_transaction, 0)) * 100, 2)
    );

    RETURN performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- 3. テーブル別パフォーマンス分析
CREATE OR REPLACE FUNCTION analyze_table_performance()
RETURNS jsonb AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    table_row RECORD;
    table_info jsonb;
BEGIN
    FOR table_row IN
        SELECT
            schemaname,
            tablename,
            seq_scan,
            seq_tup_read,
            idx_scan,
            idx_tup_fetch,
            n_tup_ins,
            n_tup_upd,
            n_tup_del,
            n_live_tup,
            n_dead_tup,
            vacuum_count,
            autovacuum_count,
            analyze_count,
            autoanalyze_count
        FROM pg_stat_user_tables
        ORDER BY seq_tup_read + idx_tup_fetch DESC
        LIMIT 20
    LOOP
        table_info := jsonb_build_object(
            'schema_name', table_row.schemaname,
            'table_name', table_row.tablename,
            'sequential_scans', table_row.seq_scan,
            'sequential_rows_read', table_row.seq_tup_read,
            'index_scans', table_row.idx_scan,
            'index_rows_fetched', table_row.idx_tup_fetch,
            'live_tuples', table_row.n_live_tup,
            'dead_tuples', table_row.n_dead_tup,
            'dead_tuple_ratio', CASE
                WHEN table_row.n_live_tup > 0 THEN
                    round((table_row.n_dead_tup::float / table_row.n_live_tup * 100)::numeric, 2)
                ELSE 0
            END,
            'index_usage_ratio', CASE
                WHEN (table_row.seq_scan + table_row.idx_scan) > 0 THEN
                    round((table_row.idx_scan::float / (table_row.seq_scan + table_row.idx_scan) * 100)::numeric, 2)
                ELSE 0
            END,
            'vacuum_count', table_row.vacuum_count,
            'autovacuum_count', table_row.autovacuum_count,
            'analyze_count', table_row.analyze_count,
            'autoanalyze_count', table_row.autoanalyze_count
        );

        result := result || table_info;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. インデックス使用状況分析
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS jsonb AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    index_row RECORD;
    index_info jsonb;
    recommendations TEXT[];
BEGIN
    FOR index_row IN
        SELECT
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch,
            pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
            pg_relation_size(indexname::regclass) as index_size_bytes
        FROM pg_stat_user_indexes
        ORDER BY pg_relation_size(indexname::regclass) DESC
    LOOP
        recommendations := ARRAY[]::TEXT[];

        -- 使用されていないインデックスの検出
        IF index_row.idx_scan = 0 THEN
            recommendations := array_append(recommendations, '未使用インデックス - 削除を検討');
        ELSIF index_row.idx_scan < 10 THEN
            recommendations := array_append(recommendations, '低使用頻度インデックス - 必要性を確認');
        END IF;

        -- 大きなインデックスで低使用頻度の場合
        IF index_row.index_size_bytes > 10 * 1024 * 1024 AND index_row.idx_scan < 100 THEN
            recommendations := array_append(recommendations, '大容量低使用インデックス - 最適化が必要');
        END IF;

        index_info := jsonb_build_object(
            'schema_name', index_row.schemaname,
            'table_name', index_row.tablename,
            'index_name', index_row.indexname,
            'scans', index_row.idx_scan,
            'tuples_read', index_row.idx_tup_read,
            'tuples_fetched', index_row.idx_tup_fetch,
            'size', index_row.index_size,
            'size_bytes', index_row.index_size_bytes,
            'efficiency_ratio', CASE
                WHEN index_row.idx_tup_read > 0 THEN
                    round((index_row.idx_tup_fetch::float / index_row.idx_tup_read * 100)::numeric, 2)
                ELSE 0
            END,
            'recommendations', recommendations
        );

        result := result || index_info;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. システム全体のパフォーマンス監視
CREATE OR REPLACE FUNCTION get_system_performance_metrics()
RETURNS jsonb AS $$
DECLARE
    cache_hit_ratio numeric;
    checkpoint_stats RECORD;
    bg_writer_stats RECORD;
    system_metrics jsonb;
BEGIN
    -- キャッシュヒット率計算
    SELECT
        round((sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100)::numeric, 2)
    INTO cache_hit_ratio
    FROM pg_statio_user_tables
    WHERE heap_blks_hit + heap_blks_read > 0;

    -- チェックポイント統計
    SELECT
        checkpoints_timed,
        checkpoints_req,
        checkpoint_write_time,
        checkpoint_sync_time
    INTO checkpoint_stats
    FROM pg_stat_bgwriter;

    -- バックグラウンドライター統計
    SELECT
        buffers_clean,
        buffers_backend,
        buffers_backend_fsync,
        buffers_alloc
    INTO bg_writer_stats
    FROM pg_stat_bgwriter;

    system_metrics := jsonb_build_object(
        'cache_hit_ratio', COALESCE(cache_hit_ratio, 0),
        'checkpoints_timed', checkpoint_stats.checkpoints_timed,
        'checkpoints_requested', checkpoint_stats.checkpoints_req,
        'checkpoint_write_time_ms', checkpoint_stats.checkpoint_write_time,
        'checkpoint_sync_time_ms', checkpoint_stats.checkpoint_sync_time,
        'background_writer_buffers_clean', bg_writer_stats.buffers_clean,
        'backend_buffers', bg_writer_stats.buffers_backend,
        'backend_fsync', bg_writer_stats.buffers_backend_fsync,
        'buffers_allocated', bg_writer_stats.buffers_alloc,
        'measurement_timestamp', extract(epoch from now()),
        'performance_grade', CASE
            WHEN cache_hit_ratio >= 95 THEN 'A'
            WHEN cache_hit_ratio >= 90 THEN 'B'
            WHEN cache_hit_ratio >= 85 THEN 'C'
            WHEN cache_hit_ratio >= 80 THEN 'D'
            ELSE 'F'
        END
    );

    RETURN system_metrics;
END;
$$ LANGUAGE plpgsql;

-- 6. 統合パフォーマンス分析レポート
CREATE OR REPLACE FUNCTION generate_performance_report()
RETURNS jsonb AS $$
DECLARE
    report jsonb;
    query_analysis jsonb;
    db_performance jsonb;
    table_analysis jsonb;
    index_analysis jsonb;
    system_metrics jsonb;
    overall_score numeric := 0;
    grade_weights jsonb;
BEGIN
    -- 各分析の実行
    SELECT analyze_query_performance() INTO query_analysis;
    SELECT analyze_database_performance() INTO db_performance;
    SELECT analyze_table_performance() INTO table_analysis;
    SELECT analyze_index_usage() INTO index_analysis;
    SELECT get_system_performance_metrics() INTO system_metrics;

    -- 総合スコア計算（各メトリクスの重み付け平均）
    grade_weights := jsonb_build_object(
        'cache_hit_ratio', 0.3,
        'query_performance', 0.3,
        'connection_efficiency', 0.2,
        'index_efficiency', 0.2
    );

    -- キャッシュヒット率スコア（0-100）
    overall_score := overall_score + (system_metrics->>'cache_hit_ratio')::numeric * 0.3;

    -- 接続効率スコア
    overall_score := overall_score + LEAST(100, 100 - (db_performance->>'connection_utilization')::numeric) * 0.2;

    -- インデックス効率スコア（仮の計算）
    overall_score := overall_score + 75 * 0.2; -- 実際の計算ロジックを実装する場合

    -- クエリパフォーマンススコア（仮の計算）
    overall_score := overall_score + 80 * 0.3; -- 実際の計算ロジックを実装する場合

    -- 統合レポート生成
    report := jsonb_build_object(
        'overall_score', round(overall_score::numeric, 1),
        'grade', CASE
            WHEN overall_score >= 90 THEN 'A'
            WHEN overall_score >= 80 THEN 'B'
            WHEN overall_score >= 70 THEN 'C'
            WHEN overall_score >= 60 THEN 'D'
            ELSE 'F'
        END,
        'analysis_timestamp', extract(epoch from now()),
        'query_performance', query_analysis,
        'database_performance', db_performance,
        'table_performance', table_analysis,
        'index_performance', index_analysis,
        'system_metrics', system_metrics,
        'recommendations', jsonb_build_array(
            '定期的なVACUUM ANALYZE の実行',
            'pg_stat_statements による継続的な監視',
            '未使用インデックスの削除検討',
            'キャッシュヒット率95%以上の維持'
        )
    );

    RETURN report;
END;
$$ LANGUAGE plpgsql;

-- 7. パフォーマンス履歴記録用テーブル作成
CREATE TABLE IF NOT EXISTS performance_history (
    id SERIAL PRIMARY KEY,
    overall_score numeric(5,2),
    grade varchar(1),
    cache_hit_ratio numeric(5,2),
    active_connections integer,
    database_size_mb numeric(10,2),
    analysis_data jsonb,
    created_at timestamp with time zone DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_performance_history_created_at ON performance_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_history_overall_score ON performance_history(overall_score DESC);

-- 8. パフォーマンス履歴記録関数
CREATE OR REPLACE FUNCTION record_performance_snapshot()
RETURNS jsonb AS $$
DECLARE
    report jsonb;
    db_performance jsonb;
    system_metrics jsonb;
BEGIN
    -- パフォーマンスレポート生成
    SELECT generate_performance_report() INTO report;
    SELECT analyze_database_performance() INTO db_performance;
    SELECT get_system_performance_metrics() INTO system_metrics;

    -- 履歴テーブルに記録
    INSERT INTO performance_history (
        overall_score,
        grade,
        cache_hit_ratio,
        active_connections,
        database_size_mb,
        analysis_data
    ) VALUES (
        (report->>'overall_score')::numeric,
        report->>'grade',
        (system_metrics->>'cache_hit_ratio')::numeric,
        (db_performance->>'active_connections')::integer,
        (db_performance->>'database_size_mb')::numeric,
        report
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Performance snapshot recorded',
        'snapshot_data', report
    );
END;
$$ LANGUAGE plpgsql;

-- 関数作成完了通知
SELECT 'パフォーマンス分析用SQL関数の作成が完了しました' as status;

-- 使用例コメント
/*
-- 基本的な使用例:

-- 1. 統合パフォーマンスレポート生成
SELECT generate_performance_report();

-- 2. クエリパフォーマンス分析
SELECT analyze_query_performance();

-- 3. システムメトリクス取得
SELECT get_system_performance_metrics();

-- 4. パフォーマンススナップショット記録
SELECT record_performance_snapshot();

-- 5. パフォーマンス履歴確認
SELECT created_at, overall_score, grade, cache_hit_ratio
FROM performance_history
ORDER BY created_at DESC
LIMIT 10;
*/