-- 管理者ユーザーデータを手動挿入

-- 既存のauth.usersからIDを取得して管理者プロファイルを作成
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    CASE
        WHEN au.email = 'krice4765104@gmail.com' THEN 'Krice Admin'
        WHEN au.email = 'dev@inventory.test' THEN 'Development User'
        WHEN au.email = 'prod@inventory.test' THEN 'Production User'
        ELSE au.email
    END as full_name,
    'admin' as role,
    true as is_active
FROM auth.users au
WHERE au.email IN ('krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test')
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- 結果を確認
SELECT
    email,
    role,
    is_active,
    created_at
FROM user_profiles
WHERE role = 'admin';