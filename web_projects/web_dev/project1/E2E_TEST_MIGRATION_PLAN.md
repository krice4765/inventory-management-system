# E2Eテスト移行計画

## 目的

単体テストでカバーできなかったフォーム送信機能を、Playwright E2Eテストで包括的にカバーし、本番環境での信頼性を向上させる。

---

## スコープ

### 対象機能（優先度順）

#### 🔴 優先度1: ビジネスクリティカル（必須）
1. **OrderNew (発注登録)**
   - 影響範囲: 仕入れ業務の根幹
   - テストケース数: 10件
   - 実装期間: 1日

2. **SalesOrderNew (受注登録)**
   - 影響範囲: 販売業務の根幹
   - テストケース数: 10件
   - 実装期間: 1日

#### 🟡 優先度2: 重要（推奨）
3. **PaymentNew (支払登録)**
   - テストケース数: 5件
   - 実装期間: 0.5日

4. **InventoryAdjustment (在庫調整)**
   - テストケース数: 5件
   - 実装期間: 0.5日

#### 🟢 優先度3: 補完的（任意）
5. **その他フォーム**
   - パートナー登録
   - 商品登録
   - 等

---

## 技術選定

### Playwright を選択する理由

| 基準 | Playwright | Cypress | Selenium |
|------|------------|---------|----------|
| TypeScript対応 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 実行速度 | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| 複数ブラウザ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| デバッグツール | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| CI/CD統合 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 学習曲線 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| プロジェクト利用 | ✅ 既存 | ❌ | ❌ |

**決定**: Playwright（Claude CodeのMCPツールとして既に利用可能）

---

## 実装詳細

### フェーズ1: 環境セットアップ（1日）

#### 1.1 Playwrightインストール

```bash
# パッケージインストール
npm install -D @playwright/test

# ブラウザインストール
npx playwright install chromium firefox webkit

# VS Code拡張機能（推奨）
code --install-extension ms-playwright.playwright
```

#### 1.2 ディレクトリ構造

```
project1/
├── e2e/
│   ├── fixtures/
│   │   ├── auth.ts          # 認証ヘルパー
│   │   ├── db.ts            # DBヘルパー
│   │   └── test-data.ts     # テストデータ
│   ├── pages/
│   │   ├── LoginPage.ts     # Page Object
│   │   ├── OrderNewPage.ts
│   │   └── SalesOrderNewPage.ts
│   ├── tests/
│   │   ├── order-new.spec.ts
│   │   ├── sales-order-new.spec.ts
│   │   └── ...
│   └── utils/
│       ├── helpers.ts
│       └── constants.ts
├── playwright.config.ts
└── .env.test
```

#### 1.3 設定ファイル

**playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// テスト環境変数読み込み
dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e/tests',

  // タイムアウト設定
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  // 失敗時のリトライ
  retries: process.env.CI ? 2 : 0,

  // 並列実行
  workers: process.env.CI ? 2 : 4,

  // レポーター
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  use: {
    // ベースURL
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // トレース設定
    trace: 'on-first-retry',

    // スクリーンショット
    screenshot: 'only-on-failure',

    // 動画録画
    video: 'retain-on-failure',

    // ブラウザコンテキスト
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  // 開発サーバー起動
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // ブラウザプロジェクト
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // モバイル（オプション）
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

**.env.test**
```env
# Supabaseテスト環境
VITE_SUPABASE_URL=https://your-project-test.supabase.co
VITE_SUPABASE_ANON_KEY=your-test-anon-key

# アプリケーション設定
BASE_URL=http://localhost:5173

# テストユーザー
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=adminpassword123
```

#### 1.4 共通Fixtures

**e2e/fixtures/auth.ts**
```typescript
import { Page } from '@playwright/test';

export class AuthFixture {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');

    // ログイン成功を待機
    await this.page.waitForURL(/\/(?!login)/);
  }

  async loginAsTestUser() {
    await this.login(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!
    );
  }

  async loginAsAdmin() {
    await this.login(
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!
    );
  }

  async logout() {
    await this.page.click('[aria-label="ユーザーメニュー"]');
    await this.page.click('text=ログアウト');
    await this.page.waitForURL('/login');
  }
}
```

**e2e/fixtures/db.ts**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class DBFixture {
  // テストデータのクリーンアップ
  async cleanup() {
    // テスト用データを削除
    await supabase.from('purchase_order_items').delete().like('product_id', 'test-%');
    await supabase.from('purchase_orders').delete().like('order_no', 'TEST-%');
    await supabase.from('sales_order_items').delete().like('product_id', 'test-%');
    await supabase.from('sales_orders').delete().like('order_no', 'TEST-%');
  }

  // テストデータのシード
  async seed() {
    // テスト用仕入先
    await supabase.from('partners').upsert([
      {
        id: 'test-supplier-1',
        name: 'テスト仕入先A',
        partner_code: 'TEST-SUP-001',
        partner_type: 'supplier',
      },
    ]);

    // テスト用顧客
    await supabase.from('partners').upsert([
      {
        id: 'test-customer-1',
        name: 'テスト顧客A',
        partner_code: 'TEST-CUST-001',
        partner_type: 'customer',
      },
    ]);

    // テスト用商品
    await supabase.from('products').upsert([
      {
        id: 'test-product-1',
        product_name: 'テスト商品A',
        product_code: 'TEST-PROD-001',
        purchase_price: 1000,
        selling_price: 2000,
      },
      {
        id: 'test-product-2',
        product_name: 'テスト商品B',
        product_code: 'TEST-PROD-002',
        purchase_price: 1500,
        selling_price: 2500,
      },
    ]);
  }
}
```

---

### フェーズ2: Page Object実装（0.5日）

#### Page Objectパターン

**e2e/pages/OrderNewPage.ts**
```typescript
import { Page, Locator } from '@playwright/test';

export class OrderNewPage {
  readonly page: Page;

  // セレクタ
  readonly supplierSelect: Locator;
  readonly orderDateInput: Locator;
  readonly deliveryDeadlineInput: Locator;
  readonly addItemButton: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.supplierSelect = page.locator('[data-testid="supplier-select"]');
    this.orderDateInput = page.locator('[name="order_date"]');
    this.deliveryDeadlineInput = page.locator('[name="delivery_deadline"]');
    this.addItemButton = page.locator('button:has-text("明細追加")');
    this.submitButton = page.locator('button:has-text("発注登録")');
    this.cancelButton = page.locator('button:has-text("キャンセル")');
  }

  async goto() {
    await this.page.goto('/orders/new');
    await this.page.waitForLoadState('networkidle');
  }

  async selectSupplier(supplierName: string) {
    // react-selectを開く
    await this.page.click('.react-select__control');

    // 検索
    await this.page.type('.react-select__input input', supplierName);

    // オプション選択
    await this.page.click(`.react-select__option:has-text("${supplierName}")`);
  }

  async fillOrderDate(date: string) {
    await this.orderDateInput.fill(date);
  }

  async fillDeliveryDeadline(date: string) {
    await this.deliveryDeadlineInput.fill(date);
  }

  async selectProduct(rowIndex: number, productName: string) {
    const row = this.page.locator(`[data-testid="item-row-${rowIndex}"]`);

    await row.locator('.react-select__control').click();
    await row.locator('.react-select__input input').type(productName);
    await row.locator(`.react-select__option:has-text("${productName}")`).click();
  }

  async fillQuantity(rowIndex: number, quantity: string) {
    const row = this.page.locator(`[data-testid="item-row-${rowIndex}"]`);
    await row.locator('[name=`items.${rowIndex}.quantity`]').fill(quantity);
  }

  async getUnitPrice(rowIndex: number): Promise<string> {
    const row = this.page.locator(`[data-testid="item-row-${rowIndex}"]`);
    return await row.locator('[name=`items.${rowIndex}.unit_price`]').inputValue();
  }

  async addItem() {
    await this.addItemButton.click();
  }

  async removeItem(rowIndex: number) {
    const row = this.page.locator(`[data-testid="item-row-${rowIndex}"]`);
    await row.locator('button[aria-label="削除"]').click();
  }

  async getItemCount(): Promise<number> {
    return await this.page.locator('[data-testid^="item-row-"]').count();
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async getTotalAmount(): Promise<string> {
    return await this.page.locator('[data-testid="total-amount"]').textContent() || '';
  }
}
```

---

### フェーズ3: テスト実装（2日）

#### OrderNew E2Eテスト

**e2e/tests/order-new.spec.ts**
```typescript
import { test, expect } from '@playwright/test';
import { AuthFixture } from '../fixtures/auth';
import { DBFixture } from '../fixtures/db';
import { OrderNewPage } from '../pages/OrderNewPage';

test.describe('OrderNew - 発注登録', () => {
  let auth: AuthFixture;
  let db: DBFixture;
  let orderPage: OrderNewPage;

  test.beforeEach(async ({ page }) => {
    auth = new AuthFixture(page);
    db = new DBFixture();
    orderPage = new OrderNewPage(page);

    // テストデータ準備
    await db.cleanup();
    await db.seed();

    // ログイン
    await auth.loginAsTestUser();

    // ページ遷移
    await orderPage.goto();
  });

  test.afterEach(async () => {
    // クリーンアップ
    await db.cleanup();
  });

  test('正常系: 発注を正常に登録できる', async ({ page }) => {
    // 仕入先選択
    await orderPage.selectSupplier('テスト仕入先A');

    // 発注日入力
    await orderPage.fillOrderDate('2025-01-15');

    // 納品期限入力
    await orderPage.fillDeliveryDeadline('2025-01-31');

    // 商品選択
    await orderPage.selectProduct(0, 'テスト商品A');

    // 数量入力
    await orderPage.fillQuantity(0, '10');

    // 単価が自動入力されることを確認
    const unitPrice = await orderPage.getUnitPrice(0);
    expect(parseInt(unitPrice)).toBe(1000);

    // 合計金額確認
    const totalAmount = await orderPage.getTotalAmount();
    expect(totalAmount).toContain('¥11,000'); // 税込み

    // フォーム送信
    await orderPage.submit();

    // 成功メッセージの確認
    await expect(page.locator('text=/発注番号.*を登録しました/')).toBeVisible({
      timeout: 10000,
    });

    // リダイレクト確認
    await expect(page).toHaveURL(/\/orders$/);

    // 登録された発注が表示されることを確認
    await expect(page.locator('text=/PO-|TEST-/')).toBeVisible();
  });

  test('異常系: 必須項目未入力でバリデーションエラー', async ({ page }) => {
    // 何も入力せずに送信
    await orderPage.submit();

    // バリデーションエラーメッセージの確認
    await expect(page.locator('text=/仕入先を選択してください/')).toBeVisible();
    await expect(page.locator('text=/発注日を入力してください/')).toBeVisible();
    await expect(page.locator('text=/納品期限を入力してください/')).toBeVisible();
  });

  test('異常系: 商品未選択でバリデーションエラー', async ({ page }) => {
    // 基本情報のみ入力
    await orderPage.selectSupplier('テスト仕入先A');
    await orderPage.fillOrderDate('2025-01-15');
    await orderPage.fillDeliveryDeadline('2025-01-31');
    // 商品は選択しない

    // 送信
    await orderPage.submit();

    // エラー確認
    await expect(page.locator('text=/商品を選択してください/')).toBeVisible();
  });

  test('操作: 明細行を追加できる', async ({ page }) => {
    // 初期状態: 1行
    expect(await orderPage.getItemCount()).toBe(1);

    // 行追加
    await orderPage.addItem();
    expect(await orderPage.getItemCount()).toBe(2);

    // さらに追加
    await orderPage.addItem();
    expect(await orderPage.getItemCount()).toBe(3);
  });

  test('操作: 明細行を削除できる', async ({ page }) => {
    // 2行追加
    await orderPage.addItem();
    await orderPage.addItem();
    expect(await orderPage.getItemCount()).toBe(3);

    // 2行目削除
    await orderPage.removeItem(1);
    expect(await orderPage.getItemCount()).toBe(2);

    // 最後の行削除
    await orderPage.removeItem(1);
    expect(await orderPage.getItemCount()).toBe(1);

    // 最後の1行は削除ボタンが表示されない
    await expect(page.locator('[data-testid="item-row-0"] button[aria-label="削除"]')).not.toBeVisible();
  });

  test('計算: 複数明細の合計金額が正しく計算される', async ({ page }) => {
    // 1行目
    await orderPage.selectProduct(0, 'テスト商品A'); // 単価1000
    await orderPage.fillQuantity(0, '5'); // 小計5000

    // 2行目追加
    await orderPage.addItem();
    await orderPage.selectProduct(1, 'テスト商品B'); // 単価1500
    await orderPage.fillQuantity(1, '3'); // 小計4500

    // 合計: (5000 + 4500) * 1.1 = 10450
    const totalAmount = await orderPage.getTotalAmount();
    expect(totalAmount).toContain('¥10,450');
  });

  test('操作: キャンセルボタンで一覧に戻る', async ({ page }) => {
    await orderPage.cancel();
    await expect(page).toHaveURL(/\/orders$/);
  });

  test('異常系: サーバーエラー時のエラーメッセージ表示', async ({ page }) => {
    // ネットワークエラーをシミュレート
    await page.route('**/rest/v1/purchase_orders', route => {
      route.abort('failed');
    });

    // フォーム入力
    await orderPage.selectSupplier('テスト仕入先A');
    await orderPage.fillOrderDate('2025-01-15');
    await orderPage.fillDeliveryDeadline('2025-01-31');
    await orderPage.selectProduct(0, 'テスト商品A');
    await orderPage.fillQuantity(0, '10');

    // 送信
    await orderPage.submit();

    // エラーメッセージ確認
    await expect(page.locator('text=/登録に失敗しました/')).toBeVisible();
  });

  test('アクセシビリティ: タブキーでフォーム操作可能', async ({ page }) => {
    // Tabキーでフォーカス移動
    await page.keyboard.press('Tab'); // 仕入先
    await page.keyboard.press('Tab'); // 発注日
    await page.keyboard.press('Tab'); // 納品期限
    await page.keyboard.press('Tab'); // 納品先
    // ... 以下同様

    // Enterキーで送信できることを確認
    await page.keyboard.press('Enter');
    await expect(page.locator('text=/を選択してください/')).toBeVisible();
  });

  test('パフォーマンス: ページ読み込みが2秒以内', async ({ page }) => {
    const start = Date.now();
    await orderPage.goto();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);
  });
});
```

---

### フェーズ4: CI/CD統合（1日）

#### GitHub Actions設定

**.github/workflows/e2e-tests.yml**
```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: daun/playwright-report-comment@v3
        with:
          report-path: playwright-report
```

#### package.json スクリプト追加

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:chrome": "playwright test --project=chromium",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## タイムライン

### 週次計画

| 週 | タスク | 成果物 | 担当 |
|----|--------|--------|------|
| Week 1 | セットアップ + OrderNew | 環境構築、10テスト | 開発者A |
| Week 2 | SalesOrderNew | 10テスト | 開発者A |
| Week 3 | 優先度2実装 + CI/CD | 10テスト、CI設定 | 開発者B |
| Week 4 | レビュー、調整、文書化 | ドキュメント | チーム |

### 詳細スケジュール（Week 1）

| 日 | タスク | 時間 | 成果 |
|----|--------|------|------|
| 月 | 環境セットアップ | 4h | Playwright設定完了 |
| 月 | Fixtures実装 | 4h | 認証・DBヘルパー完成 |
| 火 | Page Object | 4h | OrderNewPage完成 |
| 火 | テスト1-3 | 4h | 正常系・異常系 |
| 水 | テスト4-7 | 8h | 操作・計算テスト |
| 木 | テスト8-10 | 4h | エラー・A11y・性能 |
| 木 | レビュー | 4h | コードレビュー完了 |
| 金 | バッファ | 8h | 予備日 |

---

## 成功基準

### 定量的指標

1. **テストカバレッジ**
   - 優先度1機能: 100%カバー
   - 優先度2機能: 80%以上カバー

2. **テスト実行時間**
   - 全テスト実行: 5分以内
   - 1テストあたり: 30秒以内

3. **安定性**
   - Flaky Test率: 5%以下
   - CI成功率: 95%以上

### 定性的指標

1. **保守性**
   - Page Objectパターンの適用
   - コメント・ドキュメント完備

2. **可読性**
   - テストケース名が明確
   - Given-When-Then構造

---

## リスク管理

### 高リスク

#### リスク1: テスト環境の不安定性
**影響**: 大
**確率**: 中
**対策**:
- Supabaseテスト環境の専用化
- データクリーンアップの自動化
- リトライ機構の実装

#### リスク2: 実装遅延
**影響**: 中
**確率**: 中
**対策**:
- 週次バッファの確保
- 優先度の明確化
- 早期エスカレーション

### 中リスク

#### リスク3: Flaky Tests
**影響**: 中
**確率**: 高
**対策**:
- 明示的な待機処理
- Playwrightのauto-wait活用
- リトライ設定

---

## 予算

### 人件費

| 役割 | 工数 | 単価 | 小計 |
|------|------|------|------|
| シニア開発者 | 5日 | ¥80,000/日 | ¥400,000 |
| 開発者 | 5日 | ¥60,000/日 | ¥300,000 |
| QA | 3日 | ¥50,000/日 | ¥150,000 |
| **合計** | **13日** | - | **¥850,000** |

### インフラコスト

| 項目 | 月額 | 備考 |
|------|------|------|
| Supabaseテスト環境 | ¥5,000 | Pro plan |
| GitHub Actions | ¥0 | 無料枠内 |
| **合計** | **¥5,000** | - |

### 総コスト
**初期投資**: ¥850,000
**月額運用**: ¥5,000

---

## 次のステップ

### 即座に実行（承認後）
1. ✅ Playwrightインストール
2. ✅ 設定ファイル作成
3. ✅ サンプルテスト作成

### 今週中
4. ✅ Fixtures実装
5. ✅ Page Object実装
6. ✅ OrderNew テスト実装開始

### 来週
7. ✅ SalesOrderNew テスト実装
8. ✅ CI/CD統合

### 2週間後
9. ✅ レビュー・調整
10. ✅ 本番デプロイ

---

**作成日**: 2025-01-05
**作成者**: Claude Code
**承認待ち**: Product Owner / Tech Lead
**開始予定**: 2025-01-08
