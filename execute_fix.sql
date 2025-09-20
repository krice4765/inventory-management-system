-- 問題トリガーの削除実行
-- 発注書作成時の不要な初期取引生成を停止

-- 1. 現在のトリガー確認
SELECT 'Current triggers on purchase_orders:' as info;
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders';

-- 2. 問題トリガーの削除
DROP TRIGGER IF EXISTS trigger_sync_transaction_from_po ON purchase_orders;
DROP TRIGGER IF EXISTS sync_transaction_from_po_trigger ON purchase_orders;

-- 3. 削除確認
SELECT 'Triggers after deletion:' as info;
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders'
  AND trigger_name LIKE '%sync_transaction%';

-- 4. 成功メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ 修正完了: 発注書作成時の自動取引生成を停止しました';
    RAISE NOTICE '🎯 これで新規発注書作成時に不要な初期取引は生成されません';
END $$;