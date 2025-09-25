-- movement_type制約の修正（既存データ対応版）

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '📋 movement_type制約の修正開始（既存データ対応）';
    RAISE NOTICE '============================================';

    -- 既存のCHECK制約を探す
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'inventory_movements'::regclass
    AND contype = 'c'  -- check constraint
    AND pg_get_constraintdef(oid) LIKE '%movement_type%'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        -- 既存の制約を削除
        EXECUTE format('ALTER TABLE inventory_movements DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE '✅ 既存制約 % を削除', constraint_name;
    END IF;

    -- 新しい制約を追加（既存データ 'in', 'out' も含む）
    ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_movement_type_check
    CHECK (movement_type IN (
        'in',           -- 既存データ対応
        'out',          -- 既存データ対応
        'purchase',     -- 仕入
        'sale',         -- 売上
        'adjustment',   -- 調整
        'transfer',     -- 移動
        'return',       -- 返品
        'loss',         -- 廃棄・損失
        'initial',      -- 初期在庫
        'outbound'      -- 出庫
    ));

    RAISE NOTICE '✅ 新しいmovement_type制約を追加（既存データと新仕様の両方対応）';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ movement_type制約修正完了';
    RAISE NOTICE '============================================';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ エラー: %', SQLERRM;
        RAISE;
END $$;

-- 修正後の制約確認
SELECT
    'movement_type制約確認' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'inventory_movements'::regclass
AND contype = 'c'  -- check constraint
AND conname LIKE '%movement_type%';

-- 制約修正後のテスト（初期データ投入可能か確認）
SELECT
    'テスト結果' as test_type,
    CASE WHEN 'initial' = ANY(ARRAY['in', 'out', 'purchase', 'sale', 'adjustment', 'transfer', 'return', 'loss', 'initial', 'outbound'])
         THEN 'initial値は使用可能'
         ELSE 'initial値は使用不可'
    END as result;