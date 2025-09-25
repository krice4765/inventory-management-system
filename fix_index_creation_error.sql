-- インデックス作成エラー修正版
-- ERROR: column "installment_number" does not exist の修正

-- =====================================================
-- エラー修正：インデックス作成（修正版）
-- =====================================================

-- transactionsテーブルのインデックス（修正版）
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_no ON transactions(transaction_no);
CREATE INDEX IF NOT EXISTS idx_transactions_partner_id ON transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_parent_order ON transactions(parent_order_id);

-- 分納関連インデックス（installment_numberカラムが存在する場合のみ）
DO $$
BEGIN
    -- installment_numberカラムが存在するかチェック
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions'
        AND column_name = 'installment_number'
        AND table_schema = 'public'
    ) THEN
        -- カラムが存在する場合のみインデックス作成
        CREATE INDEX IF NOT EXISTS idx_transactions_installment ON transactions(parent_order_id, installment_number);
        RAISE NOTICE '✅ installment_number インデックスを作成しました';
    ELSE
        RAISE NOTICE '⚠️  installment_number カラムが存在しないため、インデックスをスキップしました';
    END IF;
END $$;

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

-- 実行完了メッセージ
SELECT
    'インデックス作成' as operation,
    'エラー修正版実行完了' as status;