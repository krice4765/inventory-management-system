-- Day 3 機能対応のためのデータベーススキーマ更新
-- 段階的かつ安全にスキーマを更新

-- ===============================================
-- ステップ1: purchase_ordersテーブルの拡張
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ1: purchase_ordersテーブル拡張開始';

    -- assigned_user_id列の追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'assigned_user_id'
    ) THEN
        ALTER TABLE purchase_orders
        ADD COLUMN assigned_user_id UUID REFERENCES profiles(id);
        RAISE NOTICE '✅ assigned_user_id列を追加しました';
    ELSE
        RAISE NOTICE 'ℹ️ assigned_user_id列は既に存在します';
    END IF;

    -- shipping_cost列の追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'shipping_cost'
    ) THEN
        ALTER TABLE purchase_orders
        ADD COLUMN shipping_cost INTEGER DEFAULT 0;
        RAISE NOTICE '✅ shipping_cost列を追加しました';
    ELSE
        RAISE NOTICE 'ℹ️ shipping_cost列は既に存在します';
    END IF;

    -- shipping_tax_rate列の追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'shipping_tax_rate'
    ) THEN
        ALTER TABLE purchase_orders
        ADD COLUMN shipping_tax_rate DECIMAL(5,4) DEFAULT 0.1000;
        RAISE NOTICE '✅ shipping_tax_rate列を追加しました';
    ELSE
        RAISE NOTICE 'ℹ️ shipping_tax_rate列は既に存在します';
    END IF;

    -- delivery_deadline列の追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'delivery_deadline'
    ) THEN
        ALTER TABLE purchase_orders
        ADD COLUMN delivery_deadline DATE;
        RAISE NOTICE '✅ delivery_deadline列を追加しました';
    ELSE
        RAISE NOTICE 'ℹ️ delivery_deadline列は既に存在します';
    END IF;

    RAISE NOTICE '✅ ステップ1: purchase_ordersテーブル拡張完了';
END $$;

-- ===============================================
-- ステップ2: productsテーブルの税区分対応
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ2: productsテーブル税区分対応開始';

    -- tax_category列の追加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'tax_category'
    ) THEN
        ALTER TABLE products
        ADD COLUMN tax_category VARCHAR(20) DEFAULT 'standard_10'
        CHECK (tax_category IN ('standard_10', 'reduced_8', 'tax_free', 'tax_exempt'));
        RAISE NOTICE '✅ tax_category列を追加しました';
    ELSE
        RAISE NOTICE 'ℹ️ tax_category列は既に存在します';
    END IF;

    -- weight_kg列の追加（送料計算用）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'weight_kg'
    ) THEN
        ALTER TABLE products
        ADD COLUMN weight_kg INTEGER;
        RAISE NOTICE '✅ weight_kg列を追加しました';
    ELSE
        RAISE NOTICE 'ℹ️ weight_kg列は既に存在します';
    END IF;

    RAISE NOTICE '✅ ステップ2: productsテーブル税区分対応完了';
END $$;

-- ===============================================
-- ステップ3: 税表示設定テーブルの作成
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ3: 税表示設定テーブル作成開始';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'tax_display_settings'
        AND table_schema = 'public'
    ) THEN
        CREATE TABLE tax_display_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID,
            user_id UUID REFERENCES profiles(id),
            setting_type VARCHAR(20) NOT NULL CHECK (setting_type IN ('organization', 'user')),
            tax_display_preference VARCHAR(20) NOT NULL DEFAULT 'tax_included'
                CHECK (tax_display_preference IN ('tax_included', 'tax_excluded')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_tax_display_settings_user ON tax_display_settings(user_id);
        CREATE INDEX idx_tax_display_settings_org ON tax_display_settings(organization_id);

        RAISE NOTICE '✅ tax_display_settings テーブルを作成しました';
    ELSE
        RAISE NOTICE 'ℹ️ tax_display_settings テーブルは既に存在します';
    END IF;
END $$;

-- ===============================================
-- ステップ4: 送料設定テーブルの作成
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ4: 送料設定テーブル作成開始';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'shipping_cost_settings'
        AND table_schema = 'public'
    ) THEN
        CREATE TABLE shipping_cost_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
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

        RAISE NOTICE '✅ shipping_cost_settings テーブルを作成しました';
    ELSE
        RAISE NOTICE 'ℹ️ shipping_cost_settings テーブルは既に存在します';
    END IF;
END $$;

-- ===============================================
-- ステップ5: デフォルト送料設定の挿入
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ5: デフォルト送料設定挿入開始';

    -- デフォルト送料設定
    INSERT INTO shipping_cost_settings (
        supplier_id, shipping_method, base_cost, weight_threshold,
        additional_cost_per_kg, free_shipping_threshold, tax_rate
    ) VALUES
    (NULL, 'standard', 800, 10, 100, 10000, 0.1),
    (NULL, 'express', 1500, 10, 150, 15000, 0.1),
    (NULL, 'overnight', 2500, 5, 200, 20000, 0.1),
    (NULL, 'pickup', 0, NULL, NULL, NULL, 0.0)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ デフォルト送料設定を挿入しました';
END $$;

-- ===============================================
-- ステップ6: サンプルデータの更新
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ6: サンプルデータ更新開始';

    -- purchase_ordersにdelivery_deadlineのサンプル値を設定
    UPDATE purchase_orders
    SET delivery_deadline = CURRENT_DATE + (RANDOM() * 30)::INTEGER
    WHERE delivery_deadline IS NULL;

    -- productsにweight_kgのサンプル値を設定
    UPDATE products
    SET weight_kg = (RANDOM() * 10 + 1)::INTEGER
    WHERE weight_kg IS NULL;

    RAISE NOTICE '✅ サンプルデータを更新しました';
END $$;

-- ===============================================
-- ステップ7: 基本的な税計算関数の作成
-- ===============================================

CREATE OR REPLACE FUNCTION get_tax_display_preference(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    preference TEXT;
BEGIN
    -- ユーザー個人設定を確認
    SELECT tax_display_preference INTO preference
    FROM tax_display_settings
    WHERE tax_display_settings.user_id = get_tax_display_preference.user_id
    AND setting_type = 'user'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF preference IS NOT NULL THEN
        RETURN preference;
    END IF;

    -- 組織設定を確認
    SELECT tax_display_preference INTO preference
    FROM tax_display_settings
    WHERE setting_type = 'organization'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF preference IS NOT NULL THEN
        RETURN preference;
    END IF;

    -- デフォルト
    RETURN 'tax_included';
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- ステップ8: 権限設定
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '🔄 ステップ8: 権限設定開始';

    -- RLS有効化
    ALTER TABLE tax_display_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shipping_cost_settings ENABLE ROW LEVEL SECURITY;

    -- 基本的な読み取り権限
    CREATE POLICY IF NOT EXISTS "tax_display_settings_select" ON tax_display_settings
        FOR SELECT TO authenticated USING (true);

    CREATE POLICY IF NOT EXISTS "shipping_cost_settings_select" ON shipping_cost_settings
        FOR SELECT TO authenticated USING (true);

    -- 関数実行権限
    GRANT EXECUTE ON FUNCTION get_tax_display_preference(UUID) TO authenticated;

    RAISE NOTICE '✅ 権限設定完了';
END $$;

-- ===============================================
-- 完了メッセージ
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Day 3 スキーマ更新が完了しました！';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 追加された機能:';
    RAISE NOTICE '   - 発注担当者管理 (assigned_user_id)';
    RAISE NOTICE '   - 送料計算システム (shipping_cost, shipping_tax_rate)';
    RAISE NOTICE '   - 税表示設定 (tax_display_settings)';
    RAISE NOTICE '   - 送料設定管理 (shipping_cost_settings)';
    RAISE NOTICE '   - 商品重量管理 (weight_kg)';
    RAISE NOTICE '   - 納期管理 (delivery_deadline)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 フロントエンドの新機能が正常に動作するようになります';
END $$;