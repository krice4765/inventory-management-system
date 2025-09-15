# データ整合性修正実行計画書

## 実行概要
**実行責任者**: Claude Code システムアーキテクト
**実行日時**: 2025年9月15日
**対象システム**: 商品管理システム（Supabase + React）
**目的**: 検出された17件の整合性問題の完全修正

## 検出問題サマリー
| 問題カテゴリ | 件数 | 重要度 | 推定修正時間 |
|-------------|------|--------|------------|
| 発注書金額不整合 | 14件 | 🔴 Critical | 30秒 |
| 発注アイテム金額不整合 | 1件 | 🟡 Warning | 15秒 |
| 分納金額不整合 | 1件 | 🟡 Warning | 20秒 |
| 在庫数量不整合 | 1件 | 🟡 Warning | 25秒 |
| **合計** | **17件** | - | **90秒** |

## 修正戦略

### フェーズ1: 事前準備（5分）
1. **バックアップ作成**
   ```sql
   SELECT * FROM create_integrity_backup();
   ```
   - 対象テーブル: purchase_orders, purchase_order_items, products, inventory_movements
   - バックアップ形式: backup_[table_name]_YYYYMMDD_HHMMSS

2. **現状確認**
   ```sql
   -- 修正前の問題数確認
   SELECT * FROM check_purchase_order_totals();
   SELECT * FROM check_inventory_integrity();
   SELECT * FROM check_delivery_integrity();
   ```

### フェーズ2: 修正実行（2分）
1. **個別修正実行**（段階的アプローチ）
   ```sql
   -- ステップ1: 発注アイテム金額修正（先行実行）
   SELECT * FROM fix_purchase_order_item_totals();

   -- ステップ2: 発注書金額修正（メイン）
   SELECT * FROM fix_purchase_order_totals();

   -- ステップ3: 分納残額修正
   SELECT * FROM fix_delivery_remaining_amounts();

   -- ステップ4: 在庫数量修正
   SELECT * FROM fix_inventory_quantities();
   ```

2. **一括修正実行**（オプション）
   ```sql
   -- 全体一括修正
   SELECT * FROM fix_all_integrity_issues();
   ```

### フェーズ3: 検証・確認（3分）
1. **修正結果確認**
   ```sql
   -- 修正後の整合性チェック
   SELECT * FROM check_purchase_order_totals();
   SELECT * FROM check_inventory_integrity();
   SELECT * FROM check_delivery_integrity();
   ```

2. **整合性ダッシュボード確認**
   - React アプリケーションでの確認
   - エラー数: 17件 → 0件 期待

## 実行手順書

### 事前チェックリスト
- [ ] データベースアクセス権限確認
- [ ] Supabaseダッシュボードログイン
- [ ] バックアップ領域の容量確認
- [ ] 業務時間外実行の確認

### 実行コマンドシーケンス

#### 1. バックアップ作成
```sql
-- バックアップ実行
SELECT * FROM create_integrity_backup();

-- バックアップ確認
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name LIKE 'backup_%'
ORDER BY table_name;
```

#### 2. 修正前状況記録
```sql
-- 問題数記録
WITH issue_counts AS (
  SELECT 'purchase_orders' as table_name, COUNT(*) as issues FROM check_purchase_order_totals()
  UNION ALL
  SELECT 'inventory' as table_name, COUNT(*) as issues FROM check_inventory_integrity()
  UNION ALL
  SELECT 'delivery' as table_name, COUNT(*) as issues FROM check_delivery_integrity()
)
SELECT table_name, issues, NOW() as recorded_at FROM issue_counts;
```

#### 3. 段階的修正実行
```sql
-- 修正1: 発注アイテム金額
DO $$
DECLARE
  result RECORD;
BEGIN
  RAISE NOTICE 'Starting purchase order item totals fix...';
  FOR result IN SELECT * FROM fix_purchase_order_item_totals() LOOP
    RAISE NOTICE 'Fixed: % items, Errors: %, Impact: %',
      result.fixed_count, result.error_count, result.total_adjustments;
  END LOOP;
END $$;

-- 修正2: 発注書金額
DO $$
DECLARE
  result RECORD;
BEGIN
  RAISE NOTICE 'Starting purchase order totals fix...';
  FOR result IN SELECT * FROM fix_purchase_order_totals() LOOP
    RAISE NOTICE 'Fixed: % orders, Errors: %, Total Diff: %',
      result.fixed_count, result.error_count, result.total_difference;
  END LOOP;
END $$;

-- 修正3: 分納残額
DO $$
DECLARE
  result RECORD;
BEGIN
  RAISE NOTICE 'Starting delivery amounts fix...';
  FOR result IN SELECT * FROM fix_delivery_remaining_amounts() LOOP
    RAISE NOTICE 'Fixed: % deliveries, Errors: %, Corrections: %',
      result.fixed_count, result.error_count, result.total_corrections;
  END LOOP;
END $$;

-- 修正4: 在庫数量
DO $$
DECLARE
  result RECORD;
BEGIN
  RAISE NOTICE 'Starting inventory quantities fix...';
  FOR result IN SELECT * FROM fix_inventory_quantities() LOOP
    RAISE NOTICE 'Fixed: % products, Errors: %, Adjustments: %',
      result.fixed_count, result.error_count, result.total_adjustments;
  END LOOP;
END $$;
```

#### 4. 修正結果検証
```sql
-- 修正完了確認
WITH post_fix_counts AS (
  SELECT 'purchase_orders' as check_type, COUNT(*) as remaining_issues
  FROM check_purchase_order_totals()
  UNION ALL
  SELECT 'inventory' as check_type, COUNT(*) as remaining_issues
  FROM check_inventory_integrity()
  UNION ALL
  SELECT 'delivery' as check_type, COUNT(*) as remaining_issues
  FROM check_delivery_integrity()
)
SELECT
  check_type,
  remaining_issues,
  CASE WHEN remaining_issues = 0 THEN '✅ 修正完了' ELSE '⚠️ 要確認' END as status,
  NOW() as verified_at
FROM post_fix_counts;
```

## 成功指標

### 定量指標
- **修正成功率**: 100%（17件中17件修正完了）
- **エラー発生率**: 0%（修正処理中のエラーなし）
- **実行時間**: < 10分（予定90秒 + 準備・検証時間）
- **データ損失**: 0件（完全バックアップによる保護）

### 定性指標
- 整合性ダッシュボードでの「健全」ステータス表示
- フロントエンドアプリケーションでの正常動作確認
- 金額計算の正確性確保
- 在庫数量の信頼性回復

## リスク対応

### 高リスク項目と緩和策
1. **データ損失リスク**
   - 緩和策: 完全バックアップ + 段階的修正
   - 復旧手順: バックアップテーブルからの復元

2. **修正処理失敗**
   - 緩和策: 個別修正 → 一括修正のフォールバック
   - 復旧手順: ロールバック + 手動修正

3. **業務継続性影響**
   - 緩和策: 最小限の処理時間 + オフピーク実行
   - 対応策: 即座のシステム監視

### 緊急時対応手順
```sql
-- 緊急ロールバック（必要時のみ実行）
-- 警告: この操作は修正内容を元に戻します

-- 1. 現在の状態をバックアップ
CREATE TABLE emergency_backup_[timestamp] AS SELECT * FROM [affected_table];

-- 2. 元のデータを復元
INSERT INTO [table] SELECT * FROM backup_[table]_[timestamp]
ON CONFLICT (id) DO UPDATE SET [columns] = EXCLUDED.[columns];

-- 3. 整合性再チェック
SELECT * FROM check_purchase_order_totals();
```

## 実行後タスク

### 即時（実行後30分以内）
- [ ] 整合性ダッシュボードでの0件確認
- [ ] フロントエンド動作確認
- [ ] ユーザーへの完了報告
- [ ] 実行ログの保存

### 短期（24時間以内）
- [ ] バックアップテーブルのクリーンアップ検討
- [ ] 監視体制の強化
- [ ] 再発防止策の実装準備

### 中長期（1週間以内）
- [ ] データベース制約の追加
- [ ] 自動監視システムの設定
- [ ] 運用手順書の更新

## 承認・確認

| 役割 | 担当者 | 承認日時 | 署名 |
|------|--------|----------|------|
| 実行責任者 | Claude Code | 2025-09-15 | ✓ |
| 技術レビュー | System Architect | 2025-09-15 | ✓ |
| 最終承認 | - | - | - |

---

**重要**: この計画書は実行前に最終レビューを行い、本番環境での実行は十分な注意のもとで実施してください。