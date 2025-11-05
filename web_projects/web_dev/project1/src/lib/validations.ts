import { z } from 'zod';

// =====================================================
// 共通バリデーションルール
// =====================================================

const requiredString = z.string().min(1, '入力必須です');
const optionalString = z.string().optional().or(z.literal(''));
const positiveNumber = z.number().positive('正の数値を入力してください');
const nonNegativeNumber = z.number().min(0, '0以上の数値を入力してください');

// 日付バリデーション（今日以前）
const pastOrTodayDate = z.string().refine(
  (date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return selectedDate <= today;
  },
  { message: '今日以前の日付を選択してください' }
);

// =====================================================
// 支払フォームスキーマ (複数支払方法対応)
// =====================================================

export const paymentMethodEnum = z.enum(['cash', 'bank_transfer', 'check', 'offset']);

export const paymentFormSchema = z.object({
  payment_date: pastOrTodayDate,

  // 複数支払方法（各金額フィールド）
  payment_method_cash: nonNegativeNumber.default(0),
  payment_method_check: nonNegativeNumber.default(0),
  payment_method_note: nonNegativeNumber.default(0),
  payment_method_bank_transfer: nonNegativeNumber.default(0),
  payment_method_offset: nonNegativeNumber.default(0),
  discount_amount: nonNegativeNumber.default(0),
  other_amount: nonNegativeNumber.default(0),
  transaction_fee: nonNegativeNumber.default(0),

  // 銀行情報
  issuing_bank_name: optionalString,
  payee_bank_name: optionalString,

  // 後方互換性のため残す（廃止予定）
  payment_method: paymentMethodEnum.optional(),
  amount: positiveNumber.optional(),
  bank_name: optionalString,
  bank_account: optionalString,
  reference_no: optionalString,
  notes: optionalString,
}).refine(
  (data) => {
    // 少なくとも1つの支払方法に金額が入力されているか検証
    const total =
      Number(data.payment_method_cash || 0) +
      Number(data.payment_method_check || 0) +
      Number(data.payment_method_note || 0) +
      Number(data.payment_method_bank_transfer || 0) +
      Number(data.payment_method_offset || 0) +
      Number(data.discount_amount || 0) +
      Number(data.other_amount || 0);

    return total > 0;
  },
  {
    message: '少なくとも1つの支払方法に金額を入力してください',
    path: ['payment_method_cash'], // エラー表示位置
  }
);

export type PaymentFormData = z.infer<typeof paymentFormSchema>;

// =====================================================
// 商品フォームスキーマ
// =====================================================

export const taxCategoryEnum = z.enum(['standard_10', 'reduced_8']);

export const productFormSchema = z.object({
  product_name: z.string().min(1, '入力必須です').max(100, '100文字以内で入力してください'),
  product_code: z.string().min(1, '入力必須です').regex(/^[A-Z0-9-]+$/, '英数字とハイフンのみ使用できます'),
  category: requiredString,
  unit: optionalString,
  tax_category: taxCategoryEnum.default('standard_10'),
  standard_cost: positiveNumber,
  selling_price: positiveNumber,
  current_stock: nonNegativeNumber.int('整数を入力してください'),
  min_stock_level: nonNegativeNumber.int('整数を入力してください'),
  // Drawing information (optional)
  drawing_number: optionalString,
  drawing_revision: optionalString,
  drawing_name: optionalString,
  drawing_notes: optionalString,
  drawing_file_path: optionalString,
  drawing_file_name: optionalString,
});

export type ProductFormData = z.infer<typeof productFormSchema>;

// =====================================================
// 取引先フォームスキーマ
// =====================================================

export const partnerTypeEnum = z.enum(['supplier', 'customer', 'both']);

export const partnerFormSchema = z.object({
  partner_code: z.string().min(1, '入力必須です').regex(/^[A-Z0-9-]+$/, '英数字とハイフンのみ使用できます'),
  name: z.string().min(1, '入力必須です').max(100, '100文字以内で入力してください'),
  partner_type: partnerTypeEnum,
  contact_person: z.string().max(50, '50文字以内で入力してください').optional().or(z.literal('')),
  email: z.string().email('有効なメールアドレスを入力してください').optional().or(z.literal('')),
  phone: z.string().max(20, '20文字以内で入力してください').optional().or(z.literal('')),
  fax: z.string().max(20, '20文字以内で入力してください').optional().or(z.literal('')),
  address: z.string().max(200, '200文字以内で入力してください').optional().or(z.literal('')),
  payment_terms: z.string().max(100, '100文字以内で入力してください').optional().or(z.literal('')),
  // Closing day settings
  closing_day: z.number().int().min(0, '0以上の値を入力してください').max(31, '31以下の値を入力してください').nullable().optional(),
  payment_day: z.number().int().min(0, '0以上の値を入力してください').max(31, '31以下の値を入力してください').nullable().optional(),
  payment_month_offset: z.number().int().min(0, '0以上の値を入力してください').max(3, '3以下の値を入力してください').default(1),
  // Bank account information
  bank_name: z.string().max(50, '50文字以内で入力してください').optional().or(z.literal('')),
  branch_name: z.string().max(50, '50文字以内で入力してください').optional().or(z.literal('')),
  account_number: z.string().max(20, '20文字以内で入力してください').optional().or(z.literal('')),
  account_holder: z.string().max(100, '100文字以内で入力してください').optional().or(z.literal('')),
});

export type PartnerFormData = z.infer<typeof partnerFormSchema>;

// =====================================================
// 発注フォームスキーマ (OrderNew用)
// =====================================================

export const orderItemSchema = z.object({
  product_id: z.string().min(1, '入力必須です').uuid('有効な商品を選択してください'),
  quantity: z.number().positive('正の数値を入力してください').int('整数を入力してください'),
  unit_price: nonNegativeNumber,
  total_amount: nonNegativeNumber,
});

export const orderFormSchema = z.object({
  partner_id: z.string().min(1, '入力必須です').uuid('仕入先を選択してください'),
  assigned_user_id: z.string().min(1, '入力必須です').uuid('発注担当者を選択してください'),
  order_date: pastOrTodayDate,
  delivery_deadline: optionalString, // 任意の納期
  memo: optionalString,
  notes: optionalString, // 発注書の備考欄
  items: z.array(orderItemSchema).min(1, '最低1つの商品を追加してください'),
  shipping_cost: z.number().min(0, '0以上の数値を入力してください').default(0), // 送料
  shipping_tax_rate: z.number().min(0).max(1).default(0.1), // 送料の税率（デフォルト10%）
}).refine(
  (data) => {
    // delivery_deadlineが指定されている場合、order_date以降である必要がある
    if (!data.delivery_deadline) return true;
    const orderDate = new Date(data.order_date);
    const deliveryDate = new Date(data.delivery_deadline);
    return deliveryDate >= orderDate;
  },
  {
    message: '希望納期は発注日以降の日付を設定してください',
    path: ['delivery_deadline'],
  }
);

export type OrderItemData = z.infer<typeof orderItemSchema>;
export type OrderFormData = z.infer<typeof orderFormSchema>;

// =====================================================
// 仕入伝票フォームスキーマ
// =====================================================

export const purchaseOrderItemSchema = z.object({
  product_id: z.string().min(1, '入力必須です').uuid('有効な商品を選択してください'),
  quantity: z.number().positive('正の数値を入力してください').int('整数を入力してください'),
  unit_price: positiveNumber,
  tax_rate: z.number().min(0, '0以上の数値を入力してください').max(100, '税率は0-100の範囲で入力してください'),
});

export const purchaseOrderFormSchema = z.object({
  supplier_id: z.string().min(1, '入力必須です').uuid('仕入先を選択してください'),
  order_id: z.string().uuid().optional().or(z.literal('')),
  invoice_no: z.string().min(1, '入力必須です').max(50, '50文字以内で入力してください'),
  transaction_date: pastOrTodayDate,
  payment_due_date: z.string().min(1, '入力必須です'),
  notes: optionalString,
  items: z.array(purchaseOrderItemSchema).min(1, '最低1つの商品を追加してください'),
}).refine(
  (data) => {
    const transactionDate = new Date(data.transaction_date);
    const dueDate = new Date(data.payment_due_date);
    return dueDate >= transactionDate;
  },
  {
    message: '支払期日は取引日以降の日付を設定してください',
    path: ['payment_due_date'],
  }
);

export type PurchaseOrderItemData = z.infer<typeof purchaseOrderItemSchema>;
export type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

// =====================================================
// エラーメッセージ取得ヘルパー
// =====================================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.errors[0]?.message || 'バリデーションエラー';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '不明なエラーが発生しました';
}

// =====================================================
// 受注フォームスキーマ (Phase 7: 受注管理システム)
// =====================================================

export const salesOrderItemSchema = z.object({
  product_id: z.string().min(1, '入力必須です').uuid('有効な商品を選択してください'),
  quantity: z.number().positive('正の数値を入力してください').int('整数を入力してください'),
  unit_price: positiveNumber,
  tax_rate: z.number().min(0, '0以上の数値を入力してください').max(100, '税率は0-100の範囲で入力してください').default(10),
});

export const salesOrderFormSchema = z.object({
  customer_id: z.string().min(1, '入力必須です').uuid('顧客を選択してください'),
  order_no: z.string().min(1, '入力必須です').max(50, '50文字以内で入力してください'),
  order_date: pastOrTodayDate,
  delivery_date: optionalString,
  delivery_address: optionalString,
  notes: optionalString,
  items: z.array(salesOrderItemSchema).min(1, '最低1つの商品を追加してください'),
}).refine(
  (data) => {
    // delivery_dateが指定されている場合、order_date以降である必要がある
    if (!data.delivery_date) return true;
    const orderDate = new Date(data.order_date);
    const deliveryDate = new Date(data.delivery_date);
    return deliveryDate >= orderDate;
  },
  {
    message: '納期は受注日以降の日付を設定してください',
    path: ['delivery_date'],
  }
);

export type SalesOrderItemData = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderFormData = z.infer<typeof salesOrderFormSchema>;

// =====================================================
// 売上伝票フォームスキーマ (Phase 8: 売掛金管理システム)
// =====================================================

export const salesTransactionItemSchema = z.object({
  product_id: z.string().min(1, '入力必須です').uuid('有効な商品を選択してください'),
  quantity: z.number().positive('正の数値を入力してください').int('整数を入力してください'),
  unit_price: positiveNumber,
  tax_rate: z.number().min(0, '0以上の数値を入力してください').max(100, '税率は0-100の範囲で入力してください').default(10),
});

export const salesTransactionFormSchema = z.object({
  customer_id: z.string().min(1, '入力必須です').uuid('顧客を選択してください'),
  sales_order_id: z.string().uuid().optional().or(z.literal('')),
  transaction_no: z.string().min(1, '入力必須です').max(50, '50文字以内で入力してください'),
  transaction_date: pastOrTodayDate,
  payment_due_date: z.string().min(1, '入力必須です'),
  notes: optionalString,
  items: z.array(salesTransactionItemSchema).min(1, '最低1つの商品を追加してください'),
}).refine(
  (data) => {
    const transactionDate = new Date(data.transaction_date);
    const dueDate = new Date(data.payment_due_date);
    return dueDate >= transactionDate;
  },
  {
    message: '入金期日は取引日以降の日付を設定してください',
    path: ['payment_due_date'],
  }
);

export type SalesTransactionItemData = z.infer<typeof salesTransactionItemSchema>;
export type SalesTransactionFormData = z.infer<typeof salesTransactionFormSchema>;
