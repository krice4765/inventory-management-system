import { test, expect } from '../fixtures/auth';

/**
 * 認証済みユーザーのナビゲーションテスト
 *
 * ログイン済みの状態で各ページへのナビゲーションをテストします。
 */

test.describe('認証済みナビゲーション', () => {
  test('ダッシュボードが表示される', async ({ authenticatedPage }) => {
    // authenticatedPageは既にログイン済み
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
    await expect(authenticatedPage.getByText(/ダッシュボード/)).toBeVisible();
  });

  test('在庫管理ページに移動できる', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('link', { name: '在庫管理' }).click();
    await expect(authenticatedPage).toHaveURL(/\/inventory/);
    await expect(authenticatedPage.getByText(/在庫一覧/)).toBeVisible();
  });

  test('発注管理ページに移動できる', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('link', { name: '発注管理' }).click();
    await expect(authenticatedPage).toHaveURL(/\/purchase-orders/);
    await expect(authenticatedPage.getByText(/発注一覧/)).toBeVisible();
  });

  test('受注管理ページに移動できる', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('link', { name: '受注管理' }).click();
    await expect(authenticatedPage).toHaveURL(/\/orders/);
    await expect(authenticatedPage.getByText(/受注一覧/)).toBeVisible();
  });

  test('取引先管理ページに移動できる', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('link', { name: '取引先管理' }).click();
    await expect(authenticatedPage).toHaveURL(/\/partners/);
    await expect(authenticatedPage.getByText(/取引先一覧/)).toBeVisible();
  });

  test('商品管理ページに移動できる', async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole('link', { name: '商品管理' }).click();
    await expect(authenticatedPage).toHaveURL(/\/products/);
    await expect(authenticatedPage.getByText(/商品一覧/)).toBeVisible();
  });
});

test.describe('管理者専用機能', () => {
  test('管理者は支払い管理ページにアクセスできる', async ({ adminPage }) => {
    await adminPage.getByRole('link', { name: '支払い管理' }).click();
    await expect(adminPage).toHaveURL(/\/payments/);
    await expect(adminPage.getByText(/支払い管理/)).toBeVisible();
  });
});
