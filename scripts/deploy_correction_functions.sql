-- ===============================================================
-- 整合性修正関数のデプロイメントスクリプト
-- 実行日: 2025-09-15
-- 目的: Supabaseデータベースに修正関数を配置
-- ===============================================================

-- 実行前確認
SELECT 'データベース整合性修正関数のデプロイを開始します' as message;
SELECT current_database(), current_user, now() as deployment_info;

-- 1. 既存の関数を確認
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%fix_%'
ORDER BY routine_name;

-- 2. 必要な権限を確認
SELECT has_function_privilege(current_user, 'execute_query(text)', 'execute') as can_execute_query;
SELECT has_function_privilege(current_user, 'check_purchase_order_totals()', 'execute') as can_check_orders;

-- 3. テーブル存在確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('purchase_orders', 'purchase_order_items', 'products', 'inventory_movements', 'transactions')
ORDER BY table_name;

-- 4. 修正対象データの事前確認
SELECT 'Purchase Order Totals Issues' as check_type, COUNT(*) as issue_count
FROM (
  SELECT po.id
  FROM purchase_orders po
  JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
  GROUP BY po.id, po.total_amount
  HAVING ABS(SUM(poi.total_amount) - po.total_amount) > 0.01
) issues

UNION ALL

SELECT 'Inventory Quantity Issues' as check_type, COUNT(*) as issue_count
FROM (
  WITH calculated_stock AS (
    SELECT
      p.id,
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
    GROUP BY p.id, p.current_stock
  )
  SELECT id
  FROM calculated_stock
  WHERE ABS(calculated_stock - stored_stock) > 0.01
) issues

UNION ALL

SELECT 'Delivery Amount Issues' as check_type, COUNT(*) as issue_count
FROM (
  WITH delivery_summary AS (
    SELECT
      po.id,
      po.total_amount,
      COALESCE(SUM(t.total_amount), 0) as delivered_amount,
      (po.total_amount - COALESCE(SUM(t.total_amount), 0)) as calculated_remaining,
      COALESCE(po.remaining_amount, po.total_amount) as stored_remaining
    FROM purchase_orders po
    LEFT JOIN transactions t ON po.id = t.parent_order_id
      AND t.transaction_type = 'installment'
      AND t.status = 'confirmed'
    WHERE po.status = 'active'
    GROUP BY po.id, po.total_amount, po.remaining_amount
  )
  SELECT id
  FROM delivery_summary
  WHERE ABS(calculated_remaining - stored_remaining) > 0.01
) issues;

-- 5. バックアップ準備状況確認
SELECT
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del as total_changes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename IN ('purchase_orders', 'purchase_order_items', 'products', 'inventory_movements', 'transactions')
ORDER BY tablename;

-- デプロイメント完了確認メッセージ
SELECT 'デプロイメント前確認完了 - 修正関数の実行準備が整いました' as status;
SELECT '次の手順: Supabaseダッシュボードで修正関数を実行してください' as next_step;