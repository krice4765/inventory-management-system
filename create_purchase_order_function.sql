-- 🚨 ULTIMATE FIX: 発注書作成のRPC関数
-- Supabaseライブラリのinsert+selectバグを完全回避

CREATE OR REPLACE FUNCTION create_purchase_order(
    p_order_no TEXT,
    p_partner_id UUID,
    p_order_date DATE,
    p_delivery_deadline DATE DEFAULT NULL,
    p_total_amount NUMERIC,
    p_status TEXT DEFAULT 'active',
    p_memo TEXT DEFAULT NULL
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
    'TEST-RPC-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    50000.00,
    'active',
    'RPC関数テスト'
);

RAISE NOTICE '🎯 発注書作成RPC関数の準備完了';
RAISE NOTICE '⚡ これでSupabaseライブラリのバグは完全に回避されます';