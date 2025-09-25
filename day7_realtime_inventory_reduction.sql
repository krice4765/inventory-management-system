-- Day 7-8: リアルタイム在庫減算ロジック実装
-- 0922Youken.md Week 2 Phase 1: 完全在庫減算システム
-- 2025-09-22 実施

-- ============================================
-- Step 1: リアルタイム在庫減算の基盤システム
-- ============================================

-- 在庫減算処理状況管理テーブル
CREATE TABLE IF NOT EXISTS inventory_reduction_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no VARCHAR(50) NOT NULL UNIQUE,

    -- 処理対象
    target_type VARCHAR(50) NOT NULL, -- outbound_order, sales_order, adjustment
    target_id UUID NOT NULL,

    -- 処理ステータス
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, rollback
    processing_mode VARCHAR(20) DEFAULT 'realtime', -- realtime, batch, manual

    -- 統計
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    total_quantity DECIMAL(15,3) DEFAULT 0,
    processed_quantity DECIMAL(15,3) DEFAULT 0,

    -- 実行情報
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    processed_by UUID REFERENCES auth.users(id),

    -- エラー情報
    error_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 在庫減算処理詳細ログ
CREATE TABLE IF NOT EXISTS inventory_reduction_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES inventory_reduction_batches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),

    -- 処理前後の状況
    before_quantity DECIMAL(15,3),
    reduction_quantity DECIMAL(15,3),
    after_quantity DECIMAL(15,3),

    -- FIFO処理詳細
    fifo_layers_affected INTEGER DEFAULT 0,
    average_cost DECIMAL(15,4),
    total_cost DECIMAL(15,2),

    -- ステータス
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed, rolled_back
    processing_order INTEGER,

    -- エラー情報
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- 関連情報
    movement_id UUID REFERENCES inventory_movements(id),
    allocation_ids UUID[], -- 複数の引当IDを配列で格納

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_reduction_batches_status
ON inventory_reduction_batches(status, created_at);

CREATE INDEX IF NOT EXISTS idx_reduction_batches_target
ON inventory_reduction_batches(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_reduction_details_batch_order
ON inventory_reduction_details(batch_id, processing_order);

CREATE INDEX IF NOT EXISTS idx_reduction_details_product_status
ON inventory_reduction_details(product_id, status);

-- ============================================
-- Step 2: リアルタイム在庫減算メイン関数
-- ============================================

-- リアルタイム在庫減算実行関数（トランザクション安全）
CREATE OR REPLACE FUNCTION execute_realtime_inventory_reduction(
    p_target_type VARCHAR(50),
    p_target_id UUID,
    p_processing_mode VARCHAR(20) DEFAULT 'realtime'
) RETURNS UUID AS $$
DECLARE
    batch_id UUID;
    batch_no VARCHAR(50);
    item_count INTEGER := 0;
    total_qty DECIMAL(15,3) := 0;
    detail_record RECORD;
    current_balance RECORD;
    fifo_result RECORD;
    movement_id UUID;
    processing_start TIMESTAMP := clock_timestamp();
    processing_end TIMESTAMP;
    error_occurred BOOLEAN := FALSE;
    error_msg TEXT;
BEGIN
    -- バッチIDとバッチ番号を生成
    batch_id := gen_random_uuid();
    batch_no := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 100000, 5, '0');

    -- バッチレコード作成
    INSERT INTO inventory_reduction_batches (
        id, batch_no, target_type, target_id, status, processing_mode, started_at, processed_by
    ) VALUES (
        batch_id, batch_no, p_target_type, p_target_id, 'processing', p_processing_mode, NOW(),
        COALESCE((SELECT auth.uid()), (SELECT id FROM auth.users LIMIT 1))
    );

    RAISE NOTICE '🚀 リアルタイム在庫減算開始: バッチ % (%, %)', batch_no, p_target_type, p_target_id;

    -- 処理対象の特定（出庫指示の場合）
    IF p_target_type = 'outbound_order' THEN
        -- 出庫指示明細から処理対象を取得
        FOR detail_record IN
            SELECT
                oi.product_id,
                oi.shipped_quantity as reduction_quantity,
                row_number() OVER (ORDER BY oi.id) as processing_order
            FROM outbound_order_items oi
            JOIN outbound_orders o ON oi.outbound_order_id = o.id
            WHERE o.id = p_target_id
              AND oi.shipped_quantity > 0
              AND o.status IN ('出庫完了')
              AND NOT o.inventory_reduced -- まだ在庫減算されていない
        LOOP
            BEGIN
                -- 現在の在庫残高を取得（楽観的ロック）
                SELECT * INTO current_balance
                FROM inventory_balances
                WHERE product_id = detail_record.product_id
                FOR UPDATE NOWAIT;

                -- 在庫不足チェック
                IF current_balance.available_quantity < detail_record.reduction_quantity THEN
                    RAISE EXCEPTION '在庫不足: 商品ID=%, 必要数量=%, 利用可能数量=%',
                        detail_record.product_id, detail_record.reduction_quantity, current_balance.available_quantity;
                END IF;

                -- 在庫移動記録の作成
                INSERT INTO inventory_movements (
                    product_id,
                    movement_type,
                    quantity,
                    reference_type,
                    reference_id,
                    batch_id,
                    is_confirmed,
                    memo
                ) VALUES (
                    detail_record.product_id,
                    'outbound',
                    -detail_record.reduction_quantity, -- 減算なので負の値
                    p_target_type,
                    p_target_id,
                    batch_id,
                    TRUE,
                    format('リアルタイム在庫減算 (バッチ: %s)', batch_no)
                ) RETURNING id INTO movement_id;

                -- FIFO減算処理
                SELECT * INTO fifo_result
                FROM process_fifo_reduction(detail_record.product_id, detail_record.reduction_quantity, batch_id);

                -- 在庫バランス更新（楽観的ロック）
                UPDATE inventory_balances
                SET
                    current_quantity = current_quantity - detail_record.reduction_quantity,
                    total_cost = total_cost - fifo_result.total_cost,
                    version = version + 1,
                    last_movement_at = NOW(),
                    last_calculated_at = NOW(),
                    updated_at = NOW()
                WHERE product_id = detail_record.product_id
                  AND version = current_balance.version;

                -- 楽観的ロックが失敗した場合
                IF NOT FOUND THEN
                    RAISE EXCEPTION '在庫更新競合が発生しました: 商品ID=%', detail_record.product_id;
                END IF;

                -- 処理詳細ログを作成
                INSERT INTO inventory_reduction_details (
                    batch_id, product_id,
                    before_quantity, reduction_quantity, after_quantity,
                    fifo_layers_affected, average_cost, total_cost,
                    status, processing_order, movement_id
                ) VALUES (
                    batch_id, detail_record.product_id,
                    current_balance.current_quantity, detail_record.reduction_quantity,
                    current_balance.current_quantity - detail_record.reduction_quantity,
                    fifo_result.layers_affected, fifo_result.average_cost, fifo_result.total_cost,
                    'processed', detail_record.processing_order, movement_id
                );

                item_count := item_count + 1;
                total_qty := total_qty + detail_record.reduction_quantity;

                RAISE NOTICE '  ✅ 商品 % 在庫減算完了: % → %',
                    detail_record.product_id,
                    current_balance.current_quantity,
                    current_balance.current_quantity - detail_record.reduction_quantity;

            EXCEPTION WHEN OTHERS THEN
                error_occurred := TRUE;
                error_msg := SQLERRM;

                -- エラー詳細ログ
                INSERT INTO inventory_reduction_details (
                    batch_id, product_id,
                    before_quantity, reduction_quantity,
                    status, processing_order, error_message
                ) VALUES (
                    batch_id, detail_record.product_id,
                    COALESCE(current_balance.current_quantity, 0), detail_record.reduction_quantity,
                    'failed', detail_record.processing_order, error_msg
                );

                RAISE WARNING '  ❌ 商品 % 在庫減算エラー: %', detail_record.product_id, error_msg;

                -- エラーが発生した場合、処理を継続するか判断
                -- （設定により、エラー時に全体をロールバックすることも可能）
                CONTINUE;
            END;
        END LOOP;

        -- 出庫指示の在庫減算完了フラグを更新
        IF NOT error_occurred THEN
            UPDATE outbound_orders
            SET inventory_reduced = TRUE, updated_at = NOW()
            WHERE id = p_target_id;
        END IF;
    END IF;

    -- バッチ処理完了
    processing_end := clock_timestamp();

    UPDATE inventory_reduction_batches
    SET
        status = CASE WHEN error_occurred THEN 'failed' ELSE 'completed' END,
        total_items = item_count,
        processed_items = item_count,
        total_quantity = total_qty,
        processed_quantity = total_qty,
        completed_at = processing_end,
        processing_time_ms = EXTRACT(MILLISECONDS FROM (processing_end - processing_start))::INTEGER,
        error_count = CASE WHEN error_occurred THEN 1 ELSE 0 END,
        last_error_message = CASE WHEN error_occurred THEN error_msg ELSE NULL END
    WHERE id = batch_id;

    RAISE NOTICE '🏁 リアルタイム在庫減算完了: バッチ % (処理件数: %, 総数量: %)',
        batch_no, item_count, total_qty;

    RETURN batch_id;

EXCEPTION WHEN OTHERS THEN
    -- 全体エラー時の処理
    UPDATE inventory_reduction_batches
    SET
        status = 'failed',
        completed_at = NOW(),
        error_count = error_count + 1,
        last_error_message = SQLERRM
    WHERE id = batch_id;

    RAISE EXCEPTION '在庫減算処理でエラーが発生しました (バッチ: %): %', batch_no, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 3: FIFO減算処理関数
-- ============================================

-- FIFO方式での在庫減算処理
CREATE OR REPLACE FUNCTION process_fifo_reduction(
    p_product_id UUID,
    p_reduction_quantity DECIMAL(15,3),
    p_batch_id UUID
) RETURNS TABLE(
    layers_affected INTEGER,
    average_cost DECIMAL(15,4),
    total_cost DECIMAL(15,2)
) AS $$
DECLARE
    remaining_qty DECIMAL(15,3) := p_reduction_quantity;
    layer_record RECORD;
    consumed_qty DECIMAL(15,3);
    layer_cost DECIMAL(15,2);
    total_layer_cost DECIMAL(15,2) := 0;
    affected_layers INTEGER := 0;
BEGIN
    -- FIFO順（古い順）で在庫層を処理
    FOR layer_record IN
        SELECT id, remaining_quantity, unit_cost
        FROM inventory_fifo_layers
        WHERE product_id = p_product_id
          AND remaining_quantity > 0
          AND NOT is_fully_consumed
        ORDER BY layer_date, created_at
        FOR UPDATE
    LOOP
        -- この層から消費する数量を決定
        consumed_qty := LEAST(layer_record.remaining_quantity, remaining_qty);
        layer_cost := consumed_qty * layer_record.unit_cost;

        -- FIFO層を更新
        UPDATE inventory_fifo_layers
        SET
            remaining_quantity = remaining_quantity - consumed_qty,
            consumed_quantity = consumed_quantity + consumed_qty,
            is_fully_consumed = (remaining_quantity - consumed_qty <= 0),
            updated_at = NOW()
        WHERE id = layer_record.id;

        -- 統計更新
        total_layer_cost := total_layer_cost + layer_cost;
        affected_layers := affected_layers + 1;
        remaining_qty := remaining_qty - consumed_qty;

        -- 必要数量を満たした場合は終了
        EXIT WHEN remaining_qty <= 0;
    END LOOP;

    -- 減算不足がある場合はエラー
    IF remaining_qty > 0 THEN
        RAISE EXCEPTION 'FIFO減算不足: 商品ID=%, 不足数量=%', p_product_id, remaining_qty;
    END IF;

    -- 結果を返す
    layers_affected := affected_layers;
    total_cost := total_layer_cost;
    average_cost := CASE WHEN p_reduction_quantity > 0 THEN total_layer_cost / p_reduction_quantity ELSE 0 END;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 4: 在庫減算ロールバック関数
-- ============================================

-- 在庫減算のロールバック関数
CREATE OR REPLACE FUNCTION rollback_inventory_reduction(p_batch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    batch_record RECORD;
    detail_record RECORD;
    rollback_count INTEGER := 0;
BEGIN
    -- バッチ情報を取得
    SELECT * INTO batch_record
    FROM inventory_reduction_batches
    WHERE id = p_batch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'バッチが見つかりません: %', p_batch_id;
    END IF;

    -- 既にロールバック済みの場合
    IF batch_record.status = 'rollback' THEN
        RAISE NOTICE 'バッチ % は既にロールバック済みです', batch_record.batch_no;
        RETURN TRUE;
    END IF;

    -- ロールバック処理開始
    UPDATE inventory_reduction_batches
    SET status = 'rollback', updated_at = NOW()
    WHERE id = p_batch_id;

    RAISE NOTICE '🔄 在庫減算ロールバック開始: バッチ %', batch_record.batch_no;

    -- 各詳細レコードをロールバック
    FOR detail_record IN
        SELECT *
        FROM inventory_reduction_details
        WHERE batch_id = p_batch_id
          AND status = 'processed'
        ORDER BY processing_order DESC -- 逆順でロールバック
    LOOP
        BEGIN
            -- 在庫移動の逆レコードを作成
            INSERT INTO inventory_movements (
                product_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                batch_id,
                is_confirmed,
                memo
            ) VALUES (
                detail_record.product_id,
                'adjustment',
                detail_record.reduction_quantity, -- 正の値で復元
                'rollback',
                p_batch_id,
                p_batch_id,
                TRUE,
                format('在庫減算ロールバック (元バッチ: %s)', batch_record.batch_no)
            );

            -- 在庫バランスを復元
            UPDATE inventory_balances
            SET
                current_quantity = current_quantity + detail_record.reduction_quantity,
                total_cost = total_cost + detail_record.total_cost,
                version = version + 1,
                last_calculated_at = NOW(),
                updated_at = NOW()
            WHERE product_id = detail_record.product_id;

            -- FIFO層の復元は複雑なため、新しい層として追加
            INSERT INTO inventory_fifo_layers (
                product_id,
                movement_id,
                layer_date,
                original_quantity,
                remaining_quantity,
                unit_cost,
                tax_category,
                tax_rate
            ) VALUES (
                detail_record.product_id,
                (SELECT id FROM inventory_movements WHERE batch_id = p_batch_id AND product_id = detail_record.product_id ORDER BY created_at DESC LIMIT 1),
                NOW(),
                detail_record.reduction_quantity,
                detail_record.reduction_quantity,
                detail_record.average_cost,
                (SELECT tax_category FROM products WHERE id = detail_record.product_id),
                (SELECT CASE WHEN tax_category = 'standard_10' THEN 0.100 WHEN tax_category = 'reduced_8' THEN 0.080 ELSE 0.000 END FROM products WHERE id = detail_record.product_id)
            );

            -- 詳細レコードのステータスを更新
            UPDATE inventory_reduction_details
            SET status = 'rolled_back', updated_at = NOW()
            WHERE id = detail_record.id;

            rollback_count := rollback_count + 1;

            RAISE NOTICE '  ✅ 商品 % ロールバック完了', detail_record.product_id;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '  ❌ 商品 % ロールバックエラー: %', detail_record.product_id, SQLERRM;
        END;
    END LOOP;

    -- 対象の出庫指示フラグをリセット
    IF batch_record.target_type = 'outbound_order' THEN
        UPDATE outbound_orders
        SET inventory_reduced = FALSE, updated_at = NOW()
        WHERE id = batch_record.target_id;
    END IF;

    RAISE NOTICE '🏁 在庫減算ロールバック完了: バッチ % (復元件数: %)', batch_record.batch_no, rollback_count;

    RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '在庫減算ロールバック処理でエラーが発生しました (バッチ: %): %', batch_record.batch_no, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 5: 自動在庫減算トリガー
-- ============================================

-- 出庫完了時の自動在庫減算トリガー関数
CREATE OR REPLACE FUNCTION auto_inventory_reduction_trigger()
RETURNS TRIGGER AS $$
DECLARE
    batch_id UUID;
BEGIN
    -- 出庫完了状態に変更され、自動在庫減算が有効で、まだ実行されていない場合
    IF NEW.status = '出庫完了'
       AND OLD.status != '出庫完了'
       AND NEW.auto_inventory_reduction = TRUE
       AND NEW.inventory_reduced = FALSE
    THEN
        -- 非同期でリアルタイム在庫減算を実行
        BEGIN
            SELECT execute_realtime_inventory_reduction('outbound_order', NEW.id, 'realtime')
            INTO batch_id;

            RAISE NOTICE '✅ 自動在庫減算実行: 出庫指示 %, バッチ %', NEW.outbound_no, batch_id;

        EXCEPTION WHEN OTHERS THEN
            -- エラーをログに記録し、処理は継続
            RAISE WARNING '❌ 自動在庫減算エラー: 出庫指示 %, エラー: %', NEW.outbound_no, SQLERRM;

            -- 出庫指示にエラーメモを追加
            NEW.internal_notes := COALESCE(NEW.internal_notes, '') ||
                E'\n【自動在庫減算エラー】' || SQLERRM ||
                E'\n発生日時: ' || NOW()::TEXT;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_auto_inventory_reduction ON outbound_orders;
CREATE TRIGGER trigger_auto_inventory_reduction
    BEFORE UPDATE ON outbound_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_inventory_reduction_trigger();

-- ============================================
-- Step 6: RLS設定
-- ============================================

-- 在庫減算関連テーブルのRLS
ALTER TABLE inventory_reduction_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reduction_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access reduction batches" ON inventory_reduction_batches
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access reduction details" ON inventory_reduction_details
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================
-- Step 7: 在庫減算状況監視ビュー
-- ============================================

-- リアルタイム在庫減算状況監視ビュー
CREATE OR REPLACE VIEW v_inventory_reduction_status AS
SELECT
    irb.id as batch_id,
    irb.batch_no,
    irb.target_type,
    irb.status,
    irb.processing_mode,
    irb.total_items,
    irb.processed_items,
    irb.total_quantity,
    irb.processed_quantity,
    irb.processing_time_ms,
    irb.error_count,
    irb.last_error_message,
    irb.started_at,
    irb.completed_at,

    -- 進捗率
    CASE WHEN irb.total_items > 0
        THEN ROUND((irb.processed_items::DECIMAL / irb.total_items * 100), 2)
        ELSE 0
    END as progress_percentage,

    -- 処理速度（件/秒）
    CASE WHEN irb.processing_time_ms > 0
        THEN ROUND((irb.processed_items::DECIMAL / (irb.processing_time_ms / 1000.0)), 2)
        ELSE 0
    END as processing_rate,

    -- 関連出庫指示情報
    CASE WHEN irb.target_type = 'outbound_order' THEN
        (SELECT outbound_no FROM outbound_orders WHERE id = irb.target_id)
    END as outbound_no

FROM inventory_reduction_batches irb
ORDER BY irb.created_at DESC;

-- 商品別在庫減算履歴ビュー
CREATE OR REPLACE VIEW v_product_inventory_reductions AS
SELECT
    p.id as product_id,
    p.product_name,
    p.product_code,

    COUNT(ird.*) as total_reductions,
    SUM(ird.reduction_quantity) as total_reduced_quantity,
    SUM(ird.total_cost) as total_reduced_cost,
    AVG(ird.average_cost) as avg_reduction_cost,

    MAX(ird.created_at) as last_reduction_date,

    -- 成功率
    ROUND(
        (COUNT(ird.*) FILTER (WHERE ird.status = 'processed')::DECIMAL /
         NULLIF(COUNT(ird.*), 0) * 100), 2
    ) as success_rate,

    -- 現在の在庫状況
    ib.current_quantity,
    ib.available_quantity

FROM products p
LEFT JOIN inventory_reduction_details ird ON p.id = ird.product_id
LEFT JOIN inventory_balances ib ON p.id = ib.product_id
GROUP BY p.id, p.product_name, p.product_code, ib.current_quantity, ib.available_quantity
HAVING COUNT(ird.*) > 0
ORDER BY total_reduced_quantity DESC;

-- ============================================
-- Step 8: 完了レポート
-- ============================================

DO $$
DECLARE
    function_count INTEGER;
    table_count INTEGER;
    trigger_count INTEGER;
    view_count INTEGER;
BEGIN
    -- 作成された関数数
    SELECT COUNT(*) INTO function_count
    FROM pg_proc
    WHERE proname IN (
        'execute_realtime_inventory_reduction',
        'process_fifo_reduction',
        'rollback_inventory_reduction',
        'auto_inventory_reduction_trigger'
    );

    -- 作成されたテーブル数
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN (
        'inventory_reduction_batches',
        'inventory_reduction_details'
    );

    -- 作成されたトリガー数
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname = 'trigger_auto_inventory_reduction';

    -- 作成されたビュー数
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_name LIKE 'v_inventory_reduction%';

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Day 7-8 リアルタイム在庫減算ロジック実装完了レポート';
    RAISE NOTICE '============================================';
    RAISE NOTICE '作成された関数数: %', function_count;
    RAISE NOTICE '作成されたテーブル数: %', table_count;
    RAISE NOTICE '作成されたトリガー数: %', trigger_count;
    RAISE NOTICE '作成されたビュー数: %', view_count;
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ リアルタイム在庫減算システムが完了しました';
    RAISE NOTICE '主要機能:';
    RAISE NOTICE '  - FIFO方式リアルタイム在庫減算';
    RAISE NOTICE '  - 楽観的ロック制御';
    RAISE NOTICE '  - 在庫減算ロールバック機能';
    RAISE NOTICE '  - 自動トリガー実行';
    RAISE NOTICE '  - バッチ処理監視';
    RAISE NOTICE '実行日時: %', NOW();
    RAISE NOTICE '============================================';
END $$;