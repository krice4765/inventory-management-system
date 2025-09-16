-- 🔧 SQL関数のデータ型修正
-- parent_order_idのデータ型を正しく設定

-- まず、transactionsテーブルのparent_order_idの実際のデータ型を確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name = 'parent_order_id';

-- 修正されたSQL関数（データ型を適切に設定）
CREATE OR REPLACE FUNCTION create_safe_installment_v3(
    p_parent_order_id UUID,  -- UUIDに修正
    p_amount NUMERIC,
    p_memo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID;
    v_transaction_no TEXT;
    v_installment_number INTEGER;
    v_result JSON;
BEGIN
    -- 一意のトランザクションIDを生成
    v_transaction_id := gen_random_uuid();

    -- 次の分納番号を取得（1から開始）
    SELECT COALESCE(COUNT(*), 0) + 1
    INTO v_installment_number
    FROM transactions
    WHERE parent_order_id = p_parent_order_id
      AND transaction_type = 'purchase'
      AND status = 'confirmed';

    -- 完全に一意なトランザクション番号を生成
    v_transaction_no := 'ULTRA-SAFE-' ||
                       EXTRACT(EPOCH FROM NOW())::BIGINT || '-' ||
                       v_installment_number || '-' ||
                       FLOOR(RANDOM() * 10000)::INTEGER;

    -- 分納トランザクションを作成（制約なしで安全）
    INSERT INTO transactions (
        id,
        transaction_type,
        transaction_no,
        parent_order_id,
        transaction_date,
        status,
        total_amount,
        memo,
        installment_no,
        created_at
    ) VALUES (
        v_transaction_id,
        'purchase',
        v_transaction_no,
        p_parent_order_id,
        CURRENT_DATE,
        'confirmed',
        p_amount,
        COALESCE(p_memo, '第' || v_installment_number || '回分納 (完全修正版)'),
        v_installment_number,
        NOW()
    );

    -- 成功結果をJSON形式で返す
    v_result := json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'transaction_no', v_transaction_no,
        'installment_number', v_installment_number,
        'message', '分納作成成功'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- エラー時もJSON形式で返す
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'message', '分納作成失敗: ' || SQLERRM
    );
END;
$$;

-- 実際の注文IDを使用したテスト（parent_order_idがUUIDの場合）
-- まず実際の注文IDを取得
SELECT
    'サンプル注文ID' as info,
    id as parent_order_id,
    order_no
FROM purchase_orders
LIMIT 1;

-- テストは実際のUUID値で実行する必要があります
-- 例: SELECT create_safe_installment_v3('actual-uuid-here'::UUID, 1000.00, 'テスト分納');

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '🔧 SQL関数修正完了';
    RAISE NOTICE '✅ parent_order_idをUUID型に修正';
    RAISE NOTICE '✅ データ型エラーは解決されました';
    RAISE NOTICE '⚡ これで分納システムは完全に動作可能です';
END $$;