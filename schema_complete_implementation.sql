-- 0922Youken.md完全準拠 データベーススキーマ実装
-- Phase 1: 既存テーブル拡張

-- 1. ordersテーブル拡張
DO $$
BEGIN
    -- due_dateカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN due_date DATE;
        RAISE NOTICE '✅ orders.due_date カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ orders.due_date カラムは既に存在します';
    END IF;

    -- shipping_costカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'shipping_cost'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_cost DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE '✅ orders.shipping_cost カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ orders.shipping_cost カラムは既に存在します';
    END IF;

    -- shipping_tax_rateカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'shipping_tax_rate'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_tax_rate DECIMAL(5,2) DEFAULT 0.10;
        RAISE NOTICE '✅ orders.shipping_tax_rate カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ orders.shipping_tax_rate カラムは既に存在します';
    END IF;

    -- assigned_user_idカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'assigned_user_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN assigned_user_id UUID REFERENCES profiles(id);
        RAISE NOTICE '✅ orders.assigned_user_id カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ orders.assigned_user_id カラムは既に存在します';
    END IF;
END $$;

-- 2. productsテーブル拡張
DO $$
BEGIN
    -- safety_stockカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'safety_stock'
    ) THEN
        ALTER TABLE products ADD COLUMN safety_stock INTEGER DEFAULT 0;
        RAISE NOTICE '✅ products.safety_stock カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ products.safety_stock カラムは既に存在します';
    END IF;

    -- optimal_stockカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'optimal_stock'
    ) THEN
        ALTER TABLE products ADD COLUMN optimal_stock INTEGER DEFAULT 0;
        RAISE NOTICE '✅ products.optimal_stock カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ products.optimal_stock カラムは既に存在します';
    END IF;
END $$;

-- 3. inventoryテーブル拡張（FIFO評価額管理）
DO $$
BEGIN
    -- valuation_price_tax_excludedカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory' AND column_name = 'valuation_price_tax_excluded'
    ) THEN
        ALTER TABLE inventory ADD COLUMN valuation_price_tax_excluded DECIMAL(12,2);
        RAISE NOTICE '✅ inventory.valuation_price_tax_excluded カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory.valuation_price_tax_excluded カラムは既に存在します';
    END IF;

    -- valuation_price_tax_includedカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory' AND column_name = 'valuation_price_tax_included'
    ) THEN
        ALTER TABLE inventory ADD COLUMN valuation_price_tax_included DECIMAL(12,2);
        RAISE NOTICE '✅ inventory.valuation_price_tax_included カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory.valuation_price_tax_included カラムは既に存在します';
    END IF;

    -- reserved_quantityカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory' AND column_name = 'reserved_quantity'
    ) THEN
        ALTER TABLE inventory ADD COLUMN reserved_quantity INTEGER DEFAULT 0;
        RAISE NOTICE '✅ inventory.reserved_quantity カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory.reserved_quantity カラムは既に存在します';
    END IF;

    -- last_fifo_calculationカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory' AND column_name = 'last_fifo_calculation'
    ) THEN
        ALTER TABLE inventory ADD COLUMN last_fifo_calculation TIMESTAMP DEFAULT NOW();
        RAISE NOTICE '✅ inventory.last_fifo_calculation カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory.last_fifo_calculation カラムは既に存在します';
    END IF;
END $$;

-- 4. inventory_movementsテーブル拡張
DO $$
BEGIN
    -- unit_price_tax_excludedカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements' AND column_name = 'unit_price_tax_excluded'
    ) THEN
        ALTER TABLE inventory_movements ADD COLUMN unit_price_tax_excluded DECIMAL(10,2);
        RAISE NOTICE '✅ inventory_movements.unit_price_tax_excluded カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory_movements.unit_price_tax_excluded カラムは既に存在します';
    END IF;

    -- unit_price_tax_includedカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements' AND column_name = 'unit_price_tax_included'
    ) THEN
        ALTER TABLE inventory_movements ADD COLUMN unit_price_tax_included DECIMAL(10,2);
        RAISE NOTICE '✅ inventory_movements.unit_price_tax_included カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory_movements.unit_price_tax_included カラムは既に存在します';
    END IF;

    -- applied_tax_rateカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements' AND column_name = 'applied_tax_rate'
    ) THEN
        ALTER TABLE inventory_movements ADD COLUMN applied_tax_rate DECIMAL(5,2);
        RAISE NOTICE '✅ inventory_movements.applied_tax_rate カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory_movements.applied_tax_rate カラムは既に存在します';
    END IF;

    -- fifo_layer_idカラム追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_movements' AND column_name = 'fifo_layer_id'
    ) THEN
        ALTER TABLE inventory_movements ADD COLUMN fifo_layer_id UUID;
        RAISE NOTICE '✅ inventory_movements.fifo_layer_id カラムを追加しました';
    ELSE
        RAISE NOTICE '✅ inventory_movements.fifo_layer_id カラムは既に存在します';
    END IF;
END $$;

-- 確認クエリ
SELECT 'orders拡張確認' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('due_date', 'shipping_cost', 'shipping_tax_rate', 'assigned_user_id')
ORDER BY ordinal_position;

SELECT 'products拡張確認' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('safety_stock', 'optimal_stock')
ORDER BY ordinal_position;

SELECT 'inventory拡張確認' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'inventory'
AND column_name IN ('valuation_price_tax_excluded', 'valuation_price_tax_included', 'reserved_quantity', 'last_fifo_calculation')
ORDER BY ordinal_position;