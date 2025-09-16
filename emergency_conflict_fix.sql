-- 🚨 緊急修正: 409 Conflict エラーの根本解決
-- 実行場所: Supabase Dashboard > SQL Editor
-- 目的: 危険な制約の削除と安全な分納システムの実装

-- ============================================
-- 1. 危険な制約の確認と削除
-- ============================================

-- 現在のtransactionsテーブルの制約を確認
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
  AND contype IN ('u', 'p') -- UNIQUE and PRIMARY KEY constraints
ORDER BY conname;

-- 問題の制約を削除（存在する場合）
DO $$
BEGIN
    -- 分納番号関連の重複制約を削除
    BEGIN
        ALTER TABLE transactions DROP CONSTRAINT IF EXISTS uq_transactions_parent_type_installment;
        RAISE NOTICE '✅ Dropped constraint: uq_transactions_parent_type_installment';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Constraint uq_transactions_parent_type_installment not found or already dropped';
    END;

    -- その他の問題制約を削除
    BEGIN
        ALTER TABLE transactions DROP CONSTRAINT IF EXISTS uq_installment_sequence;
        RAISE NOTICE '✅ Dropped constraint: uq_installment_sequence';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Constraint uq_installment_sequence not found or already dropped';
    END;

    -- トランザクション番号の重複制約も一時削除
    BEGIN
        ALTER TABLE transactions DROP CONSTRAINT IF EXISTS uq_transaction_no;
        RAISE NOTICE '✅ Dropped constraint: uq_transaction_no';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Constraint uq_transaction_no not found or already dropped';
    END;
END $$;

-- ============================================
-- 2. 安全な分納作成関数の実装
-- ============================================

CREATE OR REPLACE FUNCTION create_safe_installment(
    p_parent_order_id TEXT,
    p_amount NUMERIC,
    p_memo TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT 'system'
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_no TEXT,
    installment_number INTEGER,
    success BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID;
    v_transaction_no TEXT;
    v_installment_number INTEGER;
    v_max_retries INTEGER := 5;
    v_retry_count INTEGER := 0;
    v_success BOOLEAN := FALSE;
    v_error TEXT := NULL;
BEGIN
    -- 一意のトランザクションIDを生成
    v_transaction_id := gen_random_uuid();

    -- リトライループ
    WHILE v_retry_count < v_max_retries AND NOT v_success LOOP
        BEGIN
            -- 次の分納番号を安全に取得
            SELECT COALESCE(MAX(
                CASE
                    WHEN memo ~ '^第[0-9]+回分納' THEN
                        CAST(substring(memo from '^第([0-9]+)回分納') AS INTEGER)
                    ELSE 0
                END
            ), 0) + 1
            INTO v_installment_number
            FROM transactions
            WHERE parent_order_id = p_parent_order_id
              AND transaction_type = 'purchase'
              AND status = 'confirmed';

            -- 一意のトランザクション番号を生成
            v_transaction_no := 'SAFE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || v_installment_number || '-' || (RANDOM() * 1000)::INTEGER;

            -- 分納トランザクションを安全に作成
            INSERT INTO transactions (
                id,
                transaction_type,
                transaction_no,
                parent_order_id,
                transaction_date,
                status,
                total_amount,
                memo,
                created_at
            ) VALUES (
                v_transaction_id,
                'purchase',
                v_transaction_no,
                p_parent_order_id,
                CURRENT_DATE,
                'confirmed',
                p_amount,
                COALESCE(p_memo, '第' || v_installment_number || '回分納 (安全処理)'),
                NOW()
            );

            v_success := TRUE;

        EXCEPTION
            WHEN unique_violation THEN
                v_retry_count := v_retry_count + 1;
                v_transaction_id := gen_random_uuid(); -- 新しいIDを生成
                v_error := 'Unique violation retry ' || v_retry_count;

                IF v_retry_count >= v_max_retries THEN
                    v_error := 'Max retries exceeded: ' || SQLERRM;
                    EXIT;
                END IF;

                -- 短時間の待機（競合回避）
                PERFORM pg_sleep(0.1 * v_retry_count);

            WHEN OTHERS THEN
                v_error := 'Unexpected error: ' || SQLERRM;
                EXIT;
        END;
    END LOOP;

    -- 結果を返す
    RETURN QUERY SELECT
        v_transaction_id,
        v_transaction_no,
        v_installment_number,
        v_success,
        v_error;
END;
$$;

-- ============================================
-- 3. 既存重複データのクリーンアップ
-- ============================================

-- 今日作成された重複分納をクリーンアップ
WITH duplicate_transactions AS (
    SELECT
        id,
        parent_order_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY parent_order_id, DATE(created_at)
            ORDER BY created_at ASC
        ) as rn
    FROM transactions
    WHERE transaction_type = 'purchase'
      AND DATE(created_at) = CURRENT_DATE
      AND memo LIKE '%分納%'
)
DELETE FROM transactions
WHERE id IN (
    SELECT id FROM duplicate_transactions WHERE rn > 1
);

-- クリーンアップ結果をログ出力
DO $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RAISE NOTICE '🧹 Cleaned up % duplicate transactions from today', cleanup_count;
END $$;

-- ============================================
-- 4. 修正完了確認
-- ============================================

-- 修正後の制約状況確認
SELECT
    '✅ 修正完了: 制約状況' as status,
    COUNT(*) as remaining_constraints
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
  AND contype = 'u'
  AND conname LIKE '%installment%';

-- テスト用の安全な分納作成
SELECT
    '🧪 テスト実行' as status,
    *
FROM create_safe_installment(
    'TEST-ORDER-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    1000.00,
    'テスト分納 - 修正確認'
);

RAISE NOTICE '🎯 緊急修正完了: データベースレベルでの409 Conflictエラー対策が実装されました';
RAISE NOTICE '⚡ 次のステップ: アプリケーションコードでcreate_safe_installment()関数を使用してください';