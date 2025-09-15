-- セキュリティ改善機能のテストスクリプト
-- 実際のテスト実行前にバックアップを作成してください

-- テスト用データの準備
DO $$
DECLARE
    test_order_id UUID := gen_random_uuid();
    test_product_id UUID := gen_random_uuid();
    test_user_id TEXT := 'test-user-001';
    test_session_id UUID := gen_random_uuid();
    operation_hash TEXT;
BEGIN
    RAISE NOTICE '🧪 セキュリティ改善機能テスト開始';
    RAISE NOTICE '📋 テスト対象:';
    RAISE NOTICE '   - 重複検出システム (Hash-based)';
    RAISE NOTICE '   - 在庫オーバーライドログ';

    -- テスト1: 重複検出システム
    RAISE NOTICE '🔍 テスト1: 重複検出システム';

    operation_hash := encode(sha256(('{"orderId":"' || test_order_id || '","amount":100000}')::bytea), 'hex');

    -- 初回操作記録
    INSERT INTO public.duplicate_detection_records (
        operation_hash,
        order_id,
        user_id,
        session_id,
        expires_at,
        operation_data
    ) VALUES (
        operation_hash,
        test_order_id,
        test_user_id,
        test_session_id,
        NOW() + INTERVAL '1 hour',
        '{"orderId":"' || test_order_id || '","amount":100000,"deliveryType":"amount_only"}'::jsonb
    );

    RAISE NOTICE '   ✅ 操作記録作成: %', operation_hash;

    -- 重複チェック
    IF EXISTS (
        SELECT 1 FROM public.duplicate_detection_records
        WHERE operation_hash = operation_hash AND expires_at > NOW()
    ) THEN
        RAISE NOTICE '   ✅ 重複検出成功: 同一ハッシュが見つかりました';
    ELSE
        RAISE NOTICE '   ❌ 重複検出失敗: ハッシュが見つかりません';
    END IF;

    -- テスト2: 在庫オーバーライドログ
    RAISE NOTICE '🔍 テスト2: 在庫オーバーライドログ';

    INSERT INTO public.inventory_override_logs (
        order_id,
        product_id,
        requested_quantity,
        current_stock,
        shortage,
        reason,
        requested_by,
        status
    ) VALUES (
        test_order_id,
        test_product_id,
        150,
        100,
        50,
        '緊急出荷要請のため在庫制限をオーバーライド',
        test_user_id,
        'approved'
    );

    RAISE NOTICE '   ✅ オーバーライドログ記録完了';

    -- テスト結果確認
    RAISE NOTICE '📊 テスト結果サマリー:';
    RAISE NOTICE '   重複検出レコード数: %', (SELECT COUNT(*) FROM public.duplicate_detection_records);
    RAISE NOTICE '   オーバーライドログ数: %', (SELECT COUNT(*) FROM public.inventory_override_logs);

    -- テストデータクリーンアップ
    DELETE FROM public.duplicate_detection_records WHERE user_id = test_user_id;
    DELETE FROM public.inventory_override_logs WHERE requested_by = test_user_id;

    RAISE NOTICE '🧹 テストデータクリーンアップ完了';
    RAISE NOTICE '✅ セキュリティ改善機能テスト完了';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ テスト実行エラー: %', SQLERRM;
    RAISE EXCEPTION 'テスト失敗: %', SQLERRM;
END $$;

-- パフォーマンステスト
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    test_hash TEXT;
    i INTEGER;
BEGIN
    RAISE NOTICE '⚡ パフォーマンステスト開始';
    start_time := clock_timestamp();

    -- 1000件のハッシュ検索テスト
    FOR i IN 1..1000 LOOP
        test_hash := encode(sha256(('test' || i)::bytea), 'hex');
        PERFORM 1 FROM public.duplicate_detection_records
        WHERE operation_hash = test_hash AND expires_at > NOW();
    END LOOP;

    end_time := clock_timestamp();

    RAISE NOTICE '   1000回ハッシュ検索: % ms',
        EXTRACT(MILLISECONDS FROM (end_time - start_time));
    RAISE NOTICE '✅ パフォーマンステスト完了';
END $$;