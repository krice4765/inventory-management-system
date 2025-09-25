-- tax_category_updated_atカラムを追加

ALTER TABLE products
ADD COLUMN IF NOT EXISTS tax_category_updated_at TIMESTAMP DEFAULT NOW();

-- 確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name = 'tax_category_updated_at';