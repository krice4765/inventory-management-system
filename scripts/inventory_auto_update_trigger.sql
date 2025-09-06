-- ===============================================================
-- 在庫自動更新トリガー実装
-- 取引確定時に inventory_movements へ自動記録作成
-- ===============================================================

-- 1. 在庫移動自動作成関数
CREATE OR REPLACE FUNCTION auto_create_inventory_movements()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    movement_note TEXT;
BEGIN
    -- confirmed への変更時のみ実行
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- 取引種別に応じたメモを生成
        movement_note := CASE NEW.transaction_type
            WHEN 'purchase' THEN '仕入確定: ' || NEW.transaction_no
            WHEN 'sale' THEN '売上確定: ' || NEW.transaction_no
            ELSE '取引確定: ' || NEW.transaction_no
        END;
        
        -- 取引明細を取得して在庫移動記録を一括作成
        FOR item IN 
            SELECT 
                ti.product_id,
                ti.quantity,
                ti.unit_price,
                ti.line_total
            FROM transaction_items ti
            WHERE ti.transaction_id = NEW.id
        LOOP
            -- 在庫移動記録の作成
            INSERT INTO inventory_movements (
                product_id,
                movement_type,
                quantity,
                unit_price,
                total_amount,
                memo,
                created_at
            ) VALUES (
                item.product_id,
                CASE NEW.transaction_type
                    WHEN 'purchase' THEN 'in'    -- 仕入 → 入庫
                    WHEN 'sale' THEN 'out'       -- 売上 → 出庫
                    ELSE 'in'                     -- その他 → 入庫
                END,
                item.quantity,
                item.unit_price,
                COALESCE(item.line_total, item.quantity * item.unit_price),
                movement_note,
                NOW()
            );
            
            -- 商品の現在在庫を更新
            UPDATE products 
            SET 
                current_stock = current_stock + 
                    CASE NEW.transaction_type
                        WHEN 'purchase' THEN item.quantity    -- 仕入 → 在庫増加
                        WHEN 'sale' THEN -item.quantity       -- 売上 → 在庫減少
                        ELSE item.quantity                     -- その他 → 在庫増加
                    END,
                updated_at = NOW()
            WHERE id = item.product_id;
            
        END LOOP;
        
        RAISE NOTICE '在庫移動記録を自動作成: %', NEW.transaction_no;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. トリガーの作成
DROP TRIGGER IF EXISTS auto_inventory_update_trigger ON transactions;

CREATE TRIGGER auto_inventory_update_trigger
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_inventory_movements();

-- 3. 分納確定時の在庫更新関数（分納システム用）
CREATE OR REPLACE FUNCTION auto_create_installment_inventory_movements()
RETURNS TRIGGER AS $$
DECLARE
    parent_transaction RECORD;
    item RECORD;
    movement_note TEXT;
    installment_ratio DECIMAL;
BEGIN
    -- confirmed への変更時のみ実行
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- 親取引の情報を取得
        SELECT * INTO parent_transaction
        FROM transactions 
        WHERE id = NEW.parent_order_id;
        
        IF parent_transaction.id IS NOT NULL THEN
            -- 分納比率を計算
            installment_ratio := NEW.total_amount / parent_transaction.total_amount;
            
            movement_note := '分納確定(' || NEW.installment_no || '回目): ' || NEW.transaction_no;
            
            -- 親取引の明細に基づいて按分計算
            FOR item IN 
                SELECT 
                    ti.product_id,
                    ROUND(ti.quantity * installment_ratio) as quantity,
                    ti.unit_price
                FROM transaction_items ti
                WHERE ti.transaction_id = parent_transaction.id
            LOOP
                -- 分納分の在庫移動記録作成
                INSERT INTO inventory_movements (
                    product_id,
                    movement_type,
                    quantity,
                    unit_price,
                    total_amount,
                    memo,
                    created_at
                ) VALUES (
                    item.product_id,
                    'in',  -- 分納は基本的に入庫
                    item.quantity,
                    item.unit_price,
                    item.quantity * item.unit_price,
                    movement_note,
                    NOW()
                );
                
                -- 商品の現在在庫を更新
                UPDATE products 
                SET 
                    current_stock = current_stock + item.quantity,
                    updated_at = NOW()
                WHERE id = item.product_id;
                
            END LOOP;
            
            RAISE NOTICE '分納在庫移動記録を自動作成: %', NEW.transaction_no;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 分納用トリガーの作成
DROP TRIGGER IF EXISTS auto_installment_inventory_trigger ON transactions;

CREATE TRIGGER auto_installment_inventory_trigger
    AFTER UPDATE ON transactions
    FOR EACH ROW
    WHEN (NEW.parent_order_id IS NOT NULL)
    EXECUTE FUNCTION auto_create_installment_inventory_movements();

-- 5. 検証用クエリ
-- 実装後の動作確認用
/*
-- 確定前後の在庫数確認
SELECT 
    p.name,
    p.current_stock,
    COUNT(im.id) as movement_count
FROM products p
LEFT JOIN inventory_movements im ON p.id = im.product_id
GROUP BY p.id, p.name, p.current_stock
ORDER BY p.name;

結果
| name    | current_stock | movement_count |
| ------- | ------------- | -------------- |
| TEST商品A | 70            | 2              |
| ボルト     | 46            | 1              |


-- 最近の在庫移動記録
SELECT 
    im.created_at,
    p.name,
    im.movement_type,
    im.quantity,
    im.memo
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
ORDER BY im.created_at DESC
LIMIT 10;
*/

結果
| created_at                    | name    | movement_type | quantity | memo                |
| ----------------------------- | ------- | ------------- | -------- | ------------------- |
| 2025-09-06 06:28:12.155808+00 | ボルト     | in            | 6        |                     |
| 2025-09-05 14:57:25.038969+00 | TEST商品A | in            | 10       | 発注確定入庫: PO250905001 |
| 2025-09-05 14:51:14.623009+00 | TEST商品A | in            | 10       | 発注確定入庫: PO250905001 |


-- トリガー実装完了
RAISE NOTICE '在庫自動更新トリガーの実装が完了しました';