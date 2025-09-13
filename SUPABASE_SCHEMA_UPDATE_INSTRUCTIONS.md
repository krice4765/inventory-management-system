# inventory_movementsテーブルにinstallment_no列を追加

## 手順

### 1. Supabaseダッシュボードにアクセス
- https://supabase.com/dashboard にアクセス
- プロジェクトを選択
- 左側メニューから「SQL Editor」を選択

### 2. 以下のSQLを実行

```sql
-- 1. installment_no列を追加
ALTER TABLE inventory_movements
ADD COLUMN installment_no INTEGER DEFAULT NULL;

-- 2. 既存データのinstallment_no値を更新（memoから抽出）
UPDATE inventory_movements
SET installment_no = CAST(
  SUBSTRING(memo FROM '第(\d+)回') AS INTEGER
)
WHERE memo ~ '第\d+回'
  AND installment_no IS NULL;

-- 3. 結果確認
SELECT
  COUNT(*) as total_records,
  COUNT(installment_no) as records_with_installment_no,
  COUNT(CASE WHEN memo LIKE '%分納入力%' THEN 1 END) as installment_memo_records
FROM inventory_movements;

-- 4. サンプルデータ確認
SELECT installment_no, memo
FROM inventory_movements
WHERE installment_no IS NOT NULL
LIMIT 5;
```

### 3. 実行後の確認

実行が成功すると：
- `installment_no`列が追加される
- 既存の分納レコードの回数が自動的に設定される
- 新規分納処理でも適切に値が保存される

### 4. フロントエンド側の修正

SQLが成功したら、フロントエンドコードを更新して`installment_no`フィールドを使用するように変更します。