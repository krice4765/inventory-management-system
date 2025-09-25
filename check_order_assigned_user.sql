-- 🔍 発注の担当者データ確認

-- 最新の発注を確認
SELECT
  'Latest orders' as status,
  po_number,
  assigned_to,
  supplier_name,
  order_date,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;

-- 山田ユーザーのuser_profilesデータ確認
SELECT
  'Yamada user_profiles' as status,
  id,
  email,
  full_name,
  role,
  is_active
FROM user_profiles
WHERE email = 'test.yamada@example.jp';