-- transactionsテーブルの構造確認
-- installment_numberカラムの存在確認

-- =====================================================
-- 1. transactionsテーブルの全カラム情報表示
-- =====================================================
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'transactions'
ORDER BY ordinal_position;

-- =====================================================
-- 2. installment_numberカラムの存在確認
-- =====================================================
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transactions'
            AND column_name = 'installment_number'
            AND table_schema = 'public'
        ) THEN '✅ installment_number カラムが存在します'
        ELSE '❌ installment_number カラムが存在しません'
    END as installment_column_status;

-- =====================================================
-- 3. transactionsテーブルの制約確認
-- =====================================================
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
AND tc.table_name = 'transactions'
ORDER BY tc.constraint_type, kcu.column_name;

-- =====================================================
-- 4. transactionsテーブルのインデックス確認
-- =====================================================
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'transactions'
ORDER BY indexname;

-- =====================================================
-- 5. 分納関連カラムの修正が必要か判定
-- =====================================================
SELECT
    'transactions テーブル分析結果' as analysis_title,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'installment_number')
        THEN 'installment_number カラムが存在 - インデックス作成可能'
        ELSE 'installment_number カラムが不在 - ALTER TABLE で追加が必要'
    END as recommendation;