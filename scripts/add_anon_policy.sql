-- 匿名ユーザー用RLSポリシー追加
-- user_applicationsテーブルに申請を送信できるようにする

-- 匿名ユーザー用INSERT専用ポリシーを追加
CREATE POLICY "anon_insert_user_applications" ON public.user_applications
  FOR INSERT TO anon
  WITH CHECK (true);

-- 設定確認
SELECT 'ポリシー追加完了' as status;
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_applications'
ORDER BY policyname;