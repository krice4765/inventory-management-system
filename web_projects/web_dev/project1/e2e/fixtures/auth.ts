import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * 認証Fixture
 *
 * テスト用ユーザーで自動的にログインした状態でテストを開始できます。
 */

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

/**
 * ログイン処理を実行
 */
async function login(page: Page, email: string, password: string) {
  await page.goto('/');

  // ログインページであることを確認
  await expect(page.getByRole('heading', { name: '在庫管理システム' })).toBeVisible();

  // 認証情報を入力
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);

  // ログインボタンをクリック
  await page.getByRole('button', { name: 'サインイン' }).click();

  // ログイン成功を待つ（ダッシュボードへのリダイレクト）
  await expect(page).toHaveURL('/', { timeout: 10000 });

  // ダッシュボードが表示されることを確認
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
}

/**
 * 拡張されたテストFixture
 */
export const test = base.extend<AuthFixtures>({
  /**
   * 通常ユーザーとしてログイン済みのページ
   */
  authenticatedPage: async ({ page }, use) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'test-password';

    await login(page, email, password);
    await use(page);
  },

  /**
   * 管理者ユーザーとしてログイン済みのページ
   */
  adminPage: async ({ page }, use) => {
    const email = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.TEST_ADMIN_PASSWORD || 'admin-password';

    await login(page, email, password);
    await use(page);
  },
});

export { expect };
