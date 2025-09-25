-- 現在のprofilesテーブル構造を確認

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- profilesテーブルの実際のデータを確認
SELECT * FROM profiles LIMIT 3;