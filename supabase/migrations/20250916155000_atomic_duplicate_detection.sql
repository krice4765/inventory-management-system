-- アトミックな重複検出とレース条件対応のためのRPC関数

-- 重複チェックと挿入をアトミックに行うRPC関数
CREATE OR REPLACE FUNCTION check_and_insert_duplicate_detection(
    p_operation_hash VARCHAR(255),
    p_session_id UUID,
    p_operation_type VARCHAR(100),
    p_resource_id VARCHAR(255),
    p_expires_at TIMESTAMP WITH TIME ZONE,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    existing_record RECORD;
    result_json jsonb;
BEGIN
    -- BEGIN transaction block ensures atomicity

    -- Lock the table to prevent race conditions
    LOCK TABLE duplicate_detection_records IN EXCLUSIVE MODE;

    -- Check for existing valid record with same hash
    SELECT *
    INTO existing_record
    FROM duplicate_detection_records
    WHERE operation_hash = p_operation_hash
        AND expires_at > NOW()
        AND is_valid = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- If duplicate found, return it
    IF existing_record.id IS NOT NULL THEN
        result_json := jsonb_build_object(
            'is_duplicate', true,
            'existing_record', row_to_json(existing_record)
        );
        RETURN result_json;
    END IF;

    -- No duplicate found, insert new record
    INSERT INTO duplicate_detection_records (
        session_id,
        operation_hash,
        operation_type,
        resource_id,
        expires_at,
        metadata,
        is_valid
    ) VALUES (
        p_session_id,
        p_operation_hash,
        p_operation_type,
        p_resource_id,
        p_expires_at,
        p_metadata,
        true
    );

    -- Return success result
    result_json := jsonb_build_object(
        'is_duplicate', false,
        'inserted', true
    );
    RETURN result_json;

EXCEPTION
    WHEN unique_violation THEN
        -- If unique constraint violated (race condition), treat as duplicate
        result_json := jsonb_build_object(
            'is_duplicate', true,
            'race_condition_detected', true
        );
        RETURN result_json;
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Error in check_and_insert_duplicate_detection: %', SQLERRM;
END;
$$;

-- トランザクションの重複をクリーンアップする関数
CREATE OR REPLACE FUNCTION cleanup_duplicate_transactions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    duplicate_record RECORD;
    deletion_count INTEGER := 0;
BEGIN
    -- 重複するトランザクションを特定し、最新のもの以外を削除
    FOR duplicate_record IN
        SELECT
            parent_order_id,
            transaction_type,
            COUNT(*) as dup_count
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id, transaction_type
        HAVING COUNT(*) > 1
    LOOP
        -- 最新のレコード以外を削除
        WITH ranked_transactions AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY parent_order_id, transaction_type
                       ORDER BY created_at DESC
                   ) as rn
            FROM transactions
            WHERE parent_order_id = duplicate_record.parent_order_id
                AND transaction_type = duplicate_record.transaction_type
        )
        DELETE FROM transactions
        WHERE id IN (
            SELECT id FROM ranked_transactions WHERE rn > 1
        );

        GET DIAGNOSTICS deletion_count = ROW_COUNT;

        RAISE NOTICE 'Cleaned up % duplicate transactions for parent_order_id=%, type=%',
            deletion_count,
            duplicate_record.parent_order_id,
            duplicate_record.transaction_type;
    END LOOP;

    RAISE NOTICE 'Transaction cleanup completed';
END;
$$;

-- 重複データをクリーンアップしてから一意制約を追加
DO $$
DECLARE
    duplicate_record RECORD;
    deletion_count INTEGER := 0;
    total_deleted INTEGER := 0;
BEGIN
    -- 先に重複するトランザクションをクリーンアップ
    RAISE NOTICE 'Starting duplicate transaction cleanup...';

    FOR duplicate_record IN
        SELECT
            parent_order_id,
            transaction_type,
            COUNT(*) as dup_count
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id, transaction_type
        HAVING COUNT(*) > 1
    LOOP
        -- 最新のレコード以外を削除
        WITH ranked_transactions AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY parent_order_id, transaction_type
                       ORDER BY created_at DESC
                   ) as rn
            FROM transactions
            WHERE parent_order_id = duplicate_record.parent_order_id
                AND transaction_type = duplicate_record.transaction_type
        )
        DELETE FROM transactions
        WHERE id IN (
            SELECT id FROM ranked_transactions WHERE rn > 1
        );

        GET DIAGNOSTICS deletion_count = ROW_COUNT;
        total_deleted := total_deleted + deletion_count;

        RAISE NOTICE 'Cleaned up % duplicate transactions for parent_order_id=%, type=%',
            deletion_count,
            duplicate_record.parent_order_id,
            duplicate_record.transaction_type;
    END LOOP;

    RAISE NOTICE 'Total duplicates cleaned: %', total_deleted;

    -- 重複クリーンアップ後、一意制約を追加
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_transactions_parent_type'
    ) THEN
        -- Add unique constraint if it doesn't exist
        ALTER TABLE transactions
        ADD CONSTRAINT uq_transactions_parent_type
        UNIQUE (parent_order_id, transaction_type);

        RAISE NOTICE 'Added unique constraint uq_transactions_parent_type';
    ELSE
        RAISE NOTICE 'Unique constraint uq_transactions_parent_type already exists';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during cleanup and constraint creation: %', SQLERRM;
END;
$$;

-- パフォーマンス向上のためのインデックス追加
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_hash_expires_valid
ON duplicate_detection_records (operation_hash, expires_at, is_valid)
WHERE is_valid = true;

CREATE INDEX IF NOT EXISTS idx_transactions_parent_type_created
ON transactions (parent_order_id, transaction_type, created_at)
WHERE parent_order_id IS NOT NULL;