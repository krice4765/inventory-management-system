-- 🎯 ULTRA SIMPLE: ON CONFLICT句を完全に削除した安全版
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
    -- 発注書を作成（ON CONFLICT句なし）
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
    -- シンプルなエラー処理
    RAISE EXCEPTION 'Purchase order creation failed: %', SQLERRM;
END;
$$;

-- 修正版テスト実行
SELECT create_purchase_order(
    'TEST-ULTRA-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    80000.00,
    'active',
    'Ultra Simple Test'
);

RAISE NOTICE '✅ Ultra Simple版発注書作成関数が準備完了';
RAISE NOTICE '🎯 ON CONFLICT問題を完全回避しました';