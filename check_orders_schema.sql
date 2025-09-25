-- 🔍 ordersテーブルの構造確認

-- ordersテーブルのカラム一覧
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;