-- ===============================================================
-- スケーラブル在庫システム用インデックス（10万件以上対応）
-- 実装日: 2025-09-13
-- 目的: 大規模データでのパフォーマンス最適化
-- ===============================================================

-- 1. 時系列特化インデックス（最重要）
-- 在庫履歴の時系列検索を最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_created_at_desc
ON inventory_movements (created_at DESC);

-- 2. 複合インデックス最適化（順序重要）
-- 日付範囲 + 製品での高速検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_date_product
ON inventory_movements (created_at DESC, product_id);

-- 3. 部分インデックス（最近30日間のホットデータ）
-- 最頻繁に使用される最近のデータを超高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_recent_30d
ON inventory_movements (created_at DESC, movement_type, quantity)
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 4. 移動タイプ別インデックス（分析用）
-- 入庫・出庫別の集計クエリ最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_type_date
ON inventory_movements (movement_type, created_at DESC)
WHERE movement_type IN ('in', 'out');

-- 5. トランザクション関連インデックス（統合クエリ用）
-- 統合在庫履歴表示での JOIN 最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_tx_date
ON inventory_movements (transaction_id, created_at DESC)
WHERE transaction_id IS NOT NULL;

-- 6. 大量データ対応：パーティション準備インデックス
-- 将来的な時系列パーティショニング対応
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_movements_year_month
ON inventory_movements (EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at), created_at DESC);

-- ===============================================================
-- transactionsテーブルの大規模対応
-- ===============================================================

-- 7. 分納処理高速化（既存の改良版）
-- installment_no含む複合インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_installment_optimized
ON transactions (transaction_type, parent_order_id, installment_no, created_at DESC)
WHERE transaction_type = 'installment' AND parent_order_id IS NOT NULL;

-- 8. 金額範囲検索用
-- 統合表示での金額フィルタリング高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_amount_range
ON transactions (total_amount, created_at DESC)
WHERE total_amount > 0;

-- 9. ステータス別処理用
-- ワークフロー処理の高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status_date
ON transactions (status, created_at DESC);

-- ===============================================================
-- 統合クエリ専用最適化
-- ===============================================================

-- 10. 統合ビュー用マテリアライズドビュー（大量データ時）
-- 10万件超えた際の切り札
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_unified_inventory_recent AS
SELECT
    'inventory_movement' as record_type,
    im.id,
    im.product_id,
    im.created_at,
    im.quantity,
    im.total_amount,
    im.memo,
    im.movement_type,
    NULL::integer as installment_no,
    NULL::text as transaction_no,
    p.product_name,
    p.product_code
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
WHERE im.created_at >= CURRENT_DATE - INTERVAL '90 days'

UNION ALL

SELECT
    'amount_only_transaction' as record_type,
    t.id,
    poi.product_id,
    t.created_at,
    0 as quantity,
    t.total_amount,
    t.memo,
    NULL as movement_type,
    t.installment_no,
    t.transaction_no,
    p.product_name,
    p.product_code
FROM transactions t
JOIN purchase_order_items poi ON t.parent_order_id = poi.purchase_order_id
JOIN products p ON poi.product_id = p.id
WHERE t.transaction_type = 'installment'
  AND t.created_at >= CURRENT_DATE - INTERVAL '90 days';

-- マテリアライズドビュー用インデックス
CREATE INDEX IF NOT EXISTS idx_mv_unified_inventory_created_at
ON mv_unified_inventory_recent (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mv_unified_inventory_record_type
ON mv_unified_inventory_recent (record_type, created_at DESC);

-- ===============================================================
-- メンテナンス用スクリプト
-- ===============================================================

-- 11. 統計情報更新（定期実行推奨）
-- 大量データでのクエリプランナー最適化
ANALYZE inventory_movements;
ANALYZE transactions;
ANALYZE products;

-- 12. マテリアライズドビュー更新関数
CREATE OR REPLACE FUNCTION refresh_unified_inventory_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_inventory_recent;
    RAISE NOTICE '統合在庫ビューを更新しました: %', now();
END;
$$ LANGUAGE plpgsql;

-- ===============================================================
-- パフォーマンステスト用クエリ（10万件想定）
-- ===============================================================

-- テスト1: 時系列インデックス効果測定
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT id, product_id, created_at, quantity
-- FROM inventory_movements
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- ORDER BY created_at DESC
-- LIMIT 100;

-- テスト2: 部分インデックス効果測定
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT movement_type, SUM(quantity)
-- FROM inventory_movements
-- WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY movement_type;

-- テスト3: 統合クエリ（マテリアライズドビュー使用）
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT record_type, COUNT(*), AVG(total_amount)
-- FROM mv_unified_inventory_recent
-- WHERE created_at >= NOW() - INTERVAL '7 days'
-- GROUP BY record_type
-- ORDER BY record_type;

-- ===============================================================
-- 実装完了通知とインデックス一覧表示
-- ===============================================================

-- 作成されたインデックスの確認
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('inventory_movements', 'transactions')
  AND indexname LIKE '%inventory%' OR indexname LIKE '%transactions%'
ORDER BY tablename, indexname;

-- インデックスサイズ確認
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename IN ('inventory_movements', 'transactions')
ORDER BY pg_relation_size(indexname::regclass) DESC;

RAISE NOTICE 'スケーラブル在庫インデックス（10万件以上対応）の実装が完了しました';
RAISE NOTICE 'マテリアライズドビューは大量データ時のみ使用してください';
RAISE NOTICE '定期的な ANALYZE と refresh_unified_inventory_view() の実行を推奨します';