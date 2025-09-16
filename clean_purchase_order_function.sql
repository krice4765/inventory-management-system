-- 🧹 CLEAN VERSION: ON CONFLICT句を一切含まない完全クリーン版
DROP FUNCTION IF EXISTS create_purchase_order(text,uuid,date,date,numeric,text,text);

CREATE FUNCTION create_purchase_order(
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
    new_order_id UUID;
BEGIN
    -- 単純なINSERT文のみ
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
    RETURNING id INTO new_order_id;

    -- JSON結果を返す
    RETURN json_build_object(
        'id', new_order_id,
        'order_no', p_order_no,
        'partner_id', p_partner_id,
        'order_date', p_order_date,
        'delivery_deadline', p_delivery_deadline,
        'total_amount', p_total_amount,
        'status', p_status,
        'memo', p_memo,
        'created_at', NOW()
    );
END;
$$;

-- テスト実行
SELECT create_purchase_order(
    'CLEAN-TEST-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    90000.00,
    'active',
    'Clean Function Test'
);