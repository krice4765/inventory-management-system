-- Supabase認証設定とパスワードリセットエラーの詳細調査
-- 問題: test567@example.com はメール確認済みなのにパスワードリセットでエラー

-- 1. Supabase認証設定の確認
-- 注意: 以下の設定はSupabase Dashboard -> Authentication -> Settingsで確認が必要

/*
確認すべきSupabase Dashboard設定:
1. Authentication -> Settings -> General
   - Enable email confirmations
   - Enable password recovery
   - Password recovery email redirect URL

2. Authentication -> Settings -> SMTP Settings
   - SMTP server configuration
   - From email address
   - Enable email confirmations

3. Authentication -> Settings -> URL Configuration
   - Site URL
   - Redirect URLs (password reset)
*/

-- 2. auth.schema_migrations テーブル確認（認証スキーマのバージョン）
SELECT version, applied_at
FROM auth.schema_migrations
ORDER BY version DESC
LIMIT 5;

-- 3. auth.users テーブルの詳細分析
SELECT
    email,
    email_confirmed_at,
    phone_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    aud,
    role as auth_role,
    created_at,
    updated_at,
    banned_until,
    is_sso_user
FROM auth.users
WHERE email = 'test567@example.com';

-- 4. 最近のauth.audit_log_entries確認（認証関連のログ）
SELECT
    created_at,
    ip_address,
    payload
FROM auth.audit_log_entries
WHERE payload::text LIKE '%test567@example.com%'
ORDER BY created_at DESC
LIMIT 10;

-- 5. auth.refresh_tokens テーブル確認
SELECT
    token,
    user_id,
    revoked,
    created_at,
    updated_at
FROM auth.refresh_tokens
WHERE user_id = 'bc1a0b3c-a802-4077-ad58-2113c31b2c69'
ORDER BY created_at DESC
LIMIT 5;

-- 6. 問題解決のためのテスト用SQL
-- テスト1: 新しいパスワードリセットトークンを生成（手動実行用）
/*
UPDATE auth.users
SET
    recovery_token = encode(gen_random_bytes(32), 'base64'),
    recovery_sent_at = NOW()
WHERE email = 'test567@example.com';
*/

-- テスト2: 確認用クエリ
SELECT
    email,
    recovery_token IS NOT NULL as has_recovery_token,
    recovery_sent_at,
    email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users
WHERE email = 'test567@example.com';