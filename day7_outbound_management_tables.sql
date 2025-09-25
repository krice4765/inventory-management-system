-- Day 7-8: 出庫管理テーブル作成・マイグレーション
-- 0922Youken.md Week 2 Phase 1: 出庫連携システム
-- 2025-09-22 実施

-- ============================================
-- Step 1: 出庫管理基盤テーブル
-- ============================================

-- 出庫タイプの定義
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbound_type') THEN
        CREATE TYPE outbound_type AS ENUM (
            'sale',         -- 売上出庫
            'transfer',     -- 移動出庫
            'return',       -- 返品出庫
            'adjustment',   -- 調整出庫
            'sample',       -- サンプル出庫
            'disposal'      -- 廃棄出庫
        );
        RAISE NOTICE '✅ outbound_type ENUM作成完了';
    END IF;
END $$;

-- 出庫ステータスの定義
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbound_status') THEN
        CREATE TYPE outbound_status AS ENUM (
            '下書き',        -- 作成中
            '承認待ち',      -- 承認待ち
            '承認済み',      -- 出庫指示済み
            '準備中',        -- ピッキング中
            '出庫完了',      -- 出庫完了
            'キャンセル'     -- キャンセル
        );
        RAISE NOTICE '✅ outbound_status ENUM作成完了';
    END IF;
END $$;

-- 出庫指示書（ヘッダー）テーブル
CREATE TABLE IF NOT EXISTS outbound_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_no VARCHAR(50) NOT NULL UNIQUE,

    -- 基本情報
    outbound_type outbound_type NOT NULL DEFAULT 'sale',
    status outbound_status NOT NULL DEFAULT '下書き',

    -- 関連情報
    reference_type VARCHAR(50), -- sales_order, transfer_order等
    reference_id UUID,
    purchase_order_id UUID REFERENCES purchase_orders(id),

    -- 出庫先情報
    customer_id UUID, -- 出庫先（顧客・店舗等）
    destination_name VARCHAR(200),
    destination_address TEXT,
    destination_contact VARCHAR(100),
    destination_phone VARCHAR(50),

    -- 日程情報
    requested_date DATE NOT NULL,
    scheduled_date DATE,
    completed_date DATE,

    -- 担当者
    assigned_user_id UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),

    -- 配送情報
    shipping_method VARCHAR(100),
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    shipping_notes TEXT,
    tracking_number VARCHAR(100),

    -- Day 7-8仕様: 在庫減算連携
    inventory_reserved BOOLEAN DEFAULT FALSE, -- 在庫予約済み
    inventory_reduced BOOLEAN DEFAULT FALSE,  -- 在庫減算済み
    auto_inventory_reduction BOOLEAN DEFAULT TRUE, -- 自動在庫減算

    -- 金額情報
    total_quantity DECIMAL(15,3) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,

    -- メタデータ
    priority INTEGER DEFAULT 1, -- 1:低, 2:中, 3:高, 4:緊急
    memo TEXT,
    internal_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 出庫指示明細テーブル
CREATE TABLE IF NOT EXISTS outbound_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),

    -- 数量情報
    requested_quantity DECIMAL(15,3) NOT NULL,
    allocated_quantity DECIMAL(15,3) DEFAULT 0, -- 引当済み数量
    picked_quantity DECIMAL(15,3) DEFAULT 0,    -- ピッキング済み数量
    shipped_quantity DECIMAL(15,3) DEFAULT 0,   -- 出庫済み数量

    -- 金額情報（FIFO評価対応）
    unit_cost DECIMAL(15,4), -- FIFO単価
    total_cost DECIMAL(15,2), -- 総原価
    unit_price DECIMAL(15,2), -- 売価
    total_amount DECIMAL(15,2), -- 売上金額

    -- Day 7-8仕様: 税率対応
    tax_category VARCHAR(20),
    tax_rate DECIMAL(5,3),
    tax_amount DECIMAL(15,2),

    -- 在庫引当情報
    inventory_allocated BOOLEAN DEFAULT FALSE,
    allocation_batch_id UUID,

    -- ロット・シリアル管理
    lot_number VARCHAR(100),
    serial_number VARCHAR(100),
    expiration_date DATE,

    -- 場所情報
    location_code VARCHAR(50),
    bin_code VARCHAR(50),

    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Step 2: 在庫引当・ピッキング管理テーブル
-- ============================================

-- 在庫引当テーブル（FIFO対応）
CREATE TABLE IF NOT EXISTS inventory_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
    outbound_item_id UUID NOT NULL REFERENCES outbound_order_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    fifo_layer_id UUID REFERENCES inventory_fifo_layers(id),

    -- 引当情報
    allocated_quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4),
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- ステータス
    is_picked BOOLEAN DEFAULT FALSE,
    picked_quantity DECIMAL(15,3) DEFAULT 0,
    picked_at TIMESTAMP WITH TIME ZONE,
    picked_by UUID REFERENCES auth.users(id),

    -- バッチ管理
    batch_id UUID,
    allocation_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ピッキングリストテーブル
CREATE TABLE IF NOT EXISTS picking_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_no VARCHAR(50) NOT NULL UNIQUE,

    -- 基本情報
    picking_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled

    -- 担当者
    assigned_picker UUID REFERENCES auth.users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 統計
    total_items INTEGER DEFAULT 0,
    picked_items INTEGER DEFAULT 0,
    total_quantity DECIMAL(15,3) DEFAULT 0,
    picked_quantity DECIMAL(15,3) DEFAULT 0,

    -- エリア・ルート
    picking_area VARCHAR(100),
    picking_route TEXT,

    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ピッキングリスト明細
CREATE TABLE IF NOT EXISTS picking_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    picking_list_id UUID NOT NULL REFERENCES picking_lists(id) ON DELETE CASCADE,
    outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id),
    outbound_item_id UUID NOT NULL REFERENCES outbound_order_items(id),
    allocation_id UUID REFERENCES inventory_allocations(id),

    product_id UUID NOT NULL REFERENCES products(id),

    -- 数量
    planned_quantity DECIMAL(15,3) NOT NULL,
    picked_quantity DECIMAL(15,3) DEFAULT 0,

    -- 場所
    location_code VARCHAR(50),
    bin_code VARCHAR(50),

    -- ステータス
    is_picked BOOLEAN DEFAULT FALSE,
    picked_at TIMESTAMP WITH TIME ZONE,
    picking_order INTEGER DEFAULT 0,

    -- ロット・シリアル
    lot_number VARCHAR(100),
    serial_number VARCHAR(100),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Step 3: 出庫実績・配送管理テーブル
-- ============================================

-- 出庫実績テーブル
CREATE TABLE IF NOT EXISTS outbound_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_no VARCHAR(50) NOT NULL UNIQUE,
    outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id),

    -- 出庫情報
    shipped_date DATE NOT NULL,
    shipped_time TIME,
    shipped_by UUID REFERENCES auth.users(id),

    -- 配送情報
    carrier_name VARCHAR(100),
    tracking_number VARCHAR(100),
    shipping_method VARCHAR(100),
    estimated_delivery DATE,
    actual_delivery DATE,

    -- パッケージ情報
    package_count INTEGER DEFAULT 1,
    total_weight DECIMAL(10,3),
    total_volume DECIMAL(10,6),

    -- ステータス
    delivery_status VARCHAR(20) DEFAULT 'shipped', -- shipped, in_transit, delivered, failed

    -- 原価・金額
    total_cost DECIMAL(15,2),
    shipping_cost DECIMAL(10,2),

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 配送追跡テーブル
CREATE TABLE IF NOT EXISTS shipment_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES outbound_shipments(id) ON DELETE CASCADE,

    -- 追跡情報
    tracking_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL,
    location VARCHAR(200),
    description TEXT,

    -- 外部システム連携
    external_tracking_id VARCHAR(100),
    carrier_status_code VARCHAR(20),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Step 4: インデックスの作成
-- ============================================

-- 出庫指示書
CREATE INDEX IF NOT EXISTS idx_outbound_orders_status_date
ON outbound_orders(status, requested_date);

CREATE INDEX IF NOT EXISTS idx_outbound_orders_customer
ON outbound_orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_orders_assigned
ON outbound_orders(assigned_user_id, status);

CREATE INDEX IF NOT EXISTS idx_outbound_orders_reference
ON outbound_orders(reference_type, reference_id);

-- 出庫明細
CREATE INDEX IF NOT EXISTS idx_outbound_items_product
ON outbound_order_items(product_id, outbound_order_id);

CREATE INDEX IF NOT EXISTS idx_outbound_items_allocation
ON outbound_order_items(inventory_allocated, outbound_order_id);

-- 在庫引当
CREATE INDEX IF NOT EXISTS idx_allocations_product_fifo
ON inventory_allocations(product_id, fifo_layer_id);

CREATE INDEX IF NOT EXISTS idx_allocations_outbound
ON inventory_allocations(outbound_order_id, is_picked);

CREATE INDEX IF NOT EXISTS idx_allocations_batch
ON inventory_allocations(batch_id) WHERE batch_id IS NOT NULL;

-- ピッキング
CREATE INDEX IF NOT EXISTS idx_picking_lists_date_status
ON picking_lists(picking_date, status);

CREATE INDEX IF NOT EXISTS idx_picking_items_list_order
ON picking_list_items(picking_list_id, picking_order);

-- 出庫実績
CREATE INDEX IF NOT EXISTS idx_shipments_date
ON outbound_shipments(shipped_date DESC);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking
ON outbound_shipments(tracking_number) WHERE tracking_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracking_shipment_date
ON shipment_tracking(shipment_id, tracking_date);

-- ============================================
-- Step 5: 出庫番号生成関数
-- ============================================

CREATE OR REPLACE FUNCTION generate_outbound_no(order_type outbound_type DEFAULT 'sale')
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    date_part TEXT;
    sequence_no INTEGER;
    result TEXT;
BEGIN
    -- タイプ別プレフィックス
    prefix := CASE order_type
        WHEN 'sale' THEN 'OUT'
        WHEN 'transfer' THEN 'TRF'
        WHEN 'return' THEN 'RTN'
        WHEN 'adjustment' THEN 'ADJ'
        WHEN 'sample' THEN 'SMP'
        WHEN 'disposal' THEN 'DIS'
        ELSE 'OUT'
    END;

    -- 日付部分（YYMMDD）
    date_part := TO_CHAR(CURRENT_DATE, 'YYMMDD');

    -- 今日の連番を取得
    SELECT COALESCE(MAX(CAST(SUBSTRING(outbound_no FROM LENGTH(prefix || date_part) + 1) AS INTEGER)), 0) + 1
    INTO sequence_no
    FROM outbound_orders
    WHERE outbound_no LIKE (prefix || date_part || '%');

    -- 結果生成（例: OUT241225001）
    result := prefix || date_part || LPAD(sequence_no::TEXT, 3, '0');

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: 在庫引当・減算関数
-- ============================================

-- FIFO在庫引当関数
CREATE OR REPLACE FUNCTION allocate_inventory_fifo(
    p_outbound_item_id UUID,
    p_product_id UUID,
    p_quantity DECIMAL(15,3)
) RETURNS TABLE(
    allocation_id UUID,
    fifo_layer_id UUID,
    allocated_quantity DECIMAL(15,3),
    unit_cost DECIMAL(15,4)
) AS $$
DECLARE
    layer RECORD;
    remaining_qty DECIMAL(15,3) := p_quantity;
    allocation_batch UUID := gen_random_uuid();
BEGIN
    -- FIFO順でレイヤーを取得
    FOR layer IN
        SELECT id, remaining_quantity, unit_cost
        FROM inventory_fifo_layers
        WHERE product_id = p_product_id
          AND remaining_quantity > 0
          AND NOT is_fully_consumed
        ORDER BY layer_date, created_at
    LOOP
        DECLARE
            alloc_qty DECIMAL(15,3);
        BEGIN
            -- 引当数量を決定
            alloc_qty := LEAST(layer.remaining_quantity, remaining_qty);

            -- 引当レコード作成
            INSERT INTO inventory_allocations (
                outbound_item_id,
                product_id,
                fifo_layer_id,
                allocated_quantity,
                unit_cost,
                batch_id
            ) VALUES (
                p_outbound_item_id,
                p_product_id,
                layer.id,
                alloc_qty,
                layer.unit_cost,
                allocation_batch
            ) RETURNING id INTO allocation_id;

            -- FIFO層の残量を更新
            UPDATE inventory_fifo_layers
            SET remaining_quantity = remaining_quantity - alloc_qty,
                is_fully_consumed = (remaining_quantity - alloc_qty <= 0),
                updated_at = NOW()
            WHERE id = layer.id;

            -- 結果を返す
            fifo_layer_id := layer.id;
            allocated_quantity := alloc_qty;
            unit_cost := layer.unit_cost;
            RETURN NEXT;

            remaining_qty := remaining_qty - alloc_qty;

            -- 必要数量を満たした場合は終了
            EXIT WHEN remaining_qty <= 0;
        END;
    END LOOP;

    -- 引当不足の場合はエラー
    IF remaining_qty > 0 THEN
        RAISE EXCEPTION 'Insufficient inventory for product %. Required: %, Available: %',
            p_product_id, p_quantity, p_quantity - remaining_qty;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 在庫減算実行関数
CREATE OR REPLACE FUNCTION execute_inventory_reduction(p_outbound_order_id UUID)
RETURNS TABLE(
    product_id UUID,
    reduced_quantity DECIMAL(15,3),
    total_cost DECIMAL(15,2)
) AS $$
DECLARE
    outbound_item RECORD;
    movement_batch UUID := gen_random_uuid();
BEGIN
    -- 出庫指示が承認済みかチェック
    IF NOT EXISTS (
        SELECT 1 FROM outbound_orders
        WHERE id = p_outbound_order_id AND status IN ('承認済み', '出庫完了')
    ) THEN
        RAISE EXCEPTION 'Outbound order % is not approved for inventory reduction', p_outbound_order_id;
    END IF;

    -- 各明細に対して在庫減算を実行
    FOR outbound_item IN
        SELECT oi.product_id, oi.shipped_quantity, oi.id as item_id
        FROM outbound_order_items oi
        WHERE oi.outbound_order_id = p_outbound_order_id
          AND oi.shipped_quantity > 0
    LOOP
        -- 在庫移動記録の作成
        INSERT INTO inventory_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            reference_item_id,
            batch_id,
            is_confirmed,
            memo
        ) VALUES (
            outbound_item.product_id,
            'outbound',
            -outbound_item.shipped_quantity, -- 負の値で減算
            'outbound_orders',
            p_outbound_order_id,
            outbound_item.item_id,
            movement_batch,
            TRUE,
            format('出庫による在庫減算 (出庫指示: %s)',
                (SELECT outbound_no FROM outbound_orders WHERE id = p_outbound_order_id))
        );

        -- 結果を返す
        product_id := outbound_item.product_id;
        reduced_quantity := outbound_item.shipped_quantity;
        total_cost := 0; -- 実装時にFIFO原価を計算
        RETURN NEXT;
    END LOOP;

    -- 出庫指示の在庫減算フラグを更新
    UPDATE outbound_orders
    SET inventory_reduced = TRUE,
        updated_at = NOW()
    WHERE id = p_outbound_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: RLSポリシー設定
-- ============================================

-- 全ての出庫関連テーブルにRLS適用
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE picking_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE picking_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;

-- 基本的なアクセスポリシー
CREATE POLICY "Users can access outbound orders" ON outbound_orders
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access outbound items" ON outbound_order_items
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access allocations" ON inventory_allocations
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access picking lists" ON picking_lists
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access picking items" ON picking_list_items
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access shipments" ON outbound_shipments
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can access tracking" ON shipment_tracking
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================
-- Step 8: サンプルデータと検証
-- ============================================

-- 出庫管理テーブルの作成確認
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    function_count INTEGER;
BEGIN
    -- テーブル数確認
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN (
        'outbound_orders', 'outbound_order_items', 'inventory_allocations',
        'picking_lists', 'picking_list_items', 'outbound_shipments', 'shipment_tracking'
    );

    -- インデックス数確認
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE indexname LIKE '%outbound%' OR indexname LIKE '%picking%' OR indexname LIKE '%allocation%';

    -- 関数数確認
    SELECT COUNT(*) INTO function_count
    FROM pg_proc
    WHERE proname IN ('generate_outbound_no', 'allocate_inventory_fifo', 'execute_inventory_reduction');

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Day 7-8 出庫管理テーブル作成完了レポート';
    RAISE NOTICE '============================================';
    RAISE NOTICE '作成されたテーブル数: %', table_count;
    RAISE NOTICE '作成されたインデックス数: %', index_count;
    RAISE NOTICE '作成された関数数: %', function_count;
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ 出庫管理システムのテーブル作成が完了しました';
    RAISE NOTICE '実行日時: %', NOW();
    RAISE NOTICE '============================================';
END $$;