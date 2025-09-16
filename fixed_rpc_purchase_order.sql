-- 🚨 FIX: RPC権限問題を解決した完全修正版
DROP FUNCTION IF EXISTS create_purchase_order(text,uuid,date,date,numeric,text,text);

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
    new_order_id UUID;
    result JSON;
BEGIN
    -- デバッグ出力
    RAISE NOTICE '🔧 Function called with params: order_no=%, partner_id=%, total=%, status=%',
                 p_order_no, p_partner_id, p_total_amount, p_status;

    -- 発注書作成
    INSERT INTO purchase_orders (
        order_no,
        partner_id,
        order_date,
        delivery_deadline,
        total_amount,
        status,
        memo,
        created_at,
        updated_at
    ) VALUES (
        p_order_no,
        p_partner_id,
        p_order_date,
        p_delivery_deadline,
        p_total_amount,
        p_status,
        p_memo,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_order_id;

    -- 成功レスポンス
    SELECT json_build_object(
        'id', new_order_id,
        'order_no', p_order_no,
        'partner_id', p_partner_id,
        'order_date', p_order_date,
        'delivery_deadline', p_delivery_deadline,
        'total_amount', p_total_amount,
        'status', p_status,
        'memo', p_memo,
        'created_at', NOW(),
        'updated_at', NOW()
    ) INTO result;

    RAISE NOTICE '✅ Order created successfully with ID: %', new_order_id;

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    -- エラーハンドリング
    RAISE NOTICE '❌ Error in create_purchase_order: % %', SQLSTATE, SQLERRM;
    RAISE EXCEPTION 'Purchase order creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- 実行権限を明示的に付与
GRANT EXECUTE ON FUNCTION create_purchase_order(text,uuid,date,date,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_purchase_order(text,uuid,date,date,numeric,text,text) TO anon;

-- テスト実行
SELECT create_purchase_order(
    'TEST-FIX-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    95000.00,
    'active',
    'Fix Test with Full Permissions'
);

RAISE NOTICE '🎯 Fixed RPC function with explicit permissions created successfully';