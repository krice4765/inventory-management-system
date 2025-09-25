-- 修正版: 送料設定テーブルの作成（型一致対応）
-- suppliers.id が bigint 型であることに対応

-- ===============================================
-- ステップ4修正版: 送料設定テーブルの作成
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 送料設定テーブル作成開始（修正版）';

    -- 既存テーブルがある場合は削除して再作成
    DROP TABLE IF EXISTS shipping_cost_settings;

    CREATE TABLE shipping_cost_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id BIGINT REFERENCES suppliers(id) ON DELETE CASCADE,
        shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard',
        base_cost INTEGER NOT NULL DEFAULT 0,
        weight_threshold INTEGER,
        additional_cost_per_kg INTEGER,
        free_shipping_threshold INTEGER,
        tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
        is_active BOOLEAN NOT NULL DEFAULT true,
        effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        effective_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT shipping_cost_settings_base_cost_check CHECK (base_cost >= 0),
        CONSTRAINT shipping_cost_settings_tax_rate_check CHECK (tax_rate >= 0 AND tax_rate <= 1)
    );

    CREATE INDEX idx_shipping_cost_settings_supplier ON shipping_cost_settings(supplier_id, is_active);

    RAISE NOTICE '✅ shipping_cost_settings テーブルを作成しました（supplier_id: BIGINT）';
END $$;

-- ===============================================
-- ステップ6修正版: 権限設定
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 権限設定開始（修正版）';

    -- RLS有効化
    ALTER TABLE tax_display_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shipping_cost_settings ENABLE ROW LEVEL SECURITY;

    -- 基本的な読み取り権限
    DROP POLICY IF EXISTS "tax_display_settings_select" ON tax_display_settings;
    CREATE POLICY "tax_display_settings_select" ON tax_display_settings
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "shipping_cost_settings_select" ON shipping_cost_settings;
    CREATE POLICY "shipping_cost_settings_select" ON shipping_cost_settings
        FOR SELECT TO authenticated USING (true);

    -- 関数実行権限
    GRANT EXECUTE ON FUNCTION get_tax_display_preference(UUID) TO authenticated;

    RAISE NOTICE '✅ 権限設定完了';
END $$;

-- ===============================================
-- ステップ7修正版: デフォルトデータの挿入
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 デフォルトデータ挿入開始（修正版）';

    -- デフォルト送料設定（重複回避）
    INSERT INTO shipping_cost_settings (
        supplier_id, shipping_method, base_cost, weight_threshold,
        additional_cost_per_kg, free_shipping_threshold, tax_rate
    )
    SELECT NULL, 'standard', 800, 10, 100, 10000, 0.1
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'standard'
    );

    INSERT INTO shipping_cost_settings (
        supplier_id, shipping_method, base_cost, weight_threshold,
        additional_cost_per_kg, free_shipping_threshold, tax_rate
    )
    SELECT NULL, 'express', 1500, 10, 150, 15000, 0.1
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'express'
    );

    INSERT INTO shipping_cost_settings (
        supplier_id, shipping_method, base_cost, weight_threshold,
        additional_cost_per_kg, free_shipping_threshold, tax_rate
    )
    SELECT NULL, 'overnight', 2500, 5, 200, 20000, 0.1
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'overnight'
    );

    INSERT INTO shipping_cost_settings (
        supplier_id, shipping_method, base_cost, weight_threshold,
        additional_cost_per_kg, free_shipping_threshold, tax_rate
    )
    SELECT NULL, 'pickup', 0, NULL, NULL, NULL, 0.0
    WHERE NOT EXISTS (
        SELECT 1 FROM shipping_cost_settings
        WHERE supplier_id IS NULL AND shipping_method = 'pickup'
    );

    RAISE NOTICE '✅ デフォルトデータ挿入完了';
END $$;

-- ===============================================
-- 完了確認
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 修正版Day 3スキーマ更新が完了しました！';
    RAISE NOTICE '';
    RAISE NOTICE '確認SQL:';
    RAISE NOTICE '  SELECT column_name FROM information_schema.columns WHERE table_name = ''purchase_orders'' AND column_name IN (''assigned_user_id'', ''shipping_cost'', ''shipping_tax_rate'');';
    RAISE NOTICE '  SELECT table_name FROM information_schema.tables WHERE table_name IN (''tax_display_settings'', ''shipping_cost_settings'');';
    RAISE NOTICE '  SELECT proname FROM pg_proc WHERE proname = ''get_tax_display_preference'';';
    RAISE NOTICE '  SELECT COUNT(*) as default_shipping_settings FROM shipping_cost_settings;';
    RAISE NOTICE '';
END $$;