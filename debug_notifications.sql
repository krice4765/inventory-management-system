-- システム通知の詳細確認
-- 最新のパスワードリセット通知を確認

SELECT
    id,
    title,
    message,
    type,
    metadata,
    created_at,
    user_id
FROM system_notifications
WHERE type = 'password_reset_request'
ORDER BY created_at DESC
LIMIT 5;

-- metadataフィールドの詳細確認
SELECT
    id,
    title,
    message,
    metadata::text as metadata_raw,
    (metadata->>'requester_email') as requester_email,
    (metadata->>'timestamp') as request_timestamp,
    created_at
FROM system_notifications
WHERE type = 'password_reset_request'
    AND created_at >= '2025-09-16 14:00:00'
ORDER BY created_at DESC;

-- user_profilesの確認
SELECT
    id,
    email,
    role,
    is_active
FROM user_profiles
WHERE email IN ('kurisu4765104@outlook.jp', 'krice4765104@gmail.com')
ORDER BY email;