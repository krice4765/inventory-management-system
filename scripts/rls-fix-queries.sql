-- ===============================================================
-- RLS Policy Fix for user_applications table
-- 手動実行用SQLクエリ集
-- Supabase Dashboard > SQL Editor で実行してください
-- ===============================================================

-- 第1段階: 既存ポリシー削除
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;

-- 第2段階: 公開申請フォーム用ポリシー
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 第3段階: ユーザー閲覧ポリシー
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- 第4段階: 管理者閲覧ポリシー
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

-- 第5段階: 管理者更新ポリシー
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

-- 第6段階: RLS有効化と権限設定
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;

-- ===============================================================
-- テスト用クエリ
-- ===============================================================

-- 現在のポリシー確認
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;

-- RLS状態確認
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';

-- テスト挿入（匿名ユーザー権限で実行可能か確認）
-- この部分は手動テスト用のサンプルです
/*
INSERT INTO user_applications (
    email,
    company_name,
    department,
    position,
    requested_reason
) VALUES (
    'test@example.com',
    'Test Company',
    'Test Department',
    'Test Position',
    'Testing RLS policy fix'
);
*/