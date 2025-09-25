-- 🔧 PO250923005の送料情報を修正
-- total_amount (3800) - 商品合計税込 (3240) = 送料 (560)

-- 修正前の状態確認
SELECT
  'Before update' as status,
  order_no,
  total_amount,
  shipping_cost,
  shipping_tax_rate,
  (total_amount - 3240) as calculated_shipping_cost
FROM purchase_orders
WHERE order_no = 'PO250923005';

-- 送料を修正（560円）
UPDATE purchase_orders
SET shipping_cost = 560,
    updated_at = NOW()
WHERE order_no = 'PO250923005';

-- 修正後の確認
SELECT
  'After update' as status,
  order_no,
  total_amount,
  shipping_cost,
  shipping_tax_rate,
  (total_amount - 3240) as calculated_shipping_cost
FROM purchase_orders
WHERE order_no = 'PO250923005';