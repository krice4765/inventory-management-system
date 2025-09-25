-- inventory_movementsテーブルの構造確認と修正

-- Step 1: テーブルが存在するか確認
SELECT
    'テーブル存在確認' as check_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'inventory_movements' AND table_schema = 'public'
    ) THEN 'EXISTS' ELSE 'NOT_EXISTS' END as status;

-- Step 2: カラム一覧を確認
SELECT
    'カラム構造確認' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 3: 欠落カラムの確認
DO $$
DECLARE
    missing_columns TEXT[] := '{}';
BEGIN
    -- is_confirmed カラムチェック
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'is_confirmed'
        AND table_schema = 'public'
    ) THEN
        missing_columns := array_append(missing_columns, 'is_confirmed');
    END IF;

    -- unit_cost カラムチェック
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'unit_cost'
        AND table_schema = 'public'
    ) THEN
        missing_columns := array_append(missing_columns, 'unit_cost');
    END IF;

    -- 結果表示
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '❌ 欠落カラム: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ 全カラムが存在しています';
    END IF;
END $$;