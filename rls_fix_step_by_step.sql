-- ========================================
-- RLS修正SQL - 段階別実行スクリプト
-- 実行環境: Supabase SQL Editor
-- 目的: user_applicationsテーブルのRLS修正
-- ========================================

-- ========================================
-- 第1段階: 接続確認
-- ========================================
-- 以下を個別実行して接続状況を確認
SELECT current_database(), current_user, version();

-- ========================================
-- 第2段階: 既存ポリシー状況確認
-- ========================================
-- 現在のRLSポリシーの状況を確認
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'user_applications';

-- ========================================
-- 第3段階: 既存ポリシー削除
-- ========================================
-- 制限的な既存ポリシーを削除
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;

-- ========================================
-- 第4段階: 公開申請フォーム用ポリシー作成
-- ========================================
-- 匿名ユーザーと認証ユーザーの申請送信を許可
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ========================================
-- 第5段階: ユーザー閲覧ポリシー作成
-- ========================================
-- 認証済みユーザーが自分の申請を閲覧可能
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- ========================================
-- 第6段階: 管理者閲覧ポリシー作成
-- ========================================
-- 管理者が全申請を閲覧可能
CREATE POLICY "Admins can view all applications"
ON user_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- ========================================
-- 第7段階: 管理者更新ポリシー作成
-- ========================================
-- 管理者が申請ステータスを更新可能
CREATE POLICY "Admins can update application status"
ON user_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- ========================================
-- 第8段階: RLS有効化と権限設定
-- ========================================
-- RLSを有効化
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーにINSERT権限を付与
GRANT INSERT ON user_applications TO anon;

-- 認証ユーザーにSELECT, UPDATE権限を付与
GRANT SELECT, UPDATE ON user_applications TO authenticated;

-- ========================================
-- 第9段階: 最終確認
-- ========================================
-- 作成されたポリシーの確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;

-- RLS状態の確認
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';

-- ========================================
-- 追加確認: テーブル権限の確認
-- ========================================
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'user_applications'
ORDER BY grantee, privilege_type;

-- ========================================
-- 実行完了メッセージ
-- ========================================
SELECT 'RLS修正が完了しました。匿名ユーザーの申請送信が可能になります。' AS completion_message;