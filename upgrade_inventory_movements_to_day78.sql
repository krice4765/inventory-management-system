-- inventory_movements テーブルを Day 7-8 仕様に拡張

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '📋 inventory_movements テーブル Day 7-8 仕様拡張開始';
    RAISE NOTICE '============================================';

    -- 1. FIFO評価用カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'unit_cost' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN unit_cost DECIMAL(15,2);
        RAISE NOTICE '✅ unit_cost カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'remaining_quantity' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN remaining_quantity DECIMAL(15,3) DEFAULT 0;
        RAISE NOTICE '✅ remaining_quantity カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'consumed_quantity' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN consumed_quantity DECIMAL(15,3) DEFAULT 0;
        RAISE NOTICE '✅ consumed_quantity カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'average_cost' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN average_cost DECIMAL(15,4);
        RAISE NOTICE '✅ average_cost カラム追加';
    END IF;

    -- 2. 在庫金額計算用カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'total_cost' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN total_cost DECIMAL(15,2);
        RAISE NOTICE '✅ total_cost カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'running_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN running_balance DECIMAL(15,3);
        RAISE NOTICE '✅ running_balance カラム追加';
    END IF;

    -- 3. 参照情報カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_type' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN reference_type VARCHAR(50);
        RAISE NOTICE '✅ reference_type カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_id' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN reference_id UUID;
        RAISE NOTICE '✅ reference_id カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_item_id' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN reference_item_id UUID;
        RAISE NOTICE '✅ reference_item_id カラム追加';
    END IF;

    -- 4. Day 7-8仕様: リアルタイム在庫減算対応カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'is_confirmed' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN is_confirmed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ is_confirmed カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'batch_id' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN batch_id UUID;
        RAISE NOTICE '✅ batch_id カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'processing_order' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN processing_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ processing_order カラム追加';
    END IF;

    -- 5. ユーザー追跡カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'updated_at' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ updated_at カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'created_by' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN created_by UUID REFERENCES auth.users(id);
        RAISE NOTICE '✅ created_by カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'updated_by' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN updated_by UUID REFERENCES auth.users(id);
        RAISE NOTICE '✅ updated_by カラム追加';
    END IF;

    -- 6. movement_type カラムをENUMに変更（データ型変更）
    -- まず、inventory_movement_type ENUMを作成
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
        RAISE NOTICE '✅ inventory_movement_type ENUM作成';
    END IF;

    -- movement_typeのデータ型をENUMに変更
    -- 既存データとの互換性を保つため、まずデフォルト値を設定
    UPDATE inventory_movements
    SET movement_type = 'adjustment'
    WHERE movement_type NOT IN ('purchase', 'sale', 'adjustment', 'transfer', 'return', 'loss', 'initial', 'outbound');

    -- データ型を変更
    ALTER TABLE inventory_movements
    ALTER COLUMN movement_type TYPE inventory_movement_type
    USING movement_type::inventory_movement_type;

    RAISE NOTICE '✅ movement_type をENUM型に変更';

    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ inventory_movements テーブル拡張完了';
    RAISE NOTICE '============================================';
END $$;

-- 必要なインデックスを作成
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
ON inventory_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_confirmed
ON inventory_movements(movement_type, is_confirmed);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
ON inventory_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch
ON inventory_movements(batch_id) WHERE batch_id IS NOT NULL;

-- 拡張後のテーブル構造確認
SELECT
    '拡張後のカラム一覧' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
AND table_schema = 'public'
ORDER BY ordinal_position;