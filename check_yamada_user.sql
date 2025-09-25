-- 山田ユーザーの存在確認
SELECT
  'Yamada user check' as status,
  id,
  email,
  full_name,
  role,
  is_active
FROM user_profiles
WHERE email = 'test.yamada@example.jp';