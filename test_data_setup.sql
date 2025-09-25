-- 出庫管理システム テストデータ作成
-- データベーススキーマ実装後に実行

-- 1. テスト用商品データの準備（既存商品があれば不要）
DO $$
DECLARE
    test_product_id UUID;
    test_supplier_id INTEGER := 1;
BEGIN
    -- テスト商品の存在確認
    SELECT id INTO test_product_id
    FROM products
    WHERE product_code = 'TEST-001'
    LIMIT 1;

    -- テスト商品が存在しない場合は作成
    IF test_product_id IS NULL THEN
        INSERT INTO products (
            product_code,
            product_name,
            description,
            category,
            selling_price,
            cost_price,
            main_supplier_id,
            tax_category,
            weight_kg,
            is_active
        ) VALUES (
            'TEST-001',
            'テスト商品A',
            '出庫テスト用の商品',
            'テスト',
            3000.00,
            2000.00,
            test_supplier_id,
            'standard_10',
            1.5,
            true
        ) RETURNING id INTO test_product_id;

        RAISE NOTICE '✅ テスト商品を作成しました: %', test_product_id;
    ELSE
        RAISE NOTICE '✅ テスト商品が既に存在します: %', test_product_id;
    END IF;

    -- 在庫データの準備
    INSERT INTO inventory (product_id, current_stock, reserved_quantity, updated_at)
    VALUES (test_product_id, 100, 0, NOW())
    ON CONFLICT (product_id)
    DO UPDATE SET
        current_stock = GREATEST(inventory.current_stock, 100),
        updated_at = NOW();

    -- FIFO層データの準備（入庫履歴）
    INSERT INTO inventory_fifo_layers (
        product_id,
        purchase_date,
        unit_cost_tax_excluded,
        unit_cost_tax_included,
        tax_rate,
        original_quantity,
        remaining_quantity
    ) VALUES
    (test_product_id, CURRENT_DATE - INTERVAL '30 days', 2000.00, 2200.00, 0.10, 50, 50),
    (test_product_id, CURRENT_DATE - INTERVAL '15 days', 2100.00, 2310.00, 0.10, 30, 30),
    (test_product_id, CURRENT_DATE - INTERVAL '5 days', 2050.00, 2255.00, 0.10, 20, 20)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ テスト用在庫・FIFO層データを準備しました';
END $$;

-- 2. テスト用ユーザー権限確認・設定
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    -- 現在のユーザーIDを取得
    SELECT auth.uid() INTO current_user_id;

    IF current_user_id IS NOT NULL THEN
        -- 在庫管理権限を付与
        UPDATE profiles
        SET
            can_manage_inventory = true,
            can_manage_orders = true,
            role = COALESCE(role, 'admin')
        WHERE id = current_user_id;

        RAISE NOTICE '✅ 現在のユーザーに出庫管理権限を付与しました: %', current_user_id;
    ELSE
        RAISE NOTICE '⚠️ 認証されたユーザーが見つかりません';
    END IF;
END $$;

-- 3. 税表示設定のデフォルト作成
INSERT INTO tax_display_settings (
    organization_id,
    user_id,
    setting_type,
    tax_display_preference
) VALUES
(NULL, NULL, 'organization', 'tax_included')
ON CONFLICT DO NOTHING;

-- 4. テストデータ確認クエリ
SELECT
    'テストデータ確認' as check_type,
    'products' as table_name,
    COUNT(*) as record_count
FROM products
WHERE product_code LIKE 'TEST-%'

UNION ALL

SELECT
    'テストデータ確認',
    'inventory',
    COUNT(*)
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.product_code LIKE 'TEST-%'

UNION ALL

SELECT
    'テストデータ確認',
    'inventory_fifo_layers',
    COUNT(*)
FROM inventory_fifo_layers ifl
JOIN products p ON ifl.product_id = p.id
WHERE p.product_code LIKE 'TEST-%'

UNION ALL

SELECT
    'テストデータ確認',
    'profiles_permissions',
    COUNT(*)
FROM profiles
WHERE can_manage_inventory = true;