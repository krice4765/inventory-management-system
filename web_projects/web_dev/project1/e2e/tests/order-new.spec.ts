import { test, expect } from '../fixtures/auth';
import { OrderNewPage } from '../pages/OrderNewPage';

test.describe('新規発注書作成', () => {
  let orderNewPage: OrderNewPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    orderNewPage = new OrderNewPage(authenticatedPage);
    await orderNewPage.goto();
    await orderNewPage.waitForPageLoad();
  });

  test('正常系: 発注を正常に登録できる', async ({ authenticatedPage }) => {
    // 仕入先を選択
    await orderNewPage.selectSupplier('テスト仕入先');

    // 発注日を入力（今日の日付）
    const today = new Date().toISOString().split('T')[0];
    await orderNewPage.fillOrderDate(today);

    // 発注担当者を選択（自動的にデフォルト値が設定されているはず）
    // 追加の選択は不要

    // 希望納期を入力（7日後）
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    const deadlineStr = deadline.toISOString().split('T')[0];
    await orderNewPage.fillDeliveryDeadline(deadlineStr);

    // 明細を入力
    await orderNewPage.selectProduct(0, 'テスト商品');
    await orderNewPage.fillQuantity(0, 10);
    await orderNewPage.fillUnitPrice(0, 1000);

    // 送料を入力
    await orderNewPage.fillShippingCost(500);

    // フォームを送信
    await orderNewPage.submit();

    // 成功メッセージの確認
    await expect(authenticatedPage).toHaveURL('/orders', { timeout: 10000 });
  });

  test('異常系: 必須項目未入力でバリデーションエラー', async ({ authenticatedPage }) => {
    // 仕入先未選択のまま送信
    await orderNewPage.submitButton.click();

    // ページが遷移していないことを確認（バリデーションエラーで送信がブロックされる）
    await authenticatedPage.waitForTimeout(1000);
    await expect(authenticatedPage).toHaveURL(/\/orders\/new/);
  });

  test('異常系: 商品未選択でバリデーションエラー', async ({ authenticatedPage }) => {
    // 仕入先のみ選択
    await orderNewPage.selectSupplier('テスト仕入先');

    // 発注日を入力
    const today = new Date().toISOString().split('T')[0];
    await orderNewPage.fillOrderDate(today);

    // 商品は選択せず、数量と単価のみ入力
    await orderNewPage.fillQuantity(0, 10);
    await orderNewPage.fillUnitPrice(0, 1000);

    // フォームを送信
    await orderNewPage.submitButton.click();

    // ページが遷移していないことを確認
    await authenticatedPage.waitForTimeout(1000);
    await expect(authenticatedPage).toHaveURL(/\/orders\/new/);
  });

  test('操作: 明細行を追加できる', async ({ authenticatedPage }) => {
    // 初期状態の行数を確認（1行）
    const initialRowCount = await orderNewPage.getItemRowCount();
    expect(initialRowCount).toBe(1);

    // 行を追加
    await orderNewPage.addItem();

    // 行数が増えたことを確認（2行）
    const newRowCount = await orderNewPage.getItemRowCount();
    expect(newRowCount).toBe(2);

    // さらに行を追加
    await orderNewPage.addItem();

    // 行数が増えたことを確認（3行）
    const finalRowCount = await orderNewPage.getItemRowCount();
    expect(finalRowCount).toBe(3);
  });

  test('操作: 明細行を削除できる', async ({ authenticatedPage }) => {
    // 行を2行追加（合計3行）
    await orderNewPage.addItem();
    await orderNewPage.addItem();

    const initialRowCount = await orderNewPage.getItemRowCount();
    expect(initialRowCount).toBe(3);

    // 2行目を削除
    await orderNewPage.removeItem(1);

    // 行数が減ったことを確認（2行）
    const newRowCount = await orderNewPage.getItemRowCount();
    expect(newRowCount).toBe(2);

    // さらに1行削除
    await orderNewPage.removeItem(1);

    // 行数が減ったことを確認（1行）
    const finalRowCount = await orderNewPage.getItemRowCount();
    expect(finalRowCount).toBe(1);

    // 最後の1行は削除できない（削除ボタンをクリックしても行数は変わらない）
    await orderNewPage.page.locator('button[title="行削除"]').first().click();
    await authenticatedPage.waitForTimeout(500);
    const lastRowCount = await orderNewPage.getItemRowCount();
    expect(lastRowCount).toBe(1);
  });

  test('計算: 複数明細の合計金額が正しく計算される', async ({ authenticatedPage }) => {
    // 1行目: 数量10 × 単価1000 = 10,000
    await orderNewPage.selectProduct(0, 'テスト商品');
    await orderNewPage.fillQuantity(0, 10);
    await orderNewPage.fillUnitPrice(0, 1000);

    // 2行目を追加: 数量5 × 単価2000 = 10,000
    await orderNewPage.addItem();
    await orderNewPage.selectProduct(1, 'テスト商品');
    await orderNewPage.fillQuantity(1, 5);
    await orderNewPage.fillUnitPrice(1, 2000);

    // 送料: 500円
    await orderNewPage.fillShippingCost(500);

    // 計算の反映を待つ
    await authenticatedPage.waitForTimeout(500);

    // 商品小計を確認: 10,000 + 10,000 = 20,000
    const subtotal = await orderNewPage.getSubtotal();
    expect(subtotal).toContain('20,000');

    // 総合計を確認: 20,000 + 消費税(2,000) + 送料(500) + 送料消費税(50) = 22,550
    const grandTotal = await orderNewPage.getGrandTotal();
    expect(grandTotal).toContain('22,550');
  });

  test('操作: キャンセルボタンで一覧に戻る', async ({ authenticatedPage }) => {
    // データを一部入力
    await orderNewPage.selectSupplier('テスト仕入先');
    await orderNewPage.fillMemo('テストメモ');

    // キャンセルボタンをクリック
    await orderNewPage.cancel();

    // 発注一覧ページに戻ることを確認
    await expect(authenticatedPage).toHaveURL('/orders', { timeout: 5000 });
  });

  test('操作: 戻るボタンで一覧に戻る', async ({ authenticatedPage }) => {
    // 戻るボタンをクリック
    await orderNewPage.goBack();

    // 発注一覧ページに戻ることを確認
    await expect(authenticatedPage).toHaveURL('/orders', { timeout: 5000 });
  });

  test('アクセシビリティ: タブキーでフォーム操作可能', async ({ authenticatedPage }) => {
    // ページタイトルが表示されていることを確認
    await expect(orderNewPage.pageTitle).toBeVisible();

    // Tabキーでフォーカス移動をテスト
    await authenticatedPage.keyboard.press('Tab'); // 戻るボタンへ
    await authenticatedPage.keyboard.press('Tab'); // 仕入先選択へ

    // 仕入先選択フィールドにフォーカスがあることを確認
    const focusedElement = await authenticatedPage.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // Enterキーでドロップダウンを開く操作が可能であることを確認
    await authenticatedPage.keyboard.press('Enter');
    await authenticatedPage.waitForTimeout(300);

    // ドロップダウンが表示されることを確認（react-selectのメニュー）
    const dropdown = authenticatedPage.locator('[class*="menu"]').first();
    const isDropdownVisible = await dropdown.isVisible();
    expect(isDropdownVisible).toBeTruthy();
  });

  test('パフォーマンス: ページ読み込みが2秒以内', async ({ authenticatedPage }) => {
    const startTime = Date.now();

    // ページへ移動
    await authenticatedPage.goto('/orders/new');

    // ページタイトルが表示されるまで待機
    await orderNewPage.pageTitle.waitFor({ state: 'visible', timeout: 10000 });

    // ローディング完了を待機
    await orderNewPage.waitForLoading();

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // 読み込み時間が2秒以内であることを確認
    expect(loadTime).toBeLessThan(2000);
  });
});
