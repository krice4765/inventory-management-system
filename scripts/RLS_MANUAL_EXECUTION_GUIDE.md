# RLSポリシー修正 手動実行ガイド

## 🎯 目的
user_applicationsテーブルのRLSポリシーを修正し、匿名ユーザーからの申請フォーム送信を可能にする

## 📋 現在の状況
- ✅ Supabase接続確認: 完了
- ✅ テーブル存在確認: user_applicationsテーブル存在
- ✅ スキーマ確認: 正しいカラム構造確認済み
- ❌ **問題**: 現在のRLSポリシーが匿名INSERTを拒否
- ❌ **制約**: PostgreSQL MCPサーバー利用不可、Service Roleキー未設定

## 🔧 解決手順

### 方法1: Supabaseダッシュボードから実行（推奨）

1. **Supabaseダッシュボードにアクセス**
   - URL: https://supabase.com/dashboard
   - プロジェクト: tleequspizctgoosostd

2. **SQL Editorを開く**
   - 左メニューから「SQL Editor」を選択
   - 新しいクエリを作成

3. **以下のSQLを順次実行**

```sql
-- ステップ1: 既存の制限的なポリシーを削除
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;
DROP POLICY IF EXISTS "authenticated_access_user_applications" ON user_applications;

-- ステップ2: 公開申請フォーム用ポリシー作成
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ステップ3: ユーザー閲覧ポリシー作成
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- ステップ4: 管理者閲覧ポリシー作成
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

-- ステップ5: 管理者更新ポリシー作成
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

-- ステップ6: RLS有効化と権限設定
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;
```

4. **ポリシー確認**
```sql
-- 作成されたポリシーの確認
SELECT
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'user_applications'
ORDER BY policyname;

-- RLS状態確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';
```

### 方法2: ローカル環境からService Roleキーで実行

1. **Service Roleキーを取得**
   - Supabaseダッシュボード > Settings > API
   - Service Role Keyをコピー

2. **環境変数に追加**
```bash
# .envファイルに追加
VITE_SUPABASE_SERVICE_KEY=your_service_role_key_here
```

3. **スクリプト実行**
```bash
cd /c/Users/kuris/Documents/AIproject/gemini-cli-tutorial/web_projects/web_dev/project1
node scripts/apply-rls-fix.js
```

## 🧪 動作テスト

### テスト1: 現在のローカルスクリプトで確認
```bash
node scripts/rls-fix-supabase.js
```

**期待される結果:**
```
✅ 申請送信成功！
挿入されたデータ: [テストデータ]
```

### テスト2: フロントエンド申請フォームでテスト
1. ブラウザでアプリにアクセス
2. `/user-application` にアクセス
3. フォームを入力して送信
4. 成功メッセージが表示されることを確認

## 📊 実行結果の期待値

### 修正前（現在）
```
❌ 申請送信エラー: new row violates row-level security policy for table "user_applications"
```

### 修正後（期待値）
```
✅ 申請送信成功！
🎉 RLSポリシーが正常に機能しています！
✨ 匿名ユーザーからの申請フォーム送信が可能になりました。
```

## 🔒 セキュリティ確認事項

修正後のポリシーにより以下が保証されます：

1. **匿名ユーザー**: INSERT操作のみ可能（申請送信）
2. **認証済みユーザー**: 自分のメールアドレスの申請のみ閲覧可能
3. **管理者**: 全ての申請の閲覧・更新が可能
4. **データ整合性**: WITH CHECK制約により不正なデータ挿入を防止

## 🎯 次のステップ

1. ✅ **手動でRLSポリシー修正を実行**
2. ✅ **動作テストで確認**
3. ✅ **本番申請フォームで最終テスト**
4. ✅ **401 Unauthorizedエラーの解消確認**

---

**注意**: 手動実行が完了したら、ローカルスクリプトで動作確認を行い、成功を報告してください。