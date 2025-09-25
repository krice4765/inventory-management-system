# Day 3 機能有効化のためのデータベーススキーマ更新手順

## 🎯 概要
Day 3 で実装した以下の機能を有効化するために、Supabaseデータベースのスキーマ更新が必要です：

- 担当者管理システム (assigned_user_id)
- 送料計算システム (shipping_cost, shipping_tax_rate)
- 納期管理 (delivery_deadline)
- 商品重量管理 (weight_kg)
- 税表示設定システム
- 送料設定管理システム

## 🔧 実行手順

### 1. Supabase Dashboard へのアクセス
1. https://supabase.com/dashboard/projects にアクセス
2. プロジェクト `tleequspizctgoosostd` を選択
3. サイドバーから「SQL Editor」を選択

### 2. スキーマ更新SQLの実行
1. SQL Editor で新しいクエリを作成
2. `apply_day3_schema_updates.sql` ファイルの内容を貼り付け
3. 「Run」ボタンをクリックして実行

### 3. 更新内容の確認
以下のSQL文で更新が正しく適用されたかを確認：

```sql
-- 1. purchase_ordersテーブルの列確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
    AND table_schema = 'public'
    AND column_name IN ('assigned_user_id', 'shipping_cost', 'shipping_tax_rate', 'delivery_deadline')
ORDER BY column_name;

-- 2. 新しいテーブルの存在確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('tax_display_settings', 'shipping_cost_settings');

-- 3. 関数の存在確認
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'get_tax_display_preference';
```

## ✅ 期待される結果

### purchase_ordersテーブルに追加される列：
- `assigned_user_id` (UUID, NULL可能, profiles(id)への外部キー)
- `shipping_cost` (INTEGER, デフォルト: 0)
- `shipping_tax_rate` (DECIMAL(5,4), デフォルト: 0.1000)
- `delivery_deadline` (DATE, NULL可能)

### productsテーブルに追加される列：
- `tax_category` (VARCHAR(20), デフォルト: 'standard_10')
- `weight_kg` (INTEGER, NULL可能)

### 新しく作成されるテーブル：
- `tax_display_settings` - 税表示設定管理
- `shipping_cost_settings` - 送料設定管理

### 新しく作成される関数：
- `get_tax_display_preference(UUID)` - ユーザーの税表示設定取得

## 🚨 注意事項

1. **バックアップの推奨**: 重要なデータがある場合は、事前にバックアップを作成してください
2. **段階的実行**: エラーが発生した場合は、SQLを段階的に実行してください
3. **権限設定**: Row Level Security (RLS) ポリシーが自動的に設定されます

## 🔍 トラブルシューティング

### よくあるエラーとその対処法：

#### エラー: "column already exists"
- **原因**: 列が既に存在している
- **対処**: 正常な状態です。処理を続行してください

#### エラー: "relation does not exist"
- **原因**: 参照するテーブルが存在しない
- **対処**: profiles テーブルが存在するか確認してください

#### エラー: "permission denied"
- **原因**: 実行権限不足
- **対処**: Supabase Dashboard の所有者権限で実行してください

## 📞 サポート

更新で問題が発生した場合：
1. エラーメッセージの全文を記録
2. `check_current_schema.sql` を実行して現在の状態を確認
3. 段階的な手動更新を検討

## ✨ 更新完了後の確認事項

スキーマ更新完了後、以下の機能が正常に動作することを確認：

1. **発注画面**: 担当者選択機能
2. **送料設定**: 自動送料計算
3. **注文一覧**: 統一ステータス表示
4. **詳細表示**: 担当者情報と商品明細
5. **税計算**: 8%/10% 混合税率計算

更新が正常に完了すると、コンソールエラーが解消され、Day 3 の全機能が利用可能になります。