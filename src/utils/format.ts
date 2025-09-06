export const jpy = new Intl.NumberFormat('ja-JP', { 
  style: 'currency', 
  currency: 'JPY' 
});

export const formatJPY = (value: number | string): string => {
  return jpy.format(Number(value));
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ja-JP').format(value);
};

export type TransactionStatus = 'draft' | 'confirmed' | 'cancelled';

export interface TransactionFilters {
  minAmount?: number;
  maxAmount?: number;
  status?: 'all' | 'confirmed' | 'draft';
  startDate?: string;
  endDate?: string;
  orderManagerId?: string;
}

export interface OrderManager {
  id: string;
  name: string;
  email?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithManager {
  id: string;
  transaction_no?: string;
  transaction_type?: string;
  partner_id?: string;
  parent_order_id?: string;
  transaction_date?: string;
  due_date?: string;
  status: string;
  total_amount: number;
  transaction_memo?: string;
  delivery_sequence?: number;
  product_name?: string;
  unit_price?: number;
  quantity?: number;
  created_at: string;
  updated_at?: string;
  
  partner_name?: string;
  partner_code?: string;
  contact_person?: string;
  partner_phone?: string;
  partner_email?: string;
  
  order_no?: string;
  order_date?: string;
  delivery_date?: string;
  parent_memo?: string;
  order_total_amount?: number;
  order_status?: string;
  
  order_manager_id?: string;
  order_manager_name?: string;
  order_manager_department?: string;
  order_manager_email?: string;
  order_manager_active?: boolean;
  
  // 🆕 分納回次
  installment_no?: number;
}

export const createDefaultFilters = (): TransactionFilters => ({
  status: 'all'
});

export const getStatusDisplay = (status?: TransactionStatus) => {
  switch (status) {
    case 'confirmed':
      return {
        label: '確定',
        className: 'bg-green-100 text-green-800',
      };
    case 'draft':
    default:
      return {
        label: '未確定',
        className: 'bg-yellow-100 text-yellow-800',
      };
  }
};