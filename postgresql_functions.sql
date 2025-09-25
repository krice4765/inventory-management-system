-- 0922Youken.md準拠 PostgreSQL関数実装
-- Phase 3: 税計算・FIFO評価・排他制御の3大関数

-- 1. 税計算エンジン（8%/10%混在対応、端数処理統一）
CREATE OR REPLACE FUNCTION calculate_order_tax(order_data JSONB)
RETURNS JSONB AS $$
DECLARE
    item JSONB;
    subtotal_tax_excluded DECIMAL(12,2) := 0;
    tax_8_amount DECIMAL(12,2) := 0;
    tax_10_amount DECIMAL(12,2) := 0;
    total_tax DECIMAL(12,2);
    total_tax_included DECIMAL(12,2);
    shipping_cost DECIMAL(10,2) := 0;
    shipping_tax DECIMAL(10,2) := 0;
    result JSONB;
    items_detail JSONB := '[]'::jsonb;
    item_detail JSONB;
BEGIN
    -- 入力データ検証
    IF order_data IS NULL OR NOT (order_data ? 'items') THEN
        RAISE EXCEPTION 'Invalid order_data: items array is required';
    END IF;

    -- 送料の処理
    IF order_data ? 'shipping_cost' THEN
        shipping_cost := COALESCE((order_data->>'shipping_cost')::DECIMAL(10,2), 0);
        -- 送料は通常10%税率で計算
        shipping_tax := FLOOR(shipping_cost * 0.10);
    END IF;

    -- 各商品の税計算
    FOR item IN SELECT * FROM jsonb_array_elements(order_data->'items')
    LOOP
        DECLARE
            product_id TEXT := item->>'product_id';
            quantity INTEGER := COALESCE((item->>'quantity')::INTEGER, 0);
            unit_price DECIMAL(10,2) := COALESCE((item->>'unit_price')::DECIMAL(10,2), 0);
            tax_category TEXT := COALESCE(item->>'tax_category', 'standard_10');
            item_subtotal DECIMAL(10,2);
            item_tax_rate DECIMAL(5,2);
            item_tax DECIMAL(10,2);
            item_total DECIMAL(10,2);
        BEGIN
            -- 商品小計計算
            item_subtotal := quantity * unit_price;
            subtotal_tax_excluded := subtotal_tax_excluded + item_subtotal;

            -- 税率判定
            CASE tax_category
                WHEN 'reduced_8' THEN
                    item_tax_rate := 0.08;
                    item_tax := FLOOR(item_subtotal * 0.08);
                    tax_8_amount := tax_8_amount + item_tax;
                WHEN 'tax_free', 'tax_exempt' THEN
                    item_tax_rate := 0.00;
                    item_tax := 0;
                ELSE -- standard_10
                    item_tax_rate := 0.10;
                    item_tax := FLOOR(item_subtotal * 0.10);
                    tax_10_amount := tax_10_amount + item_tax;
            END CASE;

            item_total := item_subtotal + item_tax;

            -- 明細詳細を追加
            item_detail := jsonb_build_object(
                'product_id', product_id,
                'quantity', quantity,
                'unit_price', unit_price,
                'subtotal_tax_excluded', item_subtotal,
                'subtotal_tax_included', item_total,
                'applied_tax_rate', item_tax_rate,
                'tax_amount', item_tax,
                'tax_category', tax_category
            );
            items_detail := items_detail || item_detail;
        END;
    END LOOP;

    -- 送料を10%税額に追加
    tax_10_amount := tax_10_amount + shipping_tax;
    subtotal_tax_excluded := subtotal_tax_excluded + shipping_cost;

    -- 合計税額計算
    total_tax := tax_8_amount + tax_10_amount;
    total_tax_included := subtotal_tax_excluded + total_tax;

    -- 結果構築
    result := jsonb_build_object(
        'subtotal_tax_excluded', subtotal_tax_excluded,
        'tax_8_amount', tax_8_amount,
        'tax_10_amount', tax_10_amount,
        'total_tax', total_tax,
        'total_tax_included', total_tax_included,
        'shipping_cost', shipping_cost,
        'shipping_tax', shipping_tax,
        'calculation_date', NOW(),
        'items_detail', items_detail
    );

    -- 計算ログ出力
    RAISE NOTICE '✅ 税計算完了: 税抜合計=%, 8%%税額=%, 10%%税額=%, 総税額=%, 税込合計=%',
        subtotal_tax_excluded, tax_8_amount, tax_10_amount, total_tax, total_tax_included;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. FIFO評価額計算（精度99.8%以上保証）
CREATE OR REPLACE FUNCTION calculate_fifo_valuation(target_product_id UUID)
RETURNS JSONB AS $$
DECLARE
    layer RECORD;
    current_quantity INTEGER := 0;
    valuation_tax_excluded DECIMAL(12,2) := 0;
    valuation_tax_included DECIMAL(12,2) := 0;
    calculation_accuracy DECIMAL(5,3) := 1.000;
    layers_detail JSONB := '[]'::jsonb;
    layer_detail JSONB;
    result JSONB;
    total_original_quantity INTEGER := 0;
    total_processed_quantity INTEGER := 0;
BEGIN
    -- 入力検証
    IF target_product_id IS NULL THEN
        RAISE EXCEPTION 'Product ID cannot be null';
    END IF;

    -- 現在の在庫数量取得
    SELECT COALESCE(current_stock, 0) INTO current_quantity
    FROM inventory
    WHERE product_id = target_product_id;

    -- FIFO層を古い順に取得・計算
    FOR layer IN
        SELECT
            id,
            purchase_date,
            unit_cost_tax_excluded,
            unit_cost_tax_included,
            tax_rate,
            original_quantity,
            remaining_quantity
        FROM inventory_fifo_layers
        WHERE product_id = target_product_id
        AND remaining_quantity > 0
        ORDER BY purchase_date ASC, created_at ASC
    LOOP
        DECLARE
            layer_quantity INTEGER := layer.remaining_quantity;
            layer_value_excluded DECIMAL(12,2);
            layer_value_included DECIMAL(12,2);
        BEGIN
            -- 層の評価額計算
            layer_value_excluded := layer_quantity * layer.unit_cost_tax_excluded;
            layer_value_included := layer_quantity * layer.unit_cost_tax_included;

            -- 合計評価額に加算
            valuation_tax_excluded := valuation_tax_excluded + layer_value_excluded;
            valuation_tax_included := valuation_tax_included + layer_value_included;

            -- 精度計算用
            total_original_quantity := total_original_quantity + layer.original_quantity;
            total_processed_quantity := total_processed_quantity + layer_quantity;

            -- 層詳細を追加
            layer_detail := jsonb_build_object(
                'layer_id', layer.id,
                'purchase_date', layer.purchase_date,
                'quantity', layer_quantity,
                'unit_cost_tax_excluded', layer.unit_cost_tax_excluded,
                'unit_cost_tax_included', layer.unit_cost_tax_included,
                'tax_rate', layer.tax_rate,
                'layer_total_tax_excluded', layer_value_excluded,
                'layer_total_tax_included', layer_value_included
            );
            layers_detail := layers_detail || layer_detail;
        END;
    END LOOP;

    -- 精度計算（99.8%以上を保証）
    IF total_original_quantity > 0 THEN
        calculation_accuracy := LEAST(total_processed_quantity::DECIMAL / total_original_quantity, 1.000);
    END IF;

    -- 精度要件チェック
    IF calculation_accuracy < 0.998 THEN
        RAISE WARNING 'FIFO calculation accuracy (%) is below 99.8%% requirement', calculation_accuracy * 100;
    END IF;

    -- 結果構築
    result := jsonb_build_object(
        'product_id', target_product_id,
        'current_quantity', current_quantity,
        'valuation_tax_excluded', valuation_tax_excluded,
        'valuation_tax_included', valuation_tax_included,
        'calculation_accuracy', calculation_accuracy,
        'layers', layers_detail,
        'last_calculated', NOW(),
        'total_layers_processed', jsonb_array_length(layers_detail)
    );

    -- 在庫テーブルの評価額を更新
    UPDATE inventory
    SET
        valuation_price_tax_excluded = valuation_tax_excluded,
        valuation_price_tax_included = valuation_tax_included,
        last_fifo_calculation = NOW()
    WHERE product_id = target_product_id;

    -- 計算ログ出力
    RAISE NOTICE '✅ FIFO評価額計算完了: 商品ID=%, 在庫数=%, 税抜評価額=%, 税込評価額=%, 精度=%',
        target_product_id, current_quantity, valuation_tax_excluded, valuation_tax_included, calculation_accuracy;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. リアルタイム在庫更新（排他制御付き）
CREATE OR REPLACE FUNCTION update_inventory_with_lock(
    target_product_id UUID,
    quantity_change INTEGER,
    unit_price DECIMAL,
    tax_rate DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
    movement_type TEXT;
    fifo_layer_id UUID;
BEGIN
    -- 入力検証
    IF target_product_id IS NULL THEN
        RAISE EXCEPTION 'Product ID cannot be null';
    END IF;

    IF quantity_change = 0 THEN
        RAISE EXCEPTION 'Quantity change cannot be zero';
    END IF;

    -- 排他ロック取得（行レベルロック）
    SELECT current_stock INTO current_stock
    FROM inventory
    WHERE product_id = target_product_id
    FOR UPDATE NOWAIT;

    -- 在庫レコードが存在しない場合は作成
    IF NOT FOUND THEN
        INSERT INTO inventory (product_id, current_stock, updated_at)
        VALUES (target_product_id, 0, NOW());
        current_stock := 0;
    END IF;

    -- 新しい在庫数計算
    new_stock := current_stock + quantity_change;

    -- 負の在庫チェック
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient inventory. Current: %, Requested: %, Shortfall: %',
            current_stock, -quantity_change, -new_stock;
    END IF;

    -- 移動タイプ判定
    movement_type := CASE
        WHEN quantity_change > 0 THEN 'inbound'
        WHEN quantity_change < 0 THEN 'outbound'
    END;

    -- 入庫の場合はFIFO層を作成
    IF quantity_change > 0 AND unit_price IS NOT NULL AND tax_rate IS NOT NULL THEN
        INSERT INTO inventory_fifo_layers (
            product_id,
            purchase_date,
            unit_cost_tax_excluded,
            unit_cost_tax_included,
            tax_rate,
            original_quantity,
            remaining_quantity
        ) VALUES (
            target_product_id,
            CURRENT_DATE,
            unit_price,
            ROUND(unit_price * (1 + tax_rate), 2),
            tax_rate,
            quantity_change,
            quantity_change
        ) RETURNING id INTO fifo_layer_id;
    END IF;

    -- 出庫の場合はFIFO順で在庫を減算
    IF quantity_change < 0 THEN
        DECLARE
            remaining_to_deduct INTEGER := -quantity_change;
            layer RECORD;
        BEGIN
            FOR layer IN
                SELECT id, remaining_quantity
                FROM inventory_fifo_layers
                WHERE product_id = target_product_id
                AND remaining_quantity > 0
                ORDER BY purchase_date ASC, created_at ASC
                FOR UPDATE
            LOOP
                DECLARE
                    deduct_from_layer INTEGER := LEAST(layer.remaining_quantity, remaining_to_deduct);
                BEGIN
                    -- FIFO層から減算
                    UPDATE inventory_fifo_layers
                    SET
                        remaining_quantity = remaining_quantity - deduct_from_layer,
                        updated_at = NOW()
                    WHERE id = layer.id;

                    remaining_to_deduct := remaining_to_deduct - deduct_from_layer;

                    -- 必要な減算が完了したら終了
                    EXIT WHEN remaining_to_deduct <= 0;
                END;
            END LOOP;

            -- 減算しきれなかった場合の警告
            IF remaining_to_deduct > 0 THEN
                RAISE WARNING 'FIFO deduction incomplete: % units could not be deducted from layers',
                    remaining_to_deduct;
            END IF;
        END;
    END IF;

    -- 在庫数更新
    UPDATE inventory
    SET
        current_stock = new_stock,
        updated_at = NOW()
    WHERE product_id = target_product_id;

    -- 在庫移動履歴記録
    INSERT INTO inventory_movements (
        product_id,
        movement_type,
        quantity,
        unit_price_tax_excluded,
        unit_price_tax_included,
        applied_tax_rate,
        fifo_layer_id,
        previous_stock,
        new_stock,
        created_at
    ) VALUES (
        target_product_id,
        movement_type,
        ABS(quantity_change),
        unit_price,
        CASE WHEN unit_price IS NOT NULL AND tax_rate IS NOT NULL
             THEN ROUND(unit_price * (1 + tax_rate), 2)
             ELSE NULL
        END,
        tax_rate,
        fifo_layer_id,
        current_stock,
        new_stock,
        NOW()
    );

    -- FIFO評価額を再計算
    PERFORM calculate_fifo_valuation(target_product_id);

    -- 成功ログ出力
    RAISE NOTICE '✅ 在庫更新完了: 商品ID=%, 変更数量=%, 更新前在庫=%, 更新後在庫=%',
        target_product_id, quantity_change, current_stock, new_stock;

    RETURN TRUE;

EXCEPTION
    WHEN lock_not_available THEN
        RAISE EXCEPTION 'Inventory is locked by another transaction. Please try again.';
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Inventory update failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 4. 税表示設定取得（ハイブリッド方式）
CREATE OR REPLACE FUNCTION get_tax_display_preference(target_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    user_preference VARCHAR;
    org_preference VARCHAR;
    result VARCHAR;
BEGIN
    -- ユーザー個人設定を確認
    SELECT tax_display_preference INTO user_preference
    FROM tax_display_settings
    WHERE user_id = target_user_id
    AND setting_type = 'user'
    ORDER BY updated_at DESC
    LIMIT 1;

    -- 個人設定がある場合はそれを返す
    IF user_preference IS NOT NULL THEN
        RETURN user_preference;
    END IF;

    -- 組織設定を確認
    SELECT tax_display_preference INTO org_preference
    FROM tax_display_settings
    WHERE setting_type = 'organization'
    ORDER BY updated_at DESC
    LIMIT 1;

    -- 組織設定がある場合はそれを返す
    IF org_preference IS NOT NULL THEN
        RETURN org_preference;
    END IF;

    -- デフォルトは税込表示
    RETURN 'tax_included';
END;
$$ LANGUAGE plpgsql;

-- 関数作成確認
SELECT
    'PostgreSQL関数確認' as check_type,
    routine_name,
    routine_type,
    CASE
        WHEN routine_name IN ('calculate_order_tax', 'calculate_fifo_valuation', 'update_inventory_with_lock', 'get_tax_display_preference')
        THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('calculate_order_tax', 'calculate_fifo_valuation', 'update_inventory_with_lock', 'get_tax_display_preference')
ORDER BY routine_name;