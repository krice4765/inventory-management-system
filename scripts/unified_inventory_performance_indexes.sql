-- ===============================================================
-- 統合在庫履歴表示のパフォーマンス向上用インデックス
-- 実装日: 2025-09-13
-- 目的: inventory_movements + transactions統合クエリの最適化
-- ===============================================================

-- 1. inventory_movements テーブル最適化
-- 既存の idx_inventory_movements_product_date が最適なので新規作成不要
-- 重複インデックスのクリーンアップ
DROP INDEX IF EXISTS idx_inventory_movements_tx;  -- 重複削除

-- 2. transactions テーブル最適化
-- 金額のみ分納レコード（inventory_movement_id が NULL）の高速検索
-- 注意: inventory_movement_idカラムの存在確認が必要
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_amount_only
ON transactions (created_at DESC, transaction_type)
WHERE transaction_type = 'installment';

-- 3. 分納関連の複合インデックス
-- 既存の idx_transactions_parent_order_status が類似機能を提供
-- 追加の created_at インデックス（必要に応じて）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_parent_created
ON transactions (parent_order_id, created_at DESC)
WHERE parent_order_id IS NOT NULL;

-- 4. products テーブル最適化（既存確認）
-- product_id での検索は主キーで最適化済みのため、追加不要

-- 4. purchase_orders テーブル最適化
-- 既存の purchase_orders_order_no_key (UNIQUE) が存在するため追加不要

-- 6. パフォーマンステスト用クエリ
-- 実装後に実行して応答時間を確認
/*
-- テストクエリ1: inventory_movements の基本検索
EXPLAIN ANALYZE
SELECT id, product_id, movement_type, quantity, created_at
FROM inventory_movements
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 20;

-- テストクエリ2: 金額のみ分納レコードの検索
EXPLAIN ANALYZE
SELECT id, parent_order_id, total_amount, created_at, transaction_no
FROM transactions
WHERE transaction_type = 'installment'
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 20;

-- テストクエリ3: 統合データの検索（最も重要）
EXPLAIN ANALYZE
WITH inventory_data AS (
  SELECT
    'inventory_movement' as record_type,
    id, product_id, created_at, quantity, total_amount, memo
  FROM inventory_movements
  WHERE created_at >= NOW() - INTERVAL '30 days'
),
transaction_data AS (
  SELECT
    'amount_only_transaction' as record_type,
    t.id, poi.product_id, t.created_at, 0 as quantity, t.total_amount, t.memo
  FROM transactions t
  JOIN purchase_order_items poi ON t.parent_order_id = poi.purchase_order_id
  WHERE t.transaction_type = 'installment'
    AND t.created_at >= NOW() - INTERVAL '30 days'
)
SELECT * FROM inventory_data
UNION ALL
SELECT * FROM transaction_data
ORDER BY created_at DESC
LIMIT 50;
*/

-- インデックス作成完了通知
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE '%inventory%' OR indexname LIKE '%transaction%'
ORDER BY tablename, indexname;

RAISE NOTICE '統合在庫履歴表示用インデックスの作成が完了しました';