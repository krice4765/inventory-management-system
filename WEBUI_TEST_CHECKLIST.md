# WebUI最終テストチェックリスト

## 🎯 テスト実行順序（重要度順）

### Phase 0: システム基盤確認（最重要 - 事前環境確認）
- [ ] **データベースメンテナンス完了確認**
  ```sql
  -- 制約状況の最終確認（理想形：2本のUNIQUE制約）
  SELECT c.conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'transactions' AND c.contype='u';
  
  -- 期待結果：
  -- transactions_transaction_no_key | UNIQUE (transaction_no)
  -- uq_transactions_parent_type_installment | UNIQUE (parent_order_id, transaction_type, installment_no)
  ```

- [ ] **データ整合性ゼロベース確認**
  ```sql
  -- transaction_no重複確認（必ず0件）
  SELECT transaction_no, COUNT(*) FROM public.transactions 
  WHERE transaction_no IS NOT NULL 
  GROUP BY transaction_no HAVING COUNT(*) > 1;

  -- installment_no=1重複確認（必ず0件）
  SELECT parent_order_id, COUNT(*) FROM public.transactions 
  WHERE transaction_type='purchase' AND installment_no=1 AND parent_order_id IS NOT NULL
  GROUP BY parent_order_id HAVING COUNT(*) > 1;
  ```

- [ ] **fn_sync_transaction_from_po()関数の修正確認**
  ```sql
  -- 関数定義の確認（ON CONFLICTが複合キーに対応していること）
  SELECT pg_get_functiondef(oid) FROM pg_proc 
  WHERE proname = 'fn_sync_transaction_from_po';
  ```

### Phase 1: 分納機能のコアテスト
- [ ] **新規発注 → 自動分納同期**
  - 新規発注作成時にfn_sync_transaction_from_po()が動作
  - installment_no=1の分納取引が自動生成される
  - 複合キー制約(parent_order_id, transaction_type, installment_no)で重複防止
  - NetworkタブでPOSTリクエストのon_conflict指定を確認

- [ ] **分納追加ボタン**
  - AddInstallmentModal.tsxが正しく動作
  - 新しい分納作成時にinstallment_noが自動インクリメント
  - 金額入力・メモ入力が保存される
  - 作成後に分納リストが即座に反映される

- [ ] **トリガー動作パターンの完全検証**
  - 新規発注INSERT → installment_no=1自動生成（✅期待動作）
  - 既存order_noでUpsert（DO UPDATE） → 新規分納は作成されない（✅期待動作）
  - UPDATE時の分納自動生成要件確認（要件次第で追加実装）

- [ ] **同時実行耐性テスト（重要）**
  - 分納追加ボタンの連打テスト
  - 同じ発注への同時分納追加（複数タブ）
  - 複合UNIQUE制約による適切なエラー処理確認
  - UIでの重複エラー表示と正常復帰

### Phase 2: データ表示・UI反映
- [ ] **分納バッジの色分け・即時反映**
  - 「完全一致」: ✅ グリーンバッジ
  - 「未配分あり」: ⚠️ イエローバッジ  
  - 「超過配分」: 🔴 レッドバッジ
  - 分納追加後にバッジ色が即座に更新される

- [ ] **installment_no順ソート**
  - 分納取引リストがinstallment_no順（1, 2, 3...）で表示
  - v_purchase_transactionsビューの順序が期待通り
  - フロントエンドのソート処理が機能

### Phase 3: 検索・フィルタ機能
- [ ] **担当者フィルタ（AdvancedFilters/ModernAdvancedFilters）**
  - 担当者選択によるフィルタリング
  - 複数担当者選択時の動作
  - フィルタリセット機能

- [ ] **日付フィルタ**
  - 日付範囲指定による取引絞り込み
  - 開始日・終了日の組み合わせ
  - 無効な日付入力時の処理

- [ ] **商品名検索（ProductFilterBar）**
  - 商品名での部分一致検索
  - 大文字小文字の区別
  - 検索結果のリアルタイム更新

### Phase 4: フォーム・入力系
- [ ] **PurchaseOrderForm（新規発注）**
  - 発注作成時の必須フィールド検証
  - パートナー選択・商品選択
  - 金額計算の正確性
  - on_conflict指定(order_no)の動作

- [ ] **PurchaseTransactionForm（分納編集）**
  - 既存分納の編集機能
  - 金額変更時の整合性チェック
  - ステータス変更の反映

### Phase 5: API・データ整合性
- [ ] **useTransactions系Hooks**
  - useTransactions.ts - 基本取引取得
  - useTransactionsByPartner.ts - パートナー別取得
  - useTransactionsWithParent.ts - 分納取引取得
  - useAvailableOrders.ts - 発注一覧取得

- [ ] **PostgRESTスキーマ同期**
  - NOTIFY pgrst, 'reload schema'後のAPI応答
  - ビュー更新の反映状況
  - 制約変更の適用状況

### Phase 6: エラーハンドリング・エッジケース
- [ ] **重複防止テスト**
  - 同じ発注に同じinstallment_noで分納追加を試行
  - エラーメッセージの適切な表示
  - UI状態の正常復帰

- [ ] **金額超過テスト**
  - 発注金額を超える分納追加の防止
  - 警告メッセージの表示
  - 入力値のリアルタイム検証

- [ ] **ネットワークエラー処理**
  - API接続失敗時の挙動
  - トースト通知の表示
  - リトライ機能（該当する場合）

### Phase 7: 継続的品質監視
- [ ] **金額整合性の数学的正確性**
  ```sql
  -- 金額配分サマリ（小数点精度含む）
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
  GROUP BY po.id, po.order_no, po.total_amount
  ORDER BY amount_status DESC, po.order_no;
  ```

- [ ] **パフォーマンス検証**
  ```sql
  -- 主要クエリのEXPLAIN確認
  EXPLAIN (ANALYZE, BUFFERS) 
  SELECT * FROM v_purchase_transactions 
  WHERE parent_order_id = '<TEST_UUID>' 
  ORDER BY installment_no;
  ```

### Phase 8: セキュリティ・権限確認
- [ ] **Row Level Security (RLS) 実地確認**
  - 認証ユーザーでの適切なデータアクセス
  - 他ユーザーのpartner_idデータへの不正アクセス防止
  - 匿名ユーザーでの読み取り制限確認

- [ ] **API権限の境界テスト**
  - Supabase認証トークンでの実API呼び出し
  - 権限外データへのアクセス試行
  - エラーレスポンスの適切性確認

## 🔧 テスト実行環境
- **開発サーバー**: `npm run dev`
- **ブラウザ**: Chrome DevTools Network/Console タブ開放
- **データベース**: Supabase SQLエディターで検証クエリ並行実行
- **事前準備**: database_maintenance.sql実行完了後

## ⚠️ 注意事項
- 各Phaseの完了後に次のPhaseに進む
- エラー発見時は即座に記録・修正
- Networkタブでon_conflict指定やAPIレスポンス内容を必ず確認
- 重要な変更前には git status && git add でバックアップ

## 📋 最適化された実行プラン

### 段階1: 基盤確認（Phase 0）
- データベースメンテナンス状況確認
- データ整合性ゼロベース検証  
- 関数・トリガーの修正状況確認

### 段階2: コア機能検証（Phase 1-2）
- 自動分納同期の完全動作確認
- 同時実行耐性テスト
- UI反映・バッジ更新の即時性確認

### 段階3: 周辺機能・統合テスト（Phase 3-6）
- 検索・フィルタ・フォーム機能
- API・Hooks統合
- エラーハンドリング・エッジケース

### 段階4: 品質保証・セキュリティ（Phase 7-8）
- 継続的品質監視体制
- セキュリティ・権限境界確認
- パフォーマンス検証

## 📊 確定版成功基準（定量的指標）

### データ整合性：100%
- [ ] **金額配分の数学的正確性**（誤差 < 0.01）
- [ ] **重複データ完全ゼロ**
- [ ] **制約違反完全ゼロ**

### パフォーマンス基準
- [ ] **分納リスト表示：1秒以内**
- [ ] **分納追加操作：2秒以内**
- [ ] **バッジ更新反映：即時（500ms以内）**

### 信頼性基準
- [ ] **同時実行での競合状態適切処理：100%**
- [ ] **エラー時の正常復帰：100%**
- [ ] **UI状態とDB状態の完全同期：100%**

### セキュリティ基準
- [ ] **権限外アクセス完全防止：100%**
- [ ] **入力値検証の完全性：100%**
- [ ] **SQLインジェクション耐性：100%**

## 🎯 長期運用への配慮

### 監視・保守体制
- **日次**: Phase 7の品質監視クエリ実行推奨
- **週次**: 金額整合性レポートのレビュー
- **月次**: パフォーマンス指標の評価

### 拡張性への準備
- 新機能追加時のテストテンプレート整備
- データ移行時の整合性確認手順
- 負荷増加時のスケーリング計画