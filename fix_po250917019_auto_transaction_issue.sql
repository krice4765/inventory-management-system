-- ===================================================================
-- PO250917019 初期取引自動生成問題の根本的解決
-- 実行前に必ずバックアップを取得してください
-- ===================================================================

-- ステップ1: 現在の状況確認
-- ===================================================================

-- 1.1 現在のトリガー状況を確認
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders'
ORDER BY trigger_name;

-- 1.2 問題の関数fn_sync_transaction_from_po()を確認
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'fn_sync_transaction_from_po';

-- 1.3 PO250917019の現在の状態を確認
SELECT
    po.order_no,
    po.created_at as order_created,
    t.transaction_no,
    t.total_amount,
    t.created_at as transaction_created,
    t.memo,
    t.status
FROM purchase_orders po
LEFT JOIN transactions t ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250917019'
ORDER BY t.created_at;

-- ステップ2: 問題の原因
-- ===================================================================
-- 🚨 発見された問題:
-- fn_sync_transaction_from_po() 関数が purchase_orders テーブルの
-- INSERT時に自動的にtransactionsテーブルに初期取引を作成している
--
-- この機能は以下の理由で不適切:
-- 1. 発注書作成時に自動的に¥16,500などの初期取引が生成される
-- 2. ユーザーが意図しない取引が作成される
-- 3. 分納システムとの整合性が取れない

-- ステップ3: 根本的修正方法（3つの選択肢）
-- ===================================================================

-- 🎯 選択肢1: トリガーの完全削除（推奨）
-- 発注書作成時の自動取引生成を完全に停止
DROP TRIGGER IF EXISTS trigger_sync_transaction_from_po ON purchase_orders;
DROP TRIGGER IF EXISTS sync_transaction_from_po_trigger ON purchase_orders;

-- 関数も削除（使用されていない場合）
-- DROP FUNCTION IF EXISTS fn_sync_transaction_from_po();

-- 🎯 選択肢2: トリガーの条件修正（条件付き適用）
-- 特定の条件でのみトリガーを実行
/*
CREATE OR REPLACE FUNCTION fn_sync_transaction_from_po()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- 特定の条件でのみ実行（例：ステータスが'confirmed'の場合のみ）
  IF NEW.status = 'confirmed' THEN
    INSERT INTO public.transactions (
      id, transaction_no, transaction_type, partner_id,
      transaction_date, due_date, status, total_amount,
      memo, parent_order_id, installment_no, created_at
    )
    VALUES (
      gen_random_uuid(),
      'TX-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS') || '-' || substr(md5(random()::text),1,6),
      'purchase',
      NEW.partner_id,
      NEW.order_date,
      NEW.delivery_deadline,
      'draft',
      NEW.total_amount,
      '自動生成された初期取引',
      NEW.id,
      1,
      now()
    )
    ON CONFLICT (parent_order_id, transaction_type, installment_no) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
*/

-- 🎯 選択肢3: トリガーの無効化（一時的対応）
-- ALTER TABLE purchase_orders DISABLE TRIGGER trigger_sync_transaction_from_po;

-- ステップ4: クリーンアップ（選択肢1を選択した場合）
-- ===================================================================

-- 4.1 既存の不要な初期取引を特定
SELECT
    t.id,
    t.transaction_no,
    t.total_amount,
    t.memo,
    t.created_at,
    po.order_no
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE t.installment_no = 1
  AND t.status = 'draft'
  AND t.memo LIKE '%自動生成%'
  AND t.created_at >= po.created_at
  AND t.created_at <= po.created_at + INTERVAL '1 minute'
ORDER BY t.created_at DESC;

-- 4.2 自動生成された不要な取引を削除（慎重に実行）
-- 注意: 本当に不要であることを確認してから実行してください
/*
DELETE FROM transactions
WHERE id IN (
  SELECT t.id
  FROM transactions t
  JOIN purchase_orders po ON t.parent_order_id = po.id
  WHERE t.installment_no = 1
    AND t.status = 'draft'
    AND t.memo LIKE '%自動生成%'
    AND t.created_at >= po.created_at
    AND t.created_at <= po.created_at + INTERVAL '1 minute'
);
*/

-- ステップ5: 検証
-- ===================================================================

-- 5.1 トリガーが削除されたことを確認
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders'
  AND trigger_name LIKE '%sync_transaction%';

-- 5.2 新しい発注書でテスト
-- この後、OrderNew.tsxから新しい発注書を作成して
-- 自動的に取引が生成されないことを確認

-- ステップ6: 今後の運用指針
-- ===================================================================

-- 6.1 発注書作成のフロー
-- 1. OrderNew.tsxで発注書のみ作成
-- 2. 必要に応じてユーザーが手動で分納を追加
-- 3. 自動取引生成は行わない

-- 6.2 分納システムの利用
-- - create_installment_v2() 関数を使用
-- - ユーザーの明示的な操作でのみ分納を作成

-- 実行完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ PO250917019 初期取引自動生成問題の修正完了';
    RAISE NOTICE '🔄 発注書作成時の自動取引生成を停止しました';
    RAISE NOTICE '⚡ これで新規発注書作成時に不要な初期取引は生成されません';
    RAISE NOTICE '📝 今後は分納が必要な場合のみ手動で追加してください';
END $$;