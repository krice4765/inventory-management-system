# 分納商品情報表示問題の根本原因分析

## 📅 問題発生日時
2025年9月25日 16:20頃

## 🚨 問題症状
4回目分納（ガラス2個 ¥2,320）が「商品情報なし」と表示される

## 🔍 根本原因分析

### 1. システム設計上の問題

#### 問題の構造
```
分納作成時 → 金額のみ保存 → 表示時に推測 → マッチング失敗 → 「商品情報なし」
```

#### 設計フローの問題点
1. **分納作成段階**: `create_installment_v2`関数は金額・メモのみ受け取り
2. **データ保存段階**: transaction_itemsテーブルに商品情報が保存されない
3. **表示段階**: PurchaseOrderDetail.tsxが推測ロジックで商品を特定を試みる
4. **失敗**: 推測ロジックがガラス部分分納（¥2,320）を認識できない

### 2. 技術的な失敗要因

#### A. RPC関数の設計不備
**現在のcreate_installment_v2関数:**
```sql
CREATE OR REPLACE FUNCTION create_installment_v2(
    p_parent_order_id UUID,
    p_partner_id UUID,
    p_transaction_date DATE,
    p_due_date DATE,
    p_total_amount NUMERIC,  -- 金額のみ
    p_memo TEXT              -- メモのみ
) RETURNS JSON
```

**問題点:**
- 商品情報パラメータが存在しない
- transaction_itemsテーブルへの挿入処理がない
- 分納作成時に商品・数量情報を受け取れない

#### B. フロントエンドの商品情報活用不足
**利用可能だが活用されていない情報:**
- DeliveryModal.tsx内の`quantities`オブジェクト
- 商品ID、数量、単価情報
- 発注商品との関連情報

**問題点:**
- quantitiesデータがRPC関数に送信されていない
- 商品情報を事後推測に依存
- ユーザーが入力した正確な情報を無視

#### C. 推測ロジックの限界
**現在のマッチング条件（PurchaseOrderDetail.tsx:213-221）:**
```javascript
const conditions = [
  // 1. カメラ特定条件
  productName.includes('カメラ') && transactionAmount >= calculatedTotal,
  // 2. 完全一致条件（単価）
  unitPrice === transactionAmount,
  // 3. 完全一致条件（総額）
  calculatedTotal === transactionAmount,
  totalAmount === transactionAmount
];
```

**失敗するケース:**
- ガラス: 単価¥3,000 × 3個 = ¥9,000（発注総額）
- 分納: ¥2,320（2個分の部分分納）
- 結果: どの条件にも該当せず → 「商品情報なし」

### 3. データフロー分析

#### 理想的なフロー vs 現実
```
【理想】
分納作成 → 商品情報含む → 正確保存 → 確実表示

【現実】
分納作成 → 金額のみ → 空のtransaction_items → 推測失敗 → 「商品情報なし」
```

#### データベーステーブル状況
```sql
-- transactionsテーブル: 分納レコードは作成される
INSERT INTO transactions (金額, メモ, ...);

-- transaction_itemsテーブル: 何も挿入されない！
-- → 表示時に商品情報が取得できない
```

### 4. なぜこの問題が見過ごされたか

#### A. 初期実装の限界
- プロトタイプ段階では金額のみの分納で機能していた
- 「後で商品情報を推測すればよい」という楽観的設計
- 複雑なケース（部分分納、複数商品組み合わせ）を想定していなかった

#### B. テストケースの不足
- カメラ（¥11,000）: 偶然推測ロジックにマッチしていた
- ガラス部分分納（¥2,320）: 想定外のケース
- 体系的なテストケースが不足

#### C. データ設計の不一貫性
- フロントエンドでは商品・数量情報を収集
- バックエンドでは金額情報のみ処理
- データフローの途中で情報が欠落

### 5. 影響範囲

#### ユーザビリティ影響
- 分納履歴で何を納品したか分からない
- 経営判断に必要な商品別進捗が不明
- 在庫管理との整合性が取れない

#### 運用影響
- 手動で商品情報を確認する必要
- 分納処理の信頼性低下
- データ品質の問題

#### システム影響
- transaction_itemsテーブルが機能していない
- 推測ロジックの複雑化・保守困難
- 将来的な拡張性の阻害

### 6. 解決方針

#### 根本解決アプローチ
1. **データ設計修正**: RPC関数に商品情報パラメータ追加
2. **フロントエンド修正**: quantitiesデータの活用
3. **推測ロジック廃止**: 正確なデータ保存により不要化

#### 具体的対策
```sql
-- 新しいcreate_installment_v3関数
CREATE OR REPLACE FUNCTION create_installment_v3(
    ...,
    p_items JSONB -- 商品情報配列を追加
) RETURNS JSON
```

```javascript
// フロントエンド: 商品情報構築
const items = Object.entries(quantities)
  .filter(([productId, quantity]) => quantity > 0)
  .map(([productId, quantity]) => ({
    product_id: productId,
    quantity: quantity,
    unit_price: actualUnitPrice,
    total_amount: actualUnitPrice * quantity
  }));
```

### 7. 学習点

#### 設計原則違反
- **Single Source of Truth**: ユーザー入力情報を無視し、推測に依存
- **Data Integrity**: 利用可能な正確データを活用せず
- **Fail Fast**: 推測失敗時の適切な処理がない

#### 改善指針
- ユーザーが入力した情報は確実に保存・活用する
- 推測ロジックではなく確実なデータフローを設計する
- テストケースは複雑なシナリオも含める

### 8. 再発防止策

#### 設計レビューポイント
- データフロー全体の一貫性確認
- ユーザー入力データの活用度チェック
- エッジケースでのテスト実施

#### 開発プロセス改善
- プロトタイプ段階での制限を明確化
- 本格実装時の設計見直し実施
- データ品質の継続的監視

---

## 📊 結論

この問題は**システム設計上の根本的欠陥**であり、単なるバグ修正ではなく**アーキテクチャ改善**が必要。ユーザーが正確に入力した商品・数量情報を無視し、事後の推測に依存した設計が原因。

**真の解決には**: データフロー全体の見直しとtransaction_itemsテーブルへの正確なデータ保存が不可欠。