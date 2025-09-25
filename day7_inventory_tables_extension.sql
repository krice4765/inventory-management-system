-- Day 7-8: inventory関連テーブル拡張マイグレーション
-- 0922Youken.md Week 2 Phase 1: データベース基盤構築
-- 2025-09-22 実施

-- ============================================
-- Step 1: 在庫移動履歴テーブルの作成・拡張
-- ============================================

-- 在庫移動タイプの定義
DO $$
BEGIN
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
    END IF;
END $$;

-- 在庫移動履歴テーブル
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type inventory_movement_type NOT NULL,
    quantity DECIMAL(15,3) NOT NULL, -- 正負両対応
    unit_cost DECIMAL(15,2), -- 単価（FIFO計算用）
    reference_type VARCHAR(50), -- 参照元テーブル（purchase_orders, sales_orders等）
    reference_id UUID, -- 参照元ID
    reference_item_id UUID, -- 参照元明細ID

    -- FIFO評価用
    remaining_quantity DECIMAL(15,3) DEFAULT 0, -- 残数量
    consumed_quantity DECIMAL(15,3) DEFAULT 0,  -- 消費済み数量
    average_cost DECIMAL(15,4), -- 平均単価

    -- 在庫金額計算用
    total_cost DECIMAL(15,2), -- 総額
    running_balance DECIMAL(15,3), -- 累計残高

    -- Day 7-8仕様: リアルタイム在庫減算対応
    is_confirmed BOOLEAN DEFAULT FALSE, -- 確定フラグ
    batch_id UUID, -- バッチ処理ID
    processing_order INTEGER DEFAULT 0, -- 処理順序

    -- メタデータ
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- インデックスの作成
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

-- ============================================
-- Step 2: 在庫バランステーブル（リアルタイム残高管理）
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- 在庫数量
    current_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, -- 予約済み
    available_quantity DECIMAL(15,3) GENERATED ALWAYS AS (current_quantity - reserved_quantity) STORED,

    -- 金額情報（FIFO評価）
    total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    average_unit_cost DECIMAL(15,4) GENERATED ALWAYS AS (
        CASE WHEN current_quantity > 0 THEN total_cost / current_quantity ELSE 0 END
    ) STORED,

    -- 最小/最大在庫レベル
    min_stock_level DECIMAL(15,3),
    max_stock_level DECIMAL(15,3),
    reorder_point DECIMAL(15,3),

    -- 統計情報
    last_movement_at TIMESTAMP WITH TIME ZONE,
    last_purchase_cost DECIMAL(15,2),
    last_purchase_at TIMESTAMP WITH TIME ZONE,

    -- Day 7-8仕様: リアルタイム更新管理
    version INTEGER DEFAULT 1, -- 楽観的ロック用
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculation_status VARCHAR(20) DEFAULT 'current', -- current, calculating, error

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(product_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_inventory_balances_available
ON inventory_balances(available_quantity) WHERE available_quantity < min_stock_level;

CREATE INDEX IF NOT EXISTS idx_inventory_balances_reorder
ON inventory_balances(reorder_point) WHERE current_quantity <= reorder_point;

CREATE INDEX IF NOT EXISTS idx_inventory_balances_status
ON inventory_balances(calculation_status) WHERE calculation_status != 'current';

-- ============================================
-- Step 3: FIFO評価履歴テーブル
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_fifo_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_id UUID NOT NULL REFERENCES inventory_movements(id) ON DELETE CASCADE,

    -- FIFO層情報
    layer_date TIMESTAMP WITH TIME ZONE NOT NULL,
    original_quantity DECIMAL(15,3) NOT NULL,
    remaining_quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,

    -- 消費追跡
    consumed_quantity DECIMAL(15,3) DEFAULT 0,
    is_fully_consumed BOOLEAN DEFAULT FALSE,

    -- Day 7-8仕様: ハイブリッド税率対応
    tax_category VARCHAR(20),
    tax_rate DECIMAL(5,3),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT positive_quantities CHECK (
        original_quantity > 0 AND
        remaining_quantity >= 0 AND
        consumed_quantity >= 0 AND
        remaining_quantity + consumed_quantity = original_quantity
    )
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_fifo_layers_product_date
ON inventory_fifo_layers(product_id, layer_date);

CREATE INDEX IF NOT EXISTS idx_fifo_layers_not_consumed
ON inventory_fifo_layers(product_id, layer_date) WHERE NOT is_fully_consumed;

-- ============================================
-- Step 4: 在庫アラートテーブル
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    alert_type VARCHAR(50) NOT NULL, -- low_stock, out_of_stock, negative_stock, reorder
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical

    current_quantity DECIMAL(15,3),
    threshold_quantity DECIMAL(15,3),

    message TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unresolved
ON inventory_alerts(product_id, created_at) WHERE NOT is_resolved;

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_severity
ON inventory_alerts(severity, created_at) WHERE NOT is_resolved;

-- ============================================
-- Step 5: 既存productsテーブルの拡張
-- ============================================

-- productsテーブルに在庫管理関連カラムを追加
ALTER TABLE products
ADD COLUMN IF NOT EXISTS inventory_tracking_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS fifo_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_reorder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS supplier_product_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS volume_m3 DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS hazardous_material BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiration_tracking BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lot_tracking BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS serial_tracking BOOLEAN DEFAULT FALSE;

-- 在庫管理用インデックス
CREATE INDEX IF NOT EXISTS idx_products_inventory_tracking
ON products(inventory_tracking_enabled) WHERE inventory_tracking_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_barcode
ON products(barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_code
ON products(supplier_product_code) WHERE supplier_product_code IS NOT NULL;

-- ============================================
-- Step 6: トリガー関数の作成
-- ============================================

-- 在庫移動時の自動バランス更新トリガー
CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_balance RECORD;
    new_quantity DECIMAL(15,3);
    new_cost DECIMAL(15,2);
BEGIN
    -- 現在のバランスを取得
    SELECT * INTO current_balance
    FROM inventory_balances
    WHERE product_id = NEW.product_id;

    -- バランスレコードが存在しない場合は作成
    IF NOT FOUND THEN
        INSERT INTO inventory_balances (
            product_id,
            current_quantity,
            total_cost,
            last_movement_at,
            version
        ) VALUES (
            NEW.product_id,
            NEW.quantity,
            COALESCE(NEW.total_cost, NEW.quantity * COALESCE(NEW.unit_cost, 0)),
            NEW.created_at,
            1
        );
        RETURN NEW;
    END IF;

    -- 新しい数量と金額を計算
    new_quantity = current_balance.current_quantity + NEW.quantity;
    new_cost = current_balance.total_cost + COALESCE(NEW.total_cost, NEW.quantity * COALESCE(NEW.unit_cost, 0));

    -- バランスを更新（楽観的ロック）
    UPDATE inventory_balances
    SET
        current_quantity = new_quantity,
        total_cost = new_cost,
        last_movement_at = NEW.created_at,
        version = version + 1,
        last_calculated_at = NOW(),
        updated_at = NOW()
    WHERE product_id = NEW.product_id AND version = current_balance.version;

    -- 楽観的ロックが失敗した場合
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory balance update conflict for product_id: %', NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_update_inventory_balance ON inventory_movements;
CREATE TRIGGER trigger_update_inventory_balance
    AFTER INSERT ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_balance();

-- 在庫アラート生成トリガー
CREATE OR REPLACE FUNCTION check_inventory_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- 在庫不足アラート
    IF NEW.current_quantity <= COALESCE(NEW.min_stock_level, 0) AND NEW.current_quantity > 0 THEN
        INSERT INTO inventory_alerts (
            product_id, alert_type, severity, current_quantity, threshold_quantity, message
        ) VALUES (
            NEW.product_id,
            'low_stock',
            CASE WHEN NEW.current_quantity <= (COALESCE(NEW.min_stock_level, 0) * 0.5) THEN 'high' ELSE 'medium' END,
            NEW.current_quantity,
            NEW.min_stock_level,
            format('商品の在庫が不足しています。現在庫: %s, 最小在庫: %s', NEW.current_quantity, NEW.min_stock_level)
        )
        ON CONFLICT DO NOTHING; -- 重複防止
    END IF;

    -- 在庫切れアラート
    IF NEW.current_quantity <= 0 THEN
        INSERT INTO inventory_alerts (
            product_id, alert_type, severity, current_quantity, threshold_quantity, message
        ) VALUES (
            NEW.product_id,
            'out_of_stock',
            'critical',
            NEW.current_quantity,
            0,
            format('商品が在庫切れです。現在庫: %s', NEW.current_quantity)
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- 発注点アラート
    IF NEW.current_quantity <= COALESCE(NEW.reorder_point, 0) AND NEW.reorder_point IS NOT NULL THEN
        INSERT INTO inventory_alerts (
            product_id, alert_type, severity, current_quantity, threshold_quantity, message
        ) VALUES (
            NEW.product_id,
            'reorder',
            'medium',
            NEW.current_quantity,
            NEW.reorder_point,
            format('発注点に達しました。現在庫: %s, 発注点: %s', NEW.current_quantity, NEW.reorder_point)
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
DROP TRIGGER IF EXISTS trigger_check_inventory_alerts ON inventory_balances;
CREATE TRIGGER trigger_check_inventory_alerts
    AFTER UPDATE OF current_quantity ON inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION check_inventory_alerts();

-- ============================================
-- Step 7: RLSポリシー設定
-- ============================================

-- inventory_movements テーブルのRLS
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory movements" ON inventory_movements
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert inventory movements" ON inventory_movements
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- inventory_balances テーブルのRLS
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory balances" ON inventory_balances
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update inventory balances" ON inventory_balances
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- その他のテーブルにも同様のポリシーを適用
ALTER TABLE inventory_fifo_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access fifo layers" ON inventory_fifo_layers
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access alerts" ON inventory_alerts
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================
-- Step 8: 初期データの投入
-- ============================================

-- 既存商品に対するinventory_balancesの初期化
INSERT INTO inventory_balances (
    product_id,
    current_quantity,
    min_stock_level,
    max_stock_level,
    reorder_point,
    last_calculated_at
)
SELECT
    p.id,
    COALESCE(p.current_stock, 0),
    COALESCE(p.min_stock_level, 0),
    COALESCE(p.max_stock_level, 100),
    COALESCE(p.reorder_point, COALESCE(p.min_stock_level, 0)),
    NOW()
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM inventory_balances ib WHERE ib.product_id = p.id
);

-- 初期在庫移動記録の作成（existing stock）
INSERT INTO inventory_movements (
    product_id,
    movement_type,
    quantity,
    unit_cost,
    reference_type,
    memo,
    is_confirmed,
    created_by
)
SELECT
    p.id,
    'initial',
    COALESCE(p.current_stock, 0),
    COALESCE(p.standard_price, 0),
    'initial_migration',
    'Day 7-8 初期在庫データ移行',
    true,
    (SELECT id FROM auth.users LIMIT 1)
FROM products p
WHERE COALESCE(p.current_stock, 0) > 0
AND NOT EXISTS (
    SELECT 1 FROM inventory_movements im
    WHERE im.product_id = p.id AND im.movement_type = 'initial'
);

-- ============================================
-- Step 9: 検証用クエリ
-- ============================================

DO $$
DECLARE
    products_count INTEGER;
    movements_count INTEGER;
    balances_count INTEGER;
    alerts_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO products_count FROM products;
    SELECT COUNT(*) INTO movements_count FROM inventory_movements;
    SELECT COUNT(*) INTO balances_count FROM inventory_balances;
    SELECT COUNT(*) INTO alerts_count FROM inventory_alerts;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Day 7-8 inventory拡張完了レポート';
    RAISE NOTICE '============================================';
    RAISE NOTICE '商品マスタ: % 件', products_count;
    RAISE NOTICE '在庫移動履歴: % 件', movements_count;
    RAISE NOTICE '在庫バランス: % 件', balances_count;
    RAISE NOTICE '在庫アラート: % 件', alerts_count;
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ inventory関連テーブル拡張が完了しました';
    RAISE NOTICE '実行日時: %', NOW();
    RAISE NOTICE '============================================';
END $$;