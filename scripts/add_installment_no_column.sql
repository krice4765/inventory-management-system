-- inventory_movementsテーブルにinstallment_no列を追加
-- 将来性を考慮した分納回数の正規化

-- 1. installment_no列を追加（NULLを許可）
ALTER TABLE inventory_movements
ADD COLUMN installment_no INTEGER DEFAULT NULL;

-- 2. コメントを追加
COMMENT ON COLUMN inventory_movements.installment_no IS '分納回数（第X回の情報）';

-- 3. インデックスを追加（検索・フィルタリング用）
CREATE INDEX idx_inventory_movements_installment_no
ON inventory_movements(installment_no)
WHERE installment_no IS NOT NULL;

-- 4. 既存データのinstallment_no値を更新（memoから抽出）
UPDATE inventory_movements
SET installment_no = CAST(
  regexp_replace(
    regexp_replace(memo, '.*第(\d+)回.*', '\1'),
    '[^\d]', '', 'g'
  ) AS INTEGER
)
WHERE memo LIKE '%第%回%'
  AND memo ~ '第\d+回'
  AND installment_no IS NULL;

-- 5. 更新されたレコード数を確認
SELECT
  COUNT(*) as total_records,
  COUNT(installment_no) as records_with_installment_no,
  COUNT(CASE WHEN memo LIKE '%分納入力%' THEN 1 END) as installment_memo_records
FROM inventory_movements;