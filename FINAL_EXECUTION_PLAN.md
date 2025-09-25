# 📋 最終実行計画：実装テーブル調査結果に基づく

## 🔍 調査結果サマリー

### **✅ 既存テーブル（確認済み）**
- **products** (46回使用) - 商品管理の核 ⭐⭐⭐⭐⭐
- **purchase_orders** (30回使用) - 発注管理の核 ⭐⭐⭐⭐⭐
- **partners** (16回使用) - 取引先管理 ⭐⭐⭐⭐☆
- **user_profiles** (19回使用) - ユーザー管理 ⭐⭐⭐⭐☆

### **❌ 不足テーブル（影響度大）**
- **transactions** (43回使用) - 取引管理の核 ⭐⭐⭐⭐⭐
- **inventory_movements** (18回使用) - 在庫管理の核 ⭐⭐⭐⭐⭐
- **orders** - 注文管理（推測）⭐⭐⭐⭐☆
- **inventory** - 在庫テーブル（推測）⭐⭐⭐⭐☆
- **outbound_orders** - 出庫管理 ⭐⭐⭐☆☆

## 🎯 修正された優先度順実行計画

### **🔥 最優先レベル1（システム停止リスク）**

**1. transactions & transaction_items テーブル作成**
- **影響**: 43回使用、取引管理の核心
- **修正必要**: `create_core_tables_priority1.sql`にtransactionsテーブル追加

**2. inventory_movements テーブル作成**
- **影響**: 18回使用、在庫管理の核心
- **ファイル**: `create_core_tables_priority1.sql`（既に含まれている）

### **⚡ 優先レベル2（主要機能停止）**

**3. orders & order_items テーブル作成**
- **影響**: 注文管理機能
- **ファイル**: `create_core_tables_priority1.sql`（既に含まれている）

**4. inventory テーブル作成**
- **影響**: 在庫状況表示
- **ファイル**: `create_core_tables_priority1.sql`（既に含まれている）

### **🟡 優先レベル3（特定機能）**

**5. outbound_orders & outbound_order_items テーブル作成**
- **影響**: 詳細ボタン機能
- **ファイル**: `create_outbound_orders_direct.sql`

## 📝 実行手順

### **Step 1**: 最優先テーブル作成スクリプト修正

```sql
-- create_core_tables_priority1_updated.sql に以下を追加:

-- =====================================================
-- transactions テーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_no VARCHAR(50) UNIQUE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('purchase', 'sale', 'adjustment')),
    partner_id UUID REFERENCES partners(id),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),

    -- 分納対応
    parent_order_id UUID,
    installment_number INTEGER DEFAULT 1,

    -- 金額
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- メタデータ
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- transaction_items テーブル作成
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **Step 2**: 実行順序

1. **今すぐ実行**: 修正された`create_core_tables_priority1.sql`
2. **確認**: `check_all_implemented_tables.sql`
3. **アプリ確認**: transactions, inventory_movements動作確認
4. **次**: `create_outbound_orders_direct.sql`

### **Step 3**: 確認項目

```sql
-- 実行後の確認クエリ
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name)
         THEN '✅ 作成済み' ELSE '❌ 未作成' END as status
FROM (VALUES
    ('transactions'), ('transaction_items'),
    ('orders'), ('order_items'),
    ('inventory'), ('inventory_movements'),
    ('outbound_orders'), ('outbound_order_items')
) as t(table_name);
```

## ⚠️ 重要な修正点

**1. transactionsテーブルが最重要**
- 43回使用されているにも関わらず、初期スクリプトに含まれていなかった
- 分納機能の核心テーブル

**2. inventory_movementsテーブルは既に対応済み**
- `create_core_tables_priority1.sql`に含まれている

**3. 実際のテーブル構造は分納機能重視**
- `parent_order_id`や`installment_number`などの分納対応フィールドが必要

## 🎯 次のアクション

**今すぐ実行すべき**: `transactionsテーブル`を追加した修正版スクリプトの作成と実行

これにより、システムの43回使用されている核心機能が復旧します。