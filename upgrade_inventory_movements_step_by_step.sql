-- inventory_movements テーブルを段階的に Day 7-8 仕様に拡張（修正版）

-- Step 1: 必要なカラムのみ追加（ENUM変換は後回し）
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '📋 Step 1: 基本カラム追加開始';
    RAISE NOTICE '============================================';

    -- FIFO評価用カラム追加
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

    -- 在庫金額計算用カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'total_cost' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN total_cost DECIMAL(15,2);
        RAISE NOTICE '✅ total_cost カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'running_balance' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN running_balance DECIMAL(15,3);
        RAISE NOTICE '✅ running_balance カラム追加';
    END IF;

    -- 参照情報カラム追加
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

    -- リアルタイム在庫減算対応カラム追加
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

    -- ユーザー追跡カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'updated_at' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ updated_at カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'created_by' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN created_by UUID;
        -- 外部キー制約は後で追加
        RAISE NOTICE '✅ created_by カラム追加';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'updated_by' AND table_schema = 'public') THEN
        ALTER TABLE inventory_movements ADD COLUMN updated_by UUID;
        -- 外部キー制約は後で追加
        RAISE NOTICE '✅ updated_by カラム追加';
    END IF;

    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Step 1: 基本カラム追加完了';
    RAISE NOTICE '============================================';
END $$;