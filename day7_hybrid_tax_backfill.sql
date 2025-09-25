-- Day 7-8: ハイブリッド税率バックフィル実行
-- 0922Youken.md Week 2 Phase 1: 既存データへの税率適用
-- 2025-09-22 実施

-- ============================================
-- Step 1: 既存データの税区分バックフィル準備
-- ============================================

-- バックフィル実行状況を記録するテーブル
CREATE TABLE IF NOT EXISTS tax_backfill_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    affected_rows INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- バックフィル関数の作成
CREATE OR REPLACE FUNCTION log_backfill_operation(
    p_table_name VARCHAR(100),
    p_operation VARCHAR(50),
    p_affected_rows INTEGER,
    p_status VARCHAR(20) DEFAULT 'completed',
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO tax_backfill_log (
        table_name, operation, affected_rows, status, error_message, completed_at
    ) VALUES (
        p_table_name, p_operation, p_affected_rows, p_status, p_error_message, NOW()
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 2: 商品マスタの税区分バックフィル
-- ============================================

DO $$
DECLARE
    updated_count INTEGER := 0;
    start_time TIMESTAMP := clock_timestamp();
    log_id UUID;
BEGIN
    -- 商品の税区分が未設定の場合のデフォルト設定
    UPDATE products
    SET tax_category = CASE
        -- 商品名から税区分を推定
        WHEN product_name ~* '食品|飲料|食材|米|肉|魚|野菜|果物|パン|お菓子|調味料|乳製品|冷凍食品' THEN 'reduced_8'
        WHEN product_name ~* '切手|印紙|有価証券|土地|住宅|保険|医療|介護|教育|福祉' THEN 'tax_free'
        WHEN product_name ~* '輸出|海外|免税|duty.?free' THEN 'tax_exempt'
        ELSE 'standard_10'
    END,
    tax_category_updated_at = NOW(),
    tax_category_updated_by = (
        SELECT id FROM auth.users
        WHERE email LIKE '%admin%' OR email LIKE '%system%'
        ORDER BY created_at
        LIMIT 1
    )
    WHERE tax_category IS NULL
       OR tax_category = ''
       OR tax_category NOT IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt');

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- ログ記録
    PERFORM log_backfill_operation(
        'products',
        'tax_category_backfill',
        updated_count,
        'completed'
    );

    RAISE NOTICE '✅ Products税区分バックフィル完了: % 件', updated_count;

EXCEPTION WHEN OTHERS THEN
    PERFORM log_backfill_operation(
        'products',
        'tax_category_backfill',
        0,
        'failed',
        SQLERRM
    );
    RAISE;
END $$;

-- ============================================
-- Step 3: 発注履歴への税区分・税率バックフィル
-- ============================================

-- purchase_order_itemsテーブルに税関連カラムを追加
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(20),
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,3),
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS unit_price_including_tax DECIMAL(15,4),
ADD COLUMN IF NOT EXISTS total_amount_including_tax DECIMAL(15,2);

-- 発注明細の税情報バックフィル
DO $$
DECLARE
    updated_count INTEGER := 0;
    item_record RECORD;
    product_tax_category VARCHAR(20);
    calculated_tax_rate DECIMAL(5,3);
    calculated_tax_amount DECIMAL(15,2);
BEGIN
    -- 既存の発注明細に税情報を設定
    FOR item_record IN
        SELECT poi.id, poi.product_id, poi.quantity, poi.unit_price, poi.total_amount
        FROM purchase_order_items poi
        WHERE poi.tax_category IS NULL OR poi.tax_rate IS NULL
    LOOP
        -- 商品の税区分を取得
        SELECT
            COALESCE(tax_category, 'standard_10'),
            CASE COALESCE(tax_category, 'standard_10')
                WHEN 'standard_10' THEN 0.100
                WHEN 'reduced_8' THEN 0.080
                WHEN 'tax_free' THEN 0.000
                WHEN 'tax_exempt' THEN 0.000
                ELSE 0.100
            END
        INTO product_tax_category, calculated_tax_rate
        FROM products
        WHERE id = item_record.product_id;

        -- 税額計算
        calculated_tax_amount := FLOOR(item_record.total_amount * calculated_tax_rate);

        -- 税情報を更新
        UPDATE purchase_order_items
        SET
            tax_category = product_tax_category,
            tax_rate = calculated_tax_rate,
            tax_amount = calculated_tax_amount,
            unit_price_including_tax = item_record.unit_price * (1 + calculated_tax_rate),
            total_amount_including_tax = item_record.total_amount + calculated_tax_amount
        WHERE id = item_record.id;

        updated_count := updated_count + 1;
    END LOOP;

    -- ログ記録
    PERFORM log_backfill_operation(
        'purchase_order_items',
        'tax_info_backfill',
        updated_count,
        'completed'
    );

    RAISE NOTICE '✅ Purchase Order Items税情報バックフィル完了: % 件', updated_count;

EXCEPTION WHEN OTHERS THEN
    PERFORM log_backfill_operation(
        'purchase_order_items',
        'tax_info_backfill',
        0,
        'failed',
        SQLERRM
    );
    RAISE;
END $$;

-- ============================================
-- Step 4: 在庫移動履歴への税区分バックフィル
-- ============================================

-- inventory_movementsテーブルに税区分カラムが無い場合は追加
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(20),
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,3);

-- 在庫移動履歴の税区分バックフィル
DO $$
DECLARE
    updated_count INTEGER := 0;
    movement_record RECORD;
    product_tax_info RECORD;
BEGIN
    -- 税区分が未設定の在庫移動に対して商品の税区分を設定
    FOR movement_record IN
        SELECT id, product_id
        FROM inventory_movements
        WHERE tax_category IS NULL
    LOOP
        -- 商品の税区分情報を取得
        SELECT
            COALESCE(tax_category, 'standard_10') as tax_cat,
            CASE COALESCE(tax_category, 'standard_10')
                WHEN 'standard_10' THEN 0.100
                WHEN 'reduced_8' THEN 0.080
                WHEN 'tax_free' THEN 0.000
                WHEN 'tax_exempt' THEN 0.000
                ELSE 0.100
            END as tax_rt
        INTO product_tax_info
        FROM products
        WHERE id = movement_record.product_id;

        -- 在庫移動履歴を更新
        UPDATE inventory_movements
        SET
            tax_category = product_tax_info.tax_cat,
            tax_rate = product_tax_info.tax_rt
        WHERE id = movement_record.id;

        updated_count := updated_count + 1;
    END LOOP;

    -- ログ記録
    PERFORM log_backfill_operation(
        'inventory_movements',
        'tax_category_backfill',
        updated_count,
        'completed'
    );

    RAISE NOTICE '✅ Inventory Movements税区分バックフィル完了: % 件', updated_count;

EXCEPTION WHEN OTHERS THEN
    PERFORM log_backfill_operation(
        'inventory_movements',
        'tax_category_backfill',
        0,
        'failed',
        SQLERRM
    );
    RAISE;
END $$;

-- ============================================
-- Step 5: FIFO履歴への税区分バックフィル
-- ============================================

-- FIFO層の税区分が未設定の場合のバックフィル
DO $$
DECLARE
    updated_count INTEGER := 0;
    layer_record RECORD;
    product_tax_info RECORD;
BEGIN
    -- 税区分が未設定のFIFO層を更新
    FOR layer_record IN
        SELECT id, product_id
        FROM inventory_fifo_layers
        WHERE tax_category IS NULL
    LOOP
        -- 商品の税区分情報を取得
        SELECT
            COALESCE(tax_category, 'standard_10') as tax_cat,
            CASE COALESCE(tax_category, 'standard_10')
                WHEN 'standard_10' THEN 0.100
                WHEN 'reduced_8' THEN 0.080
                WHEN 'tax_free' THEN 0.000
                WHEN 'tax_exempt' THEN 0.000
                ELSE 0.100
            END as tax_rt
        INTO product_tax_info
        FROM products
        WHERE id = layer_record.product_id;

        -- FIFO層を更新
        UPDATE inventory_fifo_layers
        SET
            tax_category = product_tax_info.tax_cat,
            tax_rate = product_tax_info.tax_rt
        WHERE id = layer_record.id;

        updated_count := updated_count + 1;
    END LOOP;

    -- ログ記録
    PERFORM log_backfill_operation(
        'inventory_fifo_layers',
        'tax_category_backfill',
        updated_count,
        'completed'
    );

    RAISE NOTICE '✅ FIFO Layers税区分バックフィル完了: % 件', updated_count;

EXCEPTION WHEN OTHERS THEN
    PERFORM log_backfill_operation(
        'inventory_fifo_layers',
        'tax_category_backfill',
        0,
        'failed',
        SQLERRM
    );
    RAISE;
END $$;

-- ============================================
-- Step 6: 発注ヘッダーへの税額サマリー更新
-- ============================================

-- purchase_ordersテーブルに税関連サマリーカラムを追加
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS tax_8_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_10_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_free_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tax_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_including_tax DECIMAL(15,2) DEFAULT 0;

-- 発注ヘッダーの税額サマリーを計算・更新
DO $$
DECLARE
    updated_count INTEGER := 0;
    order_record RECORD;
    tax_summary RECORD;
BEGIN
    -- 各発注に対して税額サマリーを計算
    FOR order_record IN
        SELECT id FROM purchase_orders
        WHERE total_tax_amount IS NULL OR total_tax_amount = 0
    LOOP
        -- 明細の税額を集計
        SELECT
            COALESCE(SUM(CASE WHEN poi.tax_category = 'reduced_8' THEN poi.tax_amount ELSE 0 END), 0) as tax_8_total,
            COALESCE(SUM(CASE WHEN poi.tax_category = 'standard_10' THEN poi.tax_amount ELSE 0 END), 0) as tax_10_total,
            COALESCE(SUM(CASE WHEN poi.tax_category IN ('tax_free', 'tax_exempt') THEN poi.total_amount ELSE 0 END), 0) as tax_free_total,
            COALESCE(SUM(poi.tax_amount), 0) as total_tax,
            COALESCE(SUM(poi.total_amount_including_tax), 0) as total_with_tax
        INTO tax_summary
        FROM purchase_order_items poi
        WHERE poi.purchase_order_id = order_record.id;

        -- 発注ヘッダーを更新
        UPDATE purchase_orders
        SET
            tax_8_amount = tax_summary.tax_8_total,
            tax_10_amount = tax_summary.tax_10_total,
            tax_free_amount = tax_summary.tax_free_total,
            total_tax_amount = tax_summary.total_tax,
            total_including_tax = tax_summary.total_with_tax
        WHERE id = order_record.id;

        updated_count := updated_count + 1;
    END LOOP;

    -- ログ記録
    PERFORM log_backfill_operation(
        'purchase_orders',
        'tax_summary_backfill',
        updated_count,
        'completed'
    );

    RAISE NOTICE '✅ Purchase Orders税額サマリーバックフィル完了: % 件', updated_count;

EXCEPTION WHEN OTHERS THEN
    PERFORM log_backfill_operation(
        'purchase_orders',
        'tax_summary_backfill',
        0,
        'failed',
        SQLERRM
    );
    RAISE;
END $$;

-- ============================================
-- Step 7: 混合税率の整合性チェック
-- ============================================

-- 混合税率データの整合性チェック関数
CREATE OR REPLACE FUNCTION verify_hybrid_tax_integrity()
RETURNS TABLE(
    check_type TEXT,
    table_name TEXT,
    passed BOOLEAN,
    total_records INTEGER,
    problematic_records INTEGER,
    details TEXT
) AS $$
BEGIN
    -- 1. 商品マスタの税区分チェック
    RETURN QUERY
    SELECT
        'tax_category_validity'::TEXT,
        'products'::TEXT,
        (COUNT(*) FILTER (WHERE tax_category NOT IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt')) = 0)::BOOLEAN,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE tax_category NOT IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt'))::INTEGER,
        '商品の税区分妥当性チェック'::TEXT
    FROM products;

    -- 2. 発注明細の税率整合性チェック
    RETURN QUERY
    SELECT
        'order_item_tax_consistency'::TEXT,
        'purchase_order_items'::TEXT,
        (COUNT(*) FILTER (WHERE
            (poi.tax_category = 'standard_10' AND poi.tax_rate != 0.100) OR
            (poi.tax_category = 'reduced_8' AND poi.tax_rate != 0.080) OR
            (poi.tax_category IN ('tax_free', 'tax_exempt') AND poi.tax_rate != 0.000)
        ) = 0)::BOOLEAN,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE
            (poi.tax_category = 'standard_10' AND poi.tax_rate != 0.100) OR
            (poi.tax_category = 'reduced_8' AND poi.tax_rate != 0.080) OR
            (poi.tax_category IN ('tax_free', 'tax_exempt') AND poi.tax_rate != 0.000)
        )::INTEGER,
        '発注明細の税区分と税率の整合性チェック'::TEXT
    FROM purchase_order_items poi;

    -- 3. 税額計算の精度チェック
    RETURN QUERY
    SELECT
        'tax_calculation_accuracy'::TEXT,
        'purchase_order_items'::TEXT,
        (COUNT(*) FILTER (WHERE
            ABS(poi.tax_amount - FLOOR(poi.total_amount * poi.tax_rate)) > 1
        ) = 0)::BOOLEAN,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE
            ABS(poi.tax_amount - FLOOR(poi.total_amount * poi.tax_rate)) > 1
        )::INTEGER,
        '税額計算精度チェック（端数処理含む）'::TEXT
    FROM purchase_order_items poi
    WHERE poi.tax_rate IS NOT NULL;

    -- 4. FIFO層の税区分整合性
    RETURN QUERY
    SELECT
        'fifo_tax_consistency'::TEXT,
        'inventory_fifo_layers'::TEXT,
        (COUNT(*) FILTER (WHERE
            ifl.tax_category != p.tax_category
        ) = 0)::BOOLEAN,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE
            ifl.tax_category != p.tax_category
        )::INTEGER,
        'FIFO層と商品マスタの税区分整合性チェック'::TEXT
    FROM inventory_fifo_layers ifl
    JOIN products p ON ifl.product_id = p.id;

    -- 5. 発注ヘッダーの税額サマリー整合性
    RETURN QUERY
    SELECT
        'order_tax_summary_consistency'::TEXT,
        'purchase_orders'::TEXT,
        (COUNT(*) FILTER (WHERE
            ABS(po.total_tax_amount - (
                SELECT COALESCE(SUM(poi.tax_amount), 0)
                FROM purchase_order_items poi
                WHERE poi.purchase_order_id = po.id
            )) > 1
        ) = 0)::BOOLEAN,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE
            ABS(po.total_tax_amount - (
                SELECT COALESCE(SUM(poi.tax_amount), 0)
                FROM purchase_order_items poi
                WHERE poi.purchase_order_id = po.id
            )) > 1
        )::INTEGER,
        '発注ヘッダーと明細の税額サマリー整合性チェック'::TEXT
    FROM purchase_orders po
    WHERE po.total_tax_amount IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: バックフィル結果レポート
-- ============================================

-- バックフィル実行結果の総合レポート
DO $$
DECLARE
    total_operations INTEGER;
    successful_operations INTEGER;
    failed_operations INTEGER;
    total_affected_rows INTEGER;
BEGIN
    -- 実行統計を取得
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        COALESCE(SUM(affected_rows), 0)
    INTO total_operations, successful_operations, failed_operations, total_affected_rows
    FROM tax_backfill_log;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Day 7-8 ハイブリッド税率バックフィル完了レポート';
    RAISE NOTICE '============================================';
    RAISE NOTICE '実行操作数: %', total_operations;
    RAISE NOTICE '成功: %, 失敗: %', successful_operations, failed_operations;
    RAISE NOTICE '総更新レコード数: %', total_affected_rows;
    RAISE NOTICE '============================================';

    -- 詳細ログ表示
    RAISE NOTICE '詳細ログ:';
    FOR rec IN
        SELECT table_name, operation, affected_rows, status
        FROM tax_backfill_log
        ORDER BY started_at
    LOOP
        RAISE NOTICE '  % [%] %: % 件', rec.table_name, rec.operation, rec.status, rec.affected_rows;
    END LOOP;

    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ ハイブリッド税率バックフィルが完了しました';
    RAISE NOTICE '実行日時: %', NOW();
    RAISE NOTICE '============================================';
END $$;

-- 整合性チェックの実行と結果表示
DO $$
DECLARE
    check_result RECORD;
    total_checks INTEGER := 0;
    passed_checks INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '混合税率データ整合性チェック結果';
    RAISE NOTICE '============================================';

    FOR check_result IN
        SELECT * FROM verify_hybrid_tax_integrity()
    LOOP
        total_checks := total_checks + 1;
        IF check_result.passed THEN
            passed_checks := passed_checks + 1;
            RAISE NOTICE '✅ % - PASS (総数: %, 問題: %)',
                check_result.details, check_result.total_records, check_result.problematic_records;
        ELSE
            RAISE NOTICE '❌ % - FAIL (総数: %, 問題: %)',
                check_result.details, check_result.total_records, check_result.problematic_records;
        END IF;
    END LOOP;

    RAISE NOTICE '============================================';
    RAISE NOTICE '整合性チェック結果: %/% 通過', passed_checks, total_checks;
    RAISE NOTICE '============================================';
END $$;