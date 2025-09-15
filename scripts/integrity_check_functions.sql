-- ===============================================================
-- データ整合性チェック用のSupabase関数群
-- 実装日: 2025-09-14
-- 目的: フロントエンドからのデータ整合性チェック実行
-- ===============================================================

-- 1. 動的クエリ実行関数（整合性チェック用）
CREATE OR REPLACE FUNCTION execute_query(query_text TEXT)
RETURNS TABLE(result JSONB) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT to_jsonb(t) FROM (%s) t
  ', query_text);
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT to_jsonb(json_build_object(
      'error', SQLERRM,
      'query', query_text,
      'timestamp', now()
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 発注書金額整合性チェック関数
CREATE OR REPLACE FUNCTION check_purchase_order_totals()
RETURNS TABLE(
  purchase_order_id TEXT,
  order_no TEXT,
  calculated_total DECIMAL,
  stored_total DECIMAL,
  difference DECIMAL,
  item_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id::TEXT as purchase_order_id,
    po.order_no,
    SUM(poi.total_amount) as calculated_total,
    po.total_amount as stored_total,
    (SUM(poi.total_amount) - po.total_amount) as difference,
    COUNT(poi.id)::INTEGER as item_count
  FROM purchase_orders po
  JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
  GROUP BY po.id, po.order_no, po.total_amount
  HAVING ABS(SUM(poi.total_amount) - po.total_amount) > 0.01
  ORDER BY ABS(SUM(poi.total_amount) - po.total_amount) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 在庫整合性チェック関数
CREATE OR REPLACE FUNCTION check_inventory_integrity()
RETURNS TABLE(
  product_id TEXT,
  product_name TEXT,
  calculated_stock DECIMAL,
  stored_stock DECIMAL,
  difference DECIMAL,
  last_movement_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
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
      ), 0) as calculated_stock,
      MAX(im.created_at) as last_movement_date
    FROM products p
    LEFT JOIN inventory_movements im ON p.id = im.product_id
    GROUP BY p.id, p.product_name, p.current_stock
  )
  SELECT
    cs.id::TEXT as product_id,
    cs.product_name,
    cs.calculated_stock,
    cs.stored_stock,
    (cs.calculated_stock - cs.stored_stock) as difference,
    cs.last_movement_date
  FROM calculated_stock cs
  WHERE ABS(cs.calculated_stock - cs.stored_stock) > 0.01
  ORDER BY ABS(cs.calculated_stock - cs.stored_stock) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 分納整合性チェック関数
CREATE OR REPLACE FUNCTION check_delivery_integrity()
RETURNS TABLE(
  purchase_order_id TEXT,
  order_no TEXT,
  total_amount DECIMAL,
  delivered_amount DECIMAL,
  calculated_remaining DECIMAL,
  stored_remaining DECIMAL,
  difference DECIMAL,
  delivery_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH delivery_summary AS (
    SELECT
      po.id,
      po.order_no,
      po.total_amount,
      COALESCE(SUM(t.total_amount), 0) as delivered_amount,
      (po.total_amount - COALESCE(SUM(t.total_amount), 0)) as calculated_remaining,
      COALESCE(po.remaining_amount, po.total_amount) as stored_remaining,
      COUNT(t.id) as delivery_count
    FROM purchase_orders po
    LEFT JOIN transactions t ON po.id = t.parent_order_id
      AND t.transaction_type = 'installment'
      AND t.status = 'confirmed'
    WHERE po.status = 'active'
    GROUP BY po.id, po.order_no, po.total_amount, po.remaining_amount
  )
  SELECT
    ds.id::TEXT as purchase_order_id,
    ds.order_no,
    ds.total_amount,
    ds.delivered_amount,
    ds.calculated_remaining,
    ds.stored_remaining,
    ABS(ds.calculated_remaining - ds.stored_remaining) as difference,
    ds.delivery_count::INTEGER
  FROM delivery_summary ds
  WHERE ABS(ds.calculated_remaining - ds.stored_remaining) > 0.01
  ORDER BY ABS(ds.calculated_remaining - ds.stored_remaining) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 外部キー参照整合性チェック関数
CREATE OR REPLACE FUNCTION check_reference_integrity()
RETURNS TABLE(
  table_name TEXT,
  foreign_key_column TEXT,
  referenced_table TEXT,
  orphaned_count INTEGER,
  sample_orphaned_ids TEXT[]
) AS $$
BEGIN
  -- purchase_order_itemsの参照整合性
  RETURN QUERY
  SELECT
    'purchase_order_items'::TEXT,
    'purchase_order_id'::TEXT,
    'purchase_orders'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(poi.purchase_order_id::TEXT ORDER BY poi.created_at DESC)
  FROM purchase_order_items poi
  WHERE poi.purchase_order_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = poi.purchase_order_id
    )
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'purchase_order_items'::TEXT,
    'product_id'::TEXT,
    'products'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(poi.product_id::TEXT ORDER BY poi.created_at DESC)
  FROM purchase_order_items poi
  WHERE poi.product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = poi.product_id
    )
  HAVING COUNT(*) > 0;

  -- transactionsの参照整合性
  RETURN QUERY
  SELECT
    'transactions'::TEXT,
    'parent_order_id'::TEXT,
    'purchase_orders'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(t.parent_order_id::TEXT ORDER BY t.created_at DESC)
  FROM transactions t
  WHERE t.parent_order_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = t.parent_order_id
    )
  HAVING COUNT(*) > 0;

  -- inventory_movementsの参照整合性
  RETURN QUERY
  SELECT
    'inventory_movements'::TEXT,
    'product_id'::TEXT,
    'products'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(im.product_id::TEXT ORDER BY im.created_at DESC)
  FROM inventory_movements im
  WHERE im.product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = im.product_id
    )
  HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ビジネスルール違反チェック関数
CREATE OR REPLACE FUNCTION check_business_rule_violations()
RETURNS TABLE(
  rule_name TEXT,
  violation_type TEXT,
  affected_table TEXT,
  violation_count INTEGER,
  sample_record_ids TEXT[]
) AS $$
BEGIN
  -- 負の在庫数量
  RETURN QUERY
  SELECT
    'negative_stock'::TEXT,
    'invalid_quantity'::TEXT,
    'products'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(p.id::TEXT ORDER BY p.current_stock ASC)
  FROM products p
  WHERE p.current_stock < 0
  HAVING COUNT(*) > 0;

  -- 未来日付の取引
  RETURN QUERY
  SELECT
    'future_transaction_date'::TEXT,
    'invalid_date'::TEXT,
    'transactions'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(t.id::TEXT ORDER BY t.transaction_date DESC)
  FROM transactions t
  WHERE t.transaction_date > CURRENT_DATE
  HAVING COUNT(*) > 0;

  -- ゼロ金額の発注
  RETURN QUERY
  SELECT
    'zero_amount_order'::TEXT,
    'invalid_amount'::TEXT,
    'purchase_orders'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(po.id::TEXT ORDER BY po.total_amount ASC)
  FROM purchase_orders po
  WHERE po.total_amount <= 0
  HAVING COUNT(*) > 0;

  -- 期限切れ発注の未完了
  RETURN QUERY
  SELECT
    'overdue_incomplete_orders'::TEXT,
    'business_logic_violation'::TEXT,
    'purchase_orders'::TEXT,
    COUNT(*)::INTEGER,
    ARRAY_AGG(po.id::TEXT ORDER BY po.delivery_deadline ASC)
  FROM purchase_orders po
  WHERE po.delivery_deadline < CURRENT_DATE
    AND po.status = 'active'
    AND COALESCE(po.remaining_amount, po.total_amount) > 0
  HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. データ品質問題チェック関数
CREATE OR REPLACE FUNCTION check_data_quality_issues()
RETURNS TABLE(
  table_name TEXT,
  column_name TEXT,
  issue_type TEXT,
  affected_count INTEGER,
  total_records INTEGER,
  percentage DECIMAL,
  sample_values TEXT[]
) AS $$
BEGIN
  -- 重複商品コード
  RETURN QUERY
  SELECT
    'products'::TEXT,
    'product_code'::TEXT,
    'duplicate_values'::TEXT,
    COUNT(*) - COUNT(DISTINCT p.product_code),
    COUNT(*)::INTEGER,
    ROUND(((COUNT(*) - COUNT(DISTINCT p.product_code))::DECIMAL / COUNT(*)) * 100, 2),
    ARRAY_AGG(DISTINCT p.product_code ORDER BY p.product_code) FILTER (WHERE p.product_code IN (
      SELECT product_code FROM products GROUP BY product_code HAVING COUNT(*) > 1
    ))
  FROM products p
  HAVING COUNT(*) - COUNT(DISTINCT p.product_code) > 0;

  -- 空の必須フィールド（商品）
  RETURN QUERY
  SELECT
    'products'::TEXT,
    'required_fields'::TEXT,
    'null_values'::TEXT,
    COUNT(*)::INTEGER,
    (SELECT COUNT(*) FROM products)::INTEGER,
    ROUND((COUNT(*)::DECIMAL / (SELECT COUNT(*) FROM products)) * 100, 2),
    ARRAY_AGG(p.id::TEXT ORDER BY p.created_at DESC)
  FROM products p
  WHERE p.product_name IS NULL OR p.product_name = '' OR p.product_code IS NULL OR p.product_code = ''
  HAVING COUNT(*) > 0;

  -- 無効な価格データ
  RETURN QUERY
  SELECT
    'products'::TEXT,
    'price_fields'::TEXT,
    'invalid_format'::TEXT,
    COUNT(*)::INTEGER,
    (SELECT COUNT(*) FROM products)::INTEGER,
    ROUND((COUNT(*)::DECIMAL / (SELECT COUNT(*) FROM products)) * 100, 2),
    ARRAY_AGG(p.id::TEXT ORDER BY p.purchase_price ASC, p.selling_price ASC)
  FROM products p
  WHERE p.purchase_price < 0 OR p.selling_price < 0
  HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 統合整合性サマリー関数
CREATE OR REPLACE FUNCTION get_integrity_summary()
RETURNS TABLE(
  category TEXT,
  total_checks INTEGER,
  critical_issues INTEGER,
  warning_issues INTEGER,
  info_issues INTEGER,
  last_check TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'financial'::TEXT,
    1::INTEGER,
    (SELECT COUNT(*) FROM check_purchase_order_totals())::INTEGER,
    0::INTEGER,
    0::INTEGER,
    NOW();

  RETURN QUERY
  SELECT
    'inventory'::TEXT,
    1::INTEGER,
    0::INTEGER,
    (SELECT COUNT(*) FROM check_inventory_integrity())::INTEGER,
    0::INTEGER,
    NOW();

  RETURN QUERY
  SELECT
    'delivery'::TEXT,
    1::INTEGER,
    (SELECT COUNT(*) FROM check_delivery_integrity())::INTEGER,
    0::INTEGER,
    0::INTEGER,
    NOW();

  RETURN QUERY
  SELECT
    'reference'::TEXT,
    4::INTEGER,
    (SELECT COUNT(*) FROM check_reference_integrity())::INTEGER,
    0::INTEGER,
    0::INTEGER,
    NOW();

  RETURN QUERY
  SELECT
    'business_rule'::TEXT,
    4::INTEGER,
    0::INTEGER,
    (SELECT COUNT(*) FROM check_business_rule_violations())::INTEGER,
    0::INTEGER,
    NOW();

  RETURN QUERY
  SELECT
    'data_quality'::TEXT,
    3::INTEGER,
    0::INTEGER,
    0::INTEGER,
    (SELECT COUNT(*) FROM check_data_quality_issues())::INTEGER,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 関数作成完了の通知
SELECT 'データ整合性チェック関数の作成が完了しました。' as message;

-- 関数の権限設定（必要に応じて調整）
-- GRANT EXECUTE ON FUNCTION execute_query(TEXT) TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_purchase_order_totals() TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_inventory_integrity() TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_delivery_integrity() TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_reference_integrity() TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_business_rule_violations() TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_data_quality_issues() TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_integrity_summary() TO authenticated;