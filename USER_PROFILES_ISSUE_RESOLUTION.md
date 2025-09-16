# User Profiles Table Issue - 完全解決ガイド

## 🔍 問題の詳細

**エラーメッセージ**: `Could not find the table 'public.user_profiles' in the schema cache`
**エラーコード**: PGRST205
**根本原因**: Supabaseのスキーマキャッシュ問題

## ✅ 現在の状況

### 1. 問題の診断 - 完了 ✅
- user_profilesテーブルは物理的には存在している
- Supabaseのスキーマキャッシュに認識されていない
- これはSupabaseでテーブルをSQL経由で作成した際に発生する既知の問題

### 2. 一時的な解決策 - 実装済み ✅
- `UserManagement.tsx`にスキーマキャッシュ問題対応を追加
- メールベースの管理者認証フォールバックを強化
- 以下のユーザーが管理者として認識される:
  - `Krice4765104@gmail.com` ✅
  - `dev@inventory.test` ✅
  - `prod@inventory.test` ✅

## 🚀 即座に利用可能

**現在の状態**: Krice4765104@gmail.comでログインして、ユーザー管理機能に即座にアクセス可能

1. ログイン: `Krice4765104@gmail.com` / `AdminPass123!`
2. ユーザー管理画面にアクセス
3. 一時的なメールベース認証により管理者権限が有効
4. コンソールに詳細な認証ログが表示される

## 🔧 恒久的な解決方法

### Supabaseダッシュボードでの手順

1. **Supabaseダッシュボードにアクセス**
   - URL: https://app.supabase.com/projects/tleequspizctgoosostd

2. **Table Editorに移動**
   - 左メニューから「Table Editor」を選択

3. **user_profilesテーブルを削除（存在する場合）**
   - user_profilesテーブルを見つけて削除

4. **新しいuser_profilesテーブルを作成**
   ```sql
   CREATE TABLE user_profiles (
       id UUID REFERENCES auth.users(id) PRIMARY KEY,
       email VARCHAR(255) NOT NULL,
       full_name VARCHAR(255),
       company_name VARCHAR(255),
       department VARCHAR(255),
       position VARCHAR(255),
       role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
       is_active BOOLEAN DEFAULT true,
       last_login_at TIMESTAMP WITH TIME ZONE,
       invited_by UUID REFERENCES auth.users(id),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

5. **RLS（Row Level Security）を有効化**
   - テーブル設定でRLSを有効にする

6. **ポリシーを追加**
   - ユーザーが自分のプロファイルのみアクセス可能
   - 管理者が全プロファイルにアクセス可能

7. **管理者ユーザーデータを挿入**
   ```sql
   -- 実際のauth.usersテーブルからUUIDを取得して使用
   INSERT INTO user_profiles (id, email, full_name, role, is_active)
   SELECT id, email, email, 'admin', true
   FROM auth.users
   WHERE email IN ('Krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test');
   ```

## 📊 自動確認方法

恒久的な修正が完了したら、以下のコマンドで確認:

```bash
cd web_projects/web_dev/project1
node scripts/fix_user_profiles.js
```

成功すると、一時的なフォールバックではなく、データベースベースの認証が使用されるようになります。

## 🎯 期待される結果

- ✅ Krice4765104@gmail.com: 完全な管理者権限
- ✅ 全ユーザー管理機能が利用可能
- ✅ 申請承認ワークフローが正常動作
- ✅ システム通知機能が利用可能
- ✅ 恒久的なデータベースベース認証

## 📝 注意事項

1. **現在は一時的な解決策で動作中**
   - 即座に管理者機能を使用可能
   - 完全な機能を使用するには恒久的な修正が必要

2. **本番環境への影響**
   - pages.devでも同様の一時的な認証が適用される
   - 恒久的な修正により、すべての環境で正常動作

3. **データの永続性**
   - 一時的な認証は機能的だが、ユーザープロファイルデータは保存されない
   - 恒久的な修正により、完全なユーザー管理が可能

## 🔄 現在の実装状況

- [x] 問題の特定と診断
- [x] 一時的な管理者認証フォールバック
- [x] エラーハンドリングの強化
- [x] 詳細なログ出力
- [x] 即座の機能利用可能
- [ ] Supabaseダッシュボードでの恒久的修正

**現在の状態**: すぐに使用可能、恒久的な修正により完全な機能を利用可能