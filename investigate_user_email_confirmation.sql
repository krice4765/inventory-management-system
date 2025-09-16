-- test567@example.com のパスワードリセットエラー調査
-- 問題: ログイン可能だがパスワードリセットで "Email address is invalid" エラー

-- 1. auth.users テーブルでの該当ユーザー確認
SELECT
    id,
    email,
    email_confirmed_at,
    phone_confirmed_at,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_user_meta_data,
    is_sso_user,
    deleted_at
FROM auth.users
WHERE email = 'test567@example.com';

-- 2. user_profiles テーブルでの該当ユーザー確認
SELECT
    id,
    email,
    role,
    is_active,
    created_at,
    updated_at
FROM user_profiles
WHERE email = 'test567@example.com';

-- 3. 両テーブルの関連性確認（JOINクエリ）
SELECT
    u.id as auth_id,
    u.email,
    u.email_confirmed_at,
    u.last_sign_in_at,
    p.id as profile_id,
    p.role,
    p.is_active,
    CASE
        WHEN u.email_confirmed_at IS NULL THEN 'メール未確認'
        ELSE 'メール確認済み'
    END as email_status
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE u.email = 'test567@example.com';

-- 4. 他の正常なユーザーと比較（参考）
SELECT
    u.email,
    u.email_confirmed_at,
    p.is_active,
    CASE
        WHEN u.email_confirmed_at IS NULL THEN 'メール未確認'
        ELSE 'メール確認済み'
    END as email_status
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE u.email IN ('krice4765104@gmail.com', 'dev@inventory.test')
ORDER BY u.email;

-- 解決策1: メール確認を手動で実行（必要に応じて実行）
-- UPDATE auth.users
-- SET email_confirmed_at = NOW()
-- WHERE email = 'test567@example.com' AND email_confirmed_at IS NULL;

-- 解決策2: 確認後の状態チェック
-- SELECT email, email_confirmed_at
-- FROM auth.users
-- WHERE email = 'test567@example.com';