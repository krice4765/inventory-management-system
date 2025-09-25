-- outbound_ordersサンプルデータ修正版
-- UUID形式エラーの修正

-- =====================================================
-- 修正版サンプルデータ挿入
-- =====================================================

-- 正しいUUID形式でサンプルデータを挿入
INSERT INTO outbound_orders (
  order_number,
  customer_name,
  request_date,
  due_date,
  status,
  total_amount,
  notes
) VALUES
(
  'OUT-20250924-001',
  '株式会社サンプル',
  '2025-09-22',
  '2025-09-25',
  'pending',
  150000,
  '緊急出荷依頼'
),
(
  'OUT-20250924-002',
  'テスト商事株式会社',
  '2025-09-21',
  '2025-09-24',
  'processing',
  200000,
  'システムテスト用データ'
),
(
  'OUT-20250924-003',
  '実装サポート株式会社',
  '2025-09-20',
  '2025-09-23',
  'completed',
  180000,
  '完了済み出庫指示'
),
(
  'OUT-20250924-004',
  'キャンセルテスト有限会社',
  '2025-09-19',
  '2025-09-22',
  'cancelled',
  120000,
  'キャンセル済み'
)
ON CONFLICT (order_number) DO NOTHING;

-- サンプル出庫明細データも追加
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
  o.id,
  p.id,
  5,
  CASE WHEN o.status = 'completed' THEN 5 ELSE 0 END,
  15000.00,
  16500.00,
  10.000
FROM outbound_orders o
CROSS JOIN (SELECT id FROM products LIMIT 2) p
WHERE o.order_number LIKE 'OUT-20250924-%'
ON CONFLICT DO NOTHING;

-- 作成確認
SELECT
  'outbound_orders サンプルデータ' as data_type,
  COUNT(*) || ' 件挿入完了' as status
FROM outbound_orders
WHERE order_number LIKE 'OUT-20250924-%'

UNION ALL

SELECT
  'outbound_order_items サンプルデータ',
  COUNT(*) || ' 件挿入完了'
FROM outbound_order_items
WHERE outbound_order_id IN (
  SELECT id FROM outbound_orders WHERE order_number LIKE 'OUT-20250924-%'
);

-- 最終確認：詳細ボタンで表示されるデータ
SELECT
  o.order_number,
  o.customer_name,
  o.status,
  o.total_amount,
  COUNT(oi.id) as item_count
FROM outbound_orders o
LEFT JOIN outbound_order_items oi ON o.id = oi.outbound_order_id
WHERE o.order_number LIKE 'OUT-20250924-%'
GROUP BY o.id, o.order_number, o.customer_name, o.status, o.total_amount
ORDER BY o.order_number;