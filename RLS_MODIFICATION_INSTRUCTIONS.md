# RLS修正SQL実行手順書

## 概要
user_applicationsテーブルのRow Level Security (RLS)ポリシーを修正し、匿名ユーザーの申請送信を可能にします。

## 実行環境
- Supabase Dashboard SQL Editor
- プロジェクト: tleequspizctgoosostd
- URL: https://tleequspizctgoosostd.supabase.co

## 実行手順

### 第1段階: 接続確認
```sql
-- データベース接続状況確認
SELECT current_database(), current_user, version();
```
**期待結果**: データベース名、ユーザー名、PostgreSQLバージョンが表示される

### 第2段階: 既存ポリシー状況確認
```sql
-- 現在のRLSポリシー確認
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'user_applications';
```
**期待結果**: 既存のポリシー一覧が表示される（削除対象の確認）

### 第3段階: 既存ポリシー削除
```sql
-- 制限的な既存ポリシーを削除
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;
```
**期待結果**: `DROP POLICY` が成功メッセージとして表示される

### 第4段階: 公開申請フォーム用ポリシー作成
```sql
-- 匿名ユーザーの申請送信を許可
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```
**期待結果**: `CREATE POLICY` が成功メッセージとして表示される

### 第5段階: ユーザー閲覧ポリシー作成
```sql
-- 認証済みユーザーが自分の申請を閲覧可能
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');
```
**期待結果**: `CREATE POLICY` が成功メッセージとして表示される

### 第6段階: 管理者閲覧ポリシー作成
```sql
-- 管理者が全申請を閲覧可能
CREATE POLICY "Admins can view all applications"
ON user_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);
```
**期待結果**: `CREATE POLICY` が成功メッセージとして表示される

### 第7段階: 管理者更新ポリシー作成
```sql
-- 管理者が申請ステータスを更新可能
CREATE POLICY "Admins can update application status"
ON user_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);
```
**期待結果**: `CREATE POLICY` が成功メッセージとして表示される

### 第8段階: RLS有効化と権限設定
```sql
-- RLSを有効化し、必要な権限を付与
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;
```
**期待結果**: `ALTER TABLE` と `GRANT` が成功メッセージとして表示される

### 第9段階: 最終確認
```sql
-- 作成されたポリシー確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;
```
**期待結果**: 新しく作成された4つのポリシーが表示される
- "Allow public application submission"
- "Admins can update application status"
- "Admins can view all applications"
- "Users can view their own applications"

```sql
-- RLS状態確認
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';
```
**期待結果**: `rowsecurity` が `t` (true) で表示される

## 実行結果の検証

### 成功判定基準
1. 全てのSQLが正常実行される
2. 新しい4つのポリシーが作成される
3. RLSが有効化される
4. 匿名ユーザーのINSERT権限が付与される

### 失敗時の対処法
- **ポリシー重複エラー**: 既存ポリシーが残っている場合、第3段階を再実行
- **権限エラー**: データベース管理者権限で実行されているか確認
- **テーブル存在エラー**: user_applicationsテーブルの存在を確認

## セキュリティ考慮事項
- 匿名ユーザーはINSERTのみ許可（SELECT, UPDATE, DELETEは不可）
- 認証済みユーザーは自分の申請のみ閲覧可能
- 管理者のみ全申請の閲覧・更新が可能
- RLSにより行レベルでのアクセス制御が実施される

## 期待される効果
- 401 Unauthorizedエラーの解消
- 匿名ユーザーによる申請フォーム送信の正常動作
- セキュリティを維持した適切なアクセス制御の実現

## トラブルシューティング

### よくあるエラーと対処法

1. **"policy already exists"エラー**
   - 解決策: 第3段階で対象ポリシーを明示的に削除

2. **"permission denied"エラー**
   - 解決策: データベース所有者またはスーパーユーザー権限で実行

3. **"relation does not exist"エラー**
   - 解決策: user_applicationsテーブルの存在確認、必要に応じて作成

4. **RLS設定が反映されない**
   - 解決策: ブラウザキャッシュクリア、Supabaseクライアント再接続

## 注意事項
- 本修正は本番環境への影響があるため、実行前にバックアップを推奨
- 修正後は必ずアプリケーションでの動作確認を実施
- エラーが発生した場合は途中で中断し、原因調査を優先