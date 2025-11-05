// 発注関連の型定義
export interface PurchaseOrder {
  id: string;
  order_no: string;
  partner_id: string;
  order_date: string;
  delivery_deadline: string | null;
  total_amount: number;
  status: 'active' | 'completed' | 'cancelled';
  memo: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
  // Phase F2: 図面管理 - カスタム図面情報
  custom_drawing_number?: string | null;
  custom_drawing_revision?: string | null;
  custom_drawing_name?: string | null;
  custom_drawing_notes?: string | null;
  custom_drawing_file_path?: string | null;
  custom_drawing_file_name?: string | null;
  custom_drawing_uploaded_at?: string | null;
  // Supabase JOINで取得する場合のオプショナルフィールド
  partners?: {
    id: string;
    name: string;
    partner_code: string;
  };
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;  // 取引時の実際の税率（%）
  total_amount: number;
  created_at: string;
  // Supabase JOINで取得する場合のオプショナルフィールド
  products?: {
    id: string;
    name: string;
    product_code: string;
    purchase_price: number;
  };
}

export interface DeliveryProgress {
  purchase_order_id: string;
  order_no: string;
  partner_id: string;
  partner_name: string;
  order_date: string;
  delivery_deadline: string | null;
  ordered_amount: number;
  delivered_amount: number;
  remaining_amount: number;
  ordered_quantity: number;     // 発注数量
  delivered_quantity: number;   // 納品済数量
  progress_status: '未納品' | '一部納品' | '納品完了';
  created_by_user_id?: string | null;
  created_by_email?: string | null;
  created_by_name?: string | null;
}

// ユーザー管理関連の型定義
export type UserRole =
  | 'admin'              // システム管理者
  | 'manager'            // 部門管理者
  | 'purchasing_staff'   // 発注担当者
  | 'inventory_staff'    // 在庫管理担当者
  | 'sales_staff'        // 営業担当者
  | 'accounting_staff'   // 経理担当者
  | 'staff'              // 一般スタッフ
  | 'readonly';          // 閲覧専用ユーザー

// ロール表示名マッピング
export const roleDisplayNames: Record<UserRole, string> = {
  admin: 'システム管理者',
  manager: '部門管理者',
  purchasing_staff: '発注担当者',
  inventory_staff: '在庫管理担当者',
  sales_staff: '営業担当者',
  accounting_staff: '経理担当者',
  staff: '一般スタッフ',
  readonly: '閲覧専用'
};

// ロールの説明文
export const roleDescriptions: Record<UserRole, string> = {
  admin: 'システム全体の管理とユーザー管理を行います',
  manager: '全業務データの閲覧と重要取引の承認を行います',
  purchasing_staff: '商品管理・発注・仕入処理を行います',
  inventory_staff: '在庫管理・入出庫処理・棚卸を行います',
  sales_staff: '顧客管理・受注・売上処理を行います',
  accounting_staff: '買掛金・売掛金管理と支払・入金処理を行います',
  staff: '基本的なデータ閲覧と限定的な編集を行います',
  readonly: 'すべてのデータの閲覧のみ可能です'
};

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  department: string | null;
  position: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

// フォーム用の型定義
export interface OrderFormData {
  partner_id: string;
  order_date: string;
  delivery_deadline: string;
  memo: string;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  // 🆕 固定フラグの追加
  quantity_locked?: boolean;
  unit_price_locked?: boolean;
}

// 既存型との互換性確保
export interface Product {
  id: string;
  product_name: string;  // DB実カラム名に修正
  product_code: string;
  category: string;
  unit?: string | null;  // 商品の単位（例：個、kg、L、箱など）
  tax_category: 'standard_10' | 'reduced_8';  // 税率区分（標準10% or 軽減8%）
  standard_cost: number;  // 標準原価（仕入原価の基準値）
  selling_price: number;  // 標準販売価格
  current_stock: number;
  min_stock_level: number;
  created_at: string;
  // Phase F2: 図面管理 - 標準図面情報
  drawing_number?: string | null;
  drawing_revision?: string | null;
  drawing_name?: string | null;
  drawing_notes?: string | null;
  drawing_file_path?: string | null;
  drawing_file_name?: string | null;
  drawing_uploaded_at?: string | null;
}

export interface Partner {
  id: string;
  name: string;
  partner_code: string;
  partner_type: 'supplier' | 'customer' | 'both';
  contact_person: string;
  phone: string;
  fax?: string;                   // FAX番号
  email: string;
  address: string;
  is_active: boolean;
  created_at: string;
  // Phase 3A: 締日・支払条件設定
  closing_day?: number;           // 締日（0=月末, 1-31=特定日）
  payment_day?: number;           // 支払日（0=月末, 1-31=特定日）
  payment_month_offset?: number;  // 支払月オフセット（0=当月, 1=翌月, 2=翌々月）
  // 銀行口座情報
  bank_name?: string;             // 銀行名
  branch_name?: string;           // 支店名
  account_number?: string;        // 口座番号
  account_holder?: string;        // 口座名義
}

// Phase 2: 買掛金管理
export interface AccountsPayable {
  id: string;
  supplier_id: string;
  purchase_transaction_id: string;
  invoice_no?: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string;
  // JOIN用オプショナルフィールド
  partners?: Partner;
}

// Phase 1: 支払管理（複数支払方法対応）
export interface PaymentTransaction {
  id: string;
  accounts_payable_id: string;
  payment_date: string;
  amount: number;
  // 複数支払方法
  payment_method_cash: number;
  payment_method_check: number;
  payment_method_note: number;
  payment_method_bank_transfer: number;
  payment_method_offset: number;
  discount_amount: number;
  other_amount: number;
  transaction_fee: number;
  // 銀行情報
  issuing_bank_name?: string;
  payee_bank_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 在庫移動履歴の型定義
export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  unit_price: number;
  total_amount: number;
  stock_after_transaction: number; // 取引後の在庫数（履歴記録用）
  reference_type: string | null;
  reference_id: string | null;
  reference_item_id: string | null;
  transaction_id: string | null;
  is_confirmed: boolean;
  memo: string | null;
  created_at: string;
  // JOINで取得する商品情報
  products?: {
    id: string;
    product_name: string;
    product_code: string;
    standard_cost: number;
    current_stock: number;
  };
}
