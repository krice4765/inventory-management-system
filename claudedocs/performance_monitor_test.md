# パフォーマンス監視システム テスト手順

## 概要
パフォーマンス監視システムが正常に動作することを確認するためのテスト手順です。

## 開発サーバーでのテスト

### 1. 開発サーバーアクセス
- URL: http://localhost:5175
- 開発者ツールのコンソールを開いてください

### 2. パフォーマンス監視システムの確認

#### 基本的な監視機能のテスト
```javascript
// 1. パフォーマンス監視オブジェクトが利用可能か確認
window.performanceMonitor

// 2. 現在の統計情報を表示
window.performanceMonitor.logPerformanceStats()

// 3. 手動でテストメトリクスを追加
window.performanceMonitor.trackQuery('テストクエリ', 750, false)
window.performanceMonitor.trackRender('テストコンポーネント', 25, false)
window.performanceMonitor.trackAPI('テストAPI', 1200)

// 4. 統計情報を再確認（追加されたメトリクスを含む）
window.performanceMonitor.logPerformanceStats()
```

#### 最適化済み処理のテスト
```javascript
// 最適化済みクエリのテスト
window.performanceMonitor.trackQuery('最適化クエリ', 200, true)
window.performanceMonitor.trackRender('最適化コンポーネント', 8, true)

// 結果確認
window.performanceMonitor.logPerformanceStats()
```

#### メトリクスクリア
```javascript
// 全てのメトリクスをクリア
window.performanceMonitor.clearMetrics()

// クリア後の確認
window.performanceMonitor.logPerformanceStats()
```

### 3. 実際のアプリケーション機能でのテスト

#### 商品データ取得時の監視
1. ブラウザで「商品管理」ページにアクセス
2. 開発者ツールのコンソールで以下を確認：
   ```javascript
   // 商品データ取得後に統計を表示
   window.performanceMonitor.logPerformanceStats()
   ```
3. `getProducts` クエリが記録されていることを確認

#### 他のページでの監視テスト
- 在庫管理ページにアクセス
- 受注管理ページにアクセス
- それぞれのページでパフォーマンス統計を確認

## 期待される結果

### 正常な場合の出力例
```
📊 パフォーマンス統計 (過去5分)
🔍 クエリ: {総数: 3, 低速: 1, 最適化済: 1, 平均時間: "456.7ms"}
🎨 レンダリング: {総数: 2, 低速: 1, 最適化済: 1, 平均時間: "16.5ms"}
🌐 API: {総数: 1, 低速: 1, 平均時間: "1200.0ms"}
```

### 閾値について
- **クエリ**: 500ms以上で低速警告
- **レンダリング**: 16ms以上で低速警告
- **API**: 1000ms以上で低速警告

### アラート例
- `🐌 低速クエリ検出: テストクエリ - 750.0ms (閾値: 500ms)`
- `⚡ クエリ最適化効果: 最適化クエリ - 200.0ms`
- `🔄 低速レンダリング検出: テストコンポーネント - 25.0ms (閾値: 16ms)`

## トラブルシューティング

### パフォーマンス監視が利用できない場合
1. `window.performanceMonitor` が `undefined` の場合は、ページを再読み込み
2. エラーが表示される場合は、コンソールエラーを確認
3. 開発サーバーが正常に起動していることを確認

### メトリクスが記録されない場合
1. 実際にアプリケーション機能を使用してAPIコールを発生させる
2. performanceMonitor.trackQuery() が呼び出されているか確認
3. インポートが正しく行われているか確認

## 本番環境での注意事項
- パフォーマンス監視は開発・ステージング環境での使用を想定
- 本番環境では必要に応じてログレベルを調整
- メトリクス蓄積によるメモリ使用量に注意

## 分析可能な項目
- データベースクエリの実行時間
- コンポーネントレンダリング時間
- API呼び出し時間
- 最適化効果の測定
- 時系列でのパフォーマンス変化