-- 段階的安全実行プラン
-- ステップ1: 現在の状態確認（実行前チェック）

-- 1-1. 承認済み申請数の確認
SELECT
  'Step1: 承認済み申請数' as check_point,
  COUNT(*) as count
FROM user_applications
WHERE status = 'approved';

-- 1-2. 既存user_profiles数の確認
SELECT
  'Step2: 既存user_profiles数' as check_point,
  COUNT(*) as count
FROM user_profiles;

-- 1-3. 欠落しているuser_profilesの特定（DRY RUN）
SELECT
  'Step3: 欠落user_profiles' as check_point,
  ua.email,
  CASE
    WHEN ua.requested_reason ~ '【申請者名】([^\\n]+)' THEN
      trim(substring(ua.requested_reason from '【申請者名】([^\\n]+)'))
    ELSE
      split_part(ua.email, '@', 1)
  END as extracted_name,
  ua.company_name,
  ua.department,
  ua.position
FROM user_applications ua
LEFT JOIN user_profiles up ON ua.email = up.email
WHERE ua.status = 'approved'
  AND up.email IS NULL
ORDER BY ua.created_at;

-- ステップ2: バックアップ作成（推奨）
-- CREATE TABLE user_profiles_backup AS SELECT * FROM user_profiles;

-- ステップ3: 実際のINSERT実行（上記確認後に実行）
-- 元のfix_missing_user_profiles.sqlの内容をここに貼り付けて実行

-- ステップ4: 実行後検証
-- SELECT 'After execution - user_profiles count' as check_point, COUNT(*) FROM user_profiles;
-- SELECT 'After execution - missing profiles check' as check_point, COUNT(*) FROM user_applications ua LEFT JOIN user_profiles up ON ua.email = up.email WHERE ua.status = 'approved' AND up.email IS NULL;