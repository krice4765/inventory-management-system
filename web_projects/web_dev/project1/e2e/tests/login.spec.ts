import { test, expect } from '@playwright/test';

test.describe('ログイン機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ログインページが表示される', async ({ page }) => {
    await expect(page).toHaveTitle(/在庫管理システム/);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });

  test('メールアドレスとパスワードのフィールドが存在する', async ({ page }) => {
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  });

  test('空のフォームで送信するとエラーが表示される', async ({ page }) => {
    await page.getByRole('button', { name: 'ログイン' }).click();

    // バリデーションエラーメッセージの確認
    await expect(page.getByText(/メールアドレスを入力してください|メールアドレスは必須です/)).toBeVisible();
  });

  test.skip('正しい認証情報でログインできる', async ({ page }) => {
    // TODO: テスト用ユーザーアカウントのセットアップが必要
    // E2E_TEST_MIGRATION_PLAN.md の認証Fixture実装後に有効化

    await page.getByLabel('メールアドレス').fill('test@example.com');
    await page.getByLabel('パスワード').fill('test-password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ログイン後、ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL('/dashboard');
  });
});
