-- 出庫管理テーブル構造確認スクリプト
-- 2025-09-25 実行用

-- 1. テーブル存在確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name IN ('outbound_orders', 'outbound_order_items')
AND table_schema = 'public';

-- 2. outbound_ordersテーブル構造確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'outbound_orders'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. outbound_order_itemsテーブル構造確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'outbound_order_items'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 外部キー制約確認
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('outbound_orders', 'outbound_order_items')
AND tc.constraint_type = 'FOREIGN KEY';

-- 5. インデックス確認
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('outbound_orders', 'outbound_order_items')
ORDER BY tablename, indexname;

-- 6. トリガー確認
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('outbound_orders', 'outbound_order_items');

-- 7. RLSポリシー確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('outbound_orders', 'outbound_order_items')
ORDER BY tablename, policyname;

-- 8. サンプルデータ存在確認
SELECT COUNT(*) as outbound_orders_count FROM outbound_orders;
SELECT COUNT(*) as outbound_order_items_count FROM outbound_order_items;

-- 9. 最新5件の出庫指示データ表示
SELECT
  id,
  order_number,
  customer_name,
  request_date,
  due_date,
  status,
  total_amount,
  created_at
FROM outbound_orders
ORDER BY created_at DESC
LIMIT 5;