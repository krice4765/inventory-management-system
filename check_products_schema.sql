-- productsテーブルのスキーマ確認とtax_categoryカラム追加

-- 1. 現在のproductsテーブル構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 2. tax_categoryカラムが存在するかチェック
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'tax_category'
    ) THEN
        RAISE NOTICE '✅ tax_categoryカラムは既に存在します';
    ELSE
        RAISE NOTICE '❌ tax_categoryカラムが存在しません - 追加が必要です';

        -- tax_categoryカラムを追加
        ALTER TABLE products
        ADD COLUMN tax_category VARCHAR DEFAULT 'standard_10'
        CHECK (tax_category IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt'));

        RAISE NOTICE '✅ tax_categoryカラムを追加しました';

        -- tax_category_updated_atカラムも追加
        ALTER TABLE products
        ADD COLUMN tax_category_updated_at TIMESTAMP DEFAULT NOW();

        RAISE NOTICE '✅ tax_category_updated_atカラムを追加しました';
    END IF;
END $$;

-- 3. 追加後の確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('tax_category', 'tax_category_updated_at')
ORDER BY ordinal_position;