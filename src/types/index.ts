// 発注関連の型定義
export interface PurchaseOrder {
  id: string;
  order_no: string;
  partner_id: string;
  order_date: string;
  delivery_deadline: string | null;
  total_amount: number;
  status: '未納品' | '一部納品' | '納品完了' | 'キャンセル';
  memo: string | null;
  created_at: string;
  updated_at: string;
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
  total_amount: number;
  created_at: string;
  // Supabase JOINで取得する場合のオプショナルフィールド
  products?: {
    id: string;
    product_name: string;
    product_code: string;
    purchase_price: number;
  };
}

export interface DeliveryProgress {
  purchase_order_id: string;
  order_no: string;
  partner_id: string;
  partner_product_name: string;
  order_date: string;
  delivery_deadline: string | null;
  ordered_amount: number;
  delivered_amount: number;
  remaining_amount: number;
  progress_status: '未納品' | '一部納品' | '納品完了';
}

// フォーム用の型定義
export interface OrderFormData {
  partner_id: string;
  order_date: string;
  delivery_deadline: string;
  memo: string;
  assigned_user_id?: string;
  shipping_cost?: number;
  shipping_tax_rate?: number;
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
  product_name: string;
  product_code: string;
  category: string;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_level: number;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  partner_code: string;
  partner_type: 'supplier' | 'customer' | 'both';
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  created_at: string;
}
