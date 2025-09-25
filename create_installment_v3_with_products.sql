-- 商品情報を含む分納作成関数 V3
-- transaction_itemsテーブルに正確な商品・数量情報を保存

CREATE OR REPLACE FUNCTION create_installment_v3(
    p_parent_order_id UUID,
    p_partner_id UUID,
    p_transaction_date DATE,
    p_due_date DATE,
    p_total_amount NUMERIC,
    p_memo TEXT,
    p_items JSONB -- 商品情報配列 [{"product_id": "uuid", "quantity": 2, "unit_price": 1160, "total_amount": 2320}]
) RETURNS JSON AS $$
DECLARE
    v_transaction_id UUID;
    v_installment_no INTEGER;
    v_transaction_no TEXT;
    v_item_record RECORD;
BEGIN
    -- 分納番号の計算
    SELECT COALESCE(MAX(installment_no), 0) + 1
    INTO v_installment_no
    FROM transactions
    WHERE parent_order_id = p_parent_order_id;

    -- 取引番号生成
    v_transaction_no := 'INST-V3-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || v_installment_no;

    -- 分納レコード作成
    INSERT INTO transactions (
        id, parent_order_id, partner_id, transaction_no, installment_no,
        transaction_date, due_date, total_amount, transaction_type, status,
        memo, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_parent_order_id, p_partner_id, v_transaction_no, v_installment_no,
        p_transaction_date, p_due_date, p_total_amount, 'purchase', 'confirmed',
        p_memo, NOW(), NOW()
    ) RETURNING id INTO v_transaction_id;

    -- 商品明細の保存（p_itemsが提供されている場合のみ）
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item_record IN
            SELECT
                (item->>'product_id')::UUID as product_id,
                (item->>'quantity')::INTEGER as quantity,
                (item->>'unit_price')::NUMERIC as unit_price,
                (item->>'total_amount')::NUMERIC as total_amount
            FROM jsonb_array_elements(p_items) as item
        LOOP
            INSERT INTO transaction_items (
                id, transaction_id, product_id, quantity, unit_price, total_amount, created_at
            ) VALUES (
                gen_random_uuid(), v_transaction_id, v_item_record.product_id,
                v_item_record.quantity, v_item_record.unit_price, v_item_record.total_amount, NOW()
            );
        END LOOP;
    END IF;

    -- 成功レスポンス
    RETURN json_build_object(
        'success', true,
        'id', v_transaction_id,
        'transaction_no', v_transaction_no,
        'installment_no', v_installment_no,
        'parent_order_id', p_parent_order_id,
        'total_amount', p_total_amount,
        'items_count', COALESCE(jsonb_array_length(p_items), 0),
        'created_at', NOW()
    );

EXCEPTION WHEN others THEN
    -- エラーレスポンス
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'V3分納処理（商品情報付き）失敗'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 権限設定
GRANT EXECUTE ON FUNCTION create_installment_v3(UUID, UUID, DATE, DATE, NUMERIC, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_installment_v3(UUID, UUID, DATE, DATE, NUMERIC, TEXT, JSONB) TO anon;

-- テスト実行
-- SELECT create_installment_v3(
--     'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,  -- parent_order_id
--     'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,  -- partner_id
--     CURRENT_DATE,
--     CURRENT_DATE + INTERVAL '30 days',
--     2320.00,
--     'ガラス2個分納テスト',
--     '[{"product_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "quantity": 2, "unit_price": 1160, "total_amount": 2320}]'::JSONB
-- ) AS test_result;

-- 実行完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ create_installment_v3 関数作成完了（商品情報対応版）';
    RAISE NOTICE '📦 transaction_itemsテーブルに正確な商品情報が保存されます';
    RAISE NOTICE '🔄 フロントエンドでp_itemsパラメータの追加が必要です';
END $$;