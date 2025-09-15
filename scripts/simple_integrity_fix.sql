-- 簡単な整合性修正用関数群 (最小限版)
-- Supabase SQL Editorで実行してください

-- 1. バックアップ作成関数（簡易版）
CREATE OR REPLACE FUNCTION create_integrity_backup()
RETURNS JSONB AS $$
DECLARE
    backup_result JSONB;
    backup_time TIMESTAMP;
BEGIN
    backup_time := NOW();

    -- 簡易バックアップ情報を返す
    backup_result := jsonb_build_object(
        'success', true,
        'backup_id', 'backup_' || EXTRACT(EPOCH FROM backup_time)::TEXT,
        'timestamp', backup_time,
        'message', 'バックアップ参照IDを作成しました。重要な修正前に手動でデータをエクスポートすることを推奨します。'
    );

    RETURN backup_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 発注書金額修正関数（簡易版）
CREATE OR REPLACE FUNCTION fix_purchase_order_totals()
RETURNS JSONB AS $$
DECLARE
    result_data JSONB;
    fix_count INTEGER := 0;
BEGIN
    -- 発注書金額の修正
    WITH fixed_orders AS (
        UPDATE purchase_orders po
        SET total_amount = calculated.total
        FROM (
            SELECT
                po.id,
                COALESCE(SUM(poi.total_amount), 0) as total
            FROM purchase_orders po
            LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
            GROUP BY po.id
        ) calculated
        WHERE po.id = calculated.id
        AND ABS(po.total_amount - calculated.total) > 0.01
        RETURNING po.id
    )
    SELECT COUNT(*) INTO fix_count FROM fixed_orders;

    result_data := jsonb_build_object(
        'success', true,
        'fixed_count', fix_count,
        'message', fix_count || '件の発注書金額を修正しました'
    );

    RETURN result_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 在庫数量修正関数（簡易版）
CREATE OR REPLACE FUNCTION fix_inventory_quantities()
RETURNS JSONB AS $$
DECLARE
    result_data JSONB;
    fix_count INTEGER := 0;
BEGIN
    -- 在庫数量の修正（基本的な同期）
    WITH fixed_inventory AS (
        UPDATE products p
        SET stock_quantity = calculated.total
        FROM (
            SELECT
                product_id,
                COALESCE(SUM(
                    CASE
                        WHEN movement_type = 'in' THEN quantity
                        WHEN movement_type = 'out' THEN -quantity
                        ELSE 0
                    END
                ), 0) as total
            FROM inventory_movements
            GROUP BY product_id
        ) calculated
        WHERE p.id = calculated.product_id
        AND ABS(p.stock_quantity - calculated.total) > 0
        RETURNING p.id
    )
    SELECT COUNT(*) INTO fix_count FROM fixed_inventory;

    result_data := jsonb_build_object(
        'success', true,
        'fixed_count', fix_count,
        'message', fix_count || '件の在庫数量を修正しました'
    );

    RETURN result_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 一括修正関数
CREATE OR REPLACE FUNCTION fix_all_integrity_issues()
RETURNS JSONB AS $$
DECLARE
    result_data JSONB;
    order_result JSONB;
    inventory_result JSONB;
    total_fixed INTEGER := 0;
BEGIN
    -- 発注書修正
    SELECT fix_purchase_order_totals() INTO order_result;

    -- 在庫修正
    SELECT fix_inventory_quantities() INTO inventory_result;

    total_fixed :=
        COALESCE((order_result->>'fixed_count')::INTEGER, 0) +
        COALESCE((inventory_result->>'fixed_count')::INTEGER, 0);

    result_data := jsonb_build_object(
        'success', true,
        'total_fixed', total_fixed,
        'order_fixes', order_result,
        'inventory_fixes', inventory_result,
        'message', '整合性修正を完了しました'
    );

    RETURN result_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 実行完了メッセージ
SELECT 'システム整合性修正関数の作成が完了しました' as status;