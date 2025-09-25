-- 最新の購入注文確認
SELECT
  order_no,
  assigned_user_id,
  order_date,
  total_amount
FROM purchase_orders
ORDER BY created_at DESC;