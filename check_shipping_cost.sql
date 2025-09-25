-- PO250923005の送料情報を確認
SELECT
  order_no,
  shipping_cost,
  shipping_tax_rate,
  total_amount,
  created_at
FROM purchase_orders
WHERE order_no = 'PO250923005';

-- 関連する明細も確認
SELECT
  poi.product_name,
  poi.quantity,
  poi.unit_price,
  poi.total_amount,
  p.shipping_cost
FROM purchase_order_items poi
JOIN purchase_orders p ON poi.purchase_order_id = p.id
WHERE p.order_no = 'PO250923005';