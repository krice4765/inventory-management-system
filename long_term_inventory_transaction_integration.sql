-- 🎯 長期的な在庫・分納システム統合
-- 在庫移動とtransactionの完全な連携を実現

-- ===================================================================
-- Phase 1: inventory_movementsテーブルの拡張
-- ===================================================================

SELECT '🔧 Phase 1: inventory_movementsテーブルの拡張' as phase;

-- 1a. transaction_idカラムの追加（外部キー制約付き）
ALTER TABLE public.inventory_movements
ADD COLUMN transaction_id uuid REFERENCES public.transactions(id);

-- 1b. 在庫移動の理由・詳細を記録するカラム追加
ALTER TABLE public.inventory_movements
ADD COLUMN movement_reason text CHECK (movement_reason IN ('purchase', 'sale', 'adjustment', 'transfer', 'return', 'installment'));

-- 1c. 参照番号（発注書番号、売上番号等）を記録
ALTER TABLE public.inventory_movements
ADD COLUMN reference_no text;

-- 1d. バッチ処理用のグループID（複数商品の一括処理）
ALTER TABLE public.inventory_movements
ADD COLUMN batch_id uuid;

-- 1e. 在庫移動のステータス管理
ALTER TABLE public.inventory_movements
ADD COLUMN movement_status text DEFAULT 'confirmed' CHECK (movement_status IN ('pending', 'confirmed', 'cancelled', 'reversed'));

-- 1f. 在庫移動の承認者記録
ALTER TABLE public.inventory_movements
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

-- 1g. インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_inventory_movements_transaction_id ON public.inventory_movements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference_no ON public.inventory_movements(reference_no);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch_id ON public.inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_reason ON public.inventory_movements(movement_reason);

-- ===================================================================
-- Phase 2: 既存データの移行・整合性確保
-- ===================================================================

SELECT '🔄 Phase 2: 既存データの移行・整合性確保' as phase;

-- 2a. 既存の在庫移動データにreasonを設定
UPDATE public.inventory_movements
SET movement_reason = 'purchase'
WHERE movement_type = 'purchase' AND movement_reason IS NULL;

UPDATE public.inventory_movements
SET movement_reason = 'sale'
WHERE movement_type = 'sale' AND movement_reason IS NULL;

UPDATE public.inventory_movements
SET movement_reason = 'adjustment'
WHERE movement_type IN ('adjustment_in', 'adjustment_out') AND movement_reason IS NULL;

-- 2b. 時間的近接性に基づくtransaction連携（推論的マッピング）
DO $$
DECLARE
    movement_record RECORD;
    matching_transaction_id uuid;
BEGIN
    -- 購入系の在庫移動について、時間的に近いtransactionを探索
    FOR movement_record IN
        SELECT id, created_at, movement_type, note
        FROM public.inventory_movements
        WHERE movement_type = 'purchase'
          AND transaction_id IS NULL
          AND movement_reason = 'purchase'
    LOOP
        -- 前後30分以内の分納取引を検索
        SELECT t.id INTO matching_transaction_id
        FROM public.transactions t
        WHERE t.transaction_type = 'purchase'
          AND t.status = 'confirmed'
          AND ABS(EXTRACT(EPOCH FROM (t.created_at - movement_record.created_at))) <= 1800 -- 30分
        ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - movement_record.created_at)))
        LIMIT 1;

        -- マッチした場合は関連付け
        IF matching_transaction_id IS NOT NULL THEN
            UPDATE public.inventory_movements
            SET
                transaction_id = matching_transaction_id,
                note = COALESCE(note, '') || ' [自動関連付け: 時間的近接性]'
            WHERE id = movement_record.id;

            RAISE NOTICE '在庫移動ID % を transaction ID % に関連付けました', movement_record.id, matching_transaction_id;
        END IF;
    END LOOP;
END $$;

-- ===================================================================
-- Phase 3: 統合的な分納・在庫管理関数
-- ===================================================================

SELECT '⚡ Phase 3: 統合的な分納・在庫管理関数' as phase;

-- 3a. 分納作成と在庫移動を同時実行する関数
CREATE OR REPLACE FUNCTION public.create_installment_with_inventory(
    p_parent_order_id uuid,
    p_amount numeric,
    p_inventory_items jsonb, -- [{"product_id": 1, "quantity": 10, "unit_price": 100}]
    p_memo text DEFAULT NULL,
    p_due_date date DEFAULT CURRENT_DATE + INTERVAL '30 days'
)
RETURNS TABLE (
    transaction_id uuid,
    transaction_no text,
    installment_no integer,
    inventory_movement_ids uuid[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_transaction_result RECORD;
    v_batch_id uuid := gen_random_uuid();
    v_inventory_item jsonb;
    v_movement_ids uuid[] := '{}';
    v_movement_id uuid;
    v_order_no text;
BEGIN
    -- 発注書番号取得
    SELECT order_no INTO v_order_no
    FROM public.purchase_orders
    WHERE id = p_parent_order_id;

    -- 1. 分納取引作成
    SELECT * INTO v_transaction_result
    FROM public.add_purchase_installment_v2(
        p_parent_order_id,
        p_amount,
        'confirmed',
        p_due_date,
        p_memo
    );

    -- 2. 各商品の在庫移動を記録
    FOR v_inventory_item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
    LOOP
        INSERT INTO public.inventory_movements (
            id,
            product_id,
            movement_type,
            quantity_delta,
            unit_price,
            note,
            transaction_id,
            movement_reason,
            reference_no,
            batch_id,
            movement_status,
            user_id,
            created_at
        )
        VALUES (
            gen_random_uuid(),
            (v_inventory_item->>'product_id')::integer,
            'purchase',
            (v_inventory_item->>'quantity')::numeric,
            (v_inventory_item->>'unit_price')::numeric,
            '分納第' || v_transaction_result.installment_no || '回 - ' || COALESCE(p_memo, ''),
            v_transaction_result.id,
            'installment',
            v_order_no,
            v_batch_id,
            'confirmed',
            auth.uid(),
            now()
        )
        RETURNING id INTO v_movement_id;

        v_movement_ids := array_append(v_movement_ids, v_movement_id);
    END LOOP;

    -- 3. 商品の在庫数量を更新
    FOR v_inventory_item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
    LOOP
        UPDATE public.products
        SET stock_quantity = stock_quantity + (v_inventory_item->>'quantity')::numeric
        WHERE id = (v_inventory_item->>'product_id')::integer;
    END LOOP;

    -- 結果返却
    RETURN QUERY
    SELECT
        v_transaction_result.id,
        v_transaction_result.transaction_no,
        v_transaction_result.installment_no,
        v_movement_ids;
END;
$$;

-- 3b. 分納履歴と在庫移動を統合表示する関数
CREATE OR REPLACE FUNCTION public.get_integrated_installment_history(
    p_order_id uuid
)
RETURNS TABLE (
    installment_no integer,
    transaction_id uuid,
    transaction_no text,
    amount numeric,
    memo text,
    transaction_date date,
    created_at timestamptz,
    inventory_movements jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.installment_no,
        t.id,
        t.transaction_no,
        t.total_amount,
        t.memo,
        t.transaction_date,
        t.created_at,
        -- 関連する在庫移動を集約
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'movement_id', im.id,
                    'product_id', im.product_id,
                    'product_name', p.name,
                    'quantity', im.quantity_delta,
                    'unit_price', im.unit_price,
                    'movement_status', im.movement_status
                )
            ) FILTER (WHERE im.id IS NOT NULL),
            '[]'::jsonb
        ) as inventory_movements
    FROM public.transactions t
    LEFT JOIN public.inventory_movements im ON t.id = im.transaction_id
    LEFT JOIN public.products p ON im.product_id = p.id
    WHERE t.parent_order_id = p_order_id
      AND t.transaction_type = 'purchase'
      AND t.status = 'confirmed'
    GROUP BY t.id, t.installment_no, t.transaction_no, t.total_amount, t.memo, t.transaction_date, t.created_at
    ORDER BY t.installment_no;
END;
$$;

-- ===================================================================
-- Phase 4: 権限設定
-- ===================================================================

SELECT '🔐 Phase 4: 権限設定' as phase;

-- 新機能の権限設定
GRANT EXECUTE ON FUNCTION public.create_installment_with_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_integrated_installment_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_installment_with_inventory TO anon;
GRANT EXECUTE ON FUNCTION public.get_integrated_installment_history TO anon;

-- ===================================================================
-- Phase 5: 検証とテスト
-- ===================================================================

SELECT '✅ Phase 5: 拡張機能の検証' as phase;

-- 5a. 新カラムの確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_movements'
  AND column_name IN ('transaction_id', 'movement_reason', 'reference_no', 'batch_id', 'movement_status')
ORDER BY column_name;

-- 5b. 既存データの関連付け状況確認
SELECT
    '既存在庫移動の関連付け状況:' as info,
    COUNT(*) as total_movements,
    COUNT(transaction_id) as linked_movements,
    ROUND(COUNT(transaction_id) * 100.0 / COUNT(*), 2) as linkage_percentage
FROM public.inventory_movements
WHERE movement_type = 'purchase';

-- 5c. 統合履歴表示のテスト（PO250917020）
SELECT 'PO250917020 統合履歴表示テスト:' as info;
SELECT
    installment_no,
    amount,
    memo,
    jsonb_array_length(inventory_movements) as inventory_items_count
FROM public.get_integrated_installment_history(
    (SELECT id FROM public.purchase_orders WHERE order_no = 'PO250917020')
);

-- 最終メッセージ
DO $$
BEGIN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🚀 長期的在庫・分納システム統合完了';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ inventory_movementsテーブル拡張: 完了';
    RAISE NOTICE '✅ transaction連携機能: 実装完了';
    RAISE NOTICE '✅ 統合管理関数: create_installment_with_inventory';
    RAISE NOTICE '✅ 統合表示関数: get_integrated_installment_history';
    RAISE NOTICE '✅ 既存データ移行: 時間的近接性で自動関連付け';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🎯 今後は在庫移動と分納が完全に連携します';
    RAISE NOTICE '📝 新規分納: create_installment_with_inventory使用';
    RAISE NOTICE '📊 履歴表示: get_integrated_installment_history使用';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;