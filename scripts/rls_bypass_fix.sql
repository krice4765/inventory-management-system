-- ===============================================================
-- RLS(Row Level Security) 一時的無効化スクリプト
-- テスト環境での401エラー解決用
-- ===============================================================

-- 注意: 本番環境では絶対に実行しないでください
-- このスクリプトはテスト目的でのみ使用してください

-- 1. 各テーブルのRLSを一時的に無効化
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_managers DISABLE ROW LEVEL SECURITY;

-- 2. 匿名ユーザーに対する基本的な権限付与
-- products テーブル
GRANT ALL ON products TO anon;
GRANT ALL ON products TO authenticated;

-- partners テーブル
GRANT ALL ON partners TO anon;
GRANT ALL ON partners TO authenticated;

-- transactions テーブル
GRANT ALL ON transactions TO anon;
GRANT ALL ON transactions TO authenticated;

-- transaction_items テーブル
GRANT ALL ON transaction_items TO anon;
GRANT ALL ON transaction_items TO authenticated;

-- purchase_order_items テーブル
GRANT ALL ON purchase_order_items TO anon;
GRANT ALL ON purchase_order_items TO authenticated;

-- inventory_movements テーブル
GRANT ALL ON inventory_movements TO anon;
GRANT ALL ON inventory_movements TO authenticated;

-- order_managers テーブル
GRANT ALL ON order_managers TO anon;
GRANT ALL ON order_managers TO authenticated;

-- 3. ビューに対する権限付与（存在する場合）
-- delivery_progress ビューが存在する場合
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'delivery_progress') THEN
        EXECUTE 'GRANT SELECT ON delivery_progress TO anon';
        EXECUTE 'GRANT SELECT ON delivery_progress TO authenticated';
    END IF;
END $$;

-- v_purchase_transactions ビューが存在する場合
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_purchase_transactions') THEN
        EXECUTE 'GRANT SELECT ON v_purchase_transactions TO anon';
        EXECUTE 'GRANT SELECT ON v_purchase_transactions TO authenticated';
    END IF;
END $$;

-- 4. シーケンスに対する権限付与
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. 設定確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasoids
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 完了メッセージ
SELECT 'RLS一時的無効化完了 - テスト用設定適用済み' AS result;
SELECT 'セキュリティ警告: 本番環境では絶対にRLSを再有効化してください' AS warning;