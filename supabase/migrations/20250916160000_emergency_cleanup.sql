-- 緊急クリーンアップ: セッションと重複レコードの問題解決

-- 1. 問題のあるセッションを削除（UPDATEではなくDELETE）
DELETE FROM duplicate_detection_records
WHERE session_id = 'ae41a1b4-5686-4dd1-abba-7d257c6a4e5e';

-- 2. 期限切れおよび無効なレコードを削除
DELETE FROM duplicate_detection_records
WHERE expires_at < NOW() OR is_valid = false;

-- 3. 今日作成された重複トランザクションをクリーンアップ
WITH duplicate_transactions AS (
    SELECT
        parent_order_id,
        transaction_type,
        array_agg(id ORDER BY created_at DESC) as ids
    FROM transactions
    WHERE parent_order_id IS NOT NULL
        AND created_at::date = CURRENT_DATE
    GROUP BY parent_order_id, transaction_type
    HAVING COUNT(*) > 1
)
DELETE FROM transactions
WHERE id IN (
    SELECT unnest(ids[2:array_length(ids, 1)])
    FROM duplicate_transactions
);

-- 4. アクティブなレコード数をログに出力
DO $$
DECLARE
    active_count INTEGER;
    cleaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM duplicate_detection_records
    WHERE is_valid = true AND expires_at > NOW();

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;

    RAISE NOTICE 'Emergency cleanup completed. Active records: %, Records cleaned: %', active_count, cleaned_count;
END $$;