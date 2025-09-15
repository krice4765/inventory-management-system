-- ===============================================================
-- 残存問題の詳細調査スクリプト
-- 実装日: 2025-09-14
-- 目的: 分納金額整合性問題の根本原因特定
-- ===============================================================

-- 🔍 データ型の詳細確認
SELECT '=== 📊 データ型詳細調査 ===' as investigation_section;

-- テーブル構造とデータ型の確認
SELECT
    'テーブル構造確認' as check_type,
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE (table_name = 'purchase_orders' AND column_name = 'id')
   OR (table_name = 'transactions' AND column_name = 'parent_order_id')
   OR (table_name = 'purchase_orders' AND column_name = 'remaining_amount')
   OR (table_name = 'transactions' AND column_name = 'total_amount')
ORDER BY table_name, column_name;

-- 🔍 実データサンプルの確認
SELECT '=== 📋 実データサンプル調査 ===' as investigation_section;

-- purchase_orders テーブルのサンプルデータ
SELECT
    'purchase_orders サンプル' as data_type,
    id,
    pg_typeof(id) as id_type,
    total_amount,
    remaining_amount,
    total_amount - COALESCE(remaining_amount, 0) as calculated_delivered
FROM purchase_orders
WHERE total_amount > 0
LIMIT 5;

-- transactions テーブルのサンプルデータ（分納関連）
SELECT
    'transactions サンプル' as data_type,
    id,
    parent_order_id,
    pg_typeof(parent_order_id) as parent_order_id_type,
    installment_no,
    total_amount
FROM transactions
WHERE parent_order_id IS NOT NULL
  AND installment_no IS NOT NULL
LIMIT 5;

-- 🔍 型変換テスト
SELECT '=== 🧪 型変換テスト ===' as investigation_section;

-- UUID → TEXT 変換テスト
SELECT
    '型変換テスト' as test_type,
    'UUID to TEXT' as conversion_direction,
    COUNT(*) as convertible_records
FROM purchase_orders po
WHERE po.id::text IS NOT NULL;

-- TEXT → UUID 変換テスト（エラーをキャッチ）
DO $$
DECLARE
    test_count integer := 0;
    error_count integer := 0;
    sample_record RECORD;
BEGIN
    -- transactions の parent_order_id を UUID に変換可能かテスト
    FOR sample_record IN
        SELECT parent_order_id
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        LIMIT 10
    LOOP
        BEGIN
            -- UUID変換テスト
            IF sample_record.parent_order_id::uuid IS NOT NULL THEN
                test_count := test_count + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE NOTICE 'UUID変換エラー: % - %', sample_record.parent_order_id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '型変換テスト結果: 成功=%, エラー=%', test_count, error_count;
END;
$$;

-- 🔍 分納データの詳細分析
SELECT '=== 💰 分納データ詳細分析 ===' as investigation_section;

-- 分納取引の存在確認
SELECT
    '分納データ統計' as analysis_type,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN parent_order_id IS NOT NULL THEN 1 END) as with_parent_order,
    COUNT(CASE WHEN installment_no IS NOT NULL THEN 1 END) as with_installment_no,
    COUNT(CASE WHEN parent_order_id IS NOT NULL AND installment_no IS NOT NULL THEN 1 END) as installment_transactions
FROM transactions;

-- 🔍 データ整合性の現状確認
SELECT '=== 🎯 整合性問題の具体的特定 ===' as investigation_section;

-- 問題のある purchase_orders の特定（TEXT変換アプローチ）
SELECT
    'TEXT変換での問題特定' as approach,
    po.id as problematic_order_id,
    po.total_amount,
    po.remaining_amount,
    installment_summary.delivered_total,
    po.total_amount - COALESCE(installment_summary.delivered_total, 0) as should_be_remaining,
    ABS(COALESCE(po.remaining_amount, po.total_amount) -
        (po.total_amount - COALESCE(installment_summary.delivered_total, 0))) as difference
FROM purchase_orders po
LEFT JOIN (
    SELECT
        t.parent_order_id,
        SUM(t.total_amount) as delivered_total
    FROM transactions t
    WHERE t.parent_order_id IS NOT NULL
      AND t.installment_no IS NOT NULL
    GROUP BY t.parent_order_id
) installment_summary ON po.id::text = installment_summary.parent_order_id
WHERE ABS(COALESCE(po.remaining_amount, po.total_amount) -
          (po.total_amount - COALESCE(installment_summary.delivered_total, 0))) > 0.01
LIMIT 5;

-- 🔍 解決方法の提案
SELECT '=== 💡 解決方法提案 ===' as investigation_section;

-- 推奨される修正アプローチの評価
WITH type_analysis AS (
    SELECT
        CASE
            WHEN (SELECT data_type FROM information_schema.columns
                  WHERE table_name = 'purchase_orders' AND column_name = 'id') = 'uuid'
            THEN 'purchase_orders.id は UUID型'
            ELSE 'purchase_orders.id は非UUID型'
        END as po_id_type,
        CASE
            WHEN (SELECT data_type FROM information_schema.columns
                  WHERE table_name = 'transactions' AND column_name = 'parent_order_id') = 'text'
            THEN 'transactions.parent_order_id は TEXT型'
            WHEN (SELECT data_type FROM information_schema.columns
                  WHERE table_name = 'transactions' AND column_name = 'parent_order_id') = 'uuid'
            THEN 'transactions.parent_order_id は UUID型'
            ELSE 'transactions.parent_order_id は不明な型'
        END as parent_order_id_type
)
SELECT
    '型分析結果' as analysis,
    po_id_type,
    parent_order_id_type,
    CASE
        WHEN po_id_type LIKE '%UUID%' AND parent_order_id_type LIKE '%TEXT%'
        THEN '推奨: po.id::text = t.parent_order_id'
        WHEN po_id_type LIKE '%UUID%' AND parent_order_id_type LIKE '%UUID%'
        THEN '推奨: po.id = t.parent_order_id'
        ELSE '推奨: カスタム変換関数が必要'
    END as recommended_approach
FROM type_analysis;

-- 調査完了メッセージ
SELECT
    '🔍 調査完了' as status,
    '分納問題の根本原因を特定しました' as result,
    '型変換の最適な方法を提案しました' as next_step,
    NOW() as investigation_time;