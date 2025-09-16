-- 恒久的なuser_profilesテーブル修正
-- Supabaseスキーマキャッシュ問題を解決

-- 既存のテーブルを削除（CASCADEでポリシーも一緒に削除される）
DROP TABLE IF EXISTS user_profiles CASCADE;

-- user_profilesテーブルを新規作成
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    department VARCHAR(255),
    position VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- RLSを有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ポリシーを作成（短い名前でトランケーション警告を回避）
CREATE POLICY "user_read_own" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "admin_full_access" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理者ユーザーデータを挿入
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
    id,
    email,
    CASE
        WHEN email = 'Krice4765104@gmail.com' THEN 'Krice Admin'
        WHEN email = 'dev@inventory.test' THEN 'Development User'
        WHEN email = 'prod@inventory.test' THEN 'Production User'
        ELSE email
    END as full_name,
    'admin' as role,
    true as is_active
FROM auth.users
WHERE email IN ('Krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test')
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();