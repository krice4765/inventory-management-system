-- inventory_movementsテーブルの欠落カラム追加修正

DO $$
BEGIN
    -- unit_cost カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'unit_cost'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN unit_cost DECIMAL(15,2);
        RAISE NOTICE '✅ unit_cost カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ unit_cost カラムは既に存在します';
    END IF;

    -- is_confirmed カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'is_confirmed'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN is_confirmed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ is_confirmed カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ is_confirmed カラムは既に存在します';
    END IF;

    -- batch_id カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'batch_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN batch_id UUID;
        RAISE NOTICE '✅ batch_id カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ batch_id カラムは既に存在します';
    END IF;

    -- processing_order カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'processing_order'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN processing_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ processing_order カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ processing_order カラムは既に存在します';
    END IF;

    -- remaining_quantity カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'remaining_quantity'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN remaining_quantity DECIMAL(15,3) DEFAULT 0;
        RAISE NOTICE '✅ remaining_quantity カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ remaining_quantity カラムは既に存在します';
    END IF;

    -- consumed_quantity カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'consumed_quantity'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN consumed_quantity DECIMAL(15,3) DEFAULT 0;
        RAISE NOTICE '✅ consumed_quantity カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ consumed_quantity カラムは既に存在します';
    END IF;

    -- average_cost カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'average_cost'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN average_cost DECIMAL(15,4);
        RAISE NOTICE '✅ average_cost カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ average_cost カラムは既に存在します';
    END IF;

    -- total_cost カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'total_cost'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN total_cost DECIMAL(15,2);
        RAISE NOTICE '✅ total_cost カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ total_cost カラムは既に存在します';
    END IF;

    -- running_balance カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements'
        AND column_name = 'running_balance'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE inventory_movements
        ADD COLUMN running_balance DECIMAL(15,3);
        RAISE NOTICE '✅ running_balance カラムを追加しました';
    ELSE
        RAISE NOTICE '⚪ running_balance カラムは既に存在します';
    END IF;

    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ inventory_movements テーブルのカラム修正完了';
    RAISE NOTICE '============================================';
END $$;

-- 欠落インデックスを追加
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_confirmed
ON inventory_movements(movement_type, is_confirmed);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch
ON inventory_movements(batch_id) WHERE batch_id IS NOT NULL;

-- 修正後の構造確認
SELECT
    'inventory_movements カラム一覧' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
AND table_schema = 'public'
ORDER BY ordinal_position;