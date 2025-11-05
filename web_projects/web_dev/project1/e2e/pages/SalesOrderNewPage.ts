import { Page, Locator } from '@playwright/test';

/**
 * SalesOrderNew Page Object
 *
 * 新規受注登録画面のPage Object
 */
export class SalesOrderNewPage {
  readonly page: Page;

  // ヘッダー要素
  readonly pageTitle: Locator;
  readonly backButton: Locator;

  // フォームフィールド
  readonly customerSelectControl: Locator;
  readonly orderNoInput: Locator;
  readonly orderDateInput: Locator;
  readonly deliveryDateInput: Locator;
  readonly deliveryAddressTextarea: Locator;
  readonly notesTextarea: Locator;

  // 明細テーブル要素
  readonly addItemButton: Locator;
  readonly itemsTable: Locator;

  // 合計表示
  readonly subtotalDisplay: Locator;
  readonly taxAmountDisplay: Locator;
  readonly totalDisplay: Locator;

  // アクションボタン
  readonly cancelButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // ヘッダー要素
    this.pageTitle = page.getByRole('heading', { name: '新規受注登録' });
    this.backButton = page.getByRole('button', { name: '受注一覧に戻る' });

    // フォームフィールド
    // react-selectはプレースホルダーテキストで検索
    this.customerSelectControl = page.getByText('顧客を検索または選択...').first();
    this.orderNoInput = page.getByPlaceholder('例: SO-2025-001');
    this.orderDateInput = page.locator('input[name="order_date"]');
    this.deliveryDateInput = page.locator('input[name="delivery_date"]');
    this.deliveryAddressTextarea = page.locator('textarea[name="delivery_address"]');
    this.notesTextarea = page.locator('textarea[name="notes"]');

    // 明細カード
    this.addItemButton = page.getByRole('button', { name: '明細追加' });
    this.itemsTable = page.locator('table').first(); // 実際はカードレイアウトだが互換性のため保持

    // 合計表示（全体の合計、明細の合計ではない）
    this.subtotalDisplay = page.getByText('小計:').last().locator('..').locator('span').last();
    this.taxAmountDisplay = page.getByText('消費税:').last().locator('..').locator('span').last();
    this.totalDisplay = page.getByText('合計金額（税込）:').locator('..').locator('span').last();

    // アクションボタン
    this.cancelButton = page.getByRole('button', { name: 'キャンセル' });
    this.submitButton = page.getByRole('button', { name: '受注登録' });
  }

  /**
   * 受注登録ページへ移動
   */
  async goto() {
    await this.page.goto('/sales-orders/new');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 顧客を選択
   * @param customerName 顧客名（部分一致検索）
   */
  async selectCustomer(customerName: string) {
    // プレースホルダーの親要素（コントロール）をクリック
    const control = this.customerSelectControl.locator('..').locator('..');
    await control.click();

    // 検索テキストを入力
    await this.page.keyboard.type(customerName);
    await this.page.waitForTimeout(500); // react-selectのドロップダウン表示待機

    // 最初のオプションを選択
    await this.page.keyboard.press('Enter');
  }

  /**
   * 受注番号を入力
   * @param orderNo 受注番号
   */
  async fillOrderNo(orderNo: string) {
    await this.orderNoInput.fill(orderNo);
  }

  /**
   * 受注日を入力
   * @param date 日付 (YYYY-MM-DD形式)
   */
  async fillOrderDate(date: string) {
    await this.orderDateInput.fill(date);
  }

  /**
   * 納期を入力
   * @param date 日付 (YYYY-MM-DD形式)
   */
  async fillDeliveryDate(date: string) {
    await this.deliveryDateInput.fill(date);
  }

  /**
   * 配送先住所を入力
   * @param address 配送先住所
   */
  async fillDeliveryAddress(address: string) {
    await this.deliveryAddressTextarea.fill(address);
  }

  /**
   * 備考を入力
   * @param notes 備考テキスト
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
    // カードが追加されるまで待機
    await this.page.waitForFunction(
      (expectedCount) => {
        const cards = document.querySelectorAll('.border.border-gray-200.p-4.rounded-lg');
        return cards.length === expectedCount;
      },
      currentRowCount + 1
    );
  }

  /**
   * 明細行数を取得
   */
  async getItemRowCount(): Promise<number> {
    // カードレイアウトなので、明細カードの数を数える
    const cards = await this.page.locator('.border.border-gray-200.p-4.rounded-lg').count();
    return cards;
  }

  /**
   * 指定した行の商品を選択
   * @param rowIndex 行インデックス（0始まり）
   * @param productName 商品名（部分一致検索）
   */
  async selectProduct(rowIndex: number, productName: string) {
    // カードレイアウト内の該当明細のreact-selectコントロールを取得
    const card = this.page.locator('.border.border-gray-200.p-4.rounded-lg').nth(rowIndex);
    const placeholder = card.getByText('商品を検索...').first();

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
   * 指定した行の税率を入力
   * @param rowIndex 行インデックス（0始まり）
   * @param taxRate 税率 (10 or 8)
   */
  async fillTaxRate(rowIndex: number, taxRate: number) {
    const taxRateInput = this.page.locator(`input[name="items.${rowIndex}.tax_rate"]`);
    await taxRateInput.fill(taxRate.toString());
    await taxRateInput.blur(); // 計算をトリガー
  }

  /**
   * 指定した行を削除
   * @param rowIndex 行インデックス（0始まり）
   */
  async removeItem(rowIndex: number) {
    const currentRowCount = await this.getItemRowCount();
    const card = this.page.locator('.border.border-gray-200.p-4.rounded-lg').nth(rowIndex);
    // Trash2アイコンのボタンを探す
    const deleteButton = card.locator('button').filter({ hasText: '' }).first();
    await deleteButton.click();

    // カードが削除されるまで待機（最低1行は残る）
    if (currentRowCount > 1) {
      await this.page.waitForFunction(
        (expectedCount) => {
          const cards = document.querySelectorAll('.border.border-gray-200.p-4.rounded-lg');
          return cards.length === expectedCount;
        },
        currentRowCount - 1
      );
    }
  }

  /**
   * 小計を取得
   */
  async getSubtotal(): Promise<string> {
    return await this.subtotalDisplay.textContent() || '';
  }

  /**
   * 消費税を取得
   */
  async getTaxAmount(): Promise<string> {
    return await this.taxAmountDisplay.textContent() || '';
  }

  /**
   * 合計を取得
   */
  async getTotal(): Promise<string> {
    return await this.totalDisplay.textContent() || '';
  }

  /**
   * フォームを送信（受注登録）
   */
  async submit() {
    await this.submitButton.click();
    // ナビゲーション完了を待機
    await this.page.waitForURL('/sales-orders', { timeout: 10000 });
  }

  /**
   * フォームをキャンセル
   */
  async cancel() {
    await this.cancelButton.click();
    await this.page.waitForURL('/sales-orders', { timeout: 5000 });
  }

  /**
   * 戻るボタンをクリック
   */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForURL('/sales-orders', { timeout: 5000 });
  }

  /**
   * バリデーションエラーメッセージを取得
   * @param fieldName フィールド名
   */
  async getValidationError(fieldName: string): Promise<string | null> {
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
