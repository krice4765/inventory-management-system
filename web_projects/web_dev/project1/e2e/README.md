# E2E Test Guide

Playwrightを使用したEnd-to-Endテストガイド

## セットアップ

### 1. Playwrightのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.test` ファイルを作成し、テスト環境の設定を記述します：

```bash
# Supabase設定
VITE_SUPABASE_URL=your-supabase-test-url
VITE_SUPABASE_ANON_KEY=your-supabase-test-anon-key

# テストユーザー認証情報
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test-password

# テスト管理者認証情報
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=admin-password
```

### 3. テストユーザーの作成

Supabaseで以下のテストユーザーを作成してください：

- 通常ユーザー: `test@example.com`
- 管理者ユーザー: `admin@example.com`

## テスト実行

### 通常実行
```bash
npm run test:e2e
```

### UI Mode（推奨）
```bash
npm run test:e2e:ui
```

### ヘッドありモード（ブラウザが表示される）
```bash
npm run test:e2e:headed
```

### デバッグモード
```bash
npm run test:e2e:debug
```

## ディレクトリ構造

```
e2e/
├── fixtures/          # テスト用Fixture
│   ├── auth.ts        # 認証Fixture
│   └── db.ts          # データベースFixture
├── tests/             # テストファイル
│   ├── login.spec.ts                      # ログイン機能テスト
│   ├── authenticated-navigation.spec.ts   # 認証済みナビゲーションテスト
│   └── partner-management.spec.ts         # 取引先管理テスト
└── README.md          # このファイル
```

## Fixtureの使い方

### 認証Fixture

ログイン済みの状態でテストを開始できます：

```typescript
import { test, expect } from '../fixtures/auth';

test('ダッシュボードにアクセスできる', async ({ authenticatedPage }) => {
  // authenticatedPageは既にログイン済み
  await expect(authenticatedPage).toHaveURL(/\/dashboard/);
});

test('管理者機能にアクセスできる', async ({ adminPage }) => {
  // adminPageは管理者としてログイン済み
  await adminPage.goto('/payments');
  await expect(adminPage).toHaveURL(/\/payments/);
});
```

### データベースFixture

テストデータの作成とクリーンアップを自動化します：

```typescript
import { test, expect } from '../fixtures/db';

test('取引先を表示できる', async ({ authenticatedPage, db }) => {
  // テストデータを作成
  const partner = await db.createTestPartner({
    name: 'Test Partner',
    type: 'supplier',
  });

  // テストを実行
  await authenticatedPage.goto('/partners');
  await expect(authenticatedPage.getByText('Test Partner')).toBeVisible();

  // テスト後、自動的にクリーンアップされます
});
```

## ベストプラクティス

### 1. テストの独立性
各テストは独立して実行できるようにします。他のテストに依存しないこと。

### 2. テストデータの管理
- DBFixtureを使用してテストデータを作成
- テスト後は自動的にクリーンアップ
- テストデータには識別可能な名前を使用（例: "Test Partner"）

### 3. 待機処理
- `waitFor`よりも`expect`を使用
- 明示的な待機時間（`wait(1000)`）は避ける
- ページ遷移やデータ読み込みを適切に待つ

### 4. セレクター
- できるだけロール（`getByRole`）やラベル（`getByLabel`）を使用
- IDやクラス名への依存を避ける
- ユーザーの視点でセレクターを選択

## トラブルシューティング

### テストが失敗する場合

1. **環境変数の確認**
   - `.env.test`が正しく設定されているか
   - Supabase URLとAnon Keyが正しいか

2. **テストユーザーの確認**
   - Supabaseにテストユーザーが作成されているか
   - 認証情報が正しいか

3. **開発サーバーの確認**
   - `npm run dev`が実行されているか
   - `http://localhost:5173`にアクセスできるか

### デバッグ方法

1. **UIモードを使用**
   ```bash
   npm run test:e2e:ui
   ```

2. **ヘッドありモードで実行**
   ```bash
   npm run test:e2e:headed
   ```

3. **スクリーンショット/ビデオを確認**
   - 失敗したテストの`test-results/`ディレクトリを確認

## 次のステップ

- [ ] OrderNew/SalesOrderNewのフォーム送信E2Eテスト実装
- [ ] 在庫管理のE2Eテスト実装
- [ ] CI/CD統合
