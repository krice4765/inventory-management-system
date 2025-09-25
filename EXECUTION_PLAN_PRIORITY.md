# データベーステーブル作成 実行計画

## 現在の状況
- ✅ **存在するテーブル**: products, purchase_orders, partners, user_profiles
- ❌ **不足しているテーブル**: inventory, orders, outbound_orders, outbound_order_items

## 優先度順実行計画

### 🔥 **優先度1（緊急）**: 基幹テーブル作成
**ファイル**: `create_core_tables_priority1.sql`

**作成されるテーブル**:
- `orders` - 注文管理（発注情報）
- `order_items` - 注文明細
- `inventory` - 在庫管理
- `inventory_movements` - 在庫移動履歴

**理由**: アプリケーションの核となる機能（Orders.tsx, Inventory.tsx）が動作するために必須

**実行方法**: Supabaseダッシュボード → SQL Editor → 全コピー＆実行

---

### 🟡 **優先度2**: 出庫管理テーブル作成
**ファイル**: `create_outbound_orders_direct.sql`

**作成されるテーブル**:
- `outbound_orders` - 出庫管理
- `outbound_order_items` - 出庫明細

**理由**: OutboundOrdersタブの詳細ボタン機能修正に必要

---

### 🟢 **優先度3**: 拡張機能テーブル
**既存ファイル**:
- `new_tables_creation.sql` - FIFO計算層、税表示設定
- `schema_complete_implementation.sql` - テーブル拡張

## 実行後の確認方法

### 1. テーブル作成確認
```sql
-- check_all_project_tables.sql を実行して確認
```

### 2. アプリケーション動作確認
- `http://localhost:5173/` → Orders.tsx ページ
- `http://localhost:5173/` → Inventory.tsx ページ
- `http://localhost:5173/` → OutboundOrders.tsx（詳細ボタン）

## 推奨実行順序

1. **今すぐ実行**: `create_core_tables_priority1.sql`
2. **確認**: `check_all_project_tables.sql`
3. **アプリ確認**: Orders.tsx, Inventory.tsx の動作
4. **次に実行**: `create_outbound_orders_direct.sql`
5. **最終確認**: 詳細ボタンの動作

## リスク軽減措置
- 全SQLは `IF NOT EXISTS` で既存テーブル保護
- RLS設定により権限管理
- サンプルデータ付きで即座に動作確認可能