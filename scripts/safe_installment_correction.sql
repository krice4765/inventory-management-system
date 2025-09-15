-- ===============================================================
-- 安全な分納金額修正スクリプト
-- 実行日: 2025-09-14
-- 目的: 過剰分納問題の段階的修正
-- 重要: 必ずバックアップ後に実行してください
-- ===============================================================

-- 🛡️ パート1: 安全確認とバックアップ
-- ===============================================================

SELECT '=== 🛡️ 修正前の安全確認 ===' as safety_check;

-- 現在の問題状況を再確認
WITH current_issues AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        (SUM(t.total_amount) - po.total_amount) as excess_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 3) as ratio,
        COUNT(t.id) as installment_count
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING SUM(t.total_amount) > po.total_amount
)
SELECT
    '修正前状況確認' as check_type,
    COUNT(*) as problematic_orders,
    ROUND(SUM(excess_amount), 2) as total_excess_amount,
    ROUND(AVG(ratio), 3) as avg_ratio,
    COUNT(CASE WHEN ratio BETWEEN 1.08 AND 1.12 THEN 1 END) as tax_related_cases,
    COUNT(CASE WHEN ratio BETWEEN 1.12 AND 1.5 THEN 1 END) as calculation_error_cases,
    COUNT(CASE WHEN ratio > 1.5 THEN 1 END) as severe_cases
FROM current_issues;

-- バックアップテーブル作成
SELECT '=== 💾 バックアップテーブル作成 ===' as backup_section;

-- バックアップテーブルが存在する場合は削除
DROP TABLE IF EXISTS backup_purchase_orders_installment_fix;
DROP TABLE IF EXISTS backup_transactions_installment_fix;

-- 完全バックアップ作成
CREATE TABLE backup_purchase_orders_installment_fix AS
SELECT * FROM purchase_orders;

CREATE TABLE backup_transactions_installment_fix AS
SELECT * FROM transactions;

-- バックアップ確認
SELECT
    '✅ バックアップ確認' as backup_status,
    (SELECT COUNT(*) FROM purchase_orders) as original_purchase_orders,
    (SELECT COUNT(*) FROM backup_purchase_orders_installment_fix) as backup_purchase_orders,
    (SELECT COUNT(*) FROM transactions) as original_transactions,
    (SELECT COUNT(*) FROM backup_transactions_installment_fix) as backup_transactions,
    CASE
        WHEN (SELECT COUNT(*) FROM purchase_orders) = (SELECT COUNT(*) FROM backup_purchase_orders_installment_fix)
         AND (SELECT COUNT(*) FROM transactions) = (SELECT COUNT(*) FROM backup_transactions_installment_fix)
        THEN '✅ バックアップ成功'
        ELSE '❌ バックアップ失敗 - 修正を中止してください'
    END as backup_verification;

-- 🛠️ パート2: Phase 1 - 税込/税抜調整
-- ===============================================================

SELECT '=== 💰 Phase 1: 税込/税抜調整 ===' as phase1_section;

-- 税込調整対象の特定と修正SQL生成
WITH tax_adjustment_candidates AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as current_order_amount,
        SUM(t.total_amount) as delivered_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 3) as ratio,
        ROUND(po.total_amount * 1.1, 0) as suggested_order_amount,
        ABS(SUM(t.total_amount) - (po.total_amount * 1.1)) as diff_from_tax_calc
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING (SUM(t.total_amount) / po.total_amount) BETWEEN 1.08 AND 1.12
       AND ABS(SUM(t.total_amount) - (po.total_amount * 1.1)) < 1000 -- 差額1000円以内
)
SELECT
    'Phase 1対象確認' as phase1_check,
    COUNT(*) as tax_adjustment_orders,
    ROUND(SUM(suggested_order_amount - current_order_amount), 2) as total_adjustment_amount,
    ROUND(AVG(diff_from_tax_calc), 2) as avg_diff_from_tax_calc
FROM tax_adjustment_candidates;

-- Phase 1実行: 発注書金額を税込みに調整
-- ⚠️ 注意: この更新は慎重に実行してください
/*
UPDATE purchase_orders
SET total_amount = ROUND(total_amount * 1.1, 0),
    updated_at = NOW()
WHERE id IN (
    SELECT po.id
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.total_amount
    HAVING (SUM(t.total_amount) / po.total_amount) BETWEEN 1.08 AND 1.12
       AND ABS(SUM(t.total_amount) - (po.total_amount * 1.1)) < 1000
);
*/

-- Phase 1の結果確認用クエリ
SELECT '=== Phase 1実行後の確認用クエリ ===';
-- 実行後に以下を実行して結果を確認
/*
WITH phase1_results AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        ABS(SUM(t.total_amount) - po.total_amount) as remaining_diff
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
)
SELECT
    'Phase 1結果' as result_type,
    COUNT(*) as total_orders_checked,
    COUNT(CASE WHEN remaining_diff < 1 THEN 1 END) as perfectly_aligned_orders,
    COUNT(CASE WHEN remaining_diff BETWEEN 1 AND 100 THEN 1 END) as minor_diff_orders,
    COUNT(CASE WHEN remaining_diff > 100 THEN 1 END) as major_diff_orders
FROM phase1_results;
*/

-- 🛠️ パート3: Phase 2 - 比例調整
-- ===============================================================

SELECT '=== 🔧 Phase 2: 比例調整準備 ===' as phase2_section;

-- 比例調整対象の特定
WITH proportional_adjustment_candidates AS (
    SELECT
        po.id as order_id,
        po.order_no,
        po.total_amount as order_amount,
        SUM(t.total_amount) as delivered_amount,
        ROUND((SUM(t.total_amount) / po.total_amount), 3) as ratio,
        COUNT(t.id) as installment_count
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
    HAVING (SUM(t.total_amount) / po.total_amount) BETWEEN 1.12 AND 1.5
)
SELECT
    'Phase 2対象確認' as phase2_check,
    COUNT(*) as proportional_adjustment_orders,
    ROUND(AVG(ratio), 3) as avg_ratio,
    SUM(installment_count) as total_transactions_to_adjust
FROM proportional_adjustment_candidates;

-- Phase 2実行用SQL生成（実際の実行は手動で慎重に）
SELECT '=== Phase 2実行用SQL ===';
/*
-- 比例調整の実行
-- 各分納取引を発注書金額に合わせて比例縮小

WITH adjustment_factors AS (
    SELECT
        po.id as order_id,
        po.total_amount / SUM(t.total_amount) as adjustment_factor
    FROM purchase_orders po
    JOIN transactions t ON po.id = t.parent_order_id
    WHERE t.installment_no IS NOT NULL
    GROUP BY po.id, po.total_amount
    HAVING (SUM(t.total_amount) / po.total_amount) BETWEEN 1.12 AND 1.5
)
UPDATE transactions
SET total_amount = ROUND(total_amount * (
    SELECT adjustment_factor
    FROM adjustment_factors af
    WHERE af.order_id = transactions.parent_order_id
), 2),
updated_at = NOW()
WHERE parent_order_id IN (SELECT order_id FROM adjustment_factors)
  AND installment_no IS NOT NULL;
*/

-- 🛠️ パート4: 最終確認
-- ===============================================================

SELECT '=== ✅ 修正完了後の確認クエリ ===' as final_verification;

-- 全修正完了後に実行する確認クエリ
/*
-- 最終整合性確認
WITH final_check AS (
    SELECT
        po.id,
        po.order_no,
        po.total_amount as order_amount,
        COALESCE(SUM(t.total_amount), 0) as delivered_amount,
        ABS(po.total_amount - COALESCE(SUM(t.total_amount), 0)) as difference,
        COUNT(t.id) as installment_count
    FROM purchase_orders po
    LEFT JOIN transactions t ON po.id = t.parent_order_id AND t.installment_no IS NOT NULL
    GROUP BY po.id, po.order_no, po.total_amount
)
SELECT
    '✅ 最終整合性確認' as final_status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN difference < 1 THEN 1 END) as perfectly_aligned,
    COUNT(CASE WHEN difference BETWEEN 1 AND 100 THEN 1 END) as minor_differences,
    COUNT(CASE WHEN difference > 100 THEN 1 END) as major_differences,
    ROUND(SUM(difference), 2) as total_remaining_difference
FROM final_check;
*/

-- 🚨 緊急復旧用SQL
-- ===============================================================

SELECT '=== 🚨 緊急復旧用SQL ===' as emergency_recovery;

-- 問題が発生した場合の復旧用SQL（コメントアウト済み）
/*
-- 緊急時の完全復旧
TRUNCATE purchase_orders CASCADE;
INSERT INTO purchase_orders SELECT * FROM backup_purchase_orders_installment_fix;

TRUNCATE transactions CASCADE;
INSERT INTO transactions SELECT * FROM backup_transactions_installment_fix;

-- 復旧確認
SELECT '🔄 緊急復旧完了' as recovery_status, NOW() as recovery_time;
*/

-- 修正手順の完了メッセージ
SELECT
    '🎉 修正スクリプト準備完了' as status,
    '1. バックアップ確認 → 2. Phase1実行 → 3. Phase2実行 → 4. 最終確認' as execution_order,
    '各段階で結果を確認してから次に進んでください' as important_note,
    NOW() as script_creation_time;