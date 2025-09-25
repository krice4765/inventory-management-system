-- Fix missing user_profiles records for approved applications
-- This script creates user_profiles records for approved applications that don't have corresponding user_profiles

-- Insert missing user_profiles records based on approved applications
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  company_name,
  department,
  position,
  role,
  is_active,
  last_login_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() as id,
  ua.email,
  CASE
    -- Extract name from requested_reason using regex
    WHEN ua.requested_reason ~ '【申請者名】([^\\n]+)' THEN
      trim(substring(ua.requested_reason from '【申請者名】([^\\n]+)'))
    ELSE
      split_part(ua.email, '@', 1)
  END as full_name,
  ua.company_name,
  ua.department,
  ua.position,
  'user' as role,
  true as is_active,
  NULL as last_login_at,
  ua.created_at,
  NOW() as updated_at
FROM user_applications ua
LEFT JOIN user_profiles up ON ua.email = up.email
WHERE ua.status = 'approved'
  AND up.email IS NULL;

-- Verify the results
SELECT
  'Total approved applications' as description,
  COUNT(*) as count
FROM user_applications
WHERE status = 'approved'

UNION ALL

SELECT
  'User profiles created' as description,
  COUNT(*) as count
FROM user_profiles up
WHERE EXISTS (
  SELECT 1 FROM user_applications ua
  WHERE ua.email = up.email AND ua.status = 'approved'
);