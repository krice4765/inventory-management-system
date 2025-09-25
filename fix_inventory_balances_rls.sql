-- 3回目納品時のRLS問題修正
-- inventory_balancesテーブルにINSERTポリシーを追加

-- 現在のポリシーを確認
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'inventory_balances';

-- INSERTポリシーが不足している場合は追加
CREATE POLICY IF NOT EXISTS "Users can insert inventory balances"
ON inventory_balances
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- inventory_movementsテーブルも同様にチェック
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'inventory_movements';

-- 必要に応じてinventory_movementsのポリシーも確認・修正
CREATE POLICY IF NOT EXISTS "Users can update inventory movements"
ON inventory_movements
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- 修正後の全ポリシーを確認
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('inventory_balances', 'inventory_movements')
ORDER BY tablename, cmd;