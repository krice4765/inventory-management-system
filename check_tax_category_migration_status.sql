-- Day 3-4 税区分マイグレーション状態確認スクリプト
-- 2025-09-22

-- ============================================
-- Step 1: ENUM型の存在確認
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '=== ENUM型確認 ===';

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_category_enum') THEN
        RAISE NOTICE '✅ tax_category_enum型: 存在';

        -- ENUM値の確認
        RAISE NOTICE '📋 ENUM値一覧:';
        FOR rec IN
            SELECT enumlabel
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tax_category_enum')
            ORDER BY enumsortorder
        LOOP
            RAISE NOTICE '   - %', rec.enumlabel;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ tax_category_enum型: 存在しない';
    END IF;
END $$;

-- ============================================
-- Step 2: productsテーブルのカラム確認
-- ============================================

DO $$
DECLARE
    has_tax_category BOOLEAN := false;
    has_tax_category_updated_at BOOLEAN := false;
    has_tax_category_updated_by BOOLEAN := false;
    column_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== productsテーブルカラム確認 ===';

    -- tax_categoryカラム確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category'
    ) INTO has_tax_category;

    -- tax_category_updated_atカラム確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category_updated_at'
    ) INTO has_tax_category_updated_at;

    -- tax_category_updated_byカラム確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category_updated_by'
    ) INTO has_tax_category_updated_by;

    IF has_tax_category THEN
        RAISE NOTICE '✅ tax_category カラム: 存在';

        -- データ型確認
        FOR rec IN
            SELECT data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'tax_category'
        LOOP
            RAISE NOTICE '   型: %, NULL許可: %, デフォルト値: %',
                rec.data_type, rec.is_nullable, COALESCE(rec.column_default, 'なし');
        END LOOP;
    ELSE
        RAISE NOTICE '❌ tax_category カラム: 存在しない';
    END IF;

    IF has_tax_category_updated_at THEN
        RAISE NOTICE '✅ tax_category_updated_at カラム: 存在';
    ELSE
        RAISE NOTICE '❌ tax_category_updated_at カラム: 存在しない';
    END IF;

    IF has_tax_category_updated_by THEN
        RAISE NOTICE '✅ tax_category_updated_by カラム: 存在';
    ELSE
        RAISE NOTICE '❌ tax_category_updated_by カラム: 存在しない';
    END IF;

    -- 総カラム数確認
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'products';

    RAISE NOTICE '📊 productsテーブル総カラム数: %', column_count;
END $$;

-- ============================================
-- Step 3: インデックスの存在確認
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== インデックス確認 ===';

    -- idx_products_tax_category
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'products' AND indexname = 'idx_products_tax_category'
    ) THEN
        RAISE NOTICE '✅ idx_products_tax_category インデックス: 存在';
    ELSE
        RAISE NOTICE '❌ idx_products_tax_category インデックス: 存在しない';
    END IF;

    -- idx_products_tax_category_updated_at
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'products' AND indexname = 'idx_products_tax_category_updated_at'
    ) THEN
        RAISE NOTICE '✅ idx_products_tax_category_updated_at インデックス: 存在';
    ELSE
        RAISE NOTICE '❌ idx_products_tax_category_updated_at インデックス: 存在しない';
    END IF;
END $$;

-- ============================================
-- Step 4: 関数の存在確認
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== 関数確認 ===';

    -- get_product_tax_rate関数
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_product_tax_rate'
    ) THEN
        RAISE NOTICE '✅ get_product_tax_rate 関数: 存在';
    ELSE
        RAISE NOTICE '❌ get_product_tax_rate 関数: 存在しない';
    END IF;

    -- calculate_product_tax関数
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'calculate_product_tax'
    ) THEN
        RAISE NOTICE '✅ calculate_product_tax 関数: 存在';
    ELSE
        RAISE NOTICE '❌ calculate_product_tax 関数: 存在しない';
    END IF;

    -- validate_tax_category_setup関数
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'validate_tax_category_setup'
    ) THEN
        RAISE NOTICE '✅ validate_tax_category_setup 関数: 存在';
    ELSE
        RAISE NOTICE '❌ validate_tax_category_setup 関数: 存在しない';
    END IF;
END $$;

-- ============================================
-- Step 5: 履歴テーブルの存在確認
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN := false;
    trigger_exists BOOLEAN := false;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== 履歴テーブル確認 ===';

    -- product_tax_category_historyテーブル確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'product_tax_category_history'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE '✅ product_tax_category_history テーブル: 存在';

        -- レコード数確認
        FOR rec IN
            SELECT COUNT(*) as count FROM product_tax_category_history
        LOOP
            RAISE NOTICE '📊 履歴レコード数: %', rec.count;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ product_tax_category_history テーブル: 存在しない';
    END IF;

    -- トリガー確認
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_record_tax_category_change'
    ) INTO trigger_exists;

    IF trigger_exists THEN
        RAISE NOTICE '✅ trigger_record_tax_category_change トリガー: 存在';
    ELSE
        RAISE NOTICE '❌ trigger_record_tax_category_change トリガー: 存在しない';
    END IF;
END $$;

-- ============================================
-- Step 6: データ分析
-- ============================================

DO $$
DECLARE
    total_products INTEGER;
    with_tax_category INTEGER;
    without_tax_category INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== データ分析 ===';

    -- 商品総数
    SELECT COUNT(*) INTO total_products FROM products;
    RAISE NOTICE '📊 商品総数: %', total_products;

    IF total_products > 0 AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category'
    ) THEN
        -- tax_category設定済み商品数
        SELECT COUNT(*) INTO with_tax_category
        FROM products
        WHERE tax_category IS NOT NULL;

        -- tax_category未設定商品数
        SELECT COUNT(*) INTO without_tax_category
        FROM products
        WHERE tax_category IS NULL;

        RAISE NOTICE '✅ 税区分設定済み: % (%.1f%%)',
            with_tax_category,
            CASE WHEN total_products > 0 THEN (with_tax_category::DECIMAL / total_products * 100) ELSE 0 END;

        RAISE NOTICE '⚠️  税区分未設定: % (%.1f%%)',
            without_tax_category,
            CASE WHEN total_products > 0 THEN (without_tax_category::DECIMAL / total_products * 100) ELSE 0 END;

        -- 税区分別分布
        IF with_tax_category > 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '📈 税区分別分布:';
            FOR rec IN
                SELECT
                    tax_category,
                    COUNT(*) as count,
                    ROUND((COUNT(*)::DECIMAL / with_tax_category * 100), 1) as percentage
                FROM products
                WHERE tax_category IS NOT NULL
                GROUP BY tax_category
                ORDER BY tax_category
            LOOP
                RAISE NOTICE '   %: % (%.1f%%)', rec.tax_category, rec.count, rec.percentage;
            END LOOP;
        END IF;

        -- 最近更新された税区分設定
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'tax_category_updated_at'
        ) THEN
            FOR rec IN
                SELECT COUNT(*) as recent_updates
                FROM products
                WHERE tax_category_updated_at > (NOW() - INTERVAL '24 hours')
            LOOP
                RAISE NOTICE '🕒 過去24時間の税区分更新: %', rec.recent_updates;
            END LOOP;
        END IF;
    ELSE
        RAISE NOTICE '⚠️  tax_categoryカラムが存在しないか、商品データがありません';
    END IF;
END $$;

-- ============================================
-- Step 7: RLSポリシー確認
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RLSポリシー確認 ===';

    -- productsテーブルのRLS確認
    FOR rec IN
        SELECT
            schemaname, tablename, rowsecurity,
            COUNT(*) OVER (PARTITION BY schemaname, tablename) as policy_count
        FROM pg_policies
        WHERE tablename = 'products'
        LIMIT 1
    LOOP
        RAISE NOTICE '✅ productsテーブルRLS: 有効, ポリシー数: %', rec.policy_count;
    END LOOP;

    -- 税区分更新ポリシーの確認
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'products'
        AND policyname LIKE '%tax_categories%' OR policyname LIKE '%tax%'
    ) THEN
        RAISE NOTICE '✅ 税区分関連ポリシー: 存在';
    ELSE
        RAISE NOTICE '⚠️  税区分関連ポリシー: 専用ポリシーなし（一般的なポリシーで管理）';
    END IF;
END $$;

-- ============================================
-- Step 8: 総合評価
-- ============================================

DO $$
DECLARE
    migration_score INTEGER := 0;
    max_score INTEGER := 10;
    status TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== 総合評価 ===';

    -- ENUM型チェック
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_category_enum') THEN
        migration_score := migration_score + 1;
    END IF;

    -- tax_categoryカラムチェック
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category'
    ) THEN
        migration_score := migration_score + 2;
    END IF;

    -- 更新関連カラムチェック
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category_updated_at'
    ) THEN
        migration_score := migration_score + 1;
    END IF;

    -- インデックスチェック
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'products' AND indexname = 'idx_products_tax_category'
    ) THEN
        migration_score := migration_score + 1;
    END IF;

    -- 関数チェック
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_product_tax_rate') THEN
        migration_score := migration_score + 1;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_product_tax') THEN
        migration_score := migration_score + 1;
    END IF;

    -- 履歴テーブルチェック
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'product_tax_category_history'
    ) THEN
        migration_score := migration_score + 1;
    END IF;

    -- トリガーチェック
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_record_tax_category_change'
    ) THEN
        migration_score := migration_score + 1;
    END IF;

    -- バリデーション関数チェック
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_tax_category_setup') THEN
        migration_score := migration_score + 1;
    END IF;

    -- 総合判定
    IF migration_score = max_score THEN
        status := '✅ 完全実装済み';
    ELSIF migration_score >= 7 THEN
        status := '🟡 ほぼ実装済み';
    ELSIF migration_score >= 4 THEN
        status := '🟠 部分的実装';
    ELSE
        status := '❌ 未実装';
    END IF;

    RAISE NOTICE '📊 マイグレーション完了率: %/% (%.1f%%)',
        migration_score, max_score, (migration_score::DECIMAL / max_score * 100);
    RAISE NOTICE '🎯 ステータス: %', status;

    -- 次のアクション推奨
    IF migration_score < max_score THEN
        RAISE NOTICE '';
        RAISE NOTICE '📋 推奨アクション:';
        IF migration_score < 3 THEN
            RAISE NOTICE '   → day3_products_tax_category_migration.sqlを実行してください';
        ELSE
            RAISE NOTICE '   → 不足している機能を個別に実装してください';
        END IF;
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '🎉 Day 3-4 税区分マイグレーションが完全に完了しています！';
    END IF;
END $$;