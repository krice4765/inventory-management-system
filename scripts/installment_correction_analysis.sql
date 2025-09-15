-- ===============================================================
-- 分納金額修正分析スクリプト
-- 実行日: 2025-09-14
-- 目的: 過剰分納の根本原因分析と修正戦略策定
-- ===============================================================

-- 🔍 セクション1: 過剰分納パターン分析
-- ===============================================================

SELECT '=== 📊 過剰分納パターン分析 ===' as analysis_section;

-- 過剰分納の倍率分析
WITH installment_analysis AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        SUM(t.total_amount) - po.total_amount as excess_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 2) as delivery_ratio,
        COUNT(t.id) as installment_count,
        po.created_at as order_date
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount, po.created_at
    HAVING SUM(t.total_amount) > po.total_amount
)
SELECT
    '過剰分納パターン分析' as analysis_type,
    COUNT(*) as total_excessive_orders,
    ROUND(AVG(delivery_ratio), 2) as avg_delivery_ratio,
    COUNT(CASE WHEN delivery_ratio BETWEEN 1.08 AND 1.12 THEN 1 END) as tax_related_cases,
    COUNT(CASE WHEN delivery_ratio > 1.5 THEN 1 END) as severe_cases,
    COUNT(CASE WHEN delivery_ratio > 2.0 THEN 1 END) as critical_cases,
    ROUND(SUM(excess_amount), 2) as total_excess_amount
FROM installment_analysis;

-- 🔍 セクション2: 税率関連分析
-- ===============================================================

SELECT '=== 💰 税率関連問題分析 ===' as analysis_section;

-- 1.1倍周辺の過剰分納を詳細分析
WITH tax_analysis AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 3) as ratio,
        ROUND(po.total_amount * 1.1, 2) as estimated_with_tax,
        ABS(SUM(t.total_amount) - (po.total_amount * 1.1)) as tax_calculation_diff
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING (SUM(t.total_amount) / po.total_amount) BETWEEN 1.05 AND 1.15
)
SELECT
    '税率関連ケース分析' as analysis_type,
    COUNT(*) as potential_tax_issues,
    ROUND(AVG(tax_calculation_diff), 2) as avg_tax_calc_diff,
    COUNT(CASE WHEN tax_calculation_diff < 100 THEN 1 END) as close_to_tax_calculation,
    ROUND(AVG(ratio), 3) as avg_ratio
FROM tax_analysis;

-- 税率問題の可能性が高いケースの詳細
SELECT
    '税率問題の詳細' as detail_type,
    order_no,
    order_amount,
    delivered_amount,
    ratio,
    estimated_with_tax,
    tax_calculation_diff
FROM tax_analysis
WHERE tax_calculation_diff < 1000
ORDER BY tax_calculation_diff
LIMIT 10;

-- 🔍 セクション3: 分納回数と過剰分納の関係
-- ===============================================================

SELECT '=== 📈 分納回数と過剰の関係 ===' as analysis_section;

-- 分納回数別の過剰分納パターン
WITH installment_pattern_analysis AS (
    SELECT
        po.id,
        COUNT(t.id) as installment_count,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        (SUM(t.total_amount) - po.total_amount) as excess_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 2) as ratio
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.total_amount
    HAVING SUM(t.total_amount) > po.total_amount
)
SELECT
    installment_count,
    COUNT(*) as order_count,
    ROUND(AVG(ratio), 2) as avg_ratio,
    ROUND(SUM(excess_amount), 2) as total_excess_by_count
FROM installment_pattern_analysis
GROUP BY installment_count
ORDER BY installment_count;

-- 🔍 セクション4: 修正戦略の提案
-- ===============================================================

SELECT '=== 🛠️ 修正戦略提案 ===' as analysis_section;

-- 修正方法別の分類
WITH correction_strategy AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        (SUM(t.total_amount) - po.total_amount) as excess_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 3) as ratio,
        COUNT(t.id) as installment_count,
        CASE
            WHEN (SUM(t.total_amount) / po.total_amount) BETWEEN 1.08 AND 1.12
                THEN 'tax_adjustment'
            WHEN (SUM(t.total_amount) / po.total_amount) BETWEEN 1.12 AND 1.5
                THEN 'calculation_error'
            WHEN (SUM(t.total_amount) / po.total_amount) > 1.5
                THEN 'data_corruption'
            ELSE 'other'
        END as correction_category
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING SUM(t.total_amount) > po.total_amount
)
SELECT
    correction_category,
    COUNT(*) as case_count,
    ROUND(AVG(excess_amount), 2) as avg_excess_amount,
    ROUND(SUM(excess_amount), 2) as total_excess_amount,
    CASE correction_category
        WHEN 'tax_adjustment' THEN '発注書金額を税込みに修正'
        WHEN 'calculation_error' THEN '分納金額を比例調整'
        WHEN 'data_corruption' THEN '手動確認・修正が必要'
        ELSE '個別対応が必要'
    END as recommended_action
FROM correction_strategy
GROUP BY correction_category,
         CASE correction_category
            WHEN 'tax_adjustment' THEN '発注書金額を税込みに修正'
            WHEN 'calculation_error' THEN '分納金額を比例調整'
            WHEN 'data_corruption' THEN '手動確認・修正が必要'
            ELSE '個別対応が必要'
         END
ORDER BY case_count DESC;

-- 🔍 セクション5: 具体的修正SQL生成の準備
-- ===============================================================

SELECT '=== 📝 修正SQL生成準備 ===' as analysis_section;

-- 税率調整が必要なケース（1.08-1.12倍）
CREATE TEMP TABLE tax_adjustment_cases AS
SELECT
    po.id as order_id,
    po.order_no,
    po.total_amount as current_order_amount,
    ROUND(po.total_amount * 1.1, 0) as suggested_order_amount,
    SUM(t.total_amount) as delivered_amount,
    'UPDATE purchase_orders SET total_amount = ' || ROUND(po.total_amount * 1.1, 0) ||
    ' WHERE id = ''' || po.id || ''';' as update_sql
FROM purchase_orders po
JOIN transactions t ON po.id = t.parent_order_id
WHERE t.installment_no IS NOT NULL
GROUP BY po.id, po.order_no, po.total_amount
HAVING (SUM(t.total_amount) / po.total_amount) BETWEEN 1.08 AND 1.12;

-- 比例調整が必要なケース（1.12-1.5倍）
CREATE TEMP TABLE proportional_adjustment_cases AS
SELECT
    t.id as transaction_id,
    t.parent_order_id,
    po.order_no,
    t.total_amount as current_amount,
    ROUND(t.total_amount * (po.total_amount / delivered_total.total), 2) as suggested_amount,
    'UPDATE transactions SET total_amount = ' ||
    ROUND(t.total_amount * (po.total_amount / delivered_total.total), 2) ||
    ' WHERE id = ''' || t.id || ''';' as update_sql
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
JOIN (
    SELECT parent_order_id, SUM(total_amount) as total
    FROM transactions
    WHERE installment_no IS NOT NULL
    GROUP BY parent_order_id
) delivered_total ON t.parent_order_id = delivered_total.parent_order_id
WHERE t.installment_no IS NOT NULL
  AND (delivered_total.total / po.total_amount) BETWEEN 1.12 AND 1.5;

-- 修正対象件数の確認
SELECT
    '修正対象サマリー' as summary_type,
    (SELECT COUNT(*) FROM tax_adjustment_cases) as tax_adjustment_orders,
    (SELECT COUNT(*) FROM proportional_adjustment_cases) as proportional_adjustment_transactions,
    (SELECT COUNT(DISTINCT parent_order_id) FROM proportional_adjustment_cases) as proportional_adjustment_orders;

-- 完了メッセージ
SELECT
    '🎯 分析完了' as status,
    '修正戦略が策定されました' as result,
    '次は具体的な修正スクリプトの生成に進んでください' as next_action;