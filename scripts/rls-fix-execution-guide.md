# RLS Policy Fix実行ガイド

## 概要
user_applicationsテーブルのRLSポリシー修正により、401 Unauthorizedエラーを解消し、匿名ユーザーからの申請フォーム送信を可能にします。

## 🎯 実行目標
- 匿名ユーザー（anon）からのINSERT操作を許可
- 認証済みユーザーの自分のデータ閲覧を許可
- 管理者（admin）の全データアクセスを許可
- セキュリティを維持しながら必要な機能を提供

## 📋 実行手順

### 方法1: Supabase Dashboard（推奨）

1. **Supabase Dashboardにアクセス**
   - URL: https://supabase.com/dashboard
   - プロジェクト: Access_仕入れ管理 (tleequspizctgoosostd)

2. **SQL Editorを開く**
   - 左メニューから「SQL Editor」を選択

3. **SQLクエリを実行**
   ```sql
   -- 第1段階: 既存ポリシー削除
   DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;

   -- 第2段階: 公開申請フォーム用ポリシー
   CREATE POLICY "Allow public application submission"
   ON user_applications FOR INSERT
   TO anon, authenticated
   WITH CHECK (true);

   -- 第3段階: ユーザー閲覧ポリシー
   CREATE POLICY "Users can view their own applications"
   ON user_applications FOR SELECT
   TO authenticated
   USING (email = auth.jwt() ->> 'email');

   -- 第4段階: 管理者閲覧ポリシー
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

   -- 第5段階: 管理者更新ポリシー
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

   -- 第6段階: RLS有効化と権限設定
   ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;
   GRANT INSERT ON user_applications TO anon;
   GRANT SELECT, UPDATE ON user_applications TO authenticated;
   ```

### 方法2: ローカルスクリプト実行（補助）

```bash
# テストスクリプト実行
cd C:/Users/kuris/Documents/AIproject/gemini-cli-tutorial/web_projects/web_dev/project1
node scripts/test-anonymous-insert.js
```

## 🧪 実行確認テスト

### 匿名INSERT確認
```javascript
// scripts/test-anonymous-insert.js を実行
// 期待結果: ✅ 成功メッセージ
```

### RLS状態確認
```sql
-- ポリシー一覧確認
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'user_applications';

-- RLS状態確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_applications';
```

## 📊 期待される結果

### 修正前
- ❌ 匿名ユーザーのINSERT: 401 Unauthorized
- ❌ 申請フォーム送信失敗

### 修正後
- ✅ 匿名ユーザーのINSERT: 成功
- ✅ 申請フォーム送信成功
- ✅ セキュリティ維持（ユーザー別閲覧制限）
- ✅ 管理者権限（全データアクセス）

## 🔧 トラブルシューティング

### エラー1: Policy already exists
```
解決: 既存ポリシーを先に削除してから作成
DROP POLICY IF EXISTS [ポリシー名] ON user_applications;
```

### エラー2: Permission denied
```
解決: service_roleキーを使用してSQL Editorで実行
```

### エラー3: 依然として401エラー
```
確認項目:
1. RLSが有効になっているか
2. anonロールに適切な権限が付与されているか
3. ポリシーが正しく作成されているか
```

## 📋 実行チェックリスト

- [ ] Supabase Dashboardにアクセス
- [ ] SQL Editorを開く
- [ ] 第1段階: 既存ポリシー削除
- [ ] 第2段階: 公開申請ポリシー作成
- [ ] 第3段階: ユーザー閲覧ポリシー作成
- [ ] 第4段階: 管理者閲覧ポリシー作成
- [ ] 第5段階: 管理者更新ポリシー作成
- [ ] 第6段階: RLS有効化と権限設定
- [ ] 匿名INSERTテスト実行
- [ ] アプリケーションでの動作確認

## 📧 実行完了報告

実行完了後、以下の情報を確認してください：

1. **実行結果**: 各段階の成功/失敗
2. **テスト結果**: 匿名INSERTの成功確認
3. **エラー状況**: 401エラーの解消確認
4. **セキュリティ**: 不正アクセス防止の維持

実行後は、アプリケーションの申請フォームから実際にテスト送信を行い、401エラーが解消されていることを確認してください。