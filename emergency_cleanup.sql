-- 緊急クリーンアップ: 問題のあるセッションと重複レコードを削除

-- 1. 特定のセッション（エラーが発生しているもの）を無効化
UPDATE duplicate_detection_records
SET is_valid = false, expires_at = NOW()
WHERE session_id = 'ae41a1b4-5686-4dd1-abba-7d257c6a4e5e';

-- 2. 期限切れの重複検出レコードを削除
DELETE FROM duplicate_detection_records
WHERE expires_at < NOW() OR is_valid = false;

-- 3. 今日作成された重複トランザクションがあるか確認
WITH duplicate_transactions AS (
    SELECT
        parent_order_id,
        transaction_type,
        COUNT(*) as count,
        array_agg(id ORDER BY created_at DESC) as ids
    FROM transactions
    WHERE parent_order_id IS NOT NULL
        AND created_at::date = CURRENT_DATE
    GROUP BY parent_order_id, transaction_type
    HAVING COUNT(*) > 1
)
SELECT
    parent_order_id,
    transaction_type,
    count,
    'DELETE FROM transactions WHERE id IN (' || array_to_string(ids[2:], ', ') || ');' as cleanup_query
FROM duplicate_transactions;

-- 4. アクティブなセッション数を確認
SELECT
    COUNT(*) as active_sessions,
    COUNT(DISTINCT session_id) as unique_sessions
FROM duplicate_detection_records
WHERE is_valid = true AND expires_at > NOW();