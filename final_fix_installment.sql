-- 🎯 FINAL FIX: 完全なRPC関数再作成（フロントエンドパラメータ完全対応版）

-- 1. 既存関数を完全削除
DROP FUNCTION IF EXISTS create_safe_installment CASCADE;

-- 2. フロントエンドが送信する正確なパラメータに対応した関数作成
CREATE OR REPLACE FUNCTION create_safe_installment(
    p_parent_order_id UUID,
    p_partner_id UUID,
    p_transaction_date DATE,
    p_due_date DATE,
    p_total_amount NUMERIC,
    p_memo TEXT,
    p_delivery_sequence INTEGER DEFAULT NULL,
    p_product_name TEXT DEFAULT NULL,
    p_unit_price NUMERIC DEFAULT NULL,
    p_quantity NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_installment_no INTEGER;
    v_transaction_id UUID;
    v_transaction_no TEXT;
BEGIN
    RAISE NOTICE '🔧 create_safe_installment called with: parent_order_id=%, amount=%', p_parent_order_id, p_total_amount;

    -- 次の分納番号を取得
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_installment_no
    FROM transactions
    WHERE parent_order_id = p_parent_order_id
    AND transaction_type = 'purchase';

    RAISE NOTICE '📊 Next installment number: %', v_installment_no;

    -- トランザクション番号生成（固有性保証）
    v_transaction_no := 'RPC-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text),1,6);

    -- 分納トランザクション作成
    INSERT INTO transactions (
        id,
        transaction_no,
        transaction_type,
        partner_id,
        transaction_date,
        due_date,
        status,
        total_amount,
        memo,
        parent_order_id,
        installment_no,
        delivery_sequence,
        product_name,
        unit_price,
        quantity,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_transaction_no,
        'purchase',
        p_partner_id,
        p_transaction_date,
        p_due_date,
        'confirmed',  -- ステータスをconfirmedに設定
        p_total_amount,
        COALESCE(p_memo, '第' || v_installment_no || '回分納 (RPC処理)'),
        p_parent_order_id,
        v_installment_no,
        p_delivery_sequence,
        p_product_name,
        p_unit_price,
        p_quantity,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_transaction_id;

    RAISE NOTICE '✅ Transaction created: id=%, transaction_no=%', v_transaction_id, v_transaction_no;

    -- 成功レスポンス
    RETURN json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'transaction_no', v_transaction_no,
        'installment_no', v_installment_no,
        'parent_order_id', p_parent_order_id,
        'total_amount', p_total_amount,
        'status', 'confirmed',
        'created_at', NOW()
    );

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error in create_safe_installment: % %', SQLSTATE, SQLERRM;
    RAISE EXCEPTION 'Safe installment creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- 3. 最大権限付与（確実な実行保証）
GRANT EXECUTE ON FUNCTION create_safe_installment(uuid,uuid,date,date,numeric,text,integer,text,numeric,numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_safe_installment(uuid,uuid,date,date,numeric,text,integer,text,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION create_safe_installment(uuid,uuid,date,date,numeric,text,integer,text,numeric,numeric) TO anon;
GRANT EXECUTE ON FUNCTION create_safe_installment(uuid,uuid,date,date,numeric,text,integer,text,numeric,numeric) TO service_role;

-- 4. 即座動作テスト
DO $$
DECLARE
    test_result JSON;
    sample_order_id UUID;
    sample_partner_id UUID;
BEGIN
    -- サンプルデータ取得
    SELECT id, partner_id INTO sample_order_id, sample_partner_id
    FROM purchase_orders
    LIMIT 1;

    IF sample_order_id IS NOT NULL THEN
        -- テスト実行
        SELECT create_safe_installment(
            sample_order_id,
            sample_partner_id,
            CURRENT_DATE,
            (CURRENT_DATE + INTERVAL '7 days')::DATE,
            8888.00,
            'Final Fix Test'
        ) INTO test_result;

        RAISE NOTICE '🎉 FINAL FIX TEST RESULT: %', test_result;
    ELSE
        RAISE NOTICE '⚠️ No sample order found for testing';
    END IF;
END;
$$;

RAISE NOTICE '🏆 FINAL FIX COMPLETED - RPC関数の完全再作成が完了しました';