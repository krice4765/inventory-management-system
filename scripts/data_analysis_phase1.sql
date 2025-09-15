-- ===============================================================
-- Phase 1: データ分析・分類スクリプト
-- 実行日: 2025-09-14
-- 目的: テストデータの特定と本番データの分離準備
-- ===============================================================

-- 🔍 セクション1: テストデータ特徴分析
-- ===============================================================

SELECT '=== 📊 テストデータ特定基準 ===' as analysis_section;

-- 1. 異常に大きな金額（テスト用）
WITH suspicious_amounts AS (
    SELECT
        'large_amounts' as category,
        COUNT(*) as count,
        AVG(total_amount) as avg_amount,
        MIN(total_amount) as min_amount,
        MAX(total_amount) as max_amount
    FROM purchase_orders
    WHERE total_amount > 10000000 -- 1000万円以上
),

-- 2. 連続した作成日時（バッチ投入の可能性）
batch_created AS (
    SELECT
        'batch_creation' as category,
        DATE(created_at) as creation_date,
        COUNT(*) as daily_count
    FROM purchase_orders
    GROUP BY DATE(created_at)
    HAVING COUNT(*) > 10 -- 1日10件以上
),

-- 3. 過剰分納データ
excessive_installments AS (
    SELECT
        'excessive_installments' as category,
        COUNT(po.id) as problematic_orders
    FROM purchase_orders po
    JOIN (
        SELECT parent_order_id, SUM(total_amount) as delivered_total
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id
    ) t ON po.id = t.parent_order_id
    WHERE t.delivered_total > po.total_amount * 1.1 -- 10%以上の過剰
)

SELECT
    category,
    CASE
        WHEN category = 'batch_creation' THEN NULL
        ELSE count
    END as count,
    CASE
        WHEN category = 'batch_creation' THEN NULL
        ELSE avg_amount
    END as avg_amount
FROM suspicious_amounts
UNION ALL
SELECT
    category,
    daily_count as count,
    NULL as avg_amount
FROM batch_created
WHERE daily_count > 10
UNION ALL
SELECT
    category,
    problematic_orders as count,
    NULL as avg_amount
FROM excessive_installments;

-- 🔍 セクション2: データ規模の把握
-- ===============================================================

SELECT '=== 📈 データ規模分析 ===' as analysis_section;

-- 全体のデータ量
SELECT
    'data_volume' as metric_type,
    COUNT(*) as total_purchase_orders,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    ROUND(AVG(total_amount), 2) as avg_order_amount,
    COUNT(CASE WHEN total_amount > 10000000 THEN 1 END) as large_amount_orders,
    ROUND(COUNT(CASE WHEN total_amount > 10000000 THEN 1 END) * 100.0 / COUNT(*), 2) as large_amount_percentage
FROM purchase_orders;

-- 分納取引の規模
SELECT
    'installment_volume' as metric_type,
    COUNT(*) as total_installment_transactions,
    COUNT(DISTINCT parent_order_id) as orders_with_installments,
    ROUND(AVG(total_amount), 2) as avg_installment_amount,
    COUNT(CASE WHEN total_amount > 5000000 THEN 1 END) as large_installments
FROM transactions
WHERE parent_order_id IS NOT NULL;

-- 🔍 セクション3: テストデータ詳細特定
-- ===============================================================

SELECT '=== 🎯 テストデータ詳細特定 ===' as analysis_section;

-- テストデータ候補の詳細分析
CREATE TEMP TABLE test_data_candidates AS
WITH suspicious_patterns AS (
    -- パターン1: 異常に大きな金額
    SELECT id, 'large_amount' as reason, total_amount as evidence, created_at
    FROM purchase_orders
    WHERE total_amount > 10000000

    UNION

    -- パターン2: 過剰分納があるもの
    SELECT po.id, 'excessive_installment' as reason,
           (delivered.total - po.total_amount) as evidence, po.created_at
    FROM purchase_orders po
    JOIN (
        SELECT parent_order_id, SUM(total_amount) as total
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id
    ) delivered ON po.id = delivered.parent_order_id
    WHERE delivered.total > po.total_amount * 1.5 -- 50%以上過剰

    UNION

    -- パターン3: 同日大量作成（バッチテストデータ）
    SELECT po.id, 'batch_created' as reason,
           batch_info.daily_count as evidence, po.created_at
    FROM purchase_orders po
    JOIN (
        SELECT DATE(created_at) as date, COUNT(*) as daily_count
        FROM purchase_orders
        GROUP BY DATE(created_at)
        HAVING COUNT(*) > 15 -- 1日15件以上
    ) batch_info ON DATE(po.created_at) = batch_info.date
)
SELECT DISTINCT id, reason, evidence, created_at FROM suspicious_patterns;

-- テストデータ候補の統計
SELECT
    '=== テストデータ候補統計 ===' as summary_type,
    reason,
    COUNT(*) as candidate_count,
    ROUND(AVG(evidence), 2) as avg_evidence,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM test_data_candidates
GROUP BY reason
ORDER BY candidate_count DESC;

-- 🔍 セクション4: 本番データ品質確認
-- ===============================================================

SELECT '=== ✅ 本番データ品質確認 ===' as analysis_section;

-- 本番データらしき発注書の特徴
WITH production_like_orders AS (
    SELECT
        po.id,
        po.total_amount,
        po.created_at,
        COALESCE(installments.delivered_total, 0) as delivered_total,
        COALESCE(installments.installment_count, 0) as installment_count
    FROM purchase_orders po
    LEFT JOIN (
        SELECT
            parent_order_id,
            SUM(total_amount) as delivered_total,
            COUNT(*) as installment_count
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id
    ) installments ON po.id = installments.parent_order_id
    WHERE po.id NOT IN (SELECT id FROM test_data_candidates)
      AND po.total_amount BETWEEN 1000 AND 50000000 -- 1千円〜5千万円
)
SELECT
    'production_data_quality' as quality_type,
    COUNT(*) as total_production_orders,
    ROUND(AVG(total_amount), 2) as avg_order_amount,
    COUNT(CASE WHEN delivered_total > 0 THEN 1 END) as orders_with_installments,
    COUNT(CASE WHEN delivered_total > total_amount THEN 1 END) as over_delivered_orders,
    ROUND(
        COUNT(CASE WHEN delivered_total > total_amount THEN 1 END) * 100.0 /
        NULLIF(COUNT(CASE WHEN delivered_total > 0 THEN 1 END), 0), 2
    ) as over_delivery_percentage
FROM production_like_orders;

-- 🔍 セクション5: 削除影響予測
-- ===============================================================

SELECT '=== 💥 削除影響予測 ===' as analysis_section;

-- 削除対象の詳細影響分析
WITH deletion_impact AS (
    SELECT
        COUNT(DISTINCT tdc.id) as orders_to_delete,
        COUNT(t.id) as transactions_to_delete,
        COUNT(poi.id) as order_items_to_delete,
        COALESCE(SUM(tdc.evidence), 0) as total_amount_to_delete
    FROM test_data_candidates tdc
    LEFT JOIN transactions t ON tdc.id = t.parent_order_id
    LEFT JOIN purchase_order_items poi ON tdc.id = poi.purchase_order_id
),
current_totals AS (
    SELECT
        COUNT(*) as total_orders,
        (SELECT COUNT(*) FROM transactions WHERE parent_order_id IS NOT NULL) as total_installment_transactions,
        (SELECT COUNT(*) FROM purchase_order_items) as total_order_items
    FROM purchase_orders
)
SELECT
    'deletion_impact' as impact_type,
    di.orders_to_delete,
    ROUND(di.orders_to_delete * 100.0 / ct.total_orders, 2) as orders_deletion_percentage,
    di.transactions_to_delete,
    ROUND(di.transactions_to_delete * 100.0 / NULLIF(ct.total_installment_transactions, 0), 2) as transactions_deletion_percentage,
    di.order_items_to_delete,
    ROUND(di.order_items_to_delete * 100.0 / ct.total_order_items, 2) as order_items_deletion_percentage,
    ROUND(di.total_amount_to_delete, 2) as total_amount_to_delete
FROM deletion_impact di
CROSS JOIN current_totals ct;

-- 🔍 セクション6: 最終推奨事項
-- ===============================================================

SELECT '=== 📋 最終推奨事項 ===' as analysis_section;

-- 推奨アクション
WITH analysis_summary AS (
    SELECT
        COUNT(*) as total_test_candidates,
        COUNT(CASE WHEN reason = 'large_amount' THEN 1 END) as large_amount_count,
        COUNT(CASE WHEN reason = 'excessive_installment' THEN 1 END) as excessive_installment_count,
        COUNT(CASE WHEN reason = 'batch_created' THEN 1 END) as batch_created_count
    FROM test_data_candidates
)
SELECT
    'recommendation' as advice_type,
    CASE
        WHEN total_test_candidates = 0 THEN '✅ テストデータは検出されませんでした。クリーンアップは不要です。'
        WHEN total_test_candidates <= 10 THEN CONCAT('⚠️ ', total_test_candidates, '件のテストデータを個別確認してください。')
        WHEN total_test_candidates <= 50 THEN CONCAT('🔄 ', total_test_candidates, '件のテストデータ。慎重なクリーンアップを推奨します。')
        ELSE CONCAT('🚨 ', total_test_candidates, '件の大量テストデータ。段階的クリーンアップが必要です。')
    END as recommended_action,
    CONCAT(
        '大額: ', large_amount_count, '件, ',
        '過剰分納: ', excessive_installment_count, '件, ',
        'バッチ作成: ', batch_created_count, '件'
    ) as breakdown
FROM analysis_summary;

-- 次のステップメッセージ
SELECT
    '🎯 次のステップ' as next_step,
    'Phase 2: バックアップ作成を実行してください' as action,
    NOW() as analysis_completion_time;

-- テストデータ候補一覧の表示（上位20件）
SELECT '=== 📝 テストデータ候補一覧（上位20件） ===' as candidates_section;

SELECT
    id,
    reason,
    ROUND(evidence, 2) as evidence,
    created_at,
    CASE
        WHEN reason = 'large_amount' THEN '大額取引'
        WHEN reason = 'excessive_installment' THEN '過剰分納'
        WHEN reason = 'batch_created' THEN 'バッチ作成'
        ELSE reason
    END as reason_ja
FROM test_data_candidates
ORDER BY evidence DESC
LIMIT 20;

-- 完了メッセージ
SELECT
    '🎉 Phase 1 完了' as status,
    'テストデータの特定が完了しました' as result,
    'バックアップ作成後にPhase 3の削除実行に進んでください' as next_action;