# 🏭 分納管理システム 運用マニュアル

**対象**: システム管理者・運用担当者  
**バージョン**: 2.0 (本格運用版)  
**最終更新**: 2025年9月5日  
**システム**: SuperClaude Framework 多層防御システム

## 🎯 運用目的
- システムの継続的監視・保守
- 障害時の迅速な対応・復旧
- データ品質・整合性の保証
- サービスレベル目標の達成

## 📋 目次

1. [システム概要](#システム概要)
2. [日次運用手順](#日次運用手順)
3. [週次・月次運用](#週次・月次運用)
4. [緊急時対応手順](#緊急時対応手順)
5. [障害対応ガイド](#障害対応ガイド)
6. [保守・メンテナンス](#保守・メンテナンス)
7. [監視項目・しきい値](#監視項目・しきい値)
8. [連絡体制・エスカレーション](#連絡体制・エスカレーション)

---

## 🏗️ システム概要

### アーキテクチャ
- **フロントエンド**: React 18 + TypeScript + Vite
- **バックエンド**: Supabase PostgreSQL + RLS
- **認証**: Supabase Auth
- **監視**: 自動メトリクス収集 + ダッシュボード

### 主要機能
- **分納管理**: 発注に対する分割支払い管理
- **担当者管理**: 統一マスタによる担当者権限制御  
- **エラー防御**: P0001等のビジネスルール強制実行
- **自動監視**: リアルタイム健康度チェック

### セキュリティ
- **RLS (Row Level Security)**: 全テーブルでアクセス制御
- **SECURITY DEFINER**: 権限昇格による安全な操作
- **トリガー防御**: データ整合性の物理レベル保証

---

## 📅 日次運用手順

### 🌅 朝の確認作業 (9:00-9:15)

#### 1. システムヘルスチェック実行
```sql
-- Supabase Dashboard > SQL Editor で実行
\i daily_health_check.sql
```

**確認ポイント:**
- ✅ 総合健康度スコア: 85点以上
- ✅ データ整合性: エラー0件
- ✅ API応答時間: 500ms以下
- ✅ P0001エラー: 正常にブロック機能している

#### 2. 前日の運用状況確認
```sql
-- 前日作成された分納の確認
SELECT 
    COUNT(*) as created_installments,
    SUM(amount) as total_amount,
    COUNT(DISTINCT order_id) as unique_orders
FROM installments 
WHERE created_at::date = CURRENT_DATE - 1;

-- エラー発生状況
SELECT * FROM analyze_error_trends(1);
```

#### 3. アラート・異常確認
- **ヘルスダッシュボード**: システムアラート数
- **エラーログ**: P0001以外のエラー発生
- **パフォーマンス**: 応答時間の異常

### 🌆 夕方の確認作業 (17:00-17:10)

#### 1. 本日の業務サマリー
```sql
-- 本日の分納作成状況
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM installments 
WHERE created_at::date = CURRENT_DATE
GROUP BY status;
```

#### 2. データバックアップ確認
- Supabaseの自動バックアップ状況確認
- 重要データの整合性最終チェック

#### 3. 翌日の準備
- システムリソース使用量確認
- 予定メンテナンス作業の再確認

---

## 📊 週次・月次運用

### 📅 週次作業 (毎週月曜日 10:00)

#### 1. 包括的システム分析
```sql
-- 週次パフォーマンスレポート
SELECT * FROM monitor_rpc_performance();

-- 週次エラー傾向分析  
SELECT * FROM analyze_error_trends(7);

-- ストレージ使用状況
SELECT metric_name, metric_value, unit
FROM operational_metrics 
WHERE metric_name LIKE '%size%' 
AND measurement_time >= NOW() - INTERVAL '7 days'
ORDER BY measurement_time DESC;
```

#### 2. スキーマ変更検証
```sql
-- スキーマ整合性確認
SELECT * FROM detect_schema_drift();

-- 制約・インデックス確認
SELECT * FROM comprehensive_integrity_check();
```

#### 3. セキュリティ監査
```sql
-- RLS設定確認
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables pt
JOIN pg_class pc ON pt.tablename = pc.relname
WHERE schemaname = 'public'
AND tablename IN ('purchase_orders', 'installments', 'transactions', 'staff_members');

-- 権限設定確認
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public';
```

### 📅 月次作業 (毎月第1営業日)

#### 1. 全データ整合性監査
```sql
-- 月次データ整合性フルチェック
SELECT * FROM comprehensive_integrity_check();

-- 分納・発注金額の完全検証
WITH order_validation AS (
    SELECT 
        po.id,
        po.total_amount,
        SUM(COALESCE(i.amount, 0)) as installment_total,
        po.total_amount - SUM(COALESCE(i.amount, 0)) as remaining
    FROM purchase_orders po
    LEFT JOIN installments i ON po.id = i.order_id AND i.status != 'cancelled'
    WHERE po.status = 'confirmed'
    GROUP BY po.id, po.total_amount
)
SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE remaining < 0) as over_budget_orders,
    COUNT(*) FILTER (WHERE remaining = 0) as completed_orders,
    AVG(remaining) as avg_remaining
FROM order_validation;
```

#### 2. パフォーマンス最適化
- インデックス使用状況の確認・最適化
- 古いデータのアーカイブ検討
- クエリ実行計画の分析

#### 3. 監視設定レビュー
- アラートしきい値の見直し
- 監視項目の追加・削除検討
- ダッシュボードの改善

---

## 🚨 緊急時対応手順

### P0 (システム停止) 対応

#### 即座対応 (5分以内)
1. **状況確認**
   ```bash
   # システム稼働確認
   curl -I https://your-domain.com/health
   
   # データベース接続確認
   # Supabase Dashboard でクエリ実行テスト
   SELECT NOW();
   ```

2. **緊急連絡**
   - システム管理者への即座連絡
   - 関係部署への状況報告

3. **一時対処**
   - ユーザーアクセスの制限
   - データベース読み取り専用モード検討

#### 本格対応 (30分以内)
1. **根本原因調査**
   ```sql
   -- エラーログ確認
   SELECT * FROM error_logs 
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   
   -- システム状態確認
   SELECT * FROM operational_dashboard();
   ```

2. **復旧作業**
   - バックアップからのリストア検討
   - 段階的機能復旧

### P1 (主要機能停止) 対応

#### 15分以内の対応
1. **影響範囲特定**
   ```sql
   -- 機能別エラー確認
   SELECT function_name, error_count, last_error_time
   FROM monitor_rpc_performance()
   WHERE error_count > 0;
   ```

2. **代替手段の提供**
   - 手動処理への切り替えガイダンス
   - 機能制限下での運用継続

3. **修復作業**
   - 問題のある機能の隔離
   - 段階的復旧

### P2 (性能劣化) 対応

#### 30分以内の対応
1. **パフォーマンス調査**
   ```sql
   -- 応答時間分析
   SELECT * FROM monitor_rpc_performance()
   ORDER BY avg_duration_ms DESC;
   
   -- リソース使用状況
   SELECT * FROM operational_metrics 
   WHERE metric_name LIKE '%cpu%' OR metric_name LIKE '%memory%'
   ORDER BY measurement_time DESC LIMIT 10;
   ```

2. **負荷軽減**
   - 重い処理の一時停止
   - アクセス制限の検討

---

## 🛠️ 障害対応ガイド

### よくある障害パターン

#### 1. P0001エラーが止まらない
**症状**: 正常な分納でもP0001エラーが発生  
**原因**: データ整合性の破損  
**対処**:
```sql
-- 整合性チェック実行
SELECT * FROM comprehensive_integrity_check();

-- 自動修復実行
SELECT * FROM auto_fix_minor_integrity_issues();

-- 手動修復が必要な場合
-- (具体的な修復クエリは障害内容により決定)
```

#### 2. 担当者リストが表示されない  
**症状**: ドロップダウンに担当者が出ない  
**原因**: staff_membersビューの権限問題  
**対処**:
```sql
-- ビューアクセス確認
SELECT * FROM v_purchase_assignees LIMIT 5;

-- 権限再設定
GRANT SELECT ON v_purchase_assignees TO authenticated;
```

#### 3. API応答が極端に遅い
**症状**: 全体的にレスポンスが5秒以上  
**原因**: データベース負荷・インデックス欠如  
**対処**:
```sql
-- 遅いクエリの特定
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- インデックス追加検討
-- (具体的なインデックスは調査結果により決定)
```

### データ復旧手順

#### 1. 部分データ破損の場合
```sql
-- 1. 影響範囲の特定
SELECT * FROM comprehensive_integrity_check();

-- 2. 問題データの隔離
UPDATE problem_table SET status = 'quarantined' 
WHERE conditions_for_problem_data;

-- 3. 正常データによる運用継続
-- (問題データを除外したビューの作成等)

-- 4. 段階的復旧
-- (バックアップからの選択的リストア)
```

#### 2. 全データ復旧の場合
```sql
-- 1. システム停止
-- 2. 最新バックアップの確認
-- 3. Point-in-time Recovery実行
-- 4. データ整合性の最終確認
SELECT * FROM comprehensive_integrity_check();
-- 5. システム再開
```

---

## 🔧 保守・メンテナンス

### 定期メンテナンス

#### 毎週のメンテナンス
```sql
-- 統計情報の更新
ANALYZE;

-- 不要ログの削除 (30日以上前)
DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM api_response_stats WHERE created_at < NOW() - INTERVAL '30 days';

-- インデックスの最適化
REINDEX INDEX CONCURRENTLY idx_installments_order_id;
REINDEX INDEX CONCURRENTLY idx_purchase_orders_status;
```

#### 毎月のメンテナンス
```sql
-- 全テーブルのVACUUM実行
VACUUM ANALYZE installments;
VACUUM ANALYZE purchase_orders;
VACUUM ANALYZE staff_members;

-- パフォーマンス監視データの集計
INSERT INTO monthly_performance_summary 
SELECT 
    date_trunc('month', measurement_time) as month,
    metric_name,
    AVG(metric_value) as avg_value,
    MAX(metric_value) as max_value,
    MIN(metric_value) as min_value
FROM operational_metrics 
WHERE measurement_time >= date_trunc('month', NOW() - INTERVAL '1 month')
AND measurement_time < date_trunc('month', NOW())
GROUP BY date_trunc('month', measurement_time), metric_name;
```

### バージョンアップ手順

#### 1. 事前準備
- [ ] フルバックアップの取得
- [ ] テスト環境での動作確認
- [ ] ロールバック手順の準備

#### 2. 本番適用
- [ ] メンテナンスモードへの切り替え
- [ ] データベーススキーマの更新実行
- [ ] アプリケーションコードのデプロイ
- [ ] 動作確認テストの実行

#### 3. 運用再開
- [ ] 全機能の動作確認
- [ ] パフォーマンステスト
- [ ] メンテナンスモードの解除

---

## 📏 監視項目・しきい値

### 重要監視項目

| 項目 | 正常範囲 | 警告しきい値 | 危険しきい値 | 確認頻度 |
|------|----------|---------------|---------------|----------|
| 総合健康度スコア | 95-100 | 85-94 | <85 | 5分間隔 |
| API応答時間 | <500ms | 500-1000ms | >1000ms | 1分間隔 |
| データ整合性エラー | 0件 | 1-5件/日 | >5件/日 | 10分間隔 |
| P0001エラー発生率 | <10件/日 | 10-50件/日 | >50件/日 | 5分間隔 |
| データベース接続数 | <20 | 20-40 | >40 | 1分間隔 |
| ストレージ使用率 | <70% | 70-85% | >85% | 30分間隔 |

### アラート設定

#### 即座アラート (P0)
- システム停止・全機能不全
- データベース接続不可
- データ破損検出

#### 緊急アラート (P1)
- 健康度スコア <70
- API応答時間 >2秒継続
- データ整合性エラー >10件/時間

#### 警告アラート (P2)  
- 健康度スコア 70-84
- API応答時間 500-1000ms
- エラー発生率の急増

---

## 📞 連絡体制・エスカレーション

### 連絡先一覧

#### 第一次対応
- **システム管理者**: [連絡先]
- **運用責任者**: [連絡先]  
- **開発チームリーダー**: [連絡先]

#### エスカレーション先
- **技術責任者**: [連絡先]
- **事業責任者**: [連絡先]
- **外部サポート**: Supabase サポート

### エスカレーション基準

| 障害レベル | 初期対応時間 | エスカレーション基準 | 連絡先 |
|------------|---------------|----------------------|---------|
| P0 (緊急) | 5分以内 | 15分で復旧見込み不明 | 全責任者 |
| P1 (高) | 15分以内 | 30分で復旧見込み不明 | 技術・事業責任者 |
| P2 (中) | 30分以内 | 2時間で復旧見込み不明 | システム管理者 |
| P3 (低) | 2時間以内 | 翌営業日対応 | 運用責任者 |

### 報告書テンプレート

#### 障害報告書
```markdown
# 障害報告書

**発生日時**: YYYY/MM/DD HH:MM  
**解決日時**: YYYY/MM/DD HH:MM  
**障害レベル**: P0/P1/P2/P3  
**影響範囲**: [ユーザー数/機能範囲]

## 障害概要
[障害の概要説明]

## 根本原因
[技術的な原因]

## 対応実績
1. [対応1] (HH:MM)
2. [対応2] (HH:MM)
3. [解決] (HH:MM)

## 再発防止策
- [対策1]
- [対策2]

## 学習ポイント
[今後に活かす知見]
```

---

## 🎯 運用品質向上

### 継続的改善項目

#### 毎月のレビュー
- [ ] 障害発生回数・解決時間の分析
- [ ] ユーザーフィードバックの収集・分析
- [ ] システムパフォーマンスの推移確認
- [ ] 運用手順の改善点識別

#### 四半期のレビュー
- [ ] システムアーキテクチャの見直し
- [ ] 監視項目・しきい値の調整
- [ ] 運用体制の最適化
- [ ] 技術的負債の計画的解消

### 運用メトリクス

#### サービスレベル指標 (SLI)
- **可用性**: 99.9%以上
- **応答時間**: 95%のリクエストが500ms以内
- **エラー率**: 0.1%以下

#### サービスレベル目標 (SLO)
- **月次稼働時間**: 99.9% (最大43分の停止許容)
- **データ整合性**: 99.99% (月1件のエラー許容)  
- **復旧時間目標**: P0障害15分以内、P1障害1時間以内

---

**📝 この運用マニュアルは四半期ごとに見直し、システムの成長とともに改善を続けます。**

**最終更新者**: SuperClaude Framework  
**承認者**: システム責任者  
**次回見直し予定**: 2025年12月

---

## 📖 旧テスト手順 (参考用)

### 1️⃣ ログイン・認証テスト

#### 手順
1. **ブラウザで** `http://localhost:5173` にアクセス
2. **Login画面** が表示されることを確認
3. **有効な認証情報** でログイン
4. **ダッシュボード** に遷移することを確認

#### 確認ポイント
- [ ] ログイン成功後のリダイレクト
- [ ] サイドバーナビゲーション表示
- [ ] ユーザー情報の正しい表示
- [ ] **Network**:認証API呼び出し成功 (200)

---

### 2️⃣ 発注書作成テスト

#### 手順
1. **サイドバー** → 「新規発注」クリック
2. **発注情報入力**:
   - 仕入先選択
   - 発注日入力 (今日の日付)
   - 納期指定
   - メモ入力 (任意)

3. **明細追加**:
   - 「明細追加」ボタンクリック
   - 商品選択 (例: 商品A)
   - 数量入力 (例: 10)
   - 単価入力 (例: 1000)
   - 金額自動計算確認 (¥10,000)

4. **発注確定**:
   - 「発注を作成」ボタンクリック
   - 成功メッセージ確認
   - 発注一覧画面への自動遷移

#### 確認ポイント
- [ ] **金額計算**: 数量×単価=合計金額
- [ ] **バリデーション**: 必須項目未入力時のエラー表示
- [ ] **Network**: POST `/rest/v1/purchase_orders` (201)
- [ ] **Network**: POST `/rest/v1/purchase_order_items` (201)
- [ ] **Console**: トリガー実行ログ確認
- [ ] **自動分納生成**: 第1回分納が自動作成される

---

### 3️⃣ 分納追加テスト

#### 手順
1. **発注一覧** → 作成した発注の「詳細」ボタンクリック
2. **分納セクション** で「分納追加」ボタンクリック
3. **分納モーダル**:
   - 発注情報表示確認 (発注番号、金額、残額)
   - 進捗バー表示確認
   - 分納金額入力 (例: 5,000円)
   - ステータス選択 (「下書き」または「確定」)
   - 期日指定 (デフォルト+30日)
   - メモ入力 (任意)

4. **分納実行**:
   - 「分納追加」ボタンクリック
   - 成功メッセージ確認
   - モーダル自動クローズ

#### 確認ポイント
- [ ] **残額計算**: 発注額 - 既分納額 = 残額
- [ ] **金額制限**: 残額超過入力時のエラー表示
- [ ] **進捗バー更新**: 分納追加後の即座な反映
- [ ] **分納番号**: 自動インクリメント (2, 3, 4...)
- [ ] **Network**: POST `/rest/v1/transactions` (201)
- [ ] **リアルタイム更新**: バッジ色の変更確認

#### データフロー検証
```sql
-- Supabase SQLエディターで並行実行
-- 分納追加直後に実行
SELECT 
  t.installment_no,
  t.total_amount,
  t.status,
  po.order_no,
  po.total_amount as order_total
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = '作成した発注番号'
ORDER BY t.installment_no;
```

---

### 4️⃣ 同時実行耐性テスト

#### 手順
1. **ブラウザタブ複製** (Ctrl+Shift+D)
2. **両タブで同じ発注** の分納追加モーダルを開く
3. **タブ1**: 分納金額 3,000円入力
4. **タブ2**: 分納金額 4,000円入力
5. **タブ1**: 「分納追加」実行
6. **タブ2**: 「分納追加」実行 (遅延なし)

#### 確認ポイント
- [ ] **エラーハンドリング**: 2回目実行でP0001エラー
- [ ] **UI復旧**: エラー後の正常状態復帰
- [ ] **データ整合性**: 重複分納の防止
- [ ] **Console**: 詳細エラーログ表示
- [ ] **Toast**: 適切なエラーメッセージ

---

### 5️⃣ 金額整合性テスト

#### 手順
1. **発注作成**: 総額10,000円の発注
2. **分納1**: 4,000円 (残額 6,000円)
3. **分納2**: 3,000円 (残額 3,000円) 
4. **分納3**: 3,500円 (超過500円) ← **意図的に超過**
5. **進捗バー確認**: 各段階でのバッジ色変化

#### 確認ポイント
- [ ] **バッジ色変化**:
  - 未配分: ⚠️ イエロー
  - 完全一致: ✅ グリーン
  - 超過配分: 🔴 レッド
- [ ] **超過防止**: 3回目分納で金額制限エラー
- [ ] **リアルタイム計算**: 入力中の即座な残額更新

#### データ検証クエリ
```sql
-- 金額配分状況の確認
SELECT 
  po.order_no,
  po.total_amount,
  COALESCE(SUM(t.total_amount), 0) AS installment_total,
  po.total_amount - COALESCE(SUM(t.total_amount), 0) AS remaining_amount,
  CASE 
    WHEN ABS(po.total_amount - COALESCE(SUM(t.total_amount), 0)) < 0.01 THEN '✅完全一致'
    WHEN COALESCE(SUM(t.total_amount), 0) > po.total_amount THEN '🔴超過配分'
    ELSE '⚠️未配分あり'
  END AS amount_status
FROM public.purchase_orders po
LEFT JOIN public.transactions t 
  ON t.parent_order_id = po.id AND t.transaction_type = 'purchase'
WHERE po.order_no = '対象発注番号'
GROUP BY po.id, po.order_no, po.total_amount;
```

---

### 6️⃣ 在庫連携テスト

#### 手順
1. **在庫ページ** → 商品Aの現在在庫確認 (例: 100個)
2. **発注確定**:
   - 商品A × 20個の発注作成
   - 「発注確定」ボタンクリック
   - 在庫移動の実行確認

3. **在庫確認**:
   - 在庫ページリロードまたは自動更新
   - 在庫数の変化確認 (100個 → 120個)
   - 在庫移動履歴の追加確認

#### 確認ポイント
- [ ] **在庫計算**: 確定前在庫 + 入荷数量 = 確定後在庫
- [ ] **在庫移動履歴**: タイプ「入荷」で記録
- [ ] **ダッシュボード更新**: 在庫統計の即座反映
- [ ] **Network**: 在庫更新API呼び出し確認

---

### 7️⃣ フィルタ・検索機能テスト

#### 手順
1. **発注一覧画面** で以下をテスト:

**担当者フィルタ**:
- 担当者A選択 → 該当データのみ表示
- 「すべて」選択 → 全データ表示復帰

**日付フィルタ**:
- 期間指定 (例: 先週〜今日)
- 該当期間の発注のみ表示確認
- 期間クリア → 全期間表示復帰

**商品検索**:
- 商品名部分入力 (例: "商品A")
- リアルタイム絞り込み確認
- 検索クリア → 全商品表示復帰

#### 確認ポイント
- [ ] **応答性**: 1秒以内のフィルタ実行
- [ ] **組み合わせ**: 複数フィルタの同時適用
- [ ] **リセット**: 全フィルタクリア機能
- [ ] **URL同期**: フィルタ状態のURL反映 (該当する場合)

---

### 8️⃣ エラー処理・復旧テスト

#### 手順
1. **ネットワーク切断テスト**:
   - DevTools → Network → Offline設定
   - 分納追加実行 → エラー確認
   - Online復帰 → 再実行成功確認

2. **無効データ入力**:
   - 分納金額に文字列入力
   - 未来日付に過去日付入力
   - 必須項目空白での送信

3. **競合状態テスト**:
   - 複数ユーザー同時操作 (可能な場合)
   - 同一データへの同時更新

#### 確認ポイント
- [ ] **エラー表示**: 明確なエラーメッセージ
- [ ] **UI復旧**: エラー後の操作継続可能性
- [ ] **Toast通知**: 適切な通知タイミング
- [ ] **フォーム状態**: エラー時の入力値保持

---

### 9️⃣ パフォーマンス・応答性テスト

#### 手順
1. **大量データ操作**:
   - 発注一覧で100件以上表示
   - スクロール性能確認
   - フィルタ実行時間測定

2. **連続操作**:
   - 分納追加の連続実行
   - ページ間の高速遷移
   - 同時API呼び出し負荷

#### 確認ポイント
- [ ] **表示速度**: 1秒以内の初期表示
- [ ] **操作応答**: 500ms以内のボタン反応
- [ ] **メモリ**: メモリリーク無し
- [ ] **Network**: 不要なAPI呼び出し無し

---

### 🔟 総合シナリオテスト

#### 完全業務フローシナリオ
1. **仕入先A** から **商品B × 50個** の発注作成 (¥50,000)
2. **第1回分納** ¥20,000 で追加
3. **第2回分納** ¥15,000 で追加  
4. **残額確認** ¥15,000 
5. **第3回分納** ¥15,000 で完了
6. **発注確定** → 在庫50個増加確認
7. **統計更新** → ダッシュボード即座反映

#### 確認ポイント
- [ ] **エンドツーエンド**: 全工程スムーズ実行
- [ ] **データ完整性**: 全段階での数値正確性
- [ ] **UI同期**: 各操作後の即座反映
- [ ] **品質基準達成**: 応答時間・精度・信頼性

---

## ⚡ 高速検証コマンド

### 一括データ確認
```sql
-- 📊 システム全体状況の瞬間確認
WITH stats AS (
  SELECT 
    (SELECT COUNT(*) FROM purchase_orders) AS total_orders,
    (SELECT COUNT(*) FROM transactions) AS total_installments,
    (SELECT COUNT(*) FROM products) AS total_products,
    (SELECT SUM(total_amount) FROM purchase_orders) AS order_total,
    (SELECT SUM(total_amount) FROM transactions) AS installment_total
)
SELECT 
  '📋 発注書総数: ' || total_orders || '件' AS orders_info,
  '💰 発注総額: ¥' || to_char(order_total, 'FM999,999,999') AS order_amount,
  '📦 分納総数: ' || total_installments || '件' AS installments_info,
  '💸 分納総額: ¥' || to_char(installment_total, 'FM999,999,999') AS installment_amount,
  '🎯 配分率: ' || ROUND((installment_total::decimal / order_total * 100), 2) || '%' AS allocation_rate
FROM stats;
```

### キャッシュ状態確認
```javascript
// ブラウザ Console で実行
// React Query DevTools でキャッシュ状態確認
console.table(window.__REACT_QUERY_CLIENT__?.getQueryCache().getAll().map(q => ({
  key: JSON.stringify(q.queryKey),
  status: q.state.status,
  data: q.state.data ? 'loaded' : 'empty'
})));
```

---

## 🏁 成功基準チェックリスト

### データ整合性 (100%)
- [ ] 金額配分の数学的正確性 (誤差 < 0.01)
- [ ] 分納番号の重複完全ゼロ
- [ ] 制約違反完全ゼロ

### パフォーマンス基準
- [ ] 分納リスト表示: 1秒以内
- [ ] 分納追加操作: 2秒以内  
- [ ] バッジ更新反映: 500ms以内

### 信頼性基準
- [ ] 同時実行での競合状態適切処理: 100%
- [ ] エラー時の正常復帰: 100%
- [ ] UI状態とDB状態の完全同期: 100%

### セキュリティ基準
- [ ] 権限外アクセス完全防止: 100%
- [ ] 入力値検証の完全性: 100%
- [ ] SQLインジェクション耐性: 100%

---

## 🛠️ トラブルシューティング

### よくある問題と解決法

**問題**: 分納追加後にバッジが更新されない
```javascript
// Console で手動キャッシュクリア
queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
```

**問題**: P0001エラーの頻発
```sql
-- データベースで制約確認
SELECT * FROM transactions 
WHERE parent_order_id = '該当UUID' 
ORDER BY installment_no;
```

**問題**: 在庫数が正しく更新されない  
```sql
-- 在庫移動履歴確認
SELECT * FROM inventory_movements 
WHERE product_id = '該当商品ID'
ORDER BY created_at DESC;
```

---

## 📈 品質保証レベル

### ⭐ レベル1: 基本動作 (必須)
- 各機能の個別動作確認
- 基本的なエラーハンドリング

### ⭐⭐ レベル2: 統合品質 (推奨)
- 機能間連携の完全性
- データ整合性の数学的正確性

### ⭐⭐⭐ レベル3: エンタープライズ品質 (理想)
- 同時実行耐性
- パフォーマンス基準達成
- 長期運用安定性

**目標**: ⭐⭐⭐ レベル3完全達成

このテスト手順書により、プロダクション環境での確実な動作が保証されます。