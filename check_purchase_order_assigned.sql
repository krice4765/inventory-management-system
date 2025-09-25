-- 🔍 最新の購入注文と担当者情報確認

-- 最新の購入注文5件
SELECT
  'Latest purchase orders' as status,
  order_no,
  assigned_user_id,
  order_manager_id,
  partner_id,
  order_date,
  total_amount,
  status,
  created_at
FROM purchase_orders
ORDER BY created_at DESC
LIMIT 5;