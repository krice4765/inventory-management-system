-- 企業級ユーザー管理システム用データベーススキーマ
-- 申請→承認→招待ベース登録フロー
-- 作成日: 2025-09-15

-- 1. ユーザー申請テーブル
CREATE TABLE IF NOT EXISTS user_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(255),
    department VARCHAR(255),
    position VARCHAR(255),
    requested_reason TEXT,
    application_status VARCHAR(50) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ユーザー招待テーブル
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    invited_by UUID REFERENCES auth.users(id) NOT NULL,
    invitation_token VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ユーザー権限・プロファイルテーブル
CREATE TABLE IF NOT EXISTS user_profiles (
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

-- 4. システム通知テーブル
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'user_application', 'user_approved', 'user_rejected', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, -- 追加データ（申請ID、ユーザー情報など）
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. システム設定テーブル
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_applications_email ON user_applications(email);
CREATE INDEX IF NOT EXISTS idx_user_applications_status ON user_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_system_notifications_user_id ON system_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_type ON system_notifications(type);
CREATE INDEX IF NOT EXISTS idx_system_notifications_is_read ON system_notifications(is_read);

-- RLS (Row Level Security) 設定
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能なポリシー
CREATE POLICY "管理者のみuser_applicationsアクセス可能" ON user_applications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "管理者のみuser_invitationsアクセス可能" ON user_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ユーザーは自分のプロファイルのみアクセス可能
CREATE POLICY "ユーザーは自分のプロファイルのみアクセス可能" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "管理者は全プロファイルアクセス可能" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 通知は該当ユーザーのみアクセス可能
CREATE POLICY "ユーザーは自分の通知のみアクセス可能" ON system_notifications
    FOR ALL USING (user_id = auth.uid());

-- システム設定は管理者のみ
CREATE POLICY "管理者のみシステム設定アクセス可能" ON system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 初期データ投入
INSERT INTO system_settings (key, value, description) VALUES
    ('invitation_expiry_hours', '72', '招待リンクの有効期限（時間）'),
    ('auto_approve_domains', '[]', '自動承認するドメインリスト'),
    ('require_admin_approval', 'true', '管理者承認を必須とするか'),
    ('notification_email_enabled', 'true', 'メール通知を有効にするか')
ON CONFLICT (key) DO NOTHING;

-- 完了メッセージ
SELECT 'ユーザー管理システム用データベーススキーマの作成が完了しました' as status;