-- ===================================================================
-- 完全なRPC関数再作成とAPIゲートウェイリセット
-- create_safe_installment 404エラー根本解決
-- ===================================================================

-- STEP 1: 既存関数を完全に削除
DROP FUNCTION IF EXISTS create_safe_installment CASCADE;

-- STEP 2: 完全に新しい関数を作成（異なる関数名で一意性確保）
CREATE OR REPLACE FUNCTION create_installment_v2(
    p_parent_order_id UUID,
    p_partner_id UUID,
    p_transaction_date DATE,
    p_due_date DATE,
    p_total_amount NUMERIC,
    p_memo TEXT
) RETURNS JSON AS $$
DECLARE
    v_transaction_id UUID;
    v_installment_no INTEGER;
    v_transaction_no TEXT;
    v_result JSON;
BEGIN
    -- トランザクション開始
    BEGIN
        -- 新しいUUID生成
        v_transaction_id := gen_random_uuid();

        -- 分納番号計算（安全な取得）
        SELECT COALESCE(MAX(installment_no), 0) + 1
        INTO v_installment_no
        FROM transactions
        WHERE parent_order_id = p_parent_order_id
          AND transaction_type = 'purchase';

        -- 一意なトランザクション番号生成
        v_transaction_no := 'INST-V2-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || v_installment_no;

        -- 分納レコード挿入
        INSERT INTO transactions (
            id,
            transaction_type,
            transaction_no,
            parent_order_id,
            partner_id,
            installment_no,
            transaction_date,
            due_date,
            status,
            total_amount,
            memo,
            created_at,
            updated_at
        ) VALUES (
            v_transaction_id,
            'purchase',
            v_transaction_no,
            p_parent_order_id,
            p_partner_id,
            v_installment_no,
            p_transaction_date,
            p_due_date,
            'confirmed',
            p_total_amount,
            COALESCE(p_memo, '第' || v_installment_no || '回分納 (V2システム)'),
            NOW(),
            NOW()
        );

        -- 結果JSON作成
        v_result := json_build_object(
            'success', true,
            'id', v_transaction_id,
            'transaction_no', v_transaction_no,
            'installment_no', v_installment_no,
            'total_amount', p_total_amount,
            'message', 'V2分納処理完了'
        );

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        -- エラーハンドリング
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE,
            'message', 'V2分納処理失敗'
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: 権限設定
GRANT EXECUTE ON FUNCTION create_installment_v2(UUID, UUID, DATE, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_installment_v2(UUID, UUID, DATE, DATE, NUMERIC, TEXT) TO anon;

-- STEP 4: APIゲートウェイ強制リロード
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');

-- STEP 5: 関数テスト
SELECT create_installment_v2(
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,  -- テスト用UUID
    'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,  -- テスト用UUID
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    10000.00,
    'テスト分納V2'
) AS test_result;

-- 実行完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ create_installment_v2 関数作成完了';
    RAISE NOTICE '🔄 APIゲートウェイリロード実行済み';
    RAISE NOTICE '⚡ 5分後にフロントエンドから create_installment_v2 を呼び出してください';
END $$;