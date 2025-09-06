# 🚨 P0001エラー修正検証手順

## 修正内容サマリ

**根本原因**: RPC関数 `add_purchase_installment` が `draft` ステータスでは金額超過チェックを実行していなかった

**修正点**:
1. ✅ **RPC関数修正**: 全ステータスで金額超過チェックを実行
2. ✅ **フロントエンド改善**: 残額計算ヘルパー関数追加

## 🎯 検証手順

### ステップ1: RPC関数のデプロイ

Supabase Dashboard (https://supabase.com/dashboard/project/tleequspizctgoosostd) にアクセスし、SQL Editorで以下を実行：

```sql
-- 修正前の状態確認
SELECT 
  t.transaction_no,
  t.total_amount,
  t.status,
  po.order_no,
  po.total_amount as order_total
FROM transactions t
JOIN purchase_orders po ON t.parent_order_id = po.id
WHERE po.order_no = 'PO250904006';

-- scripts/deploy_fix.sql の内容をコピーして実行
-- （修正されたRPC関数がデプロイされる）
```

### ステップ2: 問題発注での動作確認

**テスト対象発注**: PO250904006
- 発注総額: ¥2,486
- 既存分納: ¥621
- **期待される残額**: ¥1,865 (2,486 - 621)

### ステップ3: UI操作テスト

1. **残額¥1,865分納を試行**:
   - AddInstallmentModal で ¥1,865 を入力
   - ✅ 期待結果: 正常に分納作成

2. **超過金額¥1,866分納を試行**:
   - AddInstallmentModal で ¥1,866 を入力  
   - ✅ 期待結果: P0001エラーで拒否

3. **UI残額表示確認**:
   - PurchaseOrders画面で PO250904006 の残額表示
   - ✅ 期待結果: ¥1,865 と正確に表示

### ステップ4: エラーメッセージ確認

期待されるエラーメッセージ（¥1,866入力時）:
```
[P0001] 分納合計が発注金額を超過します | 発注: PO250904006 | 超過額: ¥1.00 | 発注額: ¥2486.00 | 既存分納: ¥621.00 | 今回分納: ¥1866.00
```

## 🔍 データ整合性確認クエリ

```sql
-- 修正後の動作確認
SELECT 
  po.order_no,
  po.total_amount,
  COALESCE(SUM(t.total_amount), 0) as allocated_total,
  po.total_amount - COALESCE(SUM(t.total_amount), 0) as remaining_amount,
  COUNT(t.id) as installment_count
FROM purchase_orders po
LEFT JOIN transactions t ON po.id = t.parent_order_id 
  AND t.transaction_type = 'purchase'
WHERE po.order_no = 'PO250904006'
GROUP BY po.id, po.order_no, po.total_amount;
```

## 📊 修正効果の定量評価

**修正前**: 
- ❌ draft ステータス分納で金額超過が可能
- ❌ 既存分納¥621が無視される
- ❌ 発注額¥2,486に対して計¥3,107分納が可能

**修正後**:
- ✅ 全ステータスで金額超過チェック
- ✅ 既存分納が正確に考慮される  
- ✅ 残額¥1,865を超える分納は拒否

## ✅ 完了チェックリスト

- [ ] RPC関数 `deploy_fix.sql` をSupabaseで実行
- [ ] PO250904006で残額¥1,865分納が成功することを確認
- [ ] 超過額¥1,866分納がP0001エラーで拒否されることを確認
- [ ] UI画面で残額が¥1,865と正確に表示されることを確認
- [ ] エラーメッセージが期待通りの詳細を含むことを確認

---
**修正日時**: 2025-09-05
**修正者**: SuperClaude Framework
**影響範囲**: 分納機能全体の金額制御