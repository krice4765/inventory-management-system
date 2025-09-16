-- user_applicationsテーブルのRLSポリシー修正スクリプト
-- 実行前に check_user_applications_rls.sql で現状を確認してください

-- =============================================================================
-- Phase 1: 既存ポリシーの削除
-- =============================================================================

-- 既存の古いポリシーを削除
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;

-- 他の既存ポリシーも削除（念のため）
DROP POLICY IF EXISTS "Enable read access for users based on email" ON user_applications;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_applications;
DROP POLICY IF EXISTS "Enable insert for anon users" ON user_applications;

-- =============================================================================
-- Phase 2: 新しいRLSポリシーの作成
-- =============================================================================

-- 1. 匿名ユーザーによる申請フォーム送信を許可
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. 認証済みユーザーが自分の申請を閲覧
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- 3. 管理者がすべての申請を閲覧
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

-- 4. 管理者が申請ステータスを更新
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

-- =============================================================================
-- Phase 3: テーブル設定の更新
-- =============================================================================

-- RLSを有効化
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- 権限の付与
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;

-- =============================================================================
-- Phase 4: 確認クエリ
-- =============================================================================

-- 新しいポリシーの確認
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;