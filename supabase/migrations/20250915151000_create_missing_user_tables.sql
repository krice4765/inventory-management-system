-- 不足しているユーザー管理関連テーブルを作成
-- system_notifications, user_applications, user_invitations, system_settings

-- 1. user_applications テーブル
DROP TABLE IF EXISTS user_applications CASCADE;
CREATE TABLE user_applications (
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

-- 2. user_invitations テーブル
DROP TABLE IF EXISTS user_invitations CASCADE;
CREATE TABLE user_invitations (
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

-- 3. system_notifications テーブル
DROP TABLE IF EXISTS system_notifications CASCADE;
CREATE TABLE system_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. system_settings テーブル
DROP TABLE IF EXISTS system_settings CASCADE;
CREATE TABLE system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_user_applications_email ON user_applications(email);
CREATE INDEX idx_user_applications_status ON user_applications(application_status);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX idx_user_invitations_status ON user_invitations(status);
CREATE INDEX idx_system_notifications_user_id ON system_notifications(user_id);
CREATE INDEX idx_system_notifications_type ON system_notifications(type);
CREATE INDEX idx_system_notifications_is_read ON system_notifications(is_read);

-- RLS (Row Level Security) 設定
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ポリシー作成（認証済みユーザーのみアクセス可能な簡易版）
CREATE POLICY "authenticated_access_user_applications" ON user_applications
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_access_user_invitations" ON user_invitations
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "user_own_notifications" ON system_notifications
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "authenticated_access_system_settings" ON system_settings
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 初期データ投入
INSERT INTO system_settings (key, value, description) VALUES
    ('invitation_expiry_hours', '72', '招待リンクの有効期限（時間）'),
    ('auto_approve_domains', '[]', '自動承認するドメインリスト'),
    ('require_admin_approval', 'true', '管理者承認を必須とするか'),
    ('notification_email_enabled', 'true', 'メール通知を有効にするか')
ON CONFLICT (key) DO NOTHING;

-- サンプル通知データを管理者ユーザーに追加
INSERT INTO system_notifications (user_id, type, title, message, metadata)
SELECT
    au.id,
    'welcome_admin',
    'ユーザー管理システムへようこそ',
    '管理者として、ユーザー申請の承認や招待機能をご利用いただけます。',
    '{"admin_role": true}'
FROM auth.users au
WHERE au.email IN ('Krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test')
ON CONFLICT DO NOTHING;

-- 完了メッセージ
SELECT 'User management tables created successfully' as status;