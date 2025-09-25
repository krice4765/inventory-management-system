-- Day 3-4: Products テーブル税区分カラム追加マイグレーション
-- 0922Youken.md Day 3-4 仕様準拠
-- 2025-09-22 実施

-- ============================================
-- Step 1: tax_category カラムの追加
-- ============================================

-- 税区分のENUM型を作成（存在しない場合のみ）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_category_enum') THEN
        CREATE TYPE tax_category_enum AS ENUM (
            'standard_10',   -- 標準税率10%
            'reduced_8',     -- 軽減税率8%
            'tax_free',      -- 非課税
            'tax_exempt'     -- 免税
        );
        RAISE NOTICE 'tax_category_enum型を作成しました';
    ELSE
        RAISE NOTICE 'tax_category_enum型は既に存在します';
    END IF;
END $$;

-- products テーブルに税区分カラムを追加
ALTER TABLE products
ADD COLUMN IF NOT EXISTS tax_category tax_category_enum NOT NULL DEFAULT 'standard_10',
ADD COLUMN IF NOT EXISTS tax_category_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS tax_category_updated_by uuid REFERENCES auth.users(id);

-- カラム追加の確認
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'tax_category'
    ) THEN
        RAISE NOTICE 'products.tax_category カラムが正常に追加されました';
    ELSE
        RAISE EXCEPTION 'products.tax_category カラムの追加に失敗しました';
    END IF;
END $$;

-- ============================================
-- Step 2: インデックスの作成
-- ============================================

-- 税区分での検索を高速化
CREATE INDEX IF NOT EXISTS idx_products_tax_category
ON products(tax_category);

-- 税区分更新日時でのソート用
CREATE INDEX IF NOT EXISTS idx_products_tax_category_updated_at
ON products(tax_category_updated_at DESC);

RAISE NOTICE 'インデックスを作成しました';

-- ============================================
-- Step 3: 既存データの税区分推定・設定
-- ============================================

-- 商品名から税区分を推定する関数
CREATE OR REPLACE FUNCTION estimate_tax_category(product_name TEXT)
RETURNS tax_category_enum AS $$
BEGIN
    -- 軽減税率対象商品の判定
    IF product_name ~* '食品|飲料|食材|米|肉|魚|野菜|果物|パン|お菓子|調味料|乳製品|冷凍食品' THEN
        RETURN 'reduced_8';
    END IF;

    -- 非課税対象商品の判定
    IF product_name ~* '切手|印紙|有価証券|土地|住宅|保険|医療|介護|教育|福祉' THEN
        RETURN 'tax_free';
    END IF;

    -- 免税対象商品の判定
    IF product_name ~* '輸出|海外|免税|duty.?free' THEN
        RETURN 'tax_exempt';
    END IF;

    -- デフォルトは標準税率
    RETURN 'standard_10';
END;
$$ LANGUAGE plpgsql;

-- 既存の全商品に対して税区分を推定・設定
UPDATE products
SET
    tax_category = estimate_tax_category(product_name),
    tax_category_updated_at = now(),
    tax_category_updated_by = (
        SELECT id FROM auth.users
        WHERE email LIKE '%system%' OR email LIKE '%admin%'
        LIMIT 1
    )
WHERE tax_category IS NULL OR tax_category = 'standard_10';

-- 推定結果の確認
DO $$
DECLARE
    total_count INTEGER;
    standard_count INTEGER;
    reduced_count INTEGER;
    tax_free_count INTEGER;
    tax_exempt_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM products;
    SELECT COUNT(*) INTO standard_count FROM products WHERE tax_category = 'standard_10';
    SELECT COUNT(*) INTO reduced_count FROM products WHERE tax_category = 'reduced_8';
    SELECT COUNT(*) INTO tax_free_count FROM products WHERE tax_category = 'tax_free';
    SELECT COUNT(*) INTO tax_exempt_count FROM products WHERE tax_category = 'tax_exempt';

    RAISE NOTICE '=== 税区分設定結果 ===';
    RAISE NOTICE '総商品数: %', total_count;
    RAISE NOTICE '標準税率10%%: % (%％)', standard_count, ROUND(standard_count::DECIMAL / total_count * 100, 1);
    RAISE NOTICE '軽減税率8%%: % (%％)', reduced_count, ROUND(reduced_count::DECIMAL / total_count * 100, 1);
    RAISE NOTICE '非課税0%%: % (%％)', tax_free_count, ROUND(tax_free_count::DECIMAL / total_count * 100, 1);
    RAISE NOTICE '免税0%%: % (%％)', tax_exempt_count, ROUND(tax_exempt_count::DECIMAL / total_count * 100, 1);
END $$;

-- ============================================
-- Step 4: RLS（行レベルセキュリティ）の設定
-- ============================================

-- 税区分更新のためのポリシーを追加
DROP POLICY IF EXISTS "Users can update product tax categories" ON products;
CREATE POLICY "Users can update product tax categories" ON products
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Step 5: 税計算関数の更新
-- ============================================

-- 商品の税率を取得する関数
CREATE OR REPLACE FUNCTION get_product_tax_rate(p_tax_category tax_category_enum)
RETURNS DECIMAL(5,3) AS $$
BEGIN
    CASE p_tax_category
        WHEN 'standard_10' THEN RETURN 0.100;
        WHEN 'reduced_8' THEN RETURN 0.080;
        WHEN 'tax_free' THEN RETURN 0.000;
        WHEN 'tax_exempt' THEN RETURN 0.000;
        ELSE RETURN 0.100; -- デフォルト
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 商品別税計算関数
CREATE OR REPLACE FUNCTION calculate_product_tax(
    p_product_id UUID,
    p_unit_price DECIMAL,
    p_quantity INTEGER
) RETURNS TABLE(
    product_id UUID,
    tax_category tax_category_enum,
    tax_rate DECIMAL(5,3),
    subtotal_excluding_tax DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    subtotal_including_tax DECIMAL(10,2)
) AS $$
DECLARE
    v_tax_category tax_category_enum;
    v_tax_rate DECIMAL(5,3);
    v_subtotal DECIMAL(10,2);
    v_tax_amount DECIMAL(10,2);
BEGIN
    -- 商品の税区分を取得
    SELECT products.tax_category INTO v_tax_category
    FROM products
    WHERE products.id = p_product_id;

    IF v_tax_category IS NULL THEN
        v_tax_category := 'standard_10';
    END IF;

    -- 税率を取得
    v_tax_rate := get_product_tax_rate(v_tax_category);

    -- 税抜小計を計算
    v_subtotal := p_unit_price * p_quantity;

    -- 税額を計算（端数切り捨て）
    v_tax_amount := FLOOR(v_subtotal * v_tax_rate);

    RETURN QUERY SELECT
        p_product_id,
        v_tax_category,
        v_tax_rate,
        v_subtotal,
        v_tax_amount,
        v_subtotal + v_tax_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: 税区分履歴テーブルの作成（オプション）
-- ============================================

-- 税区分変更履歴を記録するテーブル
CREATE TABLE IF NOT EXISTS product_tax_category_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_tax_category tax_category_enum,
    new_tax_category tax_category_enum NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_at timestamp with time zone DEFAULT now(),
    reason TEXT,
    created_at timestamp with time zone DEFAULT now()
);

-- 履歴テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_tax_category_history_product_id
ON product_tax_category_history(product_id);

CREATE INDEX IF NOT EXISTS idx_tax_category_history_changed_at
ON product_tax_category_history(changed_at DESC);

-- 税区分変更をトリガーで履歴に記録
CREATE OR REPLACE FUNCTION record_tax_category_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 税区分が変更された場合のみ履歴を記録
    IF OLD.tax_category IS DISTINCT FROM NEW.tax_category THEN
        INSERT INTO product_tax_category_history (
            product_id,
            old_tax_category,
            new_tax_category,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            OLD.tax_category,
            NEW.tax_category,
            NEW.tax_category_updated_by,
            '管理画面から変更'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_record_tax_category_change ON products;
CREATE TRIGGER trigger_record_tax_category_change
    AFTER UPDATE ON products
    FOR EACH ROW
    WHEN (OLD.tax_category IS DISTINCT FROM NEW.tax_category)
    EXECUTE FUNCTION record_tax_category_change();

-- ============================================
-- Step 7: バリデーション関数
-- ============================================

-- 税区分の妥当性チェック関数
CREATE OR REPLACE FUNCTION validate_tax_category_setup()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    check_count INTEGER;
BEGIN
    result := E'=== 税区分設定バリデーション結果 ===\n';

    -- 1. カラム存在チェック
    SELECT COUNT(*) INTO check_count
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'tax_category';

    IF check_count = 1 THEN
        result := result || E'✅ tax_categoryカラム: 存在\n';
    ELSE
        result := result || E'❌ tax_categoryカラム: 存在しない\n';
    END IF;

    -- 2. インデックス存在チェック
    SELECT COUNT(*) INTO check_count
    FROM pg_indexes
    WHERE tablename = 'products' AND indexname = 'idx_products_tax_category';

    IF check_count = 1 THEN
        result := result || E'✅ 税区分インデックス: 存在\n';
    ELSE
        result := result || E'❌ 税区分インデックス: 存在しない\n';
    END IF;

    -- 3. 履歴テーブル存在チェック
    SELECT COUNT(*) INTO check_count
    FROM information_schema.tables
    WHERE table_name = 'product_tax_category_history';

    IF check_count = 1 THEN
        result := result || E'✅ 税区分履歴テーブル: 存在\n';
    ELSE
        result := result || E'❌ 税区分履歴テーブル: 存在しない\n';
    END IF;

    -- 4. 関数存在チェック
    SELECT COUNT(*) INTO check_count
    FROM pg_proc
    WHERE proname = 'calculate_product_tax';

    IF check_count = 1 THEN
        result := result || E'✅ 税計算関数: 存在\n';
    ELSE
        result := result || E'❌ 税計算関数: 存在しない\n';
    END IF;

    -- 5. データ整合性チェック
    SELECT COUNT(*) INTO check_count
    FROM products
    WHERE tax_category IS NULL;

    result := result || format(E'📊 税区分未設定商品: %s件\n', check_count);

    -- 6. 税区分分布
    FOR check_count IN
        SELECT
            tax_category::TEXT || ': ' || COUNT(*) || '件' as distribution
        FROM products
        GROUP BY tax_category
        ORDER BY tax_category
    LOOP
        result := result || E'📈 ' || check_count || E'\n';
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: マイグレーション完了確認
-- ============================================

-- マイグレーション結果の表示
SELECT validate_tax_category_setup();

-- マイグレーション完了ログ
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Day 3-4 Products税区分マイグレーション完了';
    RAISE NOTICE '実行日時: %', now();
    RAISE NOTICE '============================================';
END $$;

-- クリーンアップ（一時的な関数を削除）
DROP FUNCTION IF EXISTS estimate_tax_category(TEXT);