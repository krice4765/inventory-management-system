-- system_notifications テーブルのRLS問題を修正
-- 問題: 匿名ユーザーがパスワードリセット通知を作成できない

-- 現在のポリシーを確認
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'system_notifications';

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "user_own_notifications" ON system_notifications;
DROP POLICY IF EXISTS "ユーザーは自分の通知のみアクセス可能" ON system_notifications;

-- 新しいポリシーを作成
-- 1. 認証済みユーザーは自分宛ての通知を読み取り可能
CREATE POLICY "authenticated_users_read_own_notifications" ON system_notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 2. 管理者は全通知にアクセス可能
CREATE POLICY "admin_all_notifications" ON system_notifications
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'admin'
            AND up.is_active = true
        )
    );

-- 3. 【重要】匿名ユーザーがパスワードリセット通知を作成可能
CREATE POLICY "allow_anonymous_password_reset_notifications" ON system_notifications
    FOR INSERT TO anon
    WITH CHECK (
        type IN ('password_reset_request', 'password_reset_failed', 'password_reset_error')
        AND user_id IS NOT NULL
    );

-- 4. 認証済みユーザーも通知作成可能（一般的な通知用）
CREATE POLICY "authenticated_users_create_notifications" ON system_notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ポリシー確認
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'system_notifications';