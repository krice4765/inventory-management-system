-- 🔧 分納システムのスキーマ問題修正
-- カラム名不一致とRPC関数の作成

-- 1. 現在のtransactionsテーブル確認（既に確認済み：installment_no exists）

-- 2. create_safe_installment RPC関数を作成
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
    -- 次の分納番号を取得
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_installment_no
    FROM transactions
    WHERE parent_order_id = p_parent_order_id
    AND transaction_type = 'purchase';

    -- トランザクション番号生成
    v_transaction_no := 'TX-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text),1,6);

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
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_transaction_no,
        'purchase',
        p_partner_id,
        p_transaction_date,
        p_due_date,
        'draft',
        p_total_amount,
        p_memo,
        p_parent_order_id,
        v_installment_no,
        p_delivery_sequence,
        p_product_name,
        p_unit_price,
        p_quantity,
        NOW()
    )
    RETURNING id INTO v_transaction_id;

    -- 成功レスポンス
    RETURN json_build_object(
        'id', v_transaction_id,
        'transaction_no', v_transaction_no,
        'installment_no', v_installment_no,
        'parent_order_id', p_parent_order_id,
        'total_amount', p_total_amount,
        'status', 'draft',
        'created_at', NOW()
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Safe installment creation failed: %', SQLERRM;
END;
$$;

-- 3. 権限付与
GRANT EXECUTE ON FUNCTION create_safe_installment TO authenticated;
GRANT EXECUTE ON FUNCTION create_safe_installment TO anon;

-- 4. テスト実行
SELECT create_safe_installment(
    (SELECT id FROM purchase_orders LIMIT 1),
    (SELECT partner_id FROM purchase_orders LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '7 days')::DATE,
    25000.00,
    'Test Safe Installment'
);

RAISE NOTICE '✅ create_safe_installment関数を作成しました';