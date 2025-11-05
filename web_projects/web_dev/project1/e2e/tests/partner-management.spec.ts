import { test, expect } from '../fixtures/db';

/**
 * 取引先管理のE2Eテスト
 *
 * DBFixtureを使用してテストデータを管理します。
 */

test.describe('取引先管理', () => {
  test('取引先一覧が表示される', async ({ authenticatedPage, db }) => {
    // テストデータを作成
    const partner = await db.createTestPartner({
      name: 'E2E Test Supplier',
      type: 'supplier',
    });

    // 取引先一覧ページに移動
    await authenticatedPage.goto('/partners');

    // 作成した取引先が表示されることを確認
    await expect(authenticatedPage.getByText('E2E Test Supplier')).toBeVisible();
  });

  test.skip('新しい取引先を作成できる', async ({ authenticatedPage, db }) => {
    // TODO: フォーム送信のE2Eテスト
    // Phase 12で失敗したフォーム送信テストのE2E版を実装

    await authenticatedPage.goto('/partners');

    // 「新規作成」ボタンをクリック
    await authenticatedPage.getByRole('button', { name: '新規作成' }).click();

    // フォームに入力
    await authenticatedPage.getByLabel('取引先名').fill('New E2E Partner');
    await authenticatedPage.getByLabel('種別').selectOption('customer');

    // 送信
    await authenticatedPage.getByRole('button', { name: '登録' }).click();

    // 成功メッセージを確認
    await expect(authenticatedPage.getByText(/登録しました/)).toBeVisible();

    // 一覧に表示されることを確認
    await expect(authenticatedPage.getByText('New E2E Partner')).toBeVisible();
  });

  test('取引先詳細ページに移動できる', async ({ authenticatedPage, db }) => {
    // テストデータを作成
    const partner = await db.createTestPartner({
      name: 'E2E Detail Test Partner',
      type: 'supplier',
    });

    await authenticatedPage.goto('/partners');

    // 取引先名をクリック
    await authenticatedPage.getByText('E2E Detail Test Partner').click();

    // 詳細ページが表示されることを確認
    await expect(authenticatedPage).toHaveURL(/\/partners\/\d+/);
    await expect(authenticatedPage.getByText('E2E Detail Test Partner')).toBeVisible();
  });
});
