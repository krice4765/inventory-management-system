-- 緊急クリーンアップの実行

-- 1. 問題のあるセッションを無効化
UPDATE duplicate_detection_records
SET is_valid = false, expires_at = NOW()
WHERE session_id = 'ae41a1b4-5686-4dd1-abba-7d257c6a4e5e';

-- 2. 期限切れおよび無効なレコードを削除
DELETE FROM duplicate_detection_records
WHERE expires_at < NOW() OR is_valid = false;

-- 3. 結果確認
SELECT 'Cleanup completed. Current active records:' as status;
SELECT COUNT(*) as remaining_active_records
FROM duplicate_detection_records
WHERE is_valid = true AND expires_at > NOW();