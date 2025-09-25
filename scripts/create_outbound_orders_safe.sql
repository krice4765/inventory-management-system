-- 安全なoutbound_ordersテーブル作成スクリプト
-- 前提条件を確認してから実行されます

-- Step 1: 前提条件の確認
DO $$
DECLARE
    products_exists BOOLEAN;
    auth_users_exists BOOLEAN;
    outbound_orders_exists BOOLEAN;
BEGIN
    -- productsテーブルの存在確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) INTO products_exists;

    -- auth.usersテーブルの存在確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) INTO auth_users_exists;

    -- outbound_ordersテーブルの存在確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'outbound_orders'
    ) INTO outbound_orders_exists;

    -- 結果レポート
    RAISE NOTICE '=== 前提条件確認結果 ===';
    RAISE NOTICE 'products テーブル: %', CASE WHEN products_exists THEN '✅ 存在' ELSE '❌ 不存在' END;
    RAISE NOTICE 'auth.users テーブル: %', CASE WHEN auth_users_exists THEN '✅ 存在' ELSE '❌ 不存在' END;
    RAISE NOTICE 'outbound_orders テーブル: %', CASE WHEN outbound_orders_exists THEN '⚠️ 既存在' ELSE '✅ 未存在（作成可能）' END;

    -- 前提条件チェック
    IF NOT products_exists THEN
        RAISE EXCEPTION 'products テーブルが存在しません。先にproductsテーブルを作成してください。';
    END IF;

    IF NOT auth_users_exists THEN
        RAISE EXCEPTION 'auth.users テーブルが存在しません。Supabaseの認証システムが正しく設定されていません。';
    END IF;

    IF outbound_orders_exists THEN
        RAISE NOTICE '⚠️ outbound_ordersテーブルは既に存在します。既存データを保持して処理を続行します。';
    END IF;

    RAISE NOTICE '✅ 前提条件確認完了 - テーブル作成を開始します';
END
$$;

-- Step 2: outbound_ordersテーブル作成（存在しない場合のみ）
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

-- Step 3: outbound_order_itemsテーブル作成（存在しない場合のみ）
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

-- Step 4: インデックス作成（存在しない場合のみ）
CREATE INDEX IF NOT EXISTS idx_outbound_orders_status ON outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_request_date ON outbound_orders(request_date);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_due_date ON outbound_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_customer_name ON outbound_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_order_number ON outbound_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_outbound_order_items_outbound_order_id ON outbound_order_items(outbound_order_id);
CREATE INDEX IF NOT EXISTS idx_outbound_order_items_product_id ON outbound_order_items(product_id);

-- Step 5: トリガー関数作成（存在しない場合のみ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 6: updated_atトリガー作成
DROP TRIGGER IF EXISTS update_outbound_orders_updated_at ON outbound_orders;
CREATE TRIGGER update_outbound_orders_updated_at
  BEFORE UPDATE ON outbound_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: RLS設定
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーの削除（エラー回避）
DROP POLICY IF EXISTS "Users can view all outbound orders" ON outbound_orders;
DROP POLICY IF EXISTS "Users can create outbound orders" ON outbound_orders;
DROP POLICY IF EXISTS "Users can update outbound orders" ON outbound_orders;
DROP POLICY IF EXISTS "Users can delete outbound orders" ON outbound_orders;
DROP POLICY IF EXISTS "Users can view all outbound order items" ON outbound_order_items;
DROP POLICY IF EXISTS "Users can create outbound order items" ON outbound_order_items;
DROP POLICY IF EXISTS "Users can update outbound order items" ON outbound_order_items;
DROP POLICY IF EXISTS "Users can delete outbound order items" ON outbound_order_items;

-- RLSポリシー作成
CREATE POLICY "Users can view all outbound orders" ON outbound_orders
  FOR SELECT USING (true);

CREATE POLICY "Users can create outbound orders" ON outbound_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update outbound orders" ON outbound_orders
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete outbound orders" ON outbound_orders
  FOR DELETE USING (true);

CREATE POLICY "Users can view all outbound order items" ON outbound_order_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create outbound order items" ON outbound_order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update outbound order items" ON outbound_order_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete outbound order items" ON outbound_order_items
  FOR DELETE USING (true);

-- Step 8: 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '🎉 outbound_ordersテーブルシステムの作成が完了しました！';
    RAISE NOTICE '📋 次のステップ:';
    RAISE NOTICE '   1. サンプルデータの投入（オプション）';
    RAISE NOTICE '   2. アプリケーションの404エラー解消確認';
    RAISE NOTICE '   3. 出庫管理機能のテスト';
END
$$;