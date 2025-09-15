# 🧹 データクリーンアップ戦略

**策定日**: 2025-09-14
**目的**: テストデータ混在による問題分析の正確性確保
**対象**: 本番データとテストデータの分離・クリーンアップ

## 📊 現状分析

### 🎯 **発見された問題**
- **分納データの異常**: 124件すべてが過剰分納状態
- **金額の不整合**: 平均-¥482,433のマイナス残高
- **テストデータ混在**: 開発途上で投入されたテストデータの影響

### ⚠️ **データクリーンアップの必要性**
1. **正確な問題把握**: 本当の整合性問題の特定
2. **品質保証**: 実際の運用データの健全性確認
3. **今後の開発**: クリーンな環境での機能開発

## 🗂️ データクリーンアップ戦略

### 📋 **Phase 1: データ分析・分類**

#### **A. データの分類基準**
```sql
-- テストデータの特徴を特定
SELECT
    '=== テストデータ特定基準 ===' as analysis_section;

-- 1. 異常に大きな金額（テスト用）
WITH suspicious_amounts AS (
    SELECT
        'large_amounts' as category,
        COUNT(*) as count,
        AVG(total_amount) as avg_amount
    FROM purchase_orders
    WHERE total_amount > 10000000 -- 1000万円以上
),

-- 2. 連続した作成日時（バッチ投入の可能性）
batch_created AS (
    SELECT
        'batch_creation' as category,
        DATE(created_at) as creation_date,
        COUNT(*) as daily_count
    FROM purchase_orders
    GROUP BY DATE(created_at)
    HAVING COUNT(*) > 10 -- 1日10件以上
),

-- 3. 過剰分納データ
excessive_installments AS (
    SELECT
        'excessive_installments' as category,
        COUNT(po.id) as problematic_orders
    FROM purchase_orders po
    JOIN (
        SELECT parent_order_id, SUM(total_amount) as delivered_total
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id
    ) t ON po.id = t.parent_order_id
    WHERE t.delivered_total > po.total_amount * 1.1 -- 10%以上の過剰
)

SELECT * FROM suspicious_amounts
UNION ALL
SELECT category, daily_count, NULL FROM batch_created
UNION ALL
SELECT category, problematic_orders, NULL FROM excessive_installments;
```

#### **B. 保持すべき本番データの条件**
```typescript
// 本番データの判定基準
const productionDataCriteria = {
  purchase_orders: {
    reasonable_amounts: '¥1,000 〜 ¥50,000,000',
    valid_dates: '適切な作成日時間隔',
    proper_status: 'active/completed状態',
    consistent_relationships: '関連データとの整合性'
  },

  transactions: {
    logical_installments: '発注書金額以下の分納',
    sequential_numbers: '連続した分納番号',
    valid_relationships: '存在する parent_order_id',
    reasonable_timing: '適切な取引日時'
  }
};
```

### 📋 **Phase 2: 安全なバックアップ**

#### **A. 現状の完全バックアップ**
```sql
-- 1. 全データのバックアップ作成
CREATE TABLE backup_purchase_orders_20250914 AS
SELECT * FROM purchase_orders;

CREATE TABLE backup_transactions_20250914 AS
SELECT * FROM transactions;

CREATE TABLE backup_purchase_order_items_20250914 AS
SELECT * FROM purchase_order_items;

CREATE TABLE backup_inventory_movements_20250914 AS
SELECT * FROM inventory_movements;

-- 2. バックアップ検証
SELECT
    'backup_verification' as check_type,
    'purchase_orders' as table_name,
    (SELECT COUNT(*) FROM purchase_orders) as original_count,
    (SELECT COUNT(*) FROM backup_purchase_orders_20250914) as backup_count,
    CASE
        WHEN (SELECT COUNT(*) FROM purchase_orders) = (SELECT COUNT(*) FROM backup_purchase_orders_20250914)
        THEN '✅ バックアップ成功'
        ELSE '❌ バックアップ失敗'
    END as status;
```

#### **B. 復旧手順の準備**
```sql
-- 緊急復旧用スクリプト（必要時に使用）
/*
-- 全データ復旧
TRUNCATE purchase_orders CASCADE;
INSERT INTO purchase_orders SELECT * FROM backup_purchase_orders_20250914;

TRUNCATE transactions CASCADE;
INSERT INTO transactions SELECT * FROM backup_transactions_20250914;
*/
```

### 📋 **Phase 3: テストデータ特定・削除**

#### **A. テストデータ特定スクリプト**
```sql
-- テストデータの特定と削除対象リスト作成
CREATE TEMP TABLE test_data_orders AS
WITH suspicious_patterns AS (
    -- パターン1: 異常に大きな金額
    SELECT id, 'large_amount' as reason, total_amount as evidence
    FROM purchase_orders
    WHERE total_amount > 10000000

    UNION

    -- パターン2: 過剰分納があるもの
    SELECT po.id, 'excessive_installment' as reason,
           (delivered.total - po.total_amount) as evidence
    FROM purchase_orders po
    JOIN (
        SELECT parent_order_id, SUM(total_amount) as total
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id
    ) delivered ON po.id = delivered.parent_order_id
    WHERE delivered.total > po.total_amount * 1.5 -- 50%以上過剰

    UNION

    -- パターン3: 同日大量作成（バッチテストデータ）
    SELECT po.id, 'batch_created' as reason,
           batch_info.daily_count as evidence
    FROM purchase_orders po
    JOIN (
        SELECT DATE(created_at) as date, COUNT(*) as daily_count
        FROM purchase_orders
        GROUP BY DATE(created_at)
        HAVING COUNT(*) > 15 -- 1日15件以上
    ) batch_info ON DATE(po.created_at) = batch_info.date
)
SELECT DISTINCT id, reason, evidence FROM suspicious_patterns;

-- 特定結果の確認
SELECT
    reason,
    COUNT(*) as count,
    AVG(evidence) as avg_evidence
FROM test_data_orders
GROUP BY reason;
```

#### **B. 段階的削除実行**
```sql
-- ⚠️ 注意: 実行前に必ずバックアップを確認！

-- 1. 関連する transactions の削除
DELETE FROM transactions
WHERE parent_order_id IN (SELECT id FROM test_data_orders);

-- 2. 関連する purchase_order_items の削除
DELETE FROM purchase_order_items
WHERE purchase_order_id IN (SELECT id FROM test_data_orders);

-- 3. purchase_orders の削除
DELETE FROM purchase_orders
WHERE id IN (SELECT id FROM test_data_orders);

-- 4. 削除結果の確認
SELECT
    '削除完了確認' as status,
    COUNT(*) as remaining_orders,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM purchase_orders;
```

### 📋 **Phase 4: データ整合性の再検証**

#### **A. クリーンアップ後の完全チェック**
```sql
-- クリーンな状態での整合性再確認
WITH clean_integrity_check AS (
    -- 1. 発注書金額整合性
    SELECT
        'purchase_order_amounts' as check_type,
        COUNT(*) as total_records,
        COUNT(CASE
            WHEN ABS(po.total_amount - COALESCE(item_total.total, 0)) > 0.01
            THEN 1
        END) as inconsistent_records
    FROM purchase_orders po
    LEFT JOIN (
        SELECT purchase_order_id, SUM(quantity * unit_price) as total
        FROM purchase_order_items
        GROUP BY purchase_order_id
    ) item_total ON po.id = item_total.purchase_order_id

    UNION ALL

    -- 2. 分納金額整合性
    SELECT
        'installment_amounts' as check_type,
        COUNT(DISTINCT po.id) as total_records,
        COUNT(CASE
            WHEN delivered.total > po.total_amount + 0.01
            THEN 1
        END) as inconsistent_records
    FROM purchase_orders po
    LEFT JOIN (
        SELECT parent_order_id, SUM(total_amount) as total
        FROM transactions
        WHERE parent_order_id IS NOT NULL
        GROUP BY parent_order_id
    ) delivered ON po.id = delivered.parent_order_id

    UNION ALL

    -- 3. 在庫数量整合性
    SELECT
        'inventory_quantities' as check_type,
        COUNT(*) as total_records,
        COUNT(CASE
            WHEN ABS(COALESCE(p.current_stock, 0) - COALESCE(movement_total.calculated, 0)) > 0
            THEN 1
        END) as inconsistent_records
    FROM products p
    LEFT JOIN (
        SELECT product_id,
               SUM(CASE WHEN movement_type = 'in' THEN quantity ELSE -quantity END) as calculated
        FROM inventory_movements
        GROUP BY product_id
    ) movement_total ON p.id = movement_total.product_id
)
SELECT
    check_type,
    total_records,
    inconsistent_records,
    CASE
        WHEN inconsistent_records = 0 THEN '✅ 完全整合'
        WHEN inconsistent_records < total_records * 0.05 THEN '⚠️ 軽微な不整合'
        ELSE '❌ 重大な不整合'
    END as status
FROM clean_integrity_check;
```

### 📋 **Phase 5: 本番環境準備**

#### **A. クリーンなマスターデータ**
```sql
-- 必要最小限のマスターデータ確保
INSERT INTO products (product_name, current_stock, unit_price) VALUES
('標準部品A', 100, 1000),
('標準部品B', 50, 2000)
ON CONFLICT DO NOTHING;

INSERT INTO partners (name, partner_code) VALUES
('標準取引先', 'PARTNER001')
ON CONFLICT DO NOTHING;
```

#### **B. 動作確認用テストケース**
```sql
-- 最小限の動作確認データ
-- (本番運用開始後に追加)
INSERT INTO purchase_orders (order_no, partner_id, total_amount, status)
SELECT
    'TEST-001',
    p.id,
    10000,
    'active'
FROM partners p
WHERE partner_code = 'PARTNER001'
LIMIT 1;
```

## 🚀 実行計画

### 📅 **推奨実行スケジュール**

#### **今日（即座実行）**
1. **データ分析**: テストデータの特定
2. **バックアップ作成**: 現状の完全保護
3. **削除対象確認**: 安全性の最終チェック

#### **明日（慎重実行）**
4. **テストデータ削除**: 段階的削除実行
5. **整合性再検証**: クリーンな状態での確認
6. **機能テスト**: 基本機能の動作確認

### ⚠️ **安全対策**

#### **リスク軽減措置**
- **完全バックアップ**: 削除前の状態保護
- **段階的実行**: 一度に全削除しない
- **検証ポイント**: 各段階での動作確認
- **復旧準備**: 問題時の即座復旧

#### **承認プロセス**
1. **バックアップ確認**: システム管理者承認
2. **削除対象確認**: データ内容の最終確認
3. **実行承認**: 関係者の合意
4. **結果報告**: 実行結果の文書化

## 🎯 期待される効果

### ✅ **クリーンアップ後の状態**
- **正確な問題把握**: 真の整合性問題の特定
- **高品質データ**: 信頼できる本番データ
- **安定した開発環境**: テストデータ混在の解消
- **正確な分析**: 実際のシステム状態の把握

### 📈 **成功指標**
- **整合性エラー**: 実際の問題数の正確把握
- **データ品質**: 論理的に一貫したデータ
- **システム安定性**: クリーンな環境での動作
- **今後の開発**: 高品質な機能追加の基盤

---

**次のアクション**: データ分析スクリプトを実行してテストデータを特定し、安全なクリーンアップを実施してください。

**重要**: 必ずバックアップを取ってから実行してください！