-- Manual SQL for creating outbound_orders tables
-- Copy and paste this into Supabase SQL Editor

-- 出庫管理テーブル
CREATE TABLE IF NOT EXISTS outbound_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  request_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  notes TEXT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 出庫指示明細テーブル
CREATE TABLE IF NOT EXISTS outbound_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
  quantity_shipped INTEGER NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
  unit_price_tax_excluded DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price_tax_included DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,3) NOT NULL DEFAULT 10.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_quantity_shipped_not_exceeds_requested
    CHECK (quantity_shipped <= quantity_requested)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_outbound_orders_status ON outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_request_date ON outbound_orders(request_date);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_due_date ON outbound_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_customer_name ON outbound_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_order_number ON outbound_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_outbound_order_items_outbound_order_id ON outbound_order_items(outbound_order_id);
CREATE INDEX IF NOT EXISTS idx_outbound_order_items_product_id ON outbound_order_items(product_id);

-- updated_atトリガー関数（既に存在する場合はスキップ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 出庫管理テーブルのupdated_atトリガー
DROP TRIGGER IF EXISTS update_outbound_orders_updated_at ON outbound_orders;
CREATE TRIGGER update_outbound_orders_updated_at
  BEFORE UPDATE ON outbound_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) ポリシー設定
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;

-- 出庫管理テーブルのRLSポリシー
CREATE POLICY "Users can view all outbound orders" ON outbound_orders
  FOR SELECT USING (true);

CREATE POLICY "Users can create outbound orders" ON outbound_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update outbound orders" ON outbound_orders
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete outbound orders" ON outbound_orders
  FOR DELETE USING (true);

-- 出庫指示明細テーブルのRLSポリシー
CREATE POLICY "Users can view all outbound order items" ON outbound_order_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create outbound order items" ON outbound_order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update outbound order items" ON outbound_order_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete outbound order items" ON outbound_order_items
  FOR DELETE USING (true);

-- サンプルデータ挿入
INSERT INTO outbound_orders (
  order_number,
  customer_name,
  request_date,
  due_date,
  status,
  total_amount,
  notes
) VALUES
(
  'OUT-20250923-001',
  '株式会社サンプル',
  '2025-09-22',
  '2025-09-25',
  'pending',
  150000,
  '緊急出荷依頼'
),
(
  'OUT-20250923-002',
  'テスト商事株式会社',
  '2025-09-21',
  '2025-09-24',
  'processing',
  200000,
  'システムテスト用データ'
),
(
  'OUT-20250923-003',
  '実装サポート株式会社',
  '2025-09-20',
  '2025-09-23',
  'completed',
  180000,
  '完了済み出庫指示'
),
(
  'OUT-20250923-004',
  'キャンセルテスト有限会社',
  '2025-09-19',
  '2025-09-22',
  'cancelled',
  120000,
  'キャンセル済み'
)
ON CONFLICT (order_number) DO NOTHING;