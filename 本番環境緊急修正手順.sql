-- 本番環境緊急修正手順
-- duplicate_detection_records テーブルの作成

-- Step 1: duplicate_detection_records テーブル作成
CREATE TABLE IF NOT EXISTS public.duplicate_detection_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    operation_hash VARCHAR(255) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- インデックス用の制約
    UNIQUE(operation_hash, expires_at),
    INDEX idx_duplicate_detection_hash (operation_hash),
    INDEX idx_duplicate_detection_session (session_id),
    INDEX idx_duplicate_detection_expires (expires_at)
);

-- Step 2: RLS (Row Level Security) ポリシー設定
ALTER TABLE public.duplicate_detection_records ENABLE ROW LEVEL SECURITY;

-- 認証されたユーザーの読み取り/書き込みを許可
CREATE POLICY "Authenticated users can manage duplicate detection records"
ON public.duplicate_detection_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 3: 既存の重複トランザクションを調査・クリーンアップ
-- 問題のあるトランザクション確認
SELECT
    parent_order_id,
    transaction_type,
    installment_number,
    COUNT(*) as duplicate_count,
    array_agg(id) as transaction_ids
FROM transactions
WHERE parent_order_id = '1d81325f-867d-4da4-8c0d-0d27fa459672'
    AND transaction_type = 'purchase'
    AND installment_number = 1
GROUP BY parent_order_id, transaction_type, installment_number
HAVING COUNT(*) > 1;

-- 重複レコードがある場合の削除（最新のもの以外）
-- ※ 実行前に必ずデータのバックアップを確認
WITH duplicate_transactions AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY parent_order_id, transaction_type, installment_number
            ORDER BY created_at DESC
        ) as rn
    FROM transactions
    WHERE parent_order_id = '1d81325f-867d-4da4-8c0d-0d27fa459672'
        AND transaction_type = 'purchase'
        AND installment_number = 1
)
-- DELETE FROM transactions
-- WHERE id IN (
--     SELECT id FROM duplicate_transactions WHERE rn > 1
-- );

-- Step 4: テーブル作成確認
SELECT
    tablename,
    schemaname,
    hasindexes,
    hasrules
FROM pg_tables
WHERE tablename = 'duplicate_detection_records';

-- Step 5: 権限確認
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'duplicate_detection_records';

-- 実行順序:
-- 1. Step 1: テーブル作成
-- 2. Step 2: RLSポリシー設定
-- 3. Step 3: 既存重複データ確認（削除は慎重に）
-- 4. Step 4-5: 作成確認