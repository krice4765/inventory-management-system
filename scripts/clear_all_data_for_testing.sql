-- ===============================================================
-- WebUI業務完結性テスト用データクリアスクリプト
-- 全テーブルのデータを安全にクリア
-- ===============================================================

-- データベースの整合性を保持しながらクリア実行
-- 外部キー制約順を考慮してクリア順序を決定

-- 1. 取引関連（子テーブルから先にクリア）
TRUNCATE TABLE transaction_items CASCADE;
TRUNCATE TABLE transactions CASCADE;

-- 2. 発注関連
TRUNCATE TABLE purchase_order_items CASCADE;
-- 発注進捗ビューは実テーブルではないため対象外

-- 3. 在庫移動履歴
TRUNCATE TABLE inventory_movements CASCADE;

-- 4. 発注担当者（中間テーブル）
TRUNCATE TABLE order_managers CASCADE;

-- 5. マスタデータ（参照先を最後にクリア）
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE partners CASCADE;

-- シーケンスのリセット（必要に応じて）
-- ALTER SEQUENCE products_id_seq RESTART WITH 1;
-- ALTER SEQUENCE partners_id_seq RESTART WITH 1;
-- ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE transaction_items_id_seq RESTART WITH 1;
-- ALTER SEQUENCE purchase_order_items_id_seq RESTART WITH 1;
-- ALTER SEQUENCE inventory_movements_id_seq RESTART WITH 1;
-- ALTER SEQUENCE order_managers_id_seq RESTART WITH 1;

-- 完了メッセージ
SELECT 'データクリア完了: 全テーブルが空になりました' AS result;

-- クリア後の確認クエリ
SELECT 
    'products' as table_name, 
    COUNT(*) as record_count 
FROM products
UNION ALL
SELECT 
    'partners' as table_name, 
    COUNT(*) as record_count 
FROM partners
UNION ALL
SELECT 
    'transactions' as table_name, 
    COUNT(*) as record_count 
FROM transactions
UNION ALL
SELECT 
    'transaction_items' as table_name, 
    COUNT(*) as record_count 
FROM transaction_items
UNION ALL
SELECT 
    'purchase_order_items' as table_name, 
    COUNT(*) as record_count 
FROM purchase_order_items
UNION ALL
SELECT 
    'inventory_movements' as table_name, 
    COUNT(*) as record_count 
FROM inventory_movements
UNION ALL
SELECT 
    'order_managers' as table_name, 
    COUNT(*) as record_count 
FROM order_managers
ORDER BY table_name;