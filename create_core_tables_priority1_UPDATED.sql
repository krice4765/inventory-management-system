-- 優先度1: 基幹テーブル作成スクリプト（修正版）
-- transactions, orders, inventory テーブル作成
-- 調査結果に基づき、transactionsテーブルを最重要として追加

-- =====================================================
-- 1. transactionsテーブル作成（最重要：43回使用）
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_no VARCHAR(50) UNIQUE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'purchase'
        CHECK (transaction_type IN ('purchase', 'sale', 'adjustment')),
    partner_id UUID REFERENCES partners(id),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),

    -- 分納システム対応
    parent_order_id UUID,
    installment_number INTEGER DEFAULT 1,
    is_installment BOOLEAN DEFAULT false,

    -- 金額（税抜き・税込み対応）
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- メタデータ
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    assigned_user_id UUID REFERENCES auth.users(id),

    -- タイムスタンプ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. transaction_itemsテーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),

    -- 数量と価格
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- 税金関連
    tax_rate DECIMAL(5,3) DEFAULT 10.000,
    tax_amount DECIMAL(10,2) DEFAULT 0,

    -- メタデータ
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. ordersテーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    partner_id UUID REFERENCES partners(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    delivery_deadline DATE,

    -- 金額関連（税抜き・税込み対応）
    subtotal_tax_excluded DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal_tax_included DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    shipping_tax_rate DECIMAL(5,2) DEFAULT 0.10,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- ユーザー管理
    assigned_user_id UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),

    -- メタデータ
    notes TEXT,
    metadata JSONB,

    -- タイムスタンプ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. order_itemsテーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),

    -- 数量
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    shipped_quantity INTEGER NOT NULL DEFAULT 0 CHECK (shipped_quantity >= 0),

    -- 単価（税抜き・税込み）
    unit_price_tax_excluded DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit_price_tax_included DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,3) NOT NULL DEFAULT 10.000,

    -- 小計
    subtotal_tax_excluded DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal_tax_included DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- タイムスタンプ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 制約
    CONSTRAINT check_shipped_not_exceeds_quantity
        CHECK (shipped_quantity <= quantity)
);

-- =====================================================
-- 5. inventoryテーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),

    -- 在庫数量
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,

    -- FIFO評価額
    valuation_price_tax_excluded DECIMAL(12,2),
    valuation_price_tax_included DECIMAL(12,2),
    total_valuation_tax_excluded DECIMAL(12,2) GENERATED ALWAYS AS (quantity * valuation_price_tax_excluded) STORED,
    total_valuation_tax_included DECIMAL(12,2) GENERATED ALWAYS AS (quantity * valuation_price_tax_included) STORED,

    -- 在庫場所・ロット管理
    location VARCHAR(100),
    lot_number VARCHAR(50),
    expiry_date DATE,

    -- タイムスタンプ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 制約
    CONSTRAINT check_reserved_not_exceeds_quantity
        CHECK (reserved_quantity <= quantity),
    CONSTRAINT unique_product_location_lot
        UNIQUE (product_id, location, lot_number)
);

-- =====================================================
-- 6. inventory_movementsテーブル作成（18回使用）
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),

    -- 移動タイプ
    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN ('inbound', 'outbound', 'adjustment', 'transfer', 'reserved', 'unreserved')),

    -- 数量変動
    quantity_change INTEGER NOT NULL, -- 正数=入庫、負数=出庫
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,

    -- 関連情報
    reference_type VARCHAR(20), -- 'order', 'purchase_order', 'transaction', 'adjustment'
    reference_id UUID,

    -- FIFO対応
    unit_cost_tax_excluded DECIMAL(10,2),
    unit_cost_tax_included DECIMAL(10,2),

    -- メタデータ
    notes TEXT,
    performed_by UUID REFERENCES auth.users(id),

    -- タイムスタンプ
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. インデックス作成
-- =====================================================

-- transactionsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_no ON transactions(transaction_no);
CREATE INDEX IF NOT EXISTS idx_transactions_partner_id ON transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_parent_order ON transactions(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_installment ON transactions(parent_order_id, installment_number);

-- transaction_itemsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items(product_id);

-- ordersテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_deadline ON orders(delivery_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_user ON orders(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- order_itemsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- inventoryテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);
CREATE INDEX IF NOT EXISTS idx_inventory_lot_number ON inventory(lot_number);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_available_quantity ON inventory(available_quantity);

-- inventory_movementsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_performed_by ON inventory_movements(performed_by);

-- =====================================================
-- 8. トリガー関数作成
-- =====================================================

-- updated_atカラム自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atトリガー設定
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transaction_items_updated_at ON transaction_items;
CREATE TRIGGER update_transaction_items_updated_at
    BEFORE UPDATE ON transaction_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items;
CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. 自動番号生成関数
-- =====================================================

-- 取引番号自動生成関数
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TEXT AS $$
DECLARE
    current_date_str TEXT;
    sequence_num INTEGER;
    transaction_no TEXT;
BEGIN
    current_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    SELECT COALESCE(MAX(
        CASE
            WHEN transaction_no LIKE 'TXN-' || current_date_str || '-%'
            THEN CAST(SPLIT_PART(transaction_no, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO sequence_num
    FROM transactions
    WHERE transaction_no LIKE 'TXN-' || current_date_str || '-%';

    transaction_no := 'TXN-' || current_date_str || '-' || LPAD(sequence_num::TEXT, 3, '0');

    RETURN transaction_no;
END;
$$ LANGUAGE plpgsql;

-- 注文番号自動生成関数
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    current_date_str TEXT;
    sequence_num INTEGER;
    order_number TEXT;
BEGIN
    current_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    SELECT COALESCE(MAX(
        CASE
            WHEN order_number LIKE 'ORD-' || current_date_str || '-%'
            THEN CAST(SPLIT_PART(order_number, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO sequence_num
    FROM orders
    WHERE order_number LIKE 'ORD-' || current_date_str || '-%';

    order_number := 'ORD-' || current_date_str || '-' || LPAD(sequence_num::TEXT, 3, '0');

    RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- 取引番号自動設定トリガー
CREATE OR REPLACE FUNCTION set_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_no IS NULL OR NEW.transaction_no = '' THEN
        NEW.transaction_no := generate_transaction_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 注文番号自動設定トリガー
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_transaction_number ON transactions;
CREATE TRIGGER trigger_set_transaction_number
    BEFORE INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_transaction_number();

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- =====================================================
-- 10. RLS (Row Level Security) 設定
-- =====================================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLSポリシー設定（認証済みユーザーのみアクセス可能）
CREATE POLICY "Users can view all transactions" ON transactions
    FOR SELECT USING (true);
CREATE POLICY "Users can create transactions" ON transactions
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update transactions" ON transactions
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete transactions" ON transactions
    FOR DELETE USING (true);

CREATE POLICY "Users can view all transaction items" ON transaction_items
    FOR SELECT USING (true);
CREATE POLICY "Users can create transaction items" ON transaction_items
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update transaction items" ON transaction_items
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete transaction items" ON transaction_items
    FOR DELETE USING (true);

CREATE POLICY "Users can view all orders" ON orders
    FOR SELECT USING (true);
CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update orders" ON orders
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete orders" ON orders
    FOR DELETE USING (true);

CREATE POLICY "Users can view all order items" ON order_items
    FOR SELECT USING (true);
CREATE POLICY "Users can create order items" ON order_items
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update order items" ON order_items
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete order items" ON order_items
    FOR DELETE USING (true);

CREATE POLICY "Users can view all inventory" ON inventory
    FOR SELECT USING (true);
CREATE POLICY "Users can create inventory" ON inventory
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update inventory" ON inventory
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete inventory" ON inventory
    FOR DELETE USING (true);

CREATE POLICY "Users can view all inventory movements" ON inventory_movements
    FOR SELECT USING (true);
CREATE POLICY "Users can create inventory movements" ON inventory_movements
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update inventory movements" ON inventory_movements
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete inventory movements" ON inventory_movements
    FOR DELETE USING (true);

-- =====================================================
-- 11. サンプルデータ挿入
-- =====================================================

-- サンプル取引データ
INSERT INTO transactions (
    id,
    transaction_no,
    transaction_type,
    partner_id,
    transaction_date,
    due_date,
    status,
    subtotal,
    tax_amount,
    total_amount,
    notes
) VALUES
(
    1,
    'TXN-20250924-001',
    'purchase',
    (SELECT id FROM partners LIMIT 1),
    '2025-09-24',
    '2025-09-30',
    'confirmed',
    100000,
    10000,
    110000,
    'サンプル取引データ'
),
(
    2,
    'TXN-20250924-002',
    'purchase',
    (SELECT id FROM partners LIMIT 1),
    '2025-09-23',
    '2025-09-29',
    'draft',
    200000,
    20000,
    220000,
    'ドラフト取引'
)
ON CONFLICT (id) DO NOTHING;

-- サンプル注文データ
INSERT INTO orders (
    id,
    order_number,
    partner_id,
    status,
    order_date,
    due_date,
    delivery_deadline,
    subtotal_tax_excluded,
    subtotal_tax_included,
    tax_amount,
    total_amount,
    notes
) VALUES
(
    'sample-order-001',
    'ORD-20250924-001',
    (SELECT id FROM partners LIMIT 1),
    'pending',
    '2025-09-24',
    '2025-09-30',
    '2025-10-01',
    100000,
    110000,
    10000,
    110000,
    'サンプル注文データ'
)
ON CONFLICT (id) DO NOTHING;

-- サンプル在庫データ（既存productsに対して）
INSERT INTO inventory (
    product_id,
    quantity,
    reserved_quantity,
    valuation_price_tax_excluded,
    valuation_price_tax_included,
    location,
    lot_number
)
SELECT
    p.id,
    100,
    0,
    15000.00,
    16500.00,
    'A-01-01',
    'LOT20250924001'
FROM products p
LIMIT 3
ON CONFLICT (product_id, location, lot_number) DO NOTHING;

-- コメント追加
COMMENT ON TABLE transactions IS '取引管理テーブル - 仕入・販売・調整取引の記録';
COMMENT ON TABLE transaction_items IS '取引明細テーブル - 取引に含まれる商品の詳細';
COMMENT ON TABLE orders IS '注文管理テーブル - 顧客からの注文情報';
COMMENT ON TABLE order_items IS '注文明細テーブル - 注文に含まれる商品の詳細';
COMMENT ON TABLE inventory IS '在庫管理テーブル - 商品の在庫状況と評価額';
COMMENT ON TABLE inventory_movements IS '在庫移動履歴テーブル - 在庫の入出庫記録';

COMMENT ON COLUMN transactions.transaction_no IS '取引番号（自動生成）';
COMMENT ON COLUMN transactions.parent_order_id IS '分納の場合の親注文ID';
COMMENT ON COLUMN transactions.installment_number IS '分納回数（1回目、2回目など）';
COMMENT ON COLUMN inventory.available_quantity IS '利用可能在庫数（総在庫 - 予約済み在庫）';
COMMENT ON COLUMN inventory_movements.movement_type IS '移動タイプ: inbound(入庫), outbound(出庫), adjustment(調整), transfer(移動), reserved(予約), unreserved(予約解除)';

-- 実行完了メッセージ
SELECT
    'transactions' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions')
         THEN '✅ 作成完了' ELSE '❌ 作成失敗' END as status
UNION ALL
SELECT
    'transaction_items',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_items')
         THEN '✅ 作成完了' ELSE '❌ 作成失敗' END
UNION ALL
SELECT
    'orders',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders')
         THEN '✅ 作成完了' ELSE '❌ 作成失敗' END
UNION ALL
SELECT
    'order_items',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items')
         THEN '✅ 作成完了' ELSE '❌ 作成失敗' END
UNION ALL
SELECT
    'inventory',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory')
         THEN '✅ 作成完了' ELSE '❌ 作成失敗' END
UNION ALL
SELECT
    'inventory_movements',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_movements')
         THEN '✅ 作成完了' ELSE '❌ 作成失敗' END;