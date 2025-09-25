-- 出庫指示作成テスト - 2025年9月25日
-- OutboundOrderNew.tsxの動作をSQLレベルで検証

-- TEST 1: 基本的な出庫指示作成（自動番号生成テスト）
INSERT INTO outbound_orders (
  customer_name,
  request_date,
  due_date,
  status,
  total_amount,
  notes
) VALUES (
  'テスト顧客株式会社',
  '2025-09-25',
  '2025-09-28',
  'pending',
  50000,
  'データ作成テスト用出庫指示'
) RETURNING id, order_number, customer_name, total_amount, created_at;

-- TEST 2: 商品明細データの作成（products テーブルから実際の商品を参照）
-- まず利用可能な商品を確認
SELECT id, product_name, product_code, current_stock, selling_price
FROM products
WHERE current_stock > 0
LIMIT 5;

-- TEST 3: 出庫指示明細の作成（最新の出庫指示IDを使用）
WITH latest_order AS (
  SELECT id FROM outbound_orders ORDER BY created_at DESC LIMIT 1
),
available_product AS (
  SELECT id, selling_price FROM products WHERE current_stock > 10 LIMIT 1
)
INSERT INTO outbound_order_items (
  outbound_order_id,
  product_id,
  quantity_requested,
  quantity_shipped,
  unit_price_tax_excluded,
  unit_price_tax_included,
  tax_rate
)
SELECT
  lo.id,
  ap.id,
  5,  -- 要求数量
  0,  -- 出荷済み数量
  ROUND(ap.selling_price / 1.1, 2),  -- 税抜価格
  ap.selling_price,  -- 税込価格
  10.000  -- 消費税率
FROM latest_order lo, available_product ap
RETURNING id, outbound_order_id, product_id, quantity_requested, unit_price_tax_included;

-- TEST 4: 作成されたデータの検証
SELECT
  o.id,
  o.order_number,
  o.customer_name,
  o.request_date,
  o.due_date,
  o.status,
  o.total_amount,
  COUNT(oi.id) as item_count,
  SUM(oi.quantity_requested * oi.unit_price_tax_included) as calculated_total
FROM outbound_orders o
LEFT JOIN outbound_order_items oi ON o.id = oi.outbound_order_id
WHERE o.created_at >= CURRENT_DATE
GROUP BY o.id, o.order_number, o.customer_name, o.request_date, o.due_date, o.status, o.total_amount
ORDER BY o.created_at DESC
LIMIT 3;

-- TEST 5: useOutboundManagement.tsのクエリ検証
-- createOutboundOrder関数で実際に使用される形式のテスト
WITH test_data AS (
  SELECT
    'API作成テスト顧客' as customer_name,
    '2025-09-25' as request_date,
    '2025-09-30' as due_date,
    'テスト備考' as notes,
    ARRAY[
      ROW('product-uuid-1', 3),
      ROW('product-uuid-2', 2)
    ] as items
)
SELECT
  customer_name,
  request_date::date,
  due_date::date,
  notes,
  0 as total_amount  -- 初期値、後で更新
FROM test_data;

-- TEST 6: エラーケースのテスト
-- 存在しない商品IDでの明細作成テスト（エラーになるはず）
-- INSERT INTO outbound_order_items (
--   outbound_order_id,
--   product_id,
--   quantity_requested,
--   unit_price_tax_included
-- ) VALUES (
--   (SELECT id FROM outbound_orders ORDER BY created_at DESC LIMIT 1),
--   'non-existent-product-id',  -- 存在しない商品ID
--   1,
--   1000
-- );

-- TEST 7: 制約チェック（数量が負の値）
-- INSERT INTO outbound_order_items (
--   outbound_order_id,
--   product_id,
--   quantity_requested,
--   unit_price_tax_included
-- ) VALUES (
--   (SELECT id FROM outbound_orders ORDER BY created_at DESC LIMIT 1),
--   (SELECT id FROM products LIMIT 1),
--   -1,  -- 負の数量（制約エラーになるはず）
--   1000
-- );

-- TEST 8: 今日作成されたテストデータの削除（クリーンアップ）
-- DELETE FROM outbound_orders WHERE customer_name LIKE '%テスト%' AND created_at >= CURRENT_DATE;