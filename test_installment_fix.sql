-- ===============================================================
-- 分納システム修正後の検証テストスクリプト
-- 実行日：2025-09-16
-- 目的：409 Conflictエラー修正の効果測定
-- ===============================================================

-- Phase 1: 修正前の状態確認
-- ===============================================================

SELECT '=== 🧪 分納システム修正効果測定 ===' as test_section;

-- 1. 現在の制約状況確認
SELECT '--- 📋 制約状況確認 ---' as sub_section;
SELECT
    conname as constraint_name,
    contype as constraint_type,
    CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'c' THEN 'CHECK'
        ELSE contype::text
    END as constraint_description
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'transactions'
    AND contype IN ('u', 'p')
ORDER BY contype, conname;

-- 2. 分納関数の存在確認
SELECT '--- 🔧 分納関数の存在確認 ---' as sub_section;
SELECT
    routine_name,
    routine_type,
    CASE
        WHEN routine_name = 'create_safe_installment' THEN '✅ 分納作成関数'
        WHEN routine_name = 'get_next_installment_number' THEN '✅ 分納番号関数'
        ELSE '❓ その他の関数'
    END as function_status
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('create_safe_installment', 'get_next_installment_number')
ORDER BY routine_name;

-- Phase 2: データ整合性の確認
-- ===============================================================

-- 3. 重複データの確認
SELECT '--- 🔍 重複データ確認 ---' as sub_section;
WITH duplicate_check AS (
    SELECT
        parent_order_id,
        transaction_type,
        installment_number,
        COUNT(*) as count
    FROM transactions
    WHERE parent_order_id IS NOT NULL
        AND transaction_type = 'purchase'
    GROUP BY parent_order_id, transaction_type, installment_number
    HAVING COUNT(*) > 1
)
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ 重複データなし - 正常状態'
        ELSE '⚠️ 重複データ検出: ' || COUNT(*)::TEXT || '件'
    END as duplicate_status
FROM duplicate_check;

-- 4. 分納データの基本統計
SELECT '--- 📊 分納データ統計 ---' as sub_section;
SELECT
    COUNT(*) as total_installments,
    COUNT(DISTINCT parent_order_id) as unique_parent_orders,
    MIN(installment_number) as min_installment_no,
    MAX(installment_number) as max_installment_no,
    AVG(installment_number)::numeric(10,2) as avg_installment_no,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as todays_installments
FROM transactions
WHERE parent_order_id IS NOT NULL
    AND transaction_type = 'purchase';

-- Phase 3: 機能テスト（安全確認）
-- ===============================================================

-- 5. 分納番号採番関数のテスト（既存発注があれば）
SELECT '--- 🧪 分納番号採番テスト ---' as sub_section;
SELECT
    parent_order_id,
    MAX(installment_number) as current_max,
    get_next_installment_number(parent_order_id) as next_number,
    CASE
        WHEN get_next_installment_number(parent_order_id) = MAX(installment_number) + 1
        THEN '✅ 正常'
        ELSE '❌ 異常'
    END as test_result
FROM transactions
WHERE parent_order_id IS NOT NULL
    AND transaction_type = 'purchase'
GROUP BY parent_order_id
LIMIT 3;

-- Phase 4: システム負荷テスト（参考値）
-- ===============================================================

-- 6. システム負荷状況確認
SELECT '--- ⚡ システム負荷状況 ---' as sub_section;
SELECT
    'transactions' as table_name,
    pg_size_pretty(pg_total_relation_size('transactions')) as table_size,
    (SELECT COUNT(*) FROM transactions) as total_records,
    pg_size_pretty(pg_database_size(current_database())) as db_total_size;

-- Phase 5: 同時実行安全性確認
-- ===============================================================

-- 7. 同時実行による競合の可能性分析
SELECT '--- 🔒 同時実行安全性分析 ---' as sub_section;
WITH recent_transactions AS (
    SELECT
        parent_order_id,
        installment_number,
        created_at,
        LAG(created_at) OVER (PARTITION BY parent_order_id ORDER BY installment_number) as prev_created_at
    FROM transactions
    WHERE parent_order_id IS NOT NULL
        AND transaction_type = 'purchase'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT
    COUNT(*) as potential_race_conditions,
    AVG(EXTRACT(EPOCH FROM (created_at - prev_created_at)))::numeric(10,2) as avg_seconds_between_installments
FROM recent_transactions
WHERE prev_created_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (created_at - prev_created_at)) < 60; -- 1分以内の連続作成

-- Phase 6: 結論とアクションアイテム
-- ===============================================================

SELECT '=== 📋 修正効果まとめ ====' as summary_section;

-- 総合評価
WITH system_health AS (
    SELECT
        (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
         WHERE t.relname = 'transactions' AND c.conname LIKE '%parent_type_installment%') as dangerous_constraints,
        (SELECT COUNT(*) FROM information_schema.routines
         WHERE routine_schema = 'public' AND routine_name = 'create_safe_installment') as safety_functions,
        (SELECT COUNT(*)
         FROM (SELECT parent_order_id, transaction_type, installment_number, COUNT(*)
               FROM transactions WHERE parent_order_id IS NOT NULL
               GROUP BY parent_order_id, transaction_type, installment_number
               HAVING COUNT(*) > 1) duplicates) as duplicate_records
)
SELECT
    CASE
        WHEN dangerous_constraints = 0 AND safety_functions > 0 AND duplicate_records = 0
        THEN '✅ 修正完了 - 409エラー解決済み'
        WHEN dangerous_constraints > 0
        THEN '⚠️ 危険な制約が残存 - SQLスクリプト実行が必要'
        WHEN safety_functions = 0
        THEN '⚠️ 安全な分納関数が未作成 - SQLスクリプト実行が必要'
        WHEN duplicate_records > 0
        THEN '⚠️ 重複データが存在 - クリーンアップが必要'
        ELSE '🔄 部分的修正完了 - 追加対応が推奨'
    END as overall_status,
    dangerous_constraints,
    safety_functions,
    duplicate_records
FROM system_health;

-- アクションアイテム
SELECT '=== 📝 次のアクションアイテム ====' as action_section;
SELECT
    '1. emergency_conflict_fix.sql をSupabase SQL Editorで実行' as step_1,
    '2. アプリケーションで分納処理をテスト実行' as step_2,
    '3. 409エラーが解消されたことを確認' as step_3,
    '4. 本番環境への展開準備' as step_4;