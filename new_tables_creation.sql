-- 0922Youken.md準拠 新規テーブル作成
-- Phase 2: 出庫管理・FIFO評価・税表示設定テーブル

-- 1. 出庫管理テーブル作成
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

-- 2. 出庫明細テーブル作成
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

-- 3. FIFO計算層管理テーブル作成
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

-- 4. 税表示設定テーブル作成（既存確認付き）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tax_display_settings') THEN
        CREATE TABLE tax_display_settings (
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
        RAISE NOTICE '✅ tax_display_settings テーブルを作成しました';
    ELSE
        RAISE NOTICE '✅ tax_display_settings テーブルは既に存在します';
    END IF;
END $$;

-- 5. パフォーマンス最適化インデックス作成
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);
CREATE INDEX IF NOT EXISTS idx_products_tax_category ON products(tax_category);
CREATE INDEX IF NOT EXISTS idx_inventory_fifo_layers_product_date ON inventory_fifo_layers(product_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_status ON outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_outbound_order_items_outbound_id ON outbound_order_items(outbound_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_fifo_layers_remaining ON inventory_fifo_layers(product_id, remaining_quantity) WHERE remaining_quantity > 0;

-- 6. RLSポリシー設定（出庫管理）
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_fifo_layers ENABLE ROW LEVEL SECURITY;

-- 出庫管理のRLSポリシー
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
        RAISE NOTICE '✅ outbound_orders RLSポリシーを作成しました';
    ELSE
        RAISE NOTICE '✅ outbound_orders RLSポリシーは既に存在します';
    END IF;
END $$;

-- 出庫明細のRLSポリシー
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
        RAISE NOTICE '✅ outbound_order_items RLSポリシーを作成しました';
    ELSE
        RAISE NOTICE '✅ outbound_order_items RLSポリシーは既に存在します';
    END IF;
END $$;

-- FIFO層のRLSポリシー
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inventory_fifo_layers'
        AND policyname = 'inventory_users_can_view_fifo_layers'
    ) THEN
        CREATE POLICY "inventory_users_can_view_fifo_layers"
        ON inventory_fifo_layers FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.can_manage_inventory = true OR profiles.role = 'admin')
          )
        );
        RAISE NOTICE '✅ inventory_fifo_layers RLSポリシーを作成しました';
    ELSE
        RAISE NOTICE '✅ inventory_fifo_layers RLSポリシーは既に存在します';
    END IF;
END $$;

-- 7. テーブル作成確認
SELECT
    'テーブル作成確認' as check_type,
    table_name,
    CASE
        WHEN table_name IN ('outbound_orders', 'outbound_order_items', 'inventory_fifo_layers', 'tax_display_settings')
        THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('outbound_orders', 'outbound_order_items', 'inventory_fifo_layers', 'tax_display_settings')
ORDER BY table_name;

-- 8. インデックス作成確認
SELECT
    'インデックス確認' as check_type,
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;