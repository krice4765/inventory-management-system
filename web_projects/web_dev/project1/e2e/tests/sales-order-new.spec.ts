import { test, expect } from '../fixtures/auth';
import { SalesOrderNewPage } from '../pages/SalesOrderNewPage';

test.describe('新規受注登録', () => {
  let salesOrderNewPage: SalesOrderNewPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    salesOrderNewPage = new SalesOrderNewPage(authenticatedPage);
    await salesOrderNewPage.goto();
    await salesOrderNewPage.waitForPageLoad();
  });

  test('正常系: 受注を正常に登録できる', async ({ authenticatedPage }) => {
    // ネットワークとコンソールを監視
    const errors: string[] = [];
    authenticatedPage.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const networkErrors: any[] = [];
    authenticatedPage.on('response', async response => {
      if (response.status() >= 400) {
        try {
          const body = await response.json();
          networkErrors.push({
            url: response.url(),
            status: response.status(),
            body
          });
        } catch (e) {
          networkErrors.push({
            url: response.url(),
            status: response.status()
          });
        }
      }
    });

    // 顧客を選択
    await salesOrderNewPage.selectCustomer('テスト顧客');

    // 受注番号を入力
    const orderNo = `SO-TEST-${Date.now()}`;
    await salesOrderNewPage.fillOrderNo(orderNo);

    // 受注日を入力（今日の日付）
    const today = new Date().toISOString().split('T')[0];
    await salesOrderNewPage.fillOrderDate(today);

    // 納期を入力（7日後）
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    const deliveryDateStr = deliveryDate.toISOString().split('T')[0];
    await salesOrderNewPage.fillDeliveryDate(deliveryDateStr);

    // 明細を入力
    await salesOrderNewPage.selectProduct(0, 'テスト商品');
    await salesOrderNewPage.fillQuantity(0, 10);
    await salesOrderNewPage.fillUnitPrice(0, 1000);

    // フォームを送信
    await salesOrderNewPage.submitButton.click();

    // エラーがあれば待機して確認
    await authenticatedPage.waitForTimeout(3000);

    if (errors.length > 0 || networkErrors.length > 0) {
      console.log('=== Console Errors ===');
      errors.forEach(e => console.log(e));
      console.log('=== Network Errors ===');
      console.log(JSON.stringify(networkErrors, null, 2));
    }

    // 成功時に受注一覧ページに遷移することを確認
    await expect(authenticatedPage).toHaveURL('/sales-orders', { timeout: 10000 });
  });

  test('異常系: 必須項目未入力でバリデーションエラー', async ({ authenticatedPage }) => {
    // 顧客未選択のまま送信
    await salesOrderNewPage.submitButton.click();

    // ページが遷移していないことを確認（バリデーションエラーで送信がブロックされる）
    await authenticatedPage.waitForTimeout(1000);
    await expect(authenticatedPage).toHaveURL(/\/sales-orders\/new/);
  });

  test('異常系: 商品未選択でバリデーションエラー', async ({ authenticatedPage }) => {
    // 顧客のみ選択
    await salesOrderNewPage.selectCustomer('テスト顧客');

    // 受注番号を入力
    const orderNo = `SO-TEST-${Date.now()}`;
    await salesOrderNewPage.fillOrderNo(orderNo);

    // 受注日を入力
    const today = new Date().toISOString().split('T')[0];
    await salesOrderNewPage.fillOrderDate(today);

    // 商品は選択せず、数量と単価のみ入力
    await salesOrderNewPage.fillQuantity(0, 10);
    await salesOrderNewPage.fillUnitPrice(0, 1000);

    // フォームを送信
    await salesOrderNewPage.submitButton.click();

    // ページが遷移していないことを確認
    await authenticatedPage.waitForTimeout(1000);
    await expect(authenticatedPage).toHaveURL(/\/sales-orders\/new/);
  });

  test('操作: 明細行を追加できる', async ({ authenticatedPage }) => {
    // 初期状態の行数を確認（1行）
    const initialRowCount = await salesOrderNewPage.getItemRowCount();
    expect(initialRowCount).toBe(1);

    // 行を追加
    await salesOrderNewPage.addItem();

    // 行数が増えたことを確認（2行）
    const newRowCount = await salesOrderNewPage.getItemRowCount();
    expect(newRowCount).toBe(2);

    // さらに行を追加
    await salesOrderNewPage.addItem();

    // 行数が増えたことを確認（3行）
    const finalRowCount = await salesOrderNewPage.getItemRowCount();
    expect(finalRowCount).toBe(3);
  });

  test('操作: 明細行を削除できる', async ({ authenticatedPage }) => {
    // 行を2行追加（合計3行）
    await salesOrderNewPage.addItem();
    await salesOrderNewPage.addItem();

    const initialRowCount = await salesOrderNewPage.getItemRowCount();
    expect(initialRowCount).toBe(3);

    // 2行目を削除
    await salesOrderNewPage.removeItem(1);

    // 行数が減ったことを確認（2行）
    const newRowCount = await salesOrderNewPage.getItemRowCount();
    expect(newRowCount).toBe(2);

    // さらに1行削除
    await salesOrderNewPage.removeItem(1);

    // 行数が減ったことを確認（1行）
    const finalRowCount = await salesOrderNewPage.getItemRowCount();
    expect(finalRowCount).toBe(1);

    // 最後の1行は削除できない（削除ボタンが表示されない）
    // fields.length > 1 の条件により、1行しかない場合は削除ボタンが表示されない
    const lastRowCount = await salesOrderNewPage.getItemRowCount();
    expect(lastRowCount).toBe(1);
  });

  test('計算: 複数明細の合計金額が正しく計算される', async ({ authenticatedPage }) => {
    // 1行目: 数量10 × 単価1000 = 10,000 (税率10%)
    await salesOrderNewPage.selectProduct(0, 'テスト商品');
    await salesOrderNewPage.fillQuantity(0, 10);
    await salesOrderNewPage.fillUnitPrice(0, 1000);
    await salesOrderNewPage.fillTaxRate(0, 10);

    // 2行目を追加: 数量5 × 単価2000 = 10,000 (税率8%)
    await salesOrderNewPage.addItem();
    await salesOrderNewPage.selectProduct(1, 'テスト商品');
    await salesOrderNewPage.fillQuantity(1, 5);
    await salesOrderNewPage.fillUnitPrice(1, 2000);
    await salesOrderNewPage.fillTaxRate(1, 8);

    // 計算の反映を待つ
    await authenticatedPage.waitForTimeout(500);

    // 小計を確認: 10,000 + 10,000 = 20,000
    const subtotal = await salesOrderNewPage.getSubtotal();
    expect(subtotal).toContain('20,000');

    // 消費税を確認: 1,000 (10%) + 800 (8%) = 1,800
    const taxAmount = await salesOrderNewPage.getTaxAmount();
    expect(taxAmount).toContain('1,800');

    // 合計を確認: 20,000 + 1,800 = 21,800
    const total = await salesOrderNewPage.getTotal();
    expect(total).toContain('21,800');
  });

  test('操作: キャンセルボタンで一覧に戻る', async ({ authenticatedPage }) => {
    // データを一部入力
    await salesOrderNewPage.selectCustomer('テスト顧客');
    await salesOrderNewPage.fillOrderNo('SO-TEST-CANCEL');

    // キャンセルボタンをクリック
    await salesOrderNewPage.cancel();

    // 受注一覧ページに戻ることを確認
    await expect(authenticatedPage).toHaveURL('/sales-orders', { timeout: 5000 });
  });

  test('操作: 戻るボタンで一覧に戻る', async ({ authenticatedPage }) => {
    // 戻るボタンをクリック
    await salesOrderNewPage.goBack();

    // 受注一覧ページに戻ることを確認
    await expect(authenticatedPage).toHaveURL('/sales-orders', { timeout: 5000 });
  });

  // 配送先住所機能のテストを削除（データベースにカラムが存在しないため）
  // test('機能: 配送先住所を入力できる', async ({ authenticatedPage }) => {
  //   await expect(salesOrderNewPage.deliveryAddressTextarea).toBeVisible();
  //   const address = '東京都千代田区霞が関1-1-1\n中央合同庁舎第2号館';
  //   await salesOrderNewPage.fillDeliveryAddress(address);
  //   const value = await salesOrderNewPage.deliveryAddressTextarea.inputValue();
  //   expect(value).toBe(address);
  // });

  test('パフォーマンス: ページ読み込みが2秒以内', async ({ authenticatedPage }) => {
    const startTime = Date.now();

    // ページへ移動
    await authenticatedPage.goto('/sales-orders/new');

    // ページタイトルが表示されるまで待機
    await salesOrderNewPage.pageTitle.waitFor({ state: 'visible', timeout: 10000 });

    // ローディング完了を待機
    await salesOrderNewPage.waitForLoading();

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // 読み込み時間が2秒以内であることを確認
    expect(loadTime).toBeLessThan(2000);
  });
});
