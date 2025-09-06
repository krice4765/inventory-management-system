# データベーストリガー設定手順

## 在庫反映問題の解決方法

現在、取引確定時に在庫が自動的に`/inventory`ページに反映されない問題があります。これはデータベーストリガーが設定されていないためです。

### 手順1: SQLスクリプトの実行

1. Supabaseのダッシュボードにログイン
2. SQL Editorにアクセス
3. `scripts/inventory_auto_update_trigger.sql`の内容を実行

### 手順2: スクリプトの内容確認

以下のトリガーが設定されます：

- **`auto_create_inventory_movements`関数**: 取引確定時に`inventory_movements`テーブルへ自動記録
- **`auto_create_installment_inventory_movements`関数**: 分納確定時の在庫反映
- **トリガー設定**: `transactions`テーブルのUPDATE時に自動実行

### 手順3: 動作確認

1. `/purchase-orders`または`/orders`で取引を確定
2. `/inventory`ページで在庫移動履歴を確認
3. 商品の`current_stock`が正しく更新されることを確認

## 担当者情報反映の解決

`/partners`で作成した担当者が`/purchase-orders`のフィルターに反映されない問題は既に修正済みです：

- パートナー作成/更新時に`order_managers`テーブルに自動同期
- 担当者情報がフィルタードロップダウンに表示されます

## 検索機能の改善状況

以下のページで検索機能が実装済みです：

- ✅ `/inventory`: 商品名・商品コード・メモ・移動種別で検索
- ✅ `/partners`: 取引先名・コード・担当者・連絡先・種別・ステータスで検索  
- ✅ `/orders`: 発注番号・仕入先・進捗状況で検索

すべての検索機能はリアルタイム検索、複数条件フィルター、クリア機能を備えています。