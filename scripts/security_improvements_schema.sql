-- セキュリティ改善のために必要なテーブル定義
-- 実行前に既存テーブルの存在確認を行う

-- 1. 重複検出記録テーブル
CREATE TABLE IF NOT EXISTS public.duplicate_detection_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_hash VARCHAR(64) NOT NULL UNIQUE,
    order_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    session_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    operation_data JSONB
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_hash ON public.duplicate_detection_records(operation_hash);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_expires ON public.duplicate_detection_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_duplicate_detection_session ON public.duplicate_detection_records(session_id);

-- 2. 在庫オーバーライドログテーブル
CREATE TABLE IF NOT EXISTS public.inventory_override_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    requested_quantity INTEGER NOT NULL,
    current_stock INTEGER NOT NULL,
    shortage INTEGER NOT NULL,
    reason TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by TEXT,
    approved_at TIMESTAMPTZ
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_inventory_override_order ON public.inventory_override_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_override_product ON public.inventory_override_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_override_timestamp ON public.inventory_override_logs(timestamp);

-- 3. 既存のテーブルにインデックス追加（パフォーマンス改善）
-- transactionsテーブル用
CREATE INDEX IF NOT EXISTS idx_transactions_parent_order_type ON public.transactions(parent_order_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- inventory_movementsテーブル用
CREATE INDEX IF NOT EXISTS idx_inventory_movements_transaction ON public.inventory_movements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id);

-- 4. 期限切れレコードの自動削除ジョブ（pg_cron使用時）
-- SELECT cron.schedule('cleanup-duplicate-detection', '0 */6 * * *',
--   'DELETE FROM public.duplicate_detection_records WHERE expires_at < NOW();');

-- 5. RLS (Row Level Security) ポリシー設定例
-- 実際の運用では権限管理システムに応じて調整

-- ALTER TABLE public.duplicate_detection_records ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY duplicate_detection_policy ON public.duplicate_detection_records
--   FOR ALL USING (user_id = current_setting('app.current_user_id'));

-- ALTER TABLE public.inventory_override_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY inventory_override_policy ON public.inventory_override_logs
--   FOR ALL USING (requested_by = current_setting('app.current_user_id') OR
--                  current_setting('app.user_role') = 'admin');

COMMENT ON TABLE public.duplicate_detection_records IS 'ハッシュベース重複検出システム - 分納操作の重複を防止';
COMMENT ON TABLE public.inventory_override_logs IS '在庫制限オーバーライドログ - 権限ベース在庫制限突破の記録';

-- 正常に完了した場合の通知
DO $$
BEGIN
    RAISE NOTICE '✅ セキュリティ改善スキーマの作成が完了しました';
    RAISE NOTICE '📊 作成されたテーブル:';
    RAISE NOTICE '   - duplicate_detection_records (重複検出記録)';
    RAISE NOTICE '   - inventory_override_logs (在庫オーバーライドログ)';
    RAISE NOTICE '🔍 作成されたインデックス: 6個';
END $$;