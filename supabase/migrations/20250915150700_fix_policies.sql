-- ポリシーの無限再帰を修正

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "user_read_own" ON user_profiles;
DROP POLICY IF EXISTS "admin_full_access" ON user_profiles;

-- 無限再帰を回避する新しいポリシーを作成
-- 管理者チェックを直接auth.usersテーブルから行う
CREATE POLICY "user_read_own" ON user_profiles
    FOR SELECT USING (id = auth.uid());

-- 管理者フルアクセス（無限再帰を回避）
CREATE POLICY "admin_full_access" ON user_profiles
    FOR ALL USING (
        auth.uid() IN (
            SELECT au.id
            FROM auth.users au
            WHERE au.email IN ('Krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test')
        )
    );

-- 管理者が自分のプロファイルを更新できるポリシー
CREATE POLICY "admin_update_profiles" ON user_profiles
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT au.id
            FROM auth.users au
            WHERE au.email IN ('Krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test')
        )
    );

-- 管理者が新しいプロファイルを挿入できるポリシー
CREATE POLICY "admin_insert_profiles" ON user_profiles
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT au.id
            FROM auth.users au
            WHERE au.email IN ('Krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test')
        )
    );