-- デフォルト送料設定の作成
-- SupabaseダッシュボードのSQL Editorで実行してください

-- ===============================================
-- デフォルト送料設定データの挿入
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 デフォルト送料設定作成開始';

    -- 標準配送設定
    INSERT INTO shipping_cost_settings (
        supplier_id,
        shipping_method,
        base_cost,
        weight_threshold,
        additional_cost_per_kg,
        free_shipping_threshold,
        tax_rate,
        is_active,
        effective_from,
        effective_until
    )
    SELECT
        NULL,
        'standard',
        800,
        10,
        100,
        10000,
        0.1,
        true,
        NOW(),
        NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'standard'
    );

    -- 速達配送設定
    INSERT INTO shipping_cost_settings (
        supplier_id,
        shipping_method,
        base_cost,
        weight_threshold,
        additional_cost_per_kg,
        free_shipping_threshold,
        tax_rate,
        is_active,
        effective_from,
        effective_until
    )
    SELECT
        NULL,
        'express',
        1500,
        10,
        150,
        15000,
        0.1,
        true,
        NOW(),
        NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'express'
    );

    -- 翌日配送設定
    INSERT INTO shipping_cost_settings (
        supplier_id,
        shipping_method,
        base_cost,
        weight_threshold,
        additional_cost_per_kg,
        free_shipping_threshold,
        tax_rate,
        is_active,
        effective_from,
        effective_until
    )
    SELECT
        NULL,
        'overnight',
        2500,
        5,
        200,
        20000,
        0.1,
        true,
        NOW(),
        NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'overnight'
    );

    -- 店舗受取設定（送料無料）
    INSERT INTO shipping_cost_settings (
        supplier_id,
        shipping_method,
        base_cost,
        weight_threshold,
        additional_cost_per_kg,
        free_shipping_threshold,
        tax_rate,
        is_active,
        effective_from,
        effective_until
    )
    SELECT
        NULL,
        'pickup',
        0,
        NULL,
        NULL,
        NULL,
        0.0,
        true,
        NOW(),
        NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'pickup'
    );

    RAISE NOTICE '✅ デフォルト送料設定作成完了';
END $$;

-- ===============================================
-- 作成結果の確認
-- ===============================================

DO $$
DECLARE
    setting_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO setting_count
    FROM shipping_cost_settings
    WHERE supplier_id IS NULL;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 デフォルト送料設定が作成されました！';
    RAISE NOTICE '作成された設定数: %', setting_count;
    RAISE NOTICE '';
    RAISE NOTICE '確認SQL:';
    RAISE NOTICE '  SELECT * FROM shipping_cost_settings WHERE supplier_id IS NULL;';
    RAISE NOTICE '';
END $$;