-- UserApplication用RLSポリシー修正
-- 匿名ユーザーが申請を送信できるように設定

-- 現在のuser_applicationsのRLS状況確認
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'user_applications';

-- 既存ポリシー確認
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_applications';

-- RLS有効化（既に有効な場合は何もしない）
ALTER TABLE public.user_applications ENABLE ROW LEVEL SECURITY;

-- 既存の匿名ユーザー用ポリシーを削除して再作成
DROP POLICY IF EXISTS user_applications_anon_insert_policy ON public.user_applications;
CREATE POLICY user_applications_anon_insert_policy ON public.user_applications
  FOR INSERT TO anon
  WITH CHECK (true);

-- 認証済みユーザー用ポリシー（管理者が閲覧・更新可能）
DROP POLICY IF EXISTS user_applications_authenticated_policy ON public.user_applications;
CREATE POLICY user_applications_authenticated_policy ON public.user_applications
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 設定後の確認
SELECT '=== 設定後のポリシー一覧 ===' as status;
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_applications';