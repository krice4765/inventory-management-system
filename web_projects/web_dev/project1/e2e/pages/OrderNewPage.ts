import { Page, Locator } from '@playwright/test';

/**
 * OrderNew Page Object
 *
 * 新規発注書作成画面のPage Object
 */
export class OrderNewPage {
  readonly page: Page;

  // ヘッダー要素
  readonly pageTitle: Locator;
  readonly backButton: Locator;

  // フォームフィールド
  readonly supplierSelectControl: Locator;
  readonly orderDateInput: Locator;
  readonly assignedUserSelectControl: Locator;
  readonly deliveryDeadlineInput: Locator;
  readonly memoInput: Locator;
  readonly notesTextarea: Locator;

  // 明細テーブル要素
  readonly addItemButton: Locator;
  readonly itemsTable: Locator;

  // 送料設定
  readonly shippingCostInput: Locator;
  readonly shippingTaxRateSelect: Locator;

  // 合計表示
  readonly subtotalDisplay: Locator;
  readonly totalTaxDisplay: Locator;
  readonly grandTotalDisplay: Locator;

  // アクションボタン
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // ヘッダー要素
    this.pageTitle = page.getByRole('heading', { name: '新規発注書作成' });
    this.backButton = page.getByRole('button', { name: '発注管理に戻る' });

    // フォームフィールド
    // react-selectはプレースホルダーテキストで検索
    this.supplierSelectControl = page.getByText('仕入先を検索または選択...').first();
    this.orderDateInput = page.locator('input[name="order_date"]');
    this.assignedUserSelectControl = page.getByText('担当者を選択...').first();
    this.deliveryDeadlineInput = page.locator('input[name="delivery_deadline"]');
    this.memoInput = page.locator('input[name="memo"]');
    this.notesTextarea = page.locator('textarea[name="notes"]');

    // 明細テーブル
    this.addItemButton = page.getByRole('button', { name: '行追加' });
    this.itemsTable = page.locator('table').first();

    // 送料設定
    this.shippingCostInput = page.locator('input[name="shipping_cost"]');
    this.shippingTaxRateSelect = page.locator('select[name="shipping_tax_rate"]');

    // 合計表示
    this.subtotalDisplay = page.getByText(/商品小計:/).locator('..').locator('span').last();
    this.totalTaxDisplay = page.getByText(/消費税合計:/).locator('..').locator('span').last();
    this.grandTotalDisplay = page.getByText(/総合計:/).locator('..').locator('span').last();

    // アクションボタン
    this.cancelButton = page.getByRole('button', { name: 'キャンセル' });
    this.submitButton = page.getByRole('button', { name: '発注書作成' });
  }

  /**
   * 発注書作成ページへ移動
   */
  async goto() {
    await this.page.goto('/orders/new');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 仕入先を選択
   * @param supplierName 仕入先名（部分一致検索）
   */
  async selectSupplier(supplierName: string) {
    // プレースホルダーの親要素（コントロール）をクリック
    const control = this.supplierSelectControl.locator('..').locator('..');
    await control.click();

    // 検索テキストを入力
    await this.page.keyboard.type(supplierName);
    await this.page.waitForTimeout(500); // react-selectのドロップダウン表示待機

    // 最初のオプションを選択
    await this.page.keyboard.press('Enter');
  }

  /**
   * 発注日を入力
   * @param date 日付 (YYYY-MM-DD形式)
   */
  async fillOrderDate(date: string) {
    await this.orderDateInput.fill(date);
  }

  /**
   * 発注担当者を選択
   * @param userName 担当者名（部分一致検索）
   */
  async selectAssignedUser(userName: string) {
    // プレースホルダーの親要素（コントロール）をクリック
    const control = this.assignedUserSelectControl.locator('..').locator('..');
    await control.click();

    // 検索テキストを入力
    await this.page.keyboard.type(userName);
    await this.page.waitForTimeout(500);

    // 最初のオプションを選択
    await this.page.keyboard.press('Enter');
  }

  /**
   * 希望納期を入力
   * @param date 日付 (YYYY-MM-DD形式)
   */
  async fillDeliveryDeadline(date: string) {
    await this.deliveryDeadlineInput.fill(date);
  }

  /**
   * 備考を入力
   * @param memo 備考テキスト
   */
  async fillMemo(memo: string) {
    await this.memoInput.fill(memo);
  }

  /**
   * 発注書備考を入力
   * @param notes 発注書備考テキスト
   */
  async fillNotes(notes: string) {
    await this.notesTextarea.fill(notes);
  }

  /**
   * 明細行を追加
   */
  async addItem() {
    const currentRowCount = await this.getItemRowCount();
    await this.addItemButton.click();
    // 行が追加されるまで待機
    await this.page.waitForFunction(
      (expectedCount) => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length === expectedCount;
      },
      currentRowCount + 1
    );
  }

  /**
   * 明細行数を取得
   */
  async getItemRowCount(): Promise<number> {
    const rows = await this.page.locator('table tbody tr').count();
    return rows;
  }

  /**
   * 指定した行の商品を選択
   * @param rowIndex 行インデックス（0始まり）
   * @param productName 商品名（部分一致検索）
   */
  async selectProduct(rowIndex: number, productName: string) {
    // テーブル内の該当行のreact-selectコントロールを取得
    const row = this.page.locator('table tbody tr').nth(rowIndex);
    const placeholder = row.getByText('商品を検索...').first();

    // プレースホルダーの親要素（コントロール）をクリック
    const control = placeholder.locator('..').locator('..');
    await control.click();

    // 検索テキストを入力
    await this.page.keyboard.type(productName);
    await this.page.waitForTimeout(500);

    // 最初のオプションを選択
    await this.page.keyboard.press('Enter');
  }

  /**
   * 指定した行の数量を入力
   * @param rowIndex 行インデックス（0始まり）
   * @param quantity 数量
   */
  async fillQuantity(rowIndex: number, quantity: number) {
    const quantityInput = this.page.locator(`input[name="items.${rowIndex}.quantity"]`);
    await quantityInput.fill(quantity.toString());
    await quantityInput.blur(); // 計算をトリガー
  }

  /**
   * 指定した行の単価を入力
   * @param rowIndex 行インデックス（0始まり）
   * @param unitPrice 単価
   */
  async fillUnitPrice(rowIndex: number, unitPrice: number) {
    const unitPriceInput = this.page.locator(`input[name="items.${rowIndex}.unit_price"]`);
    await unitPriceInput.fill(unitPrice.toString());
    await unitPriceInput.blur(); // 計算をトリガー
  }

  /**
   * 指定した行の小計を取得
   * @param rowIndex 行インデックス（0始まり）
   */
  async getItemTotal(rowIndex: number): Promise<string> {
    const row = this.page.locator('table tbody tr').nth(rowIndex);
    const totalCell = row.locator('td').nth(3); // 小計列
    return await totalCell.textContent() || '';
  }

  /**
   * 指定した行を削除
   * @param rowIndex 行インデックス（0始まり）
   */
  async removeItem(rowIndex: number) {
    const currentRowCount = await this.getItemRowCount();
    const row = this.page.locator('table tbody tr').nth(rowIndex);
    const deleteButton = row.locator('button[title="行削除"]');
    await deleteButton.click();

    // 行が削除されるまで待機（最低1行は残る）
    if (currentRowCount > 1) {
      await this.page.waitForFunction(
        (expectedCount) => {
          const rows = document.querySelectorAll('table tbody tr');
          return rows.length === expectedCount;
        },
        currentRowCount - 1
      );
    }
  }

  /**
   * 送料を入力
   * @param cost 送料
   */
  async fillShippingCost(cost: number) {
    await this.shippingCostInput.fill(cost.toString());
    await this.shippingCostInput.blur();
  }

  /**
   * 送料消費税率を選択
   * @param rate 税率 ('0.1' or '0.08')
   */
  async selectShippingTaxRate(rate: string) {
    await this.shippingTaxRateSelect.selectOption(rate);
  }

  /**
   * 商品小計を取得
   */
  async getSubtotal(): Promise<string> {
    return await this.subtotalDisplay.textContent() || '';
  }

  /**
   * 消費税合計を取得
   */
  async getTotalTax(): Promise<string> {
    return await this.totalTaxDisplay.textContent() || '';
  }

  /**
   * 総合計を取得
   */
  async getGrandTotal(): Promise<string> {
    return await this.grandTotalDisplay.textContent() || '';
  }

  /**
   * フォームを送信（発注書作成）
   */
  async submit() {
    await this.submitButton.click();
    // ナビゲーション完了を待機
    await this.page.waitForURL('/orders', { timeout: 10000 });
  }

  /**
   * フォームをキャンセル
   */
  async cancel() {
    await this.cancelButton.click();
    await this.page.waitForURL('/orders', { timeout: 5000 });
  }

  /**
   * 戻るボタンをクリック
   */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForURL('/orders', { timeout: 5000 });
  }

  /**
   * バリデーションエラーメッセージを取得
   * @param fieldName フィールド名 (例: 'partner_id', 'order_date')
   */
  async getValidationError(fieldName: string): Promise<string | null> {
    // react-hook-formのエラーメッセージは通常、フィールドの近くに表示される
    const errorMessage = this.page.locator(`text=/.*エラー.*/i`).first();
    if (await errorMessage.isVisible()) {
      return await errorMessage.textContent();
    }
    return null;
  }

  /**
   * トーストメッセージを取得
   */
  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('[role="status"], [role="alert"]').first();
    if (await toast.isVisible({ timeout: 3000 })) {
      return await toast.textContent();
    }
    return null;
  }

  /**
   * ローディング状態を待機
   */
  async waitForLoading() {
    const loadingSpinner = this.page.locator('.animate-spin');
    if (await loadingSpinner.isVisible()) {
      await loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  /**
   * ページが完全にロードされたことを確認
   */
  async waitForPageLoad() {
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
    await this.waitForLoading();
    await this.page.waitForLoadState('networkidle');
  }
}
