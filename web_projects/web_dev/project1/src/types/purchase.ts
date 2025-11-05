// types/purchase.ts

// 科目コード（expense_category）の型定義
export type ExpenseCategory = 'material_cost' | 'outsourcing' | 'factory_supplies' | 'other';

export interface ExpenseCategoryOption {
  code: ExpenseCategory;
  label: string;
  icon: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryOption[] = [
  { code: 'material_cost', label: '材料費', icon: '📦' },
  { code: 'outsourcing', label: '外注加工費', icon: '🏭' },
  { code: 'factory_supplies', label: '工場消耗品', icon: '🔧' },
  { code: 'other', label: 'その他', icon: '📋' },
];

// 仕入伝票（purchase_transactions）の型定義
export interface PurchaseTransaction {
  id: string;
  transaction_type: 'purchase' | 'sale';
  supplier_id: string;
  invoice_no: string;
  transaction_date: string;
  payment_due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'confirmed' | string;
  notes: string | null;
  expense_category: ExpenseCategory;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithParent {
    // ===== 基本情報 =====
    id: string;
    transaction_no: string | null;
    created_at: string;
    partner_id: string;

    // ===== ビジネスクリティカルな情報 =====
    partner_name: string | null;              // 仕入先名
    partner_code: string | null;              // 仕入先コード
    payment_due_date: string | null;          // 支払期日
    created_by_user_id: string | null;        // 登録者ID
    created_by_name: string | null;           // 登録者名

    // ===== 金額情報 =====
    transaction_total: number;                // 合計金額

    // ===== 発注関連情報 =====
    parent_order_id: string | null;
    delivery_sequence: number | null;
    status: 'draft' | 'confirmed' | string;
    notes: string | null;

    // ===== 親発注情報 =====
    parent_order_code: string | null;
    parent_order_date: string | null;
    parent_order_total: number | null;
    parent_order_confirmed: number | null;
    parent_order_draft: number | null;
    parent_order_remaining: number | null;
    parent_order_usage_pct: number | null;
    parent_order_status: 'no_parent' | 'parent_not_found' | 'over_limit' | 'low_balance' | 'nearly_full' | 'normal';
}