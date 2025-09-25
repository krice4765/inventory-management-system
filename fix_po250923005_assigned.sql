-- 🔧 PO250923005の担当者を山田太郎に設定

-- 修正前の状態確認
SELECT 'Before update' as status, order_no, assigned_user_id FROM purchase_orders WHERE order_no = 'PO250923005';

-- 山田太郎のIDで担当者を設定
UPDATE purchase_orders
SET assigned_user_id = '40b8bd1f-4e12-430c-aa78-c364ad75a35a',
    updated_at = NOW()
WHERE order_no = 'PO250923005';

-- 修正後の確認
SELECT 'After update' as status, order_no, assigned_user_id FROM purchase_orders WHERE order_no = 'PO250923005';