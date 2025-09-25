-- 🔍 purchase_ordersテーブルの構造と最新データ確認

-- purchase_ordersテーブルのカラム構造
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;