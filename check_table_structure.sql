-- テーブル構造確認スクリプト

-- 1. user_applicationsテーブルの構造確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_applications'
ORDER BY ordinal_position;

-- 2. user_profilesテーブルの構造確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 3. user_applicationsの実際のデータサンプル確認
SELECT * FROM user_applications LIMIT 5;

-- 4. user_profilesの実際のデータサンプル確認
SELECT email, full_name FROM user_profiles LIMIT 10;