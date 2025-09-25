-- profilesテーブルのスキーマ確認

-- 1. 現在のprofilesテーブル構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. 不足しているカラムを追加（存在しない場合のみ）
DO $$
BEGIN
    -- can_manage_ordersカラムの確認・追加
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'can_manage_orders'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN can_manage_orders BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ can_manage_ordersカラムを追加しました';
    ELSE
        RAISE NOTICE '✅ can_manage_ordersカラムは既に存在します';
    END IF;

    -- can_manage_inventoryカラムの確認・追加
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'can_manage_inventory'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN can_manage_inventory BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ can_manage_inventoryカラムを追加しました';
    ELSE
        RAISE NOTICE '✅ can_manage_inventoryカラムは既に存在します';
    END IF;

    -- departmentカラムの確認・追加
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'department'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN department VARCHAR(100);
        RAISE NOTICE '✅ departmentカラムを追加しました';
    ELSE
        RAISE NOTICE '✅ departmentカラムは既に存在します';
    END IF;
END $$;

-- 3. 追加後の確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('can_manage_orders', 'can_manage_inventory', 'department')
ORDER BY ordinal_position;