-- 🚨 URGENT FIX: purchase_ordersのトリガー関数を修正
-- ON CONFLICT制約が削除されたため、トリガー関数も更新が必要

-- 1. 現在のトリガー関数を確認
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'fn_sync_transaction_from_po';

-- 2. 問題のあるトリガー関数を修正（ON CONFLICT句を削除）
CREATE OR REPLACE FUNCTION fn_sync_transaction_from_po()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- ON CONFLICT句を削除して単純なINSERTに変更
    INSERT INTO public.transactions (
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
        created_at
    )
    VALUES (
        gen_random_uuid(),
        'TX-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text),1,6),
        'purchase',
        NEW.partner_id,
        NEW.order_date,
        NEW.delivery_deadline,
        'draft',
        NEW.total_amount,
        NEW.memo,
        NEW.id,
        1,         -- 初回分納
        now()
    );

    RETURN NEW;
END;
$$;

-- 3. テスト用の発注書作成
SELECT create_purchase_order(
    'TRIGGER-FIX-TEST-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    (SELECT id FROM partners LIMIT 1),
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    45000.00,
    'active',
    'Trigger Fix Test'
);

RAISE NOTICE '✅ トリガー関数のON CONFLICT問題を修正しました';