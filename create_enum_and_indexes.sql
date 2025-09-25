-- Step 2: ENUM作成とインデックス追加

-- ENUM型を作成（まずENUMのみ）
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '📋 Step 2: ENUM型とインデックス作成';
    RAISE NOTICE '============================================';

    -- inventory_movement_type ENUMを作成
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
        CREATE TYPE inventory_movement_type AS ENUM (
            'purchase',      -- 仕入
            'sale',         -- 売上
            'adjustment',   -- 調整
            'transfer',     -- 移動
            'return',       -- 返品
            'loss',         -- 廃棄・損失
            'initial',      -- 初期在庫
            'outbound'      -- 出庫
        );
        RAISE NOTICE '✅ inventory_movement_type ENUM作成完了';
    ELSE
        RAISE NOTICE '⚪ inventory_movement_type ENUM は既に存在します';
    END IF;
END $$;

-- 必要なインデックスを作成
DO $$
BEGIN
    -- 既存インデックスをチェックして作成
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_movements_product_id') THEN
        CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
        RAISE NOTICE '✅ idx_inventory_movements_product_id 作成';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_movements_created_at') THEN
        CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
        RAISE NOTICE '✅ idx_inventory_movements_created_at 作成';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_movements_type_confirmed') THEN
        CREATE INDEX idx_inventory_movements_type_confirmed ON inventory_movements(movement_type, is_confirmed);
        RAISE NOTICE '✅ idx_inventory_movements_type_confirmed 作成';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_movements_reference') THEN
        CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
        RAISE NOTICE '✅ idx_inventory_movements_reference 作成';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_movements_batch') THEN
        CREATE INDEX idx_inventory_movements_batch ON inventory_movements(batch_id) WHERE batch_id IS NOT NULL;
        RAISE NOTICE '✅ idx_inventory_movements_batch 作成';
    END IF;

    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Step 2: ENUM型とインデックス作成完了';
    RAISE NOTICE '============================================';
END $$;

-- 拡張後のテーブル構造確認
SELECT
    'inventory_movements 拡張後カラム一覧' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
AND table_schema = 'public'
ORDER BY ordinal_position;