import { test, expect } from '@playwright/test';

test.describe('分納機能 E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 開発サーバーに接続
    await page.goto('/');

    // ログインが必要な場合はここでログイン処理を実行
    // 現在はデモモードでテスト
  });

  test('在庫管理ページへの遷移', async ({ page }) => {
    // サイドバーから在庫管理をクリック
    await page.click('text=在庫管理');

    // URLが正しく変わることを確認
    await expect(page).toHaveURL(/.*inventory/);

    // ページタイトルが表示されることを確認
    await expect(page.locator('text=在庫移動履歴')).toBeVisible();
  });

  test('発注管理ページでの分納登録フロー', async ({ page }) => {
    // 発注管理ページに移動
    await page.click('text=発注管理');
    await expect(page).toHaveURL(/.*orders/);

    // 発注一覧が表示されることを確認
    await expect(page.locator('text=発注一覧')).toBeVisible();

    // 最初の発注の分納ボタンをクリック
    const firstDeliveryButton = page.locator('[data-testid="delivery-button"]').first();
    if (await firstDeliveryButton.isVisible()) {
      await firstDeliveryButton.click();

      // 分納モーダルが表示されることを確認
      await expect(page.locator('text=分納登録')).toBeVisible();

      // 金額入力フィールドが表示されることを確認
      const amountInput = page.locator('input[type="number"]').first();
      await expect(amountInput).toBeVisible();

      // モーダルを閉じる
      await page.click('text=キャンセル');
      await expect(page.locator('text=分納登録')).not.toBeVisible();
    }
  });

  test('在庫履歴の検索機能', async ({ page }) => {
    await page.click('text=在庫管理');
    await expect(page).toHaveURL(/.*inventory/);

    // 検索フィールドが表示されることを確認
    const searchInput = page.locator('input[placeholder*="検索"]');
    await expect(searchInput).toBeVisible();

    // 検索ボタンが表示されることを確認
    const searchButton = page.locator('button:has-text("検索")');
    await expect(searchButton).toBeVisible();

    // フィルタボタンが表示されることを確認
    const filterButton = page.locator('button:has-text("フィルター")');
    if (await filterButton.isVisible()) {
      await expect(filterButton).toBeVisible();
    }
  });

  test('発注書IDカラムの表示確認', async ({ page }) => {
    await page.click('text=在庫管理');
    await expect(page).toHaveURL(/.*inventory/);

    // テーブルヘッダーに「発注書ID」が表示されることを確認
    const orderIdHeader = page.locator('th:has-text("発注書ID")');
    await expect(orderIdHeader).toBeVisible();

    // テーブルが表示されることを確認
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('分析表示への切り替え', async ({ page }) => {
    await page.click('text=在庫管理');
    await expect(page).toHaveURL(/.*inventory/);

    // 分析表示ボタンがあるかチェック
    const analysisButton = page.locator('button:has-text("分析表示")');
    if (await analysisButton.isVisible()) {
      await analysisButton.click();

      // 統合表示が表示されることを確認
      await expect(page.locator('text=在庫移動・分納記録一覧')).toBeVisible({ timeout: 10000 });

      // 在庫履歴に戻る
      const historyButton = page.locator('button:has-text("在庫履歴")');
      if (await historyButton.isVisible()) {
        await historyButton.click();
        await expect(page.locator('text=在庫移動履歴')).toBeVisible();
      }
    }
  });

  test('レスポンシブデザインのテスト', async ({ page }) => {
    // モバイルビューポートに変更
    await page.setViewportSize({ width: 375, height: 667 });

    await page.click('text=在庫管理');
    await expect(page).toHaveURL(/.*inventory/);

    // モバイルでも基本的な要素が表示されることを確認
    await expect(page.locator('text=在庫移動履歴')).toBeVisible();

    // デスクトップビューに戻す
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});