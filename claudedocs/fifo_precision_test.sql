-- FIFO評価額計算精度検証テスト（99.8%保証要件）
-- 0922Youken.md Phase 2要件対応

-- テストケース1: 基本的なFIFO計算
-- 商品A: 10個@100円 → 20個@150円 → 15個出庫
WITH test_case_1 AS (
    SELECT
        'TEST_PRODUCT_A'::UUID AS product_id,
        'テスト商品A' AS product_name
)
SELECT
    '=== FIFO精度検証テスト開始 ===' AS test_start;

-- テストケース1実行
INSERT INTO products (id, product_name, current_stock)
VALUES ('TEST_PRODUCT_A'::UUID, 'テスト商品A', 15)
ON CONFLICT (id) DO UPDATE SET current_stock = 15;

-- FIFO層データ投入
INSERT INTO inventory_fifo_layers (
    product_id,
    purchase_date,
    unit_cost_tax_excluded,
    unit_cost_tax_included,
    tax_rate,
    remaining_quantity,
    original_quantity
) VALUES
-- 第1層: 10個@100円 → 5個残り（15個出庫の内、10個がここから出庫）
('TEST_PRODUCT_A'::UUID, '2023-10-01', 100, 110, 0.10, 0, 10),
-- 第2層: 20個@150円 → 15個残り（15個出庫の内、5個がここから出庫）
('TEST_PRODUCT_A'::UUID, '2023-10-02', 150, 165, 0.10, 15, 20)
ON CONFLICT DO NOTHING;

-- FIFO評価額計算実行
SELECT calculate_fifo_valuation('TEST_PRODUCT_A'::UUID) AS fifo_result;

-- 期待値計算（手動）:
-- 残り在庫15個 = 第2層15個@150円 = 2,250円（税抜）
-- 税込: 15個@165円 = 2,475円

-- 精度計算
WITH expected_values AS (
    SELECT
        2250.00 AS expected_tax_excluded,
        2475.00 AS expected_tax_included
),
actual_values AS (
    SELECT
        (calculate_fifo_valuation('TEST_PRODUCT_A'::UUID)->>'valuation_tax_excluded')::DECIMAL AS actual_tax_excluded,
        (calculate_fifo_valuation('TEST_PRODUCT_A'::UUID)->>'valuation_tax_included')::DECIMAL AS actual_tax_included
)
SELECT
    '=== FIFO精度検証結果 ===' AS test_title,
    expected_tax_excluded,
    actual_tax_excluded,
    expected_tax_included,
    actual_tax_included,
    CASE
        WHEN ABS(actual_tax_excluded - expected_tax_excluded) / expected_tax_excluded <= 0.002
        THEN '✅ 税抜精度OK (>99.8%)'
        ELSE '❌ 税抜精度NG (<99.8%)'
    END AS tax_excluded_precision,
    CASE
        WHEN ABS(actual_tax_included - expected_tax_included) / expected_tax_included <= 0.002
        THEN '✅ 税込精度OK (>99.8%)'
        ELSE '❌ 税込精度NG (<99.8%)'
    END AS tax_included_precision,
    ROUND((1 - ABS(actual_tax_excluded - expected_tax_excluded) / expected_tax_excluded) * 100, 3) AS tax_excluded_accuracy_percent,
    ROUND((1 - ABS(actual_tax_included - expected_tax_included) / expected_tax_included) * 100, 3) AS tax_included_accuracy_percent
FROM expected_values, actual_values;

-- クリーンアップ
DELETE FROM inventory_fifo_layers WHERE product_id = 'TEST_PRODUCT_A'::UUID;
DELETE FROM products WHERE id = 'TEST_PRODUCT_A'::UUID;

-- テストケース2: 複雑なFIFO計算（複数層跨ぎ）
-- 商品B: 5個@80円 → 10個@120円 → 15個@200円 → 22個出庫
INSERT INTO products (id, product_name, current_stock)
VALUES ('TEST_PRODUCT_B'::UUID, 'テスト商品B', 8)
ON CONFLICT (id) DO UPDATE SET current_stock = 8;

INSERT INTO inventory_fifo_layers (
    product_id,
    purchase_date,
    unit_cost_tax_excluded,
    unit_cost_tax_included,
    tax_rate,
    remaining_quantity,
    original_quantity
) VALUES
-- 第1層: 5個@80円 → 0個残り（全て出庫）
('TEST_PRODUCT_B'::UUID, '2023-10-01', 80, 88, 0.10, 0, 5),
-- 第2層: 10個@120円 → 0個残り（全て出庫）
('TEST_PRODUCT_B'::UUID, '2023-10-02', 120, 132, 0.10, 0, 10),
-- 第3層: 15個@200円 → 8個残り（22個出庫の内、7個がここから出庫）
('TEST_PRODUCT_B'::UUID, '2023-10-03', 200, 220, 0.10, 8, 15)
ON CONFLICT DO NOTHING;

-- 複雑ケース検証
WITH expected_values_b AS (
    SELECT
        1600.00 AS expected_tax_excluded, -- 8個@200円
        1760.00 AS expected_tax_included  -- 8個@220円
),
actual_values_b AS (
    SELECT
        (calculate_fifo_valuation('TEST_PRODUCT_B'::UUID)->>'valuation_tax_excluded')::DECIMAL AS actual_tax_excluded,
        (calculate_fifo_valuation('TEST_PRODUCT_B'::UUID)->>'valuation_tax_included')::DECIMAL AS actual_tax_included
)
SELECT
    '=== 複雑FIFO精度検証結果 ===' AS test_title,
    expected_tax_excluded,
    actual_tax_excluded,
    expected_tax_included,
    actual_tax_included,
    CASE
        WHEN ABS(actual_tax_excluded - expected_tax_excluded) / expected_tax_excluded <= 0.002
        THEN '✅ 複雑ケース精度OK (>99.8%)'
        ELSE '❌ 複雑ケース精度NG (<99.8%)'
    END AS complex_precision_result,
    ROUND((1 - ABS(actual_tax_excluded - expected_tax_excluded) / expected_tax_excluded) * 100, 3) AS accuracy_percent
FROM expected_values_b, actual_values_b;

-- クリーンアップ
DELETE FROM inventory_fifo_layers WHERE product_id = 'TEST_PRODUCT_B'::UUID;
DELETE FROM products WHERE id = 'TEST_PRODUCT_B'::UUID;

SELECT '=== FIFO精度検証テスト完了 ===' AS test_complete;