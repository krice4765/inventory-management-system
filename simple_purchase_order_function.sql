-- 🎯 最終解決策: デフォルト値を一切使わないシンプルな関数
CREATE OR REPLACE FUNCTION create_purchase_order(
    p_order_no TEXT,
    p_partner_id UUID,
    p_order_date DATE,
    p_delivery_deadline DATE,
    p_total_amount NUMERIC,
    p_status TEXT,
    p_memo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_result JSON;
BEGIN
    -- 発注書を作成
    INSERT INTO purchase_orders (
        order_no,
        partner_id,
        order_date,
        delivery_deadline,
        total_amount,
        status,
        memo
    ) VALUES (
        p_order_no,
        p_partner_id,
        p_order_date,
        p_delivery_deadline,
        p_total_amount,
        p_status,
        p_memo
    )
    RETURNING id INTO v_order_id;

    -- 作成された発注書情報を返す
    SELECT json_build_object(
        'id', v_order_id,
        'order_no', p_order_no,
        'partner_id', p_partner_id,
        'order_date', p_order_date,
        'delivery_deadline', p_delivery_deadline,
        'total_amount', p_total_amount,
        'status', p_status,
        'memo', p_memo,
        'created_at', NOW()
    ) INTO v_result;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '発注書作成エラー: %', SQLERRM;
END;
$$;

-- テスト実行
SELECT create_purchase_order(
    'TEST-SIMPLE-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    75000.00,
    'active',
    'シンプル関数テスト'
);

RAISE NOTICE '✅ シンプルな発注書作成関数が準備完了';
RAISE NOTICE '🎯 デフォルト値問題を完全回避しました';