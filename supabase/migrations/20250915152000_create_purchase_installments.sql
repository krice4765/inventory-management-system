-- purchase_installments テーブルの作成
-- パフォーマンステスト用の分納情報テーブル

-- 既存のテーブルを削除
DROP TABLE IF EXISTS purchase_installments CASCADE;

-- purchase_installments テーブルを作成
CREATE TABLE purchase_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES purchase_orders(id) NOT NULL,
    installment_number INTEGER NOT NULL,
    planned_delivery_date DATE,
    actual_delivery_date DATE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'delivered', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_purchase_installments_order_id ON purchase_installments(purchase_order_id);
CREATE INDEX idx_purchase_installments_status ON purchase_installments(status);
CREATE INDEX idx_purchase_installments_delivery_date ON purchase_installments(planned_delivery_date);

-- RLS有効化
ALTER TABLE purchase_installments ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーのみアクセス可能なポリシー
CREATE POLICY "authenticated_access_purchase_installments" ON purchase_installments
    FOR ALL USING (auth.uid() IS NOT NULL);

-- サンプルデータを投入（パフォーマンステスト用）
INSERT INTO purchase_installments (purchase_order_id, installment_number, planned_delivery_date, quantity, unit_price, total_amount, status)
SELECT
    po.id,
    1 as installment_number,
    (po.created_at::date + INTERVAL '7 days')::date as planned_delivery_date,
    CASE WHEN poi.quantity IS NOT NULL THEN poi.quantity ELSE 10 END as quantity,
    CASE WHEN poi.unit_price IS NOT NULL THEN poi.unit_price ELSE 1000.00 END as unit_price,
    CASE WHEN poi.total_amount IS NOT NULL THEN poi.total_amount ELSE 10000.00 END as total_amount,
    'planned' as status
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
LIMIT 20
ON CONFLICT DO NOTHING;

-- 完了メッセージ
SELECT 'purchase_installments table created successfully' as status;