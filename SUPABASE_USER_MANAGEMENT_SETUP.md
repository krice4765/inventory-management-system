# 🔧 Supabaseユーザー管理システム セットアップ手順

**目的**: ユーザー管理システムに必要なデータベーステーブルとRLSポリシーを作成

## 📋 必要なテーブル

以下のテーブルがSupabaseに必要です：
- `user_applications` - ユーザー申請管理
- `user_invitations` - 招待管理
- `user_profiles` - ユーザープロファイル
- `system_notifications` - システム通知
- `system_settings` - システム設定

## 🛠️ セットアップ手順

### 1. Supabase管理画面にアクセス
1. https://supabase.com/dashboard にログイン
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### 2. SQLスクリプトの実行
作成済みのSQLスクリプトを実行：

```sql
-- 📁 ファイル: scripts/user_management_schema.sql の内容をコピー&ペースト
-- または以下の手順で段階的に実行

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

-- 3. ユーザープロファイルテーブル
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
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
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
```

### 3. インデックスの作成
```sql
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
```

### 4. Row Level Security (RLS) 設定
```sql
-- RLS有効化
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
```

### 5. 初期データの投入
```sql
-- システム設定の初期値
INSERT INTO system_settings (key, value, description) VALUES
    ('invitation_expiry_hours', '72', '招待リンクの有効期限（時間）'),
    ('auto_approve_domains', '[]', '自動承認するドメインリスト'),
    ('require_admin_approval', 'true', '管理者承認を必須とするか'),
    ('notification_email_enabled', 'true', 'メール通知を有効にするか')
ON CONFLICT (key) DO NOTHING;

-- 管理者ユーザーのプロファイル作成（必要に応じて）
-- 注意: 実際のユーザーIDに置き換えてください
/*
INSERT INTO user_profiles (id, email, role, is_active) VALUES
    ('your-user-id-here', 'dev@inventory.test', 'admin', true),
    ('your-user-id-here', 'Krice4765104@gmail.com', 'admin', true),
    ('your-user-id-here', 'prod@inventory.test', 'admin', true)
ON CONFLICT (id) DO NOTHING;
*/
```

## ✅ 確認手順

### 1. テーブル作成確認
Supabase管理画面で以下を確認：
- Table Editor → 5つのテーブルが表示される
- 各テーブルに適切な列が存在する

### 2. RLS確認
- Authentication → RLS → 各テーブルでRLSが有効
- ポリシーが正しく設定されている

### 3. 動作確認
- ユーザー管理画面（/user-management）でエラーが表示されない
- 「データの読み込みに失敗しました」エラーが解消される

## 🚨 トラブルシューティング

### エラー: "relation does not exist"
→ テーブルが作成されていません。SQLスクリプトを再実行してください。

### エラー: "permission denied"
→ RLSポリシーに問題があります。ポリシーを確認してください。

### エラー: "foreign key constraint"
→ auth.usersテーブルとの参照制約に問題があります。ユーザーIDを確認してください。

## 📞 サポート
問題が解決しない場合は、Supabaseのドキュメントやサポートを参照してください：
- https://supabase.com/docs
- https://supabase.com/docs/guides/auth/row-level-security

---

**✨ セットアップ完了後、ユーザー管理システムが正常に動作します！**