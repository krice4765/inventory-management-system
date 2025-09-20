-- inventory_movementsテーブルの構造確認

-- テーブルのカラム一覧
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 外部キー制約の確認
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'inventory_movements';

-- サンプルデータの確認（最新5件）
SELECT *
FROM inventory_movements
ORDER BY created_at DESC
LIMIT 5;