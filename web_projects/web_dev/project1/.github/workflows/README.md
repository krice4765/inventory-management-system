# GitHub Actions E2E Test Workflow

このディレクトリには、E2Eテストを自動実行するためのGitHub Actionsワークフローが含まれています。

## ワークフロー概要

### e2e-tests.yml

このワークフローは、以下のイベントで自動実行されます：

- `main`ブランチへのpush
- `feature/**`ブランチへのpush
- `main`ブランチへのPull Request

### 実行内容

1. リポジトリのコードをチェックアウト
2. Node.js 20をセットアップ
3. npm依存関係をインストール
4. Playwrightブラウザをインストール
5. テスト用環境変数ファイル（.env.test）を作成
6. E2Eテストを実行
7. テスト結果とビデオをアーティファクトとして保存

## 必要なGitHub Secrets設定

ワークフローを実行するには、以下のSecretsをリポジトリに設定する必要があります。

### 設定手順

1. GitHubリポジトリページを開く
2. **Settings** → **Secrets and variables** → **Actions** に移動
3. **New repository secret** をクリック
4. 以下の各Secretを追加

### 必要なSecrets一覧

| Secret名 | 説明 | 例 |
|---------|------|-----|
| `VITE_SUPABASE_URL` | SupabaseプロジェクトのURL | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabaseの匿名キー | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `E2E_TEST_USER_EMAIL` | E2Eテスト用一般ユーザーのメールアドレス | `e2e-test-user@example.com` |
| `E2E_TEST_USER_PASSWORD` | E2Eテスト用一般ユーザーのパスワード | `your-test-password` |
| `E2E_TEST_ADMIN_EMAIL` | E2Eテスト用管理者ユーザーのメールアドレス | `e2e-test-admin@example.com` |
| `E2E_TEST_ADMIN_PASSWORD` | E2Eテスト用管理者ユーザーのパスワード | `your-admin-password` |

### Supabase設定の取得方法

1. [Supabaseダッシュボード](https://supabase.com/dashboard)にログイン
2. プロジェクトを選択
3. **Settings** → **API** に移動
4. 以下の値をコピー:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`

### テストユーザーの作成

E2Eテスト用のユーザーをSupabase Authenticationに作成してください：

1. Supabaseダッシュボードで **Authentication** → **Users** に移動
2. **Add user** → **Create new user** をクリック
3. 一般ユーザーと管理者ユーザーを作成
4. メールアドレスとパスワードをGitHub Secretsに設定

## テスト結果の確認

### アーティファクトの確認方法

1. GitHubリポジトリの **Actions** タブを開く
2. 実行したワークフローをクリック
3. **Artifacts** セクションから以下をダウンロード:
   - `playwright-report`: HTMLレポート
   - `test-videos`: 失敗したテストのビデオ（テスト失敗時のみ）

### ローカルでのテスト実行

```bash
# 依存関係のインストール
npm install

# Playwrightブラウザのインストール
npx playwright install chromium

# .env.testファイルを作成（必要な環境変数を設定）
cp .env.example .env.test

# E2Eテストの実行
npm run test:e2e

# 特定のテストファイルのみ実行
npm run test:e2e -- e2e/tests/login.spec.ts

# UIモードでテストを実行（デバッグ用）
npm run test:e2e:ui
```

## トラブルシューティング

### ワークフローが失敗する場合

1. **Secretsの確認**: すべての必要なSecretsが正しく設定されているか確認
2. **テストユーザーの確認**: Supabaseにテストユーザーが存在するか確認
3. **ログの確認**: Actionsタブでワークフローのログを確認
4. **アーティファクトの確認**: 失敗したテストのビデオとレポートを確認

### よくあるエラー

#### `VITE_SUPABASE_URL is not defined`
- GitHub SecretsにSupabase URLが設定されているか確認
- Secret名が正確に一致しているか確認

#### `Authentication failed`
- テストユーザーの認証情報が正しいか確認
- Supabaseでユーザーが有効化されているか確認

#### `Timeout waiting for element`
- テストタイムアウト設定を確認（デフォルト: 60秒）
- ネットワークやSupabaseのレスポンス速度を確認

## 参考リンク

- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Supabase Documentation](https://supabase.com/docs)
