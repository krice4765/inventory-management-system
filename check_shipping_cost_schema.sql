-- shipping_cost_settingsテーブルのスキーマ確認

-- 1. 現在のshipping_cost_settingsテーブル構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shipping_cost_settings'
ORDER BY ordinal_position;

-- 2. サンプルデータも確認
SELECT * FROM shipping_cost_settings LIMIT 3;