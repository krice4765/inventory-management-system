-- Day 3: 送料計算システムのデータベーススキーマ
-- 送料設定テーブルと関連機能の実装

-- 送料設定テーブル
CREATE TABLE IF NOT EXISTS shipping_cost_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE, -- NULL の場合はデフォルト設定
    shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, express, overnight, pickup
    base_cost INTEGER NOT NULL DEFAULT 0, -- 基本送料（円）
    weight_threshold INTEGER, -- 重量閾値（kg）
    additional_cost_per_kg INTEGER, -- 重量超過時の追加料金（円/kg）
    free_shipping_threshold INTEGER, -- 送料無料になる注文金額（円）
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000, -- 送料にかかる税率
    is_active BOOLEAN NOT NULL DEFAULT true,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ, -- NULL の場合は無期限
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT shipping_cost_settings_base_cost_check CHECK (base_cost >= 0),
    CONSTRAINT shipping_cost_settings_weight_threshold_check CHECK (weight_threshold IS NULL OR weight_threshold > 0),
    CONSTRAINT shipping_cost_settings_additional_cost_check CHECK (additional_cost_per_kg IS NULL OR additional_cost_per_kg >= 0),
    CONSTRAINT shipping_cost_settings_free_threshold_check CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold > 0),
    CONSTRAINT shipping_cost_settings_tax_rate_check CHECK (tax_rate >= 0 AND tax_rate <= 1),
    CONSTRAINT shipping_cost_settings_effective_period_check CHECK (effective_until IS NULL OR effective_until > effective_from),

    -- ユニーク制約：同一取引先・同一配送方法・同一期間は1つのみ
    CONSTRAINT shipping_cost_settings_unique_active UNIQUE (supplier_id, shipping_method, effective_from)
);

-- インデックスの作成
CREATE INDEX idx_shipping_cost_settings_supplier_active ON shipping_cost_settings(supplier_id, is_active, effective_from DESC);
CREATE INDEX idx_shipping_cost_settings_method_active ON shipping_cost_settings(shipping_method, is_active);
CREATE INDEX idx_shipping_cost_settings_effective_period ON shipping_cost_settings(effective_from, effective_until);

-- RLSポリシーの設定
ALTER TABLE shipping_cost_settings ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー：アクティブユーザーは全て閲覧可能
CREATE POLICY "shipping_cost_settings_select_policy" ON shipping_cost_settings
    FOR SELECT TO authenticated
    USING (true);

-- 挿入・更新・削除ポリシー：管理者のみ
CREATE POLICY "shipping_cost_settings_admin_policy" ON shipping_cost_settings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 送料計算関数
CREATE OR REPLACE FUNCTION calculate_shipping_cost(
    p_supplier_id UUID,
    p_order_value INTEGER DEFAULT 0,
    p_total_weight INTEGER DEFAULT NULL,
    p_shipping_method VARCHAR DEFAULT 'standard'
) RETURNS JSON AS $$
DECLARE
    v_setting RECORD;
    v_base_cost INTEGER;
    v_weight_based_cost INTEGER := 0;
    v_total_cost INTEGER;
    v_tax_amount INTEGER;
    v_total_with_tax INTEGER;
    v_is_free_shipping BOOLEAN := false;
    v_result JSON;
BEGIN
    -- 取引先固有の設定を検索
    SELECT * INTO v_setting
    FROM shipping_cost_settings
    WHERE supplier_id = p_supplier_id
      AND shipping_method = p_shipping_method
      AND is_active = true
      AND effective_from <= NOW()
      AND (effective_until IS NULL OR effective_until > NOW())
    ORDER BY effective_from DESC
    LIMIT 1;

    -- 取引先固有の設定がない場合、デフォルト設定を検索
    IF NOT FOUND THEN
        SELECT * INTO v_setting
        FROM shipping_cost_settings
        WHERE supplier_id IS NULL
          AND shipping_method = p_shipping_method
          AND is_active = true
          AND effective_from <= NOW()
          AND (effective_until IS NULL OR effective_until > NOW())
        ORDER BY effective_from DESC
        LIMIT 1;
    END IF;

    -- 設定が見つからない場合のデフォルト値
    IF NOT FOUND THEN
        v_setting.base_cost := 800; -- デフォルト送料
        v_setting.weight_threshold := NULL;
        v_setting.additional_cost_per_kg := NULL;
        v_setting.free_shipping_threshold := 10000; -- 1万円以上で送料無料
        v_setting.tax_rate := 0.1;
        v_setting.shipping_method := p_shipping_method;
    END IF;

    v_base_cost := v_setting.base_cost;

    -- 重量ベース追加料金の計算
    IF p_total_weight IS NOT NULL
       AND v_setting.weight_threshold IS NOT NULL
       AND v_setting.additional_cost_per_kg IS NOT NULL
       AND p_total_weight > v_setting.weight_threshold THEN
        v_weight_based_cost := (p_total_weight - v_setting.weight_threshold) * v_setting.additional_cost_per_kg;
    END IF;

    v_total_cost := v_base_cost + v_weight_based_cost;

    -- 送料無料判定
    IF v_setting.free_shipping_threshold IS NOT NULL
       AND p_order_value >= v_setting.free_shipping_threshold THEN
        v_is_free_shipping := true;
        v_total_cost := 0;
        v_base_cost := 0;
        v_weight_based_cost := 0;
    END IF;

    -- 税額計算（切り捨て）
    v_tax_amount := FLOOR(v_total_cost * v_setting.tax_rate);
    v_total_with_tax := v_total_cost + v_tax_amount;

    -- 結果のJSON構築
    v_result := json_build_object(
        'base_cost', v_base_cost,
        'weight_based_cost', v_weight_based_cost,
        'total_cost', v_total_cost,
        'tax_amount', v_tax_amount,
        'total_with_tax', v_total_with_tax,
        'is_free_shipping', v_is_free_shipping,
        'shipping_method', v_setting.shipping_method,
        'calculation_details', json_build_object(
            'weight_threshold_exceeded', (p_total_weight IS NOT NULL AND v_setting.weight_threshold IS NOT NULL AND p_total_weight > v_setting.weight_threshold),
            'free_shipping_applied', v_is_free_shipping,
            'effective_tax_rate', v_setting.tax_rate,
            'supplier_specific_setting', (v_setting.supplier_id IS NOT NULL)
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 注文の総重量計算関数
CREATE OR REPLACE FUNCTION calculate_order_total_weight(p_order_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_total_weight INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(oi.quantity * p.weight_kg), 0) INTO v_total_weight
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id
      AND p.weight_kg IS NOT NULL;

    RETURN v_total_weight;
END;
$$ LANGUAGE plpgsql;

-- デフォルト送料設定の挿入
INSERT INTO shipping_cost_settings (
    supplier_id, shipping_method, base_cost, weight_threshold,
    additional_cost_per_kg, free_shipping_threshold, tax_rate
) VALUES
-- デフォルト設定（全取引先共通）
(NULL, 'standard', 800, 10, 100, 10000, 0.1),
(NULL, 'express', 1500, 10, 150, 15000, 0.1),
(NULL, 'overnight', 2500, 5, 200, 20000, 0.1),
(NULL, 'pickup', 0, NULL, NULL, NULL, 0.0)
ON CONFLICT (supplier_id, shipping_method, effective_from) DO NOTHING;

-- 重量カラムを商品テーブルに追加（存在しない場合）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'products' AND column_name = 'weight_kg') THEN
        ALTER TABLE products ADD COLUMN weight_kg INTEGER; -- 重量（kg）
        COMMENT ON COLUMN products.weight_kg IS '商品重量（kg単位）';
    END IF;
END $$;

-- 送料計算結果の更新トリガー関数
CREATE OR REPLACE FUNCTION update_order_shipping_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_order_value INTEGER;
    v_total_weight INTEGER;
    v_shipping_result JSON;
BEGIN
    -- 注文の合計金額を計算
    SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) INTO v_order_value
    FROM order_items oi
    WHERE oi.order_id = COALESCE(NEW.id, OLD.id);

    -- 注文の総重量を計算
    v_total_weight := calculate_order_total_weight(COALESCE(NEW.id, OLD.id));

    -- 送料を計算
    IF NEW.supplier_id IS NOT NULL THEN
        v_shipping_result := calculate_shipping_cost(
            NEW.supplier_id,
            v_order_value,
            v_total_weight,
            COALESCE(NEW.shipping_method, 'standard')
        );

        -- 送料フィールドを更新
        NEW.shipping_cost := (v_shipping_result->>'total_cost')::INTEGER;
        NEW.shipping_tax_rate := (v_shipping_result->'calculation_details'->>'effective_tax_rate')::DECIMAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 発注テーブルに送料自動計算トリガーを設定
DROP TRIGGER IF EXISTS trigger_update_order_shipping_cost ON orders;
CREATE TRIGGER trigger_update_order_shipping_cost
    BEFORE INSERT OR UPDATE OF supplier_id, shipping_method
    ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_shipping_cost();

-- 発注明細変更時の送料再計算トリガー
CREATE OR REPLACE FUNCTION recalculate_order_shipping_on_items_change()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_order_value INTEGER;
    v_total_weight INTEGER;
    v_shipping_result JSON;
    v_order_record RECORD;
BEGIN
    -- 対象の注文IDを取得
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    -- 注文情報を取得
    SELECT * INTO v_order_record FROM orders WHERE id = v_order_id;

    IF FOUND AND v_order_record.supplier_id IS NOT NULL THEN
        -- 注文の合計金額を再計算
        SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) INTO v_order_value
        FROM order_items oi
        WHERE oi.order_id = v_order_id;

        -- 注文の総重量を再計算
        v_total_weight := calculate_order_total_weight(v_order_id);

        -- 送料を再計算
        v_shipping_result := calculate_shipping_cost(
            v_order_record.supplier_id,
            v_order_value,
            v_total_weight,
            COALESCE(v_order_record.shipping_method, 'standard')
        );

        -- 発注テーブルの送料を更新
        UPDATE orders
        SET shipping_cost = (v_shipping_result->>'total_cost')::INTEGER,
            shipping_tax_rate = (v_shipping_result->'calculation_details'->>'effective_tax_rate')::DECIMAL,
            updated_at = NOW()
        WHERE id = v_order_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 発注明細変更時の送料再計算トリガー
DROP TRIGGER IF EXISTS trigger_recalculate_shipping_on_items_change ON order_items;
CREATE TRIGGER trigger_recalculate_shipping_on_items_change
    AFTER INSERT OR UPDATE OR DELETE
    ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_order_shipping_on_items_change();

-- 送料設定管理用のビュー
CREATE OR REPLACE VIEW v_shipping_cost_settings_summary AS
SELECT
    scs.id,
    COALESCE(s.name, 'デフォルト設定') as supplier_name,
    scs.supplier_id,
    scs.shipping_method,
    CASE scs.shipping_method
        WHEN 'standard' THEN '通常配送'
        WHEN 'express' THEN '速達'
        WHEN 'overnight' THEN '翌日配送'
        WHEN 'pickup' THEN '店舗受取'
        ELSE scs.shipping_method
    END as shipping_method_label,
    scs.base_cost,
    scs.weight_threshold,
    scs.additional_cost_per_kg,
    scs.free_shipping_threshold,
    scs.tax_rate,
    scs.is_active,
    scs.effective_from,
    scs.effective_until,
    CASE
        WHEN scs.effective_until IS NULL THEN '無期限'
        WHEN scs.effective_until > NOW() THEN '有効'
        ELSE '期限切れ'
    END as validity_status
FROM shipping_cost_settings scs
LEFT JOIN suppliers s ON scs.supplier_id = s.id
ORDER BY
    supplier_name,
    scs.shipping_method,
    scs.effective_from DESC;

-- 送料計算テスト用のサンプル関数
CREATE OR REPLACE FUNCTION test_shipping_calculation()
RETURNS TABLE (
    test_case TEXT,
    supplier_name TEXT,
    order_value INTEGER,
    total_weight INTEGER,
    shipping_method VARCHAR,
    calculated_result JSON
) AS $$
BEGIN
    -- テストケース1: 標準配送、送料無料未満
    RETURN QUERY
    SELECT
        'Test 1: Standard shipping, below free threshold'::TEXT,
        'テスト取引先'::TEXT,
        5000::INTEGER,
        3::INTEGER,
        'standard'::VARCHAR,
        calculate_shipping_cost(NULL, 5000, 3, 'standard');

    -- テストケース2: 標準配送、送料無料適用
    RETURN QUERY
    SELECT
        'Test 2: Standard shipping, free shipping applied'::TEXT,
        'テスト取引先'::TEXT,
        15000::INTEGER,
        5::INTEGER,
        'standard'::VARCHAR,
        calculate_shipping_cost(NULL, 15000, 5, 'standard');

    -- テストケース3: 速達配送、重量超過
    RETURN QUERY
    SELECT
        'Test 3: Express shipping, weight exceeded'::TEXT,
        'テスト取引先'::TEXT,
        8000::INTEGER,
        15::INTEGER,
        'express'::VARCHAR,
        calculate_shipping_cost(NULL, 8000, 15, 'express');
END;
$$ LANGUAGE plpgsql;

-- 実行権限の設定
GRANT EXECUTE ON FUNCTION calculate_shipping_cost(UUID, INTEGER, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_order_total_weight(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION test_shipping_calculation() TO authenticated;
GRANT SELECT ON v_shipping_cost_settings_summary TO authenticated;

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ Day 3: 送料計算システムのスキーマ構築が完了しました';
    RAISE NOTICE '📊 作成されたオブジェクト:';
    RAISE NOTICE '   - shipping_cost_settings テーブル';
    RAISE NOTICE '   - calculate_shipping_cost() 関数';
    RAISE NOTICE '   - calculate_order_total_weight() 関数';
    RAISE NOTICE '   - 送料自動計算トリガー';
    RAISE NOTICE '   - v_shipping_cost_settings_summary ビュー';
    RAISE NOTICE '   - test_shipping_calculation() テスト関数';
    RAISE NOTICE '🚀 送料自動計算機能が利用可能になりました';
END $$;