# user_applicationsテーブル RLSポリシー修正手順

## 現在の問題
- 匿名ユーザーからの申請フォーム送信が「401 Unauthorized」エラーで失敗
- RLSポリシーで匿名ユーザーのINSERT操作が許可されていない

## 修正手順

### 1. Supabase SQLエディターにアクセス
1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクト `tleequspizctgoosostd` を選択
3. 左サイドバーから「SQL Editor」をクリック

### 2. 現状確認（オプション）
```sql
-- 現在のRLSポリシー確認
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;

-- RLS有効状態確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';
```

### 3. RLSポリシー修正SQLの実行

以下のSQLを **順番に** 実行してください：

```sql
-- =============================================================================
-- Phase 1: 既存ポリシーの削除
-- =============================================================================

DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;
DROP POLICY IF EXISTS "Enable read access for users based on email" ON user_applications;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_applications;
DROP POLICY IF EXISTS "Enable insert for anon users" ON user_applications;
```

```sql
-- =============================================================================
-- Phase 2: 新しいRLSポリシーの作成
-- =============================================================================

-- 1. 匿名ユーザーによる申請フォーム送信を許可
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

```sql
-- 2. 認証済みユーザーが自分の申請を閲覧
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');
```

```sql
-- 3. 管理者がすべての申請を閲覧
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

```sql
-- 4. 管理者が申請ステータスを更新
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

```sql
-- =============================================================================
-- Phase 3: テーブル設定の更新
-- =============================================================================

-- RLSを有効化
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- 権限の付与
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;
```

### 4. 実行結果の確認

```sql
-- 新しいポリシーの確認
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;

-- 権限確認
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'user_applications'
ORDER BY grantee;
```

### 5. 動作テスト

修正完了後、以下のコマンドで動作確認：

```bash
node scripts/correct_rls_test.js
```

**期待される結果：**
```
✅ INSERT成功!
🎉 RLSポリシーが正しく動作しています
   ✅ 匿名ユーザーによるINSERTが許可されています
```

## 新しいポリシーの説明

| ポリシー名 | 対象操作 | 対象ユーザー | 説明 |
|------------|----------|-------------|------|
| Allow public application submission | INSERT | anon, authenticated | 匿名・認証済みユーザーの申請投稿を許可 |
| Users can view their own applications | SELECT | authenticated | ユーザーが自分の申請のみ閲覧可能 |
| Admins can view all applications | SELECT | authenticated | 管理者がすべての申請を閲覧可能 |
| Admins can update application status | UPDATE | authenticated | 管理者が申請ステータスを更新可能 |

## トラブルシューティング

### エラー: "relation does not exist"
- user_applicationsテーブルが存在しない場合
- テーブル作成が必要

### エラー: "permission denied"
- 十分な権限がない場合
- データベース管理者権限で実行する必要がある

### エラー: "policy already exists"
- 既存ポリシーが残っている場合
- Phase 1の削除処理を再実行

## 完了チェックリスト

- [ ] 既存ポリシーの削除完了
- [ ] 新しいポリシー4つの作成完了
- [ ] RLS有効化確認
- [ ] 権限付与確認
- [ ] 動作テスト成功確認

修正完了後、申請フォームからの送信が正常に動作するようになります。