# RLS修正後の検証とトラブルシューティングガイド

## 実行後の検証手順

### 1. Supabase SQL Editorでの最終確認

#### ポリシー作成確認
```sql
-- 期待される4つのポリシーが存在することを確認
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;
```

**期待される結果:**
```
policyname                          | cmd    | roles
------------------------------------|--------|------------------
Admins can update application status| UPDATE | {authenticated}
Admins can view all applications    | SELECT | {authenticated}
Allow public application submission | INSERT | {anon,authenticated}
Users can view their own applications| SELECT | {authenticated}
```

#### RLS有効化確認
```sql
-- RLSが有効化されていることを確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';
```

**期待される結果:**
```
tablename         | rowsecurity
------------------|------------
user_applications | t
```

#### 権限設定確認
```sql
-- 匿名ユーザーのINSERT権限確認
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'user_applications'
AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
```

### 2. アプリケーションレベルでの動作確認

#### 2.1 匿名ユーザーの申請送信テスト
1. ブラウザのプライベート/シークレットモードでアプリケーションにアクセス
2. ユーザー申請フォームにアクセス
3. 必要事項を入力して送信
4. エラーなく送信完了することを確認

#### 2.2 認証ユーザーの申請閲覧テスト
1. 通常モードでアプリケーションにログイン
2. 自分の申請一覧にアクセス
3. 自分の申請のみが表示されることを確認

#### 2.3 管理者権限テスト（該当する場合）
1. 管理者アカウントでログイン
2. 全申請一覧にアクセス
3. 全ユーザーの申請が表示されることを確認
4. 申請ステータスの更新が可能であることを確認

## トラブルシューティング

### よくあるエラーと対処法

#### エラー1: "new row violates row-level security policy"
**原因:** RLSポリシーの設定に問題がある
**対処法:**
```sql
-- ポリシーの再確認と必要に応じて再作成
DROP POLICY IF EXISTS "Allow public application submission" ON user_applications;
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

#### エラー2: "permission denied for table user_applications"
**原因:** 匿名ユーザーの権限が正しく設定されていない
**対処法:**
```sql
-- 権限の再付与
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;
```

#### エラー3: "policy already exists"
**原因:** 既存のポリシーが残っている
**対処法:**
```sql
-- 既存ポリシーの強制削除
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;
DROP POLICY IF EXISTS "Allow public application submission" ON user_applications;
-- その後、新しいポリシーを作成
```

#### エラー4: 401 Unauthorized（修正後も継続）
**原因:** ブラウザキャッシュまたはSupabaseクライアントのキャッシュ
**対処法:**
1. ブラウザの完全リロード（Ctrl+F5）
2. ブラウザキャッシュのクリア
3. アプリケーションの再起動
4. Supabaseクライアントの再初期化

### デバッグ用SQL

#### 現在のセッション情報確認
```sql
-- 現在のユーザーとロール確認
SELECT
  current_user,
  session_user,
  current_setting('role') as current_role;
```

#### 具体的なポリシー詳細確認
```sql
-- ポリシーの詳細情報表示
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_applications';
```

#### テーブル権限の詳細確認
```sql
-- テーブルへのアクセス権限詳細
SELECT
  grantor,
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable,
  with_hierarchy
FROM information_schema.role_table_grants
WHERE table_name = 'user_applications';
```

## 修正が成功した場合の期待される動作

### 匿名ユーザー（未ログイン状態）
- ✅ 申請フォームへのアクセス可能
- ✅ 申請データの送信可能
- ❌ 既存申請の閲覧不可
- ❌ 申請データの更新・削除不可

### 認証済みユーザー（ログイン状態）
- ✅ 申請フォームへのアクセス可能
- ✅ 申請データの送信可能
- ✅ 自分の申請履歴の閲覧可能
- ❌ 他人の申請の閲覧不可
- ❌ 申請データの更新・削除不可（一般ユーザー）

### 管理者ユーザー
- ✅ 申請フォームへのアクセス可能
- ✅ 申請データの送信可能
- ✅ 全ユーザーの申請閲覧可能
- ✅ 申請ステータスの更新可能

## セキュリティ確認事項

### 確認すべきポイント
1. **匿名ユーザーが他人の申請を閲覧できない**
2. **認証ユーザーが他人の申請を閲覧できない**
3. **管理者以外がステータス更新できない**
4. **削除操作が制限されている**

### セキュリティテストSQL
```sql
-- 匿名ユーザーとしての読み取りテスト（失敗することを期待）
SET ROLE anon;
SELECT * FROM user_applications; -- エラーになるべき

-- 権限を戻す
RESET ROLE;
```

## ロールバック手順（問題が発生した場合）

### 緊急時のRLS無効化
```sql
-- 一時的にRLSを無効化（緊急時のみ）
ALTER TABLE user_applications DISABLE ROW LEVEL SECURITY;
```

### 元の制限的ポリシーへの復元
```sql
-- 新しいポリシーを削除
DROP POLICY IF EXISTS "Allow public application submission" ON user_applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON user_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON user_applications;
DROP POLICY IF EXISTS "Admins can update application status" ON user_applications;

-- 元のポリシーを復元
CREATE POLICY "Users can only access their own applications" ON user_applications
FOR ALL TO authenticated
USING (email = auth.jwt() ->> 'email')
WITH CHECK (email = auth.jwt() ->> 'email');

-- 匿名ユーザー権限を削除
REVOKE INSERT ON user_applications FROM anon;
```

## 成功確認チェックリスト

- [ ] 4つの新しいポリシーが作成されている
- [ ] RLSが有効化されている
- [ ] 匿名ユーザーのINSERT権限が設定されている
- [ ] 認証ユーザーのSELECT/UPDATE権限が設定されている
- [ ] アプリケーションで匿名申請が正常動作する
- [ ] 401 Unauthorizedエラーが解消されている
- [ ] セキュリティ要件が満たされている

## 注意事項

1. **本番環境での実行は慎重に行う**
2. **実行前にデータベースのバックアップを取得する**
3. **段階的に実行し、各段階で結果を確認する**
4. **問題が発生した場合は即座にロールバックを検討する**
5. **修正後は必ず本格的な動作テストを実施する**