-- ===============================================================
-- データ整合性修正用のSupabase関数群
-- 実装日: 2025-09-15
-- 目的: 検出された整合性問題の安全な修正
-- ===============================================================

-- 1. 発注書金額修正関数（最優先）
CREATE OR REPLACE FUNCTION fix_purchase_order_totals()
RETURNS TABLE(
  fixed_count INTEGER,
  error_count INTEGER,
  total_difference DECIMAL,
  max_difference DECIMAL,
  details JSONB
) AS $$
DECLARE
  fix_count INTEGER := 0;
  err_count INTEGER := 0;
  total_diff DECIMAL := 0;
  max_diff DECIMAL := 0;
  fix_details JSONB := '[]'::JSONB;
  po_record RECORD;
  calculated_total DECIMAL;
  current_diff DECIMAL;
BEGIN
  -- 修正対象の発注書を取得
  FOR po_record IN
    SELECT
      po.id,
      po.order_no,
      po.total_amount as stored_total,
      SUM(poi.total_amount) as calculated_total,
      ABS(SUM(poi.total_amount) - po.total_amount) as difference
    FROM purchase_orders po
    JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING ABS(SUM(poi.total_amount) - po.total_amount) > 0.01
    ORDER BY ABS(SUM(poi.total_amount) - po.total_amount) DESC
  LOOP
    BEGIN
      calculated_total := po_record.calculated_total;
      current_diff := po_record.difference;

      -- 発注書の総額を修正
      UPDATE purchase_orders
      SET
        total_amount = calculated_total,
        remaining_amount = CASE
          WHEN remaining_amount IS NOT NULL THEN
            GREATEST(0, calculated_total - (total_amount - COALESCE(remaining_amount, 0)))
          ELSE calculated_total
        END,
        updated_at = NOW()
      WHERE id = po_record.id;

      -- 成功カウント増加
      fix_count := fix_count + 1;
      total_diff := total_diff + current_diff;
      max_diff := GREATEST(max_diff, current_diff);

      -- 修正詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'purchase_order_id', po_record.id,
        'order_no', po_record.order_no,
        'old_total', po_record.stored_total,
        'new_total', calculated_total,
        'difference', current_diff,
        'fixed_at', NOW()
      );

    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;

      -- エラー詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'purchase_order_id', po_record.id,
        'order_no', po_record.order_no,
        'error', SQLERRM,
        'failed_at', NOW()
      );
    END;
  END LOOP;

  -- 結果を返す
  RETURN QUERY SELECT
    fix_count,
    err_count,
    total_diff,
    max_diff,
    fix_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 在庫数量修正関数
CREATE OR REPLACE FUNCTION fix_inventory_quantities()
RETURNS TABLE(
  fixed_count INTEGER,
  error_count INTEGER,
  total_adjustments DECIMAL,
  details JSONB
) AS $$
DECLARE
  fix_count INTEGER := 0;
  err_count INTEGER := 0;
  total_adj DECIMAL := 0;
  fix_details JSONB := '[]'::JSONB;
  inv_record RECORD;
  calculated_stock DECIMAL;
  adjustment_amount DECIMAL;
BEGIN
  -- 修正対象の商品を取得
  FOR inv_record IN
    WITH calculated_stock AS (
      SELECT
        p.id,
        p.product_name,
        p.current_stock as stored_stock,
        COALESCE(SUM(
          CASE
            WHEN im.movement_type = 'in' THEN im.quantity
            WHEN im.movement_type = 'out' THEN -im.quantity
            ELSE 0
          END
        ), 0) as calculated_stock
      FROM products p
      LEFT JOIN inventory_movements im ON p.id = im.product_id
      GROUP BY p.id, p.product_name, p.current_stock
    )
    SELECT
      id,
      product_name,
      calculated_stock,
      stored_stock,
      (calculated_stock - stored_stock) as difference
    FROM calculated_stock
    WHERE ABS(calculated_stock - stored_stock) > 0.01
    ORDER BY ABS(calculated_stock - stored_stock) DESC
  LOOP
    BEGIN
      calculated_stock := inv_record.calculated_stock;
      adjustment_amount := inv_record.difference;

      -- 商品の在庫数量を修正
      UPDATE products
      SET
        current_stock = calculated_stock,
        updated_at = NOW()
      WHERE id = inv_record.id;

      -- 調整履歴を記録
      INSERT INTO inventory_movements (
        product_id,
        movement_type,
        quantity,
        reason,
        notes,
        created_at
      ) VALUES (
        inv_record.id,
        CASE WHEN adjustment_amount > 0 THEN 'in' ELSE 'out' END,
        ABS(adjustment_amount),
        'integrity_correction',
        format('自動整合性修正: 差異 %s', adjustment_amount),
        NOW()
      );

      -- 成功カウント増加
      fix_count := fix_count + 1;
      total_adj := total_adj + ABS(adjustment_amount);

      -- 修正詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'product_id', inv_record.id,
        'product_name', inv_record.product_name,
        'old_stock', inv_record.stored_stock,
        'new_stock', calculated_stock,
        'adjustment', adjustment_amount,
        'fixed_at', NOW()
      );

    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;

      -- エラー詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'product_id', inv_record.id,
        'product_name', inv_record.product_name,
        'error', SQLERRM,
        'failed_at', NOW()
      );
    END;
  END LOOP;

  -- 結果を返す
  RETURN QUERY SELECT
    fix_count,
    err_count,
    total_adj,
    fix_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 分納残額修正関数
CREATE OR REPLACE FUNCTION fix_delivery_remaining_amounts()
RETURNS TABLE(
  fixed_count INTEGER,
  error_count INTEGER,
  total_corrections DECIMAL,
  details JSONB
) AS $$
DECLARE
  fix_count INTEGER := 0;
  err_count INTEGER := 0;
  total_corr DECIMAL := 0;
  fix_details JSONB := '[]'::JSONB;
  del_record RECORD;
  calculated_remaining DECIMAL;
  correction_amount DECIMAL;
BEGIN
  -- 修正対象の発注書を取得
  FOR del_record IN
    WITH delivery_summary AS (
      SELECT
        po.id,
        po.order_no,
        po.total_amount,
        COALESCE(SUM(t.total_amount), 0) as delivered_amount,
        (po.total_amount - COALESCE(SUM(t.total_amount), 0)) as calculated_remaining,
        COALESCE(po.remaining_amount, po.total_amount) as stored_remaining
      FROM purchase_orders po
      LEFT JOIN transactions t ON po.id = t.parent_order_id
        AND t.transaction_type = 'installment'
        AND t.status = 'confirmed'
      WHERE po.status = 'active'
      GROUP BY po.id, po.order_no, po.total_amount, po.remaining_amount
    )
    SELECT
      id,
      order_no,
      total_amount,
      delivered_amount,
      calculated_remaining,
      stored_remaining,
      ABS(calculated_remaining - stored_remaining) as difference
    FROM delivery_summary
    WHERE ABS(calculated_remaining - stored_remaining) > 0.01
    ORDER BY ABS(calculated_remaining - stored_remaining) DESC
  LOOP
    BEGIN
      calculated_remaining := del_record.calculated_remaining;
      correction_amount := del_record.difference;

      -- 発注書の残額を修正
      UPDATE purchase_orders
      SET
        remaining_amount = calculated_remaining,
        updated_at = NOW()
      WHERE id = del_record.id;

      -- 成功カウント増加
      fix_count := fix_count + 1;
      total_corr := total_corr + correction_amount;

      -- 修正詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'purchase_order_id', del_record.id,
        'order_no', del_record.order_no,
        'total_amount', del_record.total_amount,
        'delivered_amount', del_record.delivered_amount,
        'old_remaining', del_record.stored_remaining,
        'new_remaining', calculated_remaining,
        'correction', correction_amount,
        'fixed_at', NOW()
      );

    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;

      -- エラー詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'purchase_order_id', del_record.id,
        'order_no', del_record.order_no,
        'error', SQLERRM,
        'failed_at', NOW()
      );
    END;
  END LOOP;

  -- 結果を返す
  RETURN QUERY SELECT
    fix_count,
    err_count,
    total_corr,
    fix_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 発注アイテム金額修正関数
CREATE OR REPLACE FUNCTION fix_purchase_order_item_totals()
RETURNS TABLE(
  fixed_count INTEGER,
  error_count INTEGER,
  total_adjustments DECIMAL,
  details JSONB
) AS $$
DECLARE
  fix_count INTEGER := 0;
  err_count INTEGER := 0;
  total_adj DECIMAL := 0;
  fix_details JSONB := '[]'::JSONB;
  item_record RECORD;
  calculated_total DECIMAL;
  adjustment DECIMAL;
BEGIN
  -- 修正対象のアイテムを取得
  FOR item_record IN
    SELECT
      poi.id,
      poi.purchase_order_id,
      po.order_no,
      p.product_name,
      poi.quantity,
      poi.unit_price,
      poi.total_amount as stored_total,
      (poi.quantity * poi.unit_price) as calculated_total,
      ABS((poi.quantity * poi.unit_price) - poi.total_amount) as difference
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    JOIN products p ON poi.product_id = p.id
    WHERE ABS((poi.quantity * poi.unit_price) - poi.total_amount) > 0.01
    ORDER BY ABS((poi.quantity * poi.unit_price) - poi.total_amount) DESC
  LOOP
    BEGIN
      calculated_total := item_record.calculated_total;
      adjustment := item_record.difference;

      -- アイテムの総額を修正
      UPDATE purchase_order_items
      SET
        total_amount = calculated_total,
        updated_at = NOW()
      WHERE id = item_record.id;

      -- 成功カウント増加
      fix_count := fix_count + 1;
      total_adj := total_adj + adjustment;

      -- 修正詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'item_id', item_record.id,
        'purchase_order_id', item_record.purchase_order_id,
        'order_no', item_record.order_no,
        'product_name', item_record.product_name,
        'quantity', item_record.quantity,
        'unit_price', item_record.unit_price,
        'old_total', item_record.stored_total,
        'new_total', calculated_total,
        'adjustment', adjustment,
        'fixed_at', NOW()
      );

    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;

      -- エラー詳細を記録
      fix_details := fix_details || jsonb_build_object(
        'item_id', item_record.id,
        'error', SQLERRM,
        'failed_at', NOW()
      );
    END;
  END LOOP;

  -- 結果を返す
  RETURN QUERY SELECT
    fix_count,
    err_count,
    total_adj,
    fix_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 全体修正実行関数（ワンクリック修正）
CREATE OR REPLACE FUNCTION fix_all_integrity_issues()
RETURNS TABLE(
  category TEXT,
  fixed_count INTEGER,
  error_count INTEGER,
  total_impact DECIMAL,
  execution_time_ms INTEGER,
  details JSONB
) AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  exec_time INTEGER;
  result_record RECORD;
BEGIN
  -- 1. 発注アイテム金額修正（先に実行）
  start_time := clock_timestamp();
  FOR result_record IN SELECT * FROM fix_purchase_order_item_totals() LOOP
    end_time := clock_timestamp();
    exec_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;

    RETURN QUERY SELECT
      'purchase_order_items'::TEXT,
      result_record.fixed_count,
      result_record.error_count,
      result_record.total_adjustments,
      exec_time,
      result_record.details;
  END LOOP;

  -- 2. 発注書金額修正
  start_time := clock_timestamp();
  FOR result_record IN SELECT * FROM fix_purchase_order_totals() LOOP
    end_time := clock_timestamp();
    exec_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;

    RETURN QUERY SELECT
      'purchase_orders'::TEXT,
      result_record.fixed_count,
      result_record.error_count,
      result_record.total_difference,
      exec_time,
      result_record.details;
  END LOOP;

  -- 3. 分納残額修正
  start_time := clock_timestamp();
  FOR result_record IN SELECT * FROM fix_delivery_remaining_amounts() LOOP
    end_time := clock_timestamp();
    exec_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;

    RETURN QUERY SELECT
      'delivery_remaining'::TEXT,
      result_record.fixed_count,
      result_record.error_count,
      result_record.total_corrections,
      exec_time,
      result_record.details;
  END LOOP;

  -- 4. 在庫数量修正
  start_time := clock_timestamp();
  FOR result_record IN SELECT * FROM fix_inventory_quantities() LOOP
    end_time := clock_timestamp();
    exec_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;

    RETURN QUERY SELECT
      'inventory_quantities'::TEXT,
      result_record.fixed_count,
      result_record.error_count,
      result_record.total_adjustments,
      exec_time,
      result_record.details;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. バックアップ作成関数
CREATE OR REPLACE FUNCTION create_integrity_backup()
RETURNS TABLE(
  backup_table TEXT,
  record_count INTEGER,
  backup_timestamp TIMESTAMP WITH TIME ZONE,
  success BOOLEAN
) AS $$
DECLARE
  backup_suffix TEXT;
  sql_command TEXT;
  record_cnt INTEGER;
BEGIN
  backup_suffix := to_char(NOW(), 'YYYYMMDD_HH24MISS');

  -- purchase_orders バックアップ
  BEGIN
    sql_command := format('CREATE TABLE backup_purchase_orders_%s AS SELECT * FROM purchase_orders', backup_suffix);
    EXECUTE sql_command;
    EXECUTE format('SELECT COUNT(*) FROM backup_purchase_orders_%s', backup_suffix) INTO record_cnt;

    RETURN QUERY SELECT
      format('backup_purchase_orders_%s', backup_suffix)::TEXT,
      record_cnt,
      NOW(),
      TRUE;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      format('backup_purchase_orders_%s', backup_suffix)::TEXT,
      0,
      NOW(),
      FALSE;
  END;

  -- products バックアップ
  BEGIN
    sql_command := format('CREATE TABLE backup_products_%s AS SELECT * FROM products', backup_suffix);
    EXECUTE sql_command;
    EXECUTE format('SELECT COUNT(*) FROM backup_products_%s', backup_suffix) INTO record_cnt;

    RETURN QUERY SELECT
      format('backup_products_%s', backup_suffix)::TEXT,
      record_cnt,
      NOW(),
      TRUE;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      format('backup_products_%s', backup_suffix)::TEXT,
      0,
      NOW(),
      FALSE;
  END;

  -- purchase_order_items バックアップ
  BEGIN
    sql_command := format('CREATE TABLE backup_purchase_order_items_%s AS SELECT * FROM purchase_order_items', backup_suffix);
    EXECUTE sql_command;
    EXECUTE format('SELECT COUNT(*) FROM backup_purchase_order_items_%s', backup_suffix) INTO record_cnt;

    RETURN QUERY SELECT
      format('backup_purchase_order_items_%s', backup_suffix)::TEXT,
      record_cnt,
      NOW(),
      TRUE;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      format('backup_purchase_order_items_%s', backup_suffix)::TEXT,
      0,
      NOW(),
      FALSE;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 権限設定（認証ユーザーに実行権限を付与）
-- GRANT EXECUTE ON FUNCTION fix_purchase_order_totals() TO authenticated;
-- GRANT EXECUTE ON FUNCTION fix_inventory_quantities() TO authenticated;
-- GRANT EXECUTE ON FUNCTION fix_delivery_remaining_amounts() TO authenticated;
-- GRANT EXECUTE ON FUNCTION fix_purchase_order_item_totals() TO authenticated;
-- GRANT EXECUTE ON FUNCTION fix_all_integrity_issues() TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_integrity_backup() TO authenticated;

-- コメント追加
COMMENT ON FUNCTION fix_purchase_order_totals() IS '発注書金額の不整合を修正する関数';
COMMENT ON FUNCTION fix_inventory_quantities() IS '在庫数量の不整合を修正する関数';
COMMENT ON FUNCTION fix_delivery_remaining_amounts() IS '分納残額の不整合を修正する関数';
COMMENT ON FUNCTION fix_purchase_order_item_totals() IS '発注アイテム金額の不整合を修正する関数';
COMMENT ON FUNCTION fix_all_integrity_issues() IS '全ての整合性問題を一括修正する関数';
COMMENT ON FUNCTION create_integrity_backup() IS 'データ修正前のバックアップを作成する関数';