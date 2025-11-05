import { test, expect } from '@playwright/test';

test.describe('ログイン機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ログインページが表示される', async ({ page }) => {
    await expect(page).toHaveTitle(/在庫管理システム/);
    await expect(page.getByRole('heading', { name: '在庫管理システム' })).toBeVisible();
    await expect(page.getByText('アカウントにサインイン')).toBeVisible();
  });

  test('メールアドレスとパスワードのフィールドが存在する', async ({ page }) => {
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード')).toBeVisible();
    await expect(page.getByRole('button', { name: 'サインイン' })).toBeVisible();
  });

  test('空のフォームで送信するとブラウザバリデーションが発動する', async ({ page }) => {
    const emailInput = page.getByLabel('メールアドレス');
    const submitButton = page.getByRole('button', { name: 'サインイン' });

    // メールアドレスフィールドが required 属性を持つことを確認
    await expect(emailInput).toHaveAttribute('required', '');

    // フォームを送信しようとするとブラウザバリデーションが発動
    // （実際にはフォームが送信されない）
    await submitButton.click();

    // ページが遷移していないことを確認（バリデーションが機能している）
    await expect(page).toHaveURL('/login');
  });

  test('正しい認証情報でログインできる', async ({ page }) => {
    // テスト用ユーザーで実際にログインする
    await page.getByLabel('メールアドレス').fill(process.env.TEST_USER_EMAIL || 'e2e-test-user@example.com');
    await page.getByLabel('パスワード').fill(process.env.TEST_USER_PASSWORD || 'E2ETestPass123!');
    await page.getByRole('button', { name: 'サインイン' }).click();

    // ログイン後、ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // ダッシュボードの見出しが表示されることを確認
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible({ timeout: 10000 });
  });
});
