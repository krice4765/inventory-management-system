-- PO250917020の現在状態を詳細分析
-- 修正スクリプト実行後の実際のデータを確認

-- 1. 発注書の基本情報
SELECT 'PO250917020 発注書情報:' as info;
SELECT
    id,
    order_no,
    total_amount,
    created_at,
    status
FROM purchase_orders
WHERE order_no = 'PO250917020';

-- 2. 全分納取引の時系列確認
SELECT 'PO250917020 全分納取引（時系列順）:' as info;
SELECT
    t.id,
    t.transaction_no,
    t.installment_no,
    t.delivery_sequence,
    t.total_amount,
    t.memo,
    t.transaction_date,
    t.created_at,
    t.status,
    EXTRACT(HOUR FROM t.created_at) as created_hour,
    EXTRACT(MINUTE FROM t.created_at) as created_minute
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917020'
ORDER BY t.created_at ASC;

-- 3. 在庫移動履歴の確認（汎用的分析）
SELECT 'PO250917020関連 在庫移動履歴データ:' as info;
SELECT
    im.id,
    im.movement_type,
    im.quantity_delta,
    im.unit_price,
    im.note,
    im.created_at,
    p.name as product_name,
    p.product_code,
    EXTRACT(HOUR FROM im.created_at) as movement_hour,
    EXTRACT(MINUTE FROM im.created_at) as movement_minute,
    -- 分納取引との時間的近接性を分析
    CASE
        WHEN im.created_at BETWEEN '2025-09-17 12:50:00' AND '2025-09-17 13:10:00'
        THEN '🔍 分納取引と同時期'
        ELSE '📅 その他の時期'
    END as temporal_relation
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
WHERE im.movement_type = 'purchase'
  AND im.created_at >= '2025-09-17'::date
  AND im.created_at < '2025-09-18'::date
ORDER BY im.created_at ASC;

-- 3b. 在庫移動とtransaction連携の課題分析
SELECT '🚨 システム設計課題:' as info;
SELECT
    '在庫移動履歴とtransactionテーブル間に直接的な関連付けがない' as issue,
    'inventory_movementsテーブルにrelated_transaction_id等のカラムが存在しない' as technical_detail,
    '今後の全発注で在庫と分納の追跡が困難' as impact,
    'テーブル設計の改善またはアプリケーションレベルでの連携強化が必要' as recommendation;

-- 4. 問題の特定：時間順序と分納番号の不整合
SELECT '時間順序 vs 分納番号の整合性チェック:' as info;
WITH ordered_by_time AS (
    SELECT
        t.id,
        t.installment_no,
        t.total_amount,
        t.created_at,
        ROW_NUMBER() OVER (ORDER BY t.created_at ASC) as correct_sequence
    FROM transactions t
    JOIN purchase_orders po ON t.parent_order_id = po.id
    WHERE po.order_no = 'PO250917020'
      AND t.total_amount > 0
      AND t.status = 'confirmed'
)
SELECT
    id,
    installment_no as current_number,
    correct_sequence as should_be_number,
    total_amount,
    created_at,
    CASE
        WHEN installment_no = correct_sequence THEN '✅ 正常'
        ELSE '❌ 不整合 (現在:' || installment_no || ' → 正しい:' || correct_sequence || ')'
    END as status
FROM ordered_by_time;

-- 5. 修正提案
SELECT '修正提案:' as info;
SELECT
    '実際の分納実行順序に基づいて分納番号を再割り当てする必要があります' as recommendation,
    '12:53の分納 → 第1回、13:00の分納 → 第2回 が正しい順序' as correct_order;