# 🗺️ Week2移行 - 次フェーズ実装ロードマップ
**対象期間**: Week2 (Day7-Day13)
**基準日**: 2025年9月22日
**戦略**: Route A継続 - 段階的着実実装

## 🎯 Phase B実装計画 (Week2 Foundation)

### 📅 Phase B-1: 出庫管理MVP実装 (推定4時間)
**優先度**: 🔴 HIGH - Week2の基盤機能

#### 実装範囲
```typescript
// 新規作成予定ファイル
src/pages/OutboundOrders.tsx          // 出庫管理メインページ
src/components/modals/OutboundModal.tsx  // 出庫指示書作成
src/hooks/useOutboundManagement.ts    // 出庫管理ロジック
```

#### 具体的タスク
1. **出庫指示書作成UI**
   - 商品選択・数量入力
   - 出庫先・配送方法選択
   - 出庫予定日設定

2. **在庫減算ロジック**
   - FIFO (先入先出) 方式実装
   - 在庫不足チェック
   - ロールバック機能

3. **出庫履歴管理**
   - 出庫実績記録
   - ステータス管理（予定→実行→完了）
   - 履歴表示・検索機能

### 📅 Phase B-2: データベーステーブル検証 (推定2時間)
**優先度**: 🟡 MEDIUM - 基盤整備

#### 検証対象
```sql
-- 0922Youken.mdで要求される全テーブル存在確認
outbound_orders              -- 出庫指示
outbound_items              -- 出庫明細
inventory_movements         -- 在庫移動履歴
shipping_cost_settings      -- 送料設定 (実装済み)
tax_display_settings        -- 税表示設定 (実装済み)
```

#### 作業内容
1. **テーブル存在確認**
   - SQLクエリによる全テーブル検証
   - 不足テーブル特定

2. **スキーマ作成**
   - 不足テーブルのCREATE文作成
   - インデックス・制約設定

3. **RLS policies設定**
   - 行レベルセキュリティ適用
   - 権限管理設定

### 📅 Phase B-3: 未確定バッジ除去 (推定1時間)
**優先度**: 🟢 LOW - UI改善

#### 対象箇所
```typescript
// 「未確定」表示の除去対象
src/pages/Orders.tsx          // 発注一覧の未確定バッジ
src/pages/Inventory.tsx       // 在庫管理の未確定状態
src/components/**/*.tsx       // 各コンポーネントの未確定表示
```

## 🔄 実装フロー

### Day7-8: 出庫管理MVP
```mermaid
Day7: 出庫UI実装 → Day8: 在庫連動ロジック
```

### Day9-10: データベース整備
```mermaid
Day9: テーブル検証 → Day10: 不足分作成
```

### Day11: UI改善
```mermaid
Day11: 未確定バッジ除去
```

### Day12-13: 統合テスト
```mermaid
Day12-13: 全機能統合テスト・バグ修正
```

## 📋 事前準備チェックリスト

### ✅ 完了済み基盤
- [x] 商品マスター税区分設定
- [x] 送料設定システム
- [x] 担当者管理システム
- [x] 発注管理システム
- [x] 在庫管理基盤

### 🔄 Phase B必要準備
- [ ] 出庫テーブル設計確認
- [ ] FIFO在庫ロジック設計
- [ ] 出庫UI/UXデザイン検討
- [ ] データベースバックアップ

## 🚨 注意事項・リスク

### データ整合性リスク
- **在庫減算処理**: トランザクション管理必須
- **FIFO実装**: 複雑なロジックのため段階的実装推奨
- **ロールバック**: エラー時の復旧機能必須

### パフォーマンス考慮
- **大量データ処理**: ページネーション実装
- **リアルタイム更新**: WebSocket検討
- **データベース負荷**: インデックス最適化

## 🎯 Week2成功指標

### 機能完成度
- 出庫管理基本機能: 80%以上
- データベース整備: 100%
- UI改善: 90%以上

### 品質基準
- TypeScript準拠: 100%
- コンソールエラー: 0件
- テストカバレッジ: 70%以上

## 📞 開発再開時アクション

### 1. 環境確認
```bash
git status && git branch
npm run dev
# http://localhost:5174/ 確認
```

### 2. 実装開始
```typescript
// Phase B-1開始推奨
// 1. src/pages/OutboundOrders.tsx作成
// 2. 出庫指示書UI実装
// 3. useOutboundManagement.ts作成
```

### 3. 進捗管理
- TodoWrite活用でタスク管理
- 段階的コミット推奨
- 定期的な動作確認

---
**🚀 Week1完全達成の勢いでWeek2も確実な実装を目指しましょう！**