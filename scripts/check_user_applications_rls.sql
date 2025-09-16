-- user_applicationsテーブルのRLS状態確認スクリプト
-- 実行方法: Supabase SQLエディターまたはpsqlで実行

-- 1. テーブル存在確認
SELECT schemaname, tablename, tableowner, hasindexes, hasrules, hastriggers, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';

-- 2. テーブル構造確認
\d user_applications;

-- 3. 現在のRLSポリシー一覧
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;

-- 4. RLS有効状態確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';

-- 5. テーブル権限確認
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'user_applications'
ORDER BY grantee, privilege_type;

-- 6. カラム情報確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_applications'
ORDER BY ordinal_position;