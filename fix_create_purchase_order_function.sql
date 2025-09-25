-- 🔧 create_purchase_order関数を修正（shipping_costとassigned_user_idを追加）
CREATE OR REPLACE FUNCTION create_purchase_order(
    p_order_no TEXT,
    p_partner_id UUID,
    p_order_date DATE,
    p_delivery_deadline DATE,
    p_total_amount NUMERIC,
    p_status TEXT,
    p_memo TEXT,
    p_assigned_user_id UUID DEFAULT NULL,
    p_shipping_cost NUMERIC DEFAULT 0,
    p_shipping_tax_rate NUMERIC DEFAULT 0.1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_result JSON;
BEGIN
    -- 発注書を作成（送料と担当者情報を含む）
    INSERT INTO purchase_orders (
        order_no,
        partner_id,
        order_date,
        delivery_deadline,
        total_amount,
        status,
        memo,
        assigned_user_id,
        shipping_cost,
        shipping_tax_rate
    ) VALUES (
        p_order_no,
        p_partner_id,
        p_order_date,
        p_delivery_deadline,
        p_total_amount,
        p_status,
        p_memo,
        p_assigned_user_id,
        p_shipping_cost,
        p_shipping_tax_rate
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
        'assigned_user_id', p_assigned_user_id,
        'shipping_cost', p_shipping_cost,
        'shipping_tax_rate', p_shipping_tax_rate,
        'created_at', NOW()
    ) INTO v_result;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- エラー処理
    RAISE EXCEPTION 'Purchase order creation failed: %', SQLERRM;
END;
$$;

-- テスト実行
SELECT create_purchase_order(
    'TEST-FIXED-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    5000.00,
    'active',
    'Fixed Function Test',
    '40b8bd1f-4e12-430c-aa78-c364ad75a35a'::UUID,  -- 山田太郎のID
    500.00,  -- 送料
    0.1      -- 送料税率
);