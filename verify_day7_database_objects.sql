-- Day 7-8 データベースオブジェクト実装確認スクリプト
-- 作成されたすべてのオブジェクトの存在と構造を検証

-- ============================================
-- Step 1: テーブル存在確認
-- ============================================

DO $$
DECLARE
    expected_tables TEXT[] := ARRAY[
        'inventory_movements',
        'inventory_balances',
        'inventory_fifo_layers',
        'inventory_alerts',
        'outbound_orders',
        'outbound_order_items',
        'inventory_allocations',
        'picking_lists',
        'picking_list_items',
        'outbound_shipments',
        'shipment_tracking',
        'tax_backfill_log',
        'inventory_reduction_batches',
        'inventory_reduction_details'
    ];
    table_name TEXT;
    existing_count INTEGER := 0;
    total_count INTEGER := array_length(expected_tables, 1);
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '📋 テーブル存在確認';
    RAISE NOTICE '============================================';

    FOREACH table_name IN ARRAY expected_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name) THEN
            RAISE NOTICE '✅ %', table_name;
            existing_count := existing_count + 1;
        ELSE
            RAISE NOTICE '❌ %', table_name;
        END IF;
    END LOOP;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 テーブル作成状況: %/% (%.1f%%)',
        existing_count, total_count, (existing_count::DECIMAL / total_count * 100);
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 2: ENUM型存在確認
-- ============================================

DO $$
DECLARE
    expected_enums TEXT[] := ARRAY[
        'inventory_movement_type',
        'outbound_type',
        'outbound_status',
        'tax_category_enum'
    ];
    enum_name TEXT;
    existing_count INTEGER := 0;
    total_count INTEGER := array_length(expected_enums, 1);
    enum_values TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '🏷️  ENUM型存在確認';
    RAISE NOTICE '============================================';

    FOREACH enum_name IN ARRAY expected_enums LOOP
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = enum_name) THEN
            -- ENUM値を取得
            SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) INTO enum_values
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = enum_name);

            RAISE NOTICE '✅ % → [%]', enum_name, enum_values;
            existing_count := existing_count + 1;
        ELSE
            RAISE NOTICE '❌ %', enum_name;
        END IF;
    END LOOP;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 ENUM型作成状況: %/% (%.1f%%)',
        existing_count, total_count, (existing_count::DECIMAL / total_count * 100);
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 3: 関数存在確認
-- ============================================

DO $$
DECLARE
    expected_functions TEXT[] := ARRAY[
        'update_inventory_balance',
        'check_inventory_alerts',
        'generate_outbound_no',
        'allocate_inventory_fifo',
        'execute_inventory_reduction',
        'execute_realtime_inventory_reduction',
        'process_fifo_reduction',
        'rollback_inventory_reduction',
        'auto_inventory_reduction_trigger',
        'log_backfill_operation',
        'verify_hybrid_tax_integrity'
    ];
    func_name TEXT;
    existing_count INTEGER := 0;
    total_count INTEGER := array_length(expected_functions, 1);
    func_args TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '⚙️  関数存在確認';
    RAISE NOTICE '============================================';

    FOREACH func_name IN ARRAY expected_functions LOOP
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = func_name) THEN
            -- 引数情報を取得
            SELECT pg_get_function_arguments(oid) INTO func_args
            FROM pg_proc
            WHERE proname = func_name
            LIMIT 1;

            RAISE NOTICE '✅ %(%)', func_name, COALESCE(func_args, 'void');
            existing_count := existing_count + 1;
        ELSE
            RAISE NOTICE '❌ %', func_name;
        END IF;
    END LOOP;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 関数作成状況: %/% (%.1f%%)',
        existing_count, total_count, (existing_count::DECIMAL / total_count * 100);
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 4: トリガー存在確認
-- ============================================

DO $$
DECLARE
    expected_triggers TEXT[] := ARRAY[
        'trigger_update_inventory_balance',
        'trigger_check_inventory_alerts',
        'trigger_record_tax_category_change',
        'trigger_auto_inventory_reduction'
    ];
    trigger_name TEXT;
    existing_count INTEGER := 0;
    total_count INTEGER := array_length(expected_triggers, 1);
    trigger_table TEXT;
    trigger_event TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '🎯 トリガー存在確認';
    RAISE NOTICE '============================================';

    FOREACH trigger_name IN ARRAY expected_triggers LOOP
        SELECT
            event_object_table,
            string_agg(event_manipulation, ',' ORDER BY event_manipulation)
        INTO trigger_table, trigger_event
        FROM information_schema.triggers
        WHERE trigger_name = trigger_name
        GROUP BY event_object_table;

        IF trigger_table IS NOT NULL THEN
            RAISE NOTICE '✅ % → % [%]', trigger_name, trigger_table, trigger_event;
            existing_count := existing_count + 1;
        ELSE
            RAISE NOTICE '❌ %', trigger_name;
        END IF;

        -- 変数をクリア
        trigger_table := NULL;
        trigger_event := NULL;
    END LOOP;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 トリガー作成状況: %/% (%.1f%%)',
        existing_count, total_count, (existing_count::DECIMAL / total_count * 100);
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 5: ビュー存在確認
-- ============================================

DO $$
DECLARE
    view_record RECORD;
    view_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '👁️  ビュー存在確認';
    RAISE NOTICE '============================================';

    FOR view_record IN
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_name LIKE 'v_inventory_%'
        ORDER BY table_name
    LOOP
        RAISE NOTICE '✅ % → %',
            view_record.table_name,
            SUBSTRING(view_record.view_definition FROM 1 FOR 50) || '...';
        view_count := view_count + 1;
    END LOOP;

    IF view_count = 0 THEN
        RAISE NOTICE '❌ 在庫関連ビューが見つかりません';
    END IF;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 ビュー作成数: %', view_count;
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 6: インデックス確認
-- ============================================

SELECT
    '============================================' as separator
UNION ALL
SELECT '📈 インデックス存在確認'
UNION ALL
SELECT '============================================'
UNION ALL
SELECT
    CASE
        WHEN COUNT(*) > 0
        THEN '✅ ' || tablename || ': ' || COUNT(*)::TEXT || '個のインデックス'
        ELSE '❌ ' || tablename || ': インデックスなし'
    END
FROM pg_indexes
WHERE tablename IN (
    'inventory_movements', 'inventory_balances', 'inventory_fifo_layers',
    'inventory_alerts', 'outbound_orders', 'outbound_order_items',
    'inventory_allocations', 'picking_lists', 'picking_list_items',
    'outbound_shipments', 'shipment_tracking', 'inventory_reduction_batches',
    'inventory_reduction_details', 'products'
)
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- Step 7: テーブル構造詳細確認
-- ============================================

-- 主要テーブルのカラム構成確認
SELECT
    '============================================' as info
UNION ALL
SELECT '📋 主要テーブル構造確認'
UNION ALL
SELECT '============================================'
UNION ALL
SELECT
    t.table_name || ' (' || COUNT(c.column_name)::TEXT || 'カラム)' as table_info
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_name IN (
    'inventory_movements', 'inventory_balances', 'outbound_orders',
    'outbound_order_items', 'inventory_reduction_batches'
)
AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- ============================================
-- Step 8: データ存在確認
-- ============================================

DO $$
DECLARE
    table_record RECORD;
    record_count INTEGER;
    has_data BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '📊 データ存在確認';
    RAISE NOTICE '============================================';

    -- 主要テーブルのレコード数をチェック
    FOR table_record IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name IN (
            'products', 'inventory_movements', 'inventory_balances',
            'outbound_orders', 'purchase_orders', 'tax_backfill_log'
        )
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_record.table_name) INTO record_count;

        RAISE NOTICE '%s %: % 件',
            CASE WHEN record_count > 0 THEN '✅' ELSE '⚪' END,
            table_record.table_name,
            record_count;

        IF record_count > 0 THEN
            has_data := TRUE;
        END IF;
    END LOOP;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 データ状況: %',
        CASE WHEN has_data THEN '一部テーブルにデータあり' ELSE 'データなし' END;
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 9: RLS設定確認
-- ============================================

SELECT
    '============================================' as separator
UNION ALL
SELECT '🔐 RLS (Row Level Security) 設定確認'
UNION ALL
SELECT '============================================'
UNION ALL
SELECT
    schemaname || '.' || tablename ||
    CASE WHEN rowsecurity THEN ' ✅ RLS有効' ELSE ' ❌ RLS無効' END ||
    ' (' || COUNT(policyname)::TEXT || 'ポリシー)'
FROM pg_policies p
RIGHT JOIN pg_tables t ON p.tablename = t.tablename
WHERE t.tablename IN (
    'inventory_movements', 'inventory_balances', 'inventory_fifo_layers',
    'inventory_alerts', 'outbound_orders', 'outbound_order_items',
    'inventory_allocations', 'picking_lists', 'outbound_shipments'
)
GROUP BY schemaname, t.tablename, rowsecurity
ORDER BY t.tablename;

-- ============================================
-- Step 10: 拡張機能確認
-- ============================================

DO $$
DECLARE
    extension_record RECORD;
    extension_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '🔧 拡張機能確認';
    RAISE NOTICE '============================================';

    FOR extension_record IN
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname IN ('uuid-ossp', 'pgcrypto')
        ORDER BY extname
    LOOP
        RAISE NOTICE '✅ % (version: %)', extension_record.extname, extension_record.extversion;
        extension_count := extension_count + 1;
    END LOOP;

    IF extension_count = 0 THEN
        RAISE NOTICE '⚪ 特別な拡張機能は使用していません';
    END IF;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '📊 拡張機能: %', extension_count;
    RAISE NOTICE '--------------------------------------------';
END $$;

-- ============================================
-- Step 11: 総合評価
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
    enum_count INTEGER;
    function_count INTEGER;
    trigger_count INTEGER;
    view_count INTEGER;
    index_count INTEGER;
    total_score INTEGER := 0;
    max_score INTEGER := 60; -- 想定される最大スコア
    completion_rate DECIMAL;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '🎯 Day 7-8 実装完成度評価';
    RAISE NOTICE '============================================';

    -- 各カテゴリのオブジェクト数を取得
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN (
        'inventory_movements', 'inventory_balances', 'inventory_fifo_layers',
        'inventory_alerts', 'outbound_orders', 'outbound_order_items',
        'inventory_allocations', 'picking_lists', 'picking_list_items',
        'outbound_shipments', 'shipment_tracking', 'tax_backfill_log',
        'inventory_reduction_batches', 'inventory_reduction_details'
    );

    SELECT COUNT(*) INTO enum_count
    FROM pg_type
    WHERE typname IN ('inventory_movement_type', 'outbound_type', 'outbound_status', 'tax_category_enum');

    SELECT COUNT(*) INTO function_count
    FROM pg_proc
    WHERE proname IN (
        'update_inventory_balance', 'check_inventory_alerts', 'generate_outbound_no',
        'allocate_inventory_fifo', 'execute_inventory_reduction', 'execute_realtime_inventory_reduction',
        'process_fifo_reduction', 'rollback_inventory_reduction', 'auto_inventory_reduction_trigger',
        'log_backfill_operation', 'verify_hybrid_tax_integrity'
    );

    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name IN (
        'trigger_update_inventory_balance', 'trigger_check_inventory_alerts',
        'trigger_record_tax_category_change', 'trigger_auto_inventory_reduction'
    );

    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_name LIKE 'v_inventory_%';

    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename IN (
        'inventory_movements', 'inventory_balances', 'outbound_orders',
        'outbound_order_items', 'inventory_allocations'
    );

    -- スコア計算
    total_score := (table_count * 3) + (enum_count * 2) + (function_count * 4) +
                   (trigger_count * 3) + (view_count * 2) + (LEAST(index_count, 20));

    completion_rate := (total_score::DECIMAL / max_score * 100);

    RAISE NOTICE '📋 テーブル: % 個 (想定: 14個)', table_count;
    RAISE NOTICE '🏷️  ENUM型: % 個 (想定: 4個)', enum_count;
    RAISE NOTICE '⚙️  関数: % 個 (想定: 11個)', function_count;
    RAISE NOTICE '🎯 トリガー: % 個 (想定: 4個)', trigger_count;
    RAISE NOTICE '👁️  ビュー: % 個 (想定: 2個)', view_count;
    RAISE NOTICE '📈 インデックス: % 個 (想定: 20+個)', index_count;
    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE '🏆 総合スコア: %/% (%.1f%%)', total_score, max_score, completion_rate;
    RAISE NOTICE '--------------------------------------------';

    IF completion_rate >= 90 THEN
        RAISE NOTICE '🎉 完璧！Day 7-8 の実装が正常に完了しています';
    ELSIF completion_rate >= 75 THEN
        RAISE NOTICE '✅ 良好！ほぼ完成していますが、一部確認が必要です';
    ELSIF completion_rate >= 50 THEN
        RAISE NOTICE '⚠️  部分的！重要な要素が不足している可能性があります';
    ELSE
        RAISE NOTICE '❌ 不完全！大幅な実装が不足しています';
    END IF;

    RAISE NOTICE '============================================';
    RAISE NOTICE '実行日時: %', NOW();
    RAISE NOTICE '============================================';
END $$;