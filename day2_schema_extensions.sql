-- ========================================
-- Day 2: データベーススキーマ拡張
-- 富士精工様向け仕入管理システム統合改善
-- ========================================

-- 1. ordersテーブル拡張
-- 要件書に基づく追加カラム
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_tax_rate DECIMAL(5,2) DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES profiles(id);

-- 2. productsテーブル拡張（税区分対応）
ALTER TABLE products
ADD COLUMN IF NOT EXISTS tax_category VARCHAR DEFAULT 'standard_10'
CHECK (tax_category IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt')),
ADD COLUMN IF NOT EXISTS safety_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS optimal_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_category_updated_at TIMESTAMP DEFAULT NOW();

-- 3. inventoryテーブル拡張（FIFO評価額管理）
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS valuation_price_tax_excluded DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS valuation_price_tax_included DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_fifo_calculation TIMESTAMP DEFAULT NOW();

-- 4. inventory_movementsテーブル拡張
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS unit_price_tax_excluded DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS unit_price_tax_included DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS applied_tax_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS fifo_layer_id UUID;

-- ========================================
-- 新規テーブル作成
-- ========================================

-- 5. 出庫管理テーブル
CREATE TABLE IF NOT EXISTS outbound_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR UNIQUE NOT NULL,
  customer_name VARCHAR NOT NULL,
  request_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  notes TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. 出庫明細テーブル
CREATE TABLE IF NOT EXISTS outbound_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_order_id UUID REFERENCES outbound_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity_requested INTEGER NOT NULL,
  quantity_shipped INTEGER DEFAULT 0,
  unit_price_tax_excluded DECIMAL(10,2),
  unit_price_tax_included DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. FIFO計算層管理テーブル
CREATE TABLE IF NOT EXISTS inventory_fifo_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  purchase_date DATE NOT NULL,
  unit_cost_tax_excluded DECIMAL(10,2) NOT NULL,
  unit_cost_tax_included DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL,
  original_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. 税表示設定テーブル
CREATE TABLE IF NOT EXISTS tax_display_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID REFERENCES profiles(id),
  setting_type VARCHAR NOT NULL
    CHECK (setting_type IN ('organization', 'user')),
  tax_display_preference VARCHAR NOT NULL
    CHECK (tax_display_preference IN ('tax_included', 'tax_excluded')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- パフォーマンス最適化インデックス
-- ========================================

-- 9. インデックス作成
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_user ON orders(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_products_tax_category ON products(tax_category);
CREATE INDEX IF NOT EXISTS idx_inventory_fifo_layers_product_date ON inventory_fifo_layers(product_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_status ON outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_tax_display_settings_user ON tax_display_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_display_settings_org ON tax_display_settings(organization_id);

-- ========================================
-- RLSポリシー設定
-- ========================================

-- 10. RLSポリシー（出庫管理）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'outbound_orders'
        AND policyname = 'inventory_users_can_manage_outbound'
    ) THEN
        CREATE POLICY "inventory_users_can_manage_outbound"
        ON outbound_orders FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.can_manage_inventory = true OR profiles.role = 'admin')
          )
        );
    END IF;
END
$$;

-- 11. RLSポリシー（出庫明細）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'outbound_order_items'
        AND policyname = 'inventory_users_can_manage_outbound_items'
    ) THEN
        CREATE POLICY "inventory_users_can_manage_outbound_items"
        ON outbound_order_items FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.can_manage_inventory = true OR profiles.role = 'admin')
          )
        );
    END IF;
END
$$;

-- 12. RLSポリシー（税表示設定）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'tax_display_settings'
        AND policyname = 'users_can_manage_own_tax_settings'
    ) THEN
        CREATE POLICY "users_can_manage_own_tax_settings"
        ON tax_display_settings FOR ALL
        USING (
          user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        );
    END IF;
END
$$;

-- RLSを有効化
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_display_settings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 初期データの投入
-- ========================================

-- 13. デフォルト税表示設定（組織レベル）
INSERT INTO tax_display_settings (
  organization_id,
  setting_type,
  tax_display_preference
)
SELECT
  'default_org'::UUID,
  'organization',
  'tax_included'
WHERE NOT EXISTS (
  SELECT 1 FROM tax_display_settings
  WHERE setting_type = 'organization'
  AND organization_id = 'default_org'::UUID
);

-- 14. 既存商品の税区分を設定（デフォルト10%）
UPDATE products
SET tax_category = 'standard_10',
    tax_category_updated_at = NOW()
WHERE tax_category IS NULL;

-- ========================================
-- 確認クエリ
-- ========================================

-- 15. 拡張確認
SELECT
  'orders' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('due_date', 'shipping_cost', 'assigned_user_id')

UNION ALL

SELECT
  'products' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('tax_category', 'safety_stock', 'optimal_stock')

UNION ALL

SELECT
  'new_tables' as table_name,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_name IN (
  'outbound_orders',
  'outbound_order_items',
  'inventory_fifo_layers',
  'tax_display_settings'
);

-- 16. サンプルデータ表示
SELECT 'Schema extension completed successfully' as status;