-- 現在のデータベーススキーマ状況確認
-- Day 2-3で実装した機能に必要な構造が存在するかチェック

-- 1. purchase_ordersテーブルの構造確認
DO $$
BEGIN
    RAISE NOTICE '=== purchase_orders テーブル構造確認 ===';
END $$;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 必要な列の存在確認
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== 必要な列の存在確認 ===';

    -- assigned_user_id列
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'assigned_user_id'
    ) INTO col_exists;

    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'assigned_user_id');
    END IF;

    -- shipping_cost列
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'shipping_cost'
    ) INTO col_exists;

    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'shipping_cost');
    END IF;

    -- shipping_tax_rate列
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'shipping_tax_rate'
    ) INTO col_exists;

    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'shipping_tax_rate');
    END IF;

    -- delivery_deadline列
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'delivery_deadline'
    ) INTO col_exists;

    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'delivery_deadline');
    END IF;

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '❌ 不足している列: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ 必要な列は全て存在しています';
    END IF;
END $$;

-- 3. 外部キー制約の確認
DO $$
BEGIN
    RAISE NOTICE '=== 外部キー制約確認 ===';
END $$;

SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'purchase_orders'
    AND tc.table_schema = 'public';

-- 4. tax_display_settings テーブルの存在確認
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== 新テーブル存在確認 ===';

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'tax_display_settings'
        AND table_schema = 'public'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE '✅ tax_display_settings テーブルが存在します';
    ELSE
        RAISE NOTICE '❌ tax_display_settings テーブルが存在しません';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'shipping_cost_settings'
        AND table_schema = 'public'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE '✅ shipping_cost_settings テーブルが存在します';
    ELSE
        RAISE NOTICE '❌ shipping_cost_settings テーブルが存在しません';
    END IF;
END $$;

-- 5. 関数の存在確認
DO $$
DECLARE
    func_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== 必要な関数の存在確認 ===';

    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'calculate_order_tax'
    ) INTO func_exists;

    IF func_exists THEN
        RAISE NOTICE '✅ calculate_order_tax 関数が存在します';
    ELSE
        RAISE NOTICE '❌ calculate_order_tax 関数が存在しません';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'calculate_shipping_cost'
    ) INTO func_exists;

    IF func_exists THEN
        RAISE NOTICE '✅ calculate_shipping_cost 関数が存在します';
    ELSE
        RAISE NOTICE '❌ calculate_shipping_cost 関数が存在しません';
    END IF;
END $$;

-- 6. サンプルデータの確認
DO $$
DECLARE
    record_count INTEGER;
BEGIN
    RAISE NOTICE '=== データ数確認 ===';

    SELECT COUNT(*) INTO record_count FROM purchase_orders;
    RAISE NOTICE 'purchase_orders: % 件', record_count;

    SELECT COUNT(*) INTO record_count FROM profiles;
    RAISE NOTICE 'profiles: % 件', record_count;

    SELECT COUNT(*) INTO record_count FROM suppliers;
    RAISE NOTICE 'suppliers: % 件', record_count;
END $$;