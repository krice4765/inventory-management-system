/**
 * 富士精工システム用安全フォーマッタ（完全修正版）
 * 全ての「N/A」「-」「undefined」表示問題を解決
 */

export const safeStringFormat = (value: unknown): string => {
  // null, undefined, 空文字, 'null', 'undefined' の完全処理
  if (value === null || value === undefined || value === '' || 
      value === 'null' || value === 'undefined' || 
      value === 'N/A' || value === '-') {
    return '未設定';
  }
  
  // 数値の場合は文字列に変換
  if (typeof value === 'number') {
    return isNaN(value) ? '未設定' : String(value);
  }
  
  // 文字列の場合
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || 
        trimmed === 'N/A' || trimmed === '-') {
      return '未設定';
    }
    return trimmed;
  }
  
  // その他の型
  try {
    const stringValue = String(value);
    return stringValue === '[object Object]' ? '未設定' : stringValue;
  } catch {
    return '未設定';
  }
};

export const safeYenFormat = (value: unknown): string => {
  // null, undefined, 空値の処理
  if (value === null || value === undefined || value === '' || 
      value === 'null' || value === 'undefined' || 
      value === 'N/A' || value === '-') {
    return '¥0';
  }
  
  // 数値変換
  let numValue: number;
  if (typeof value === 'string') {
    const cleanValue = value.replace(/[^\d.-]/g, '');
    numValue = parseFloat(cleanValue);
  } else {
    numValue = Number(value);
  }
  
  // NaN または無限大チェック
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '¥0';
  }
  
  try {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(numValue));
  } catch {
    return `¥${Math.round(numValue).toLocaleString('ja-JP')}`;
  }
};

export const safeDateFormat = (value: unknown): string => {
  if (!value || value === 'null' || value === 'undefined' || 
      value === 'N/A' || value === '-') {
    return '未設定';
  }
  
  try {
    const date = new Date(value);
    
    if (isNaN(date.getTime())) {
      return '日付エラー';
    }
    
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  } catch {
    return '日付エラー';
  }
};

export const safeNumberFormat = (value: unknown): string => {
  if (value === null || value === undefined || value === '' || 
      value === 'null' || value === 'undefined' || 
      value === 'N/A' || value === '-') {
    return '0';
  }
  
  const numValue = Number(value);
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '0';
  }
  
  try {
    return Math.round(numValue).toLocaleString('ja-JP');
  } catch {
    return String(Math.round(numValue));
  }
};

export const safeStatusFormat = (status: unknown): string => {
  const statusMap: Record<string, string> = {
    'pending': '承認待ち',
    'approved': '承認済み',
    'ordered': '発注済み',
    'delivered': '納品済み',
    'cancelled': 'キャンセル',
    'draft': '下書き'
  };
  
  if (!status || status === 'null' || status === 'undefined' || 
      status === 'N/A' || status === '-') {
    return '未確定';
  }
  
  return statusMap[String(status).toLowerCase()] || String(status);
};

export const safePercentFormat = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0%';
  }
  return `${Number(value).toFixed(1)}%`;
};

export const toDatetimeLocalValue = (date?: string | Date | null): string => {
  if (!date || date === 'null' || date === 'undefined' || 
      date === 'N/A' || date === '-') {
    return '';
  }
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

export const getCurrentDatetimeLocal = (): string => {
  return toDatetimeLocalValue(new Date());
};

// Product interface
interface Product {
  id?: string
  product_name?: string
  product_code?: string
  standard_price?: number
  selling_price?: number
  drawing_no?: string
  material?: string
  current_stock?: number
  category?: string
  is_active?: boolean
}

// 商品表示用統合フォーマッタ
export const formatProductDisplay = (product: Product | null | undefined) => {
  if (!product) return null;
  
  return {
    id: product.id || '',
    name: safeStringFormat(product.product_name),
    code: safeStringFormat(product.product_code),
    price: safeYenFormat(product.standard_price),
    sellingPrice: safeYenFormat(product.selling_price),
    drawingNo: safeStringFormat(product.drawing_no),
    material: safeStringFormat(product.material),
    stock: safeNumberFormat(product.current_stock),
    category: safeStringFormat(product.category),
    isActive: product.is_active ?? true
  };
};

// Partner interface
interface Partner {
  id?: string
  name?: string
  partner_code?: string
  quality_grade?: string
  payment_terms?: string
  specialties?: string
  is_active?: boolean
}

// 仕入先表示用統合フォーマッタ
export const formatPartnerDisplay = (partner: Partner | null | undefined) => {
  if (!partner) return null;
  
  return {
    id: partner.id || '',
    name: safeStringFormat(partner.name),
    code: safeStringFormat(partner.partner_code),
    qualityGrade: safeStringFormat(partner.quality_grade),
    paymentTerms: safeStringFormat(partner.payment_terms),
    specialties: safeStringFormat(partner.specialties),
    isActive: partner.is_active ?? true
  };
};

// Order interface
interface Order {
  id?: string
  order_no?: string
  created_at?: string
  order_date?: string
  delivery_date?: string
  total_amount?: number
  status?: string
  notes?: string
  partners?: {
    name?: string
    quality_grade?: string
  }
}

// 発注表示用統合フォーマッタ
export const formatOrderDisplay = (order: Order | null | undefined) => {
  if (!order) return null;
  
  return {
    id: order.id || '',
    orderNo: safeStringFormat(order.order_no),
    createdAt: safeDateFormat(order.created_at),
    orderDate: safeDateFormat(order.order_date),
    deliveryDate: safeDateFormat(order.delivery_date),
    totalAmount: safeYenFormat(order.total_amount),
    status: safeStatusFormat(order.status),
    partnerName: safeStringFormat(order.partners?.name),
    partnerGrade: safeStringFormat(order.partners?.quality_grade),
    notes: safeStringFormat(order.notes)
  };
};

// 🚨 UI問題解決専用フォーマッタ
export const validateAmountInput = (input: string | number | null | undefined): { isValid: boolean; amount: number; error?: string } => {
  const inputStr = String(input || '');
  if (!inputStr || inputStr.trim() === '') {
    return { isValid: false, amount: 0, error: '金額を入力してください' };
  }
  
  const cleanInput = inputStr.replace(/[^\d.-]/g, '');
  const amount = parseFloat(cleanInput);
  
  if (isNaN(amount) || !isFinite(amount)) {
    return { isValid: false, amount: 0, error: '有効な数値を入力してください' };
  }
  
  if (amount < 0) {
    return { isValid: false, amount: 0, error: '負の値は入力できません' };
  }
  
  if (amount > 99999999) {
    return { isValid: false, amount: 0, error: '金額が上限を超えています' };
  }
  
  return { isValid: true, amount: Math.round(amount) };
};

export const safeUUIDFormat = (uuid: unknown): string => {
  if (!uuid || uuid === 'null' || uuid === 'undefined') {
    return '';
  }
  
  const uuidStr = String(uuid).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  return uuidRegex.test(uuidStr) ? uuidStr : '';
};

export const safeOrderDateFormat = (date: unknown): string => {
  if (!date || date === 'null' || date === 'undefined' || date === 'N/A' || date === '-') {
    return getCurrentDatetimeLocal();
  }
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return getCurrentDatetimeLocal();
    }
    return toDatetimeLocalValue(d);
  } catch {
    return getCurrentDatetimeLocal();
  }
};

export const safeProductCodeFormat = (code: unknown): string => {
  if (!code || code === 'null' || code === 'undefined' || code === 'N/A' || code === '-') {
    return `AUTO-${Date.now().toString(36).toUpperCase()}`;
  }
  
  const cleanCode = String(code).trim().replace(/[^A-Z0-9-_]/gi, '');
  return cleanCode || `AUTO-${Date.now().toString(36).toUpperCase()}`;
};

export const safeQuantityFormat = (quantity: unknown): number => {
  if (quantity === null || quantity === undefined || quantity === '' || 
      quantity === 'null' || quantity === 'undefined' || quantity === 'N/A' || quantity === '-') {
    return 1;
  }
  
  const num = Number(quantity);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return 1;
  }
  
  return Math.max(1, Math.round(num));
};

// UI表示問題の一括解決フォーマッタ
export const resolveUIDisplayIssues = (data: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data;
  
  const resolved = { ...data };
  
  // 文字列フィールドの修正
  Object.keys(resolved).forEach(key => {
    if (typeof resolved[key] === 'string') {
      if (resolved[key] === 'null' || resolved[key] === 'undefined' || 
          resolved[key] === 'N/A' || resolved[key] === '-' || resolved[key] === '') {
        resolved[key] = '未設定';
      }
    }
  });
  
  // 金額フィールドの修正
  ['price', 'amount', 'total_amount', 'unit_price', 'standard_price'].forEach(field => {
    if (resolved[field] !== undefined) {
      const validation = validateAmountInput(String(resolved[field] || 0));
      resolved[field] = validation.amount;
    }
  });
  
  // 数量フィールドの修正
  ['quantity', 'stock', 'current_stock'].forEach(field => {
    if (resolved[field] !== undefined) {
      resolved[field] = safeQuantityFormat(resolved[field]);
    }
  });
  
  // UUID フィールドの修正
  ['id', 'product_id', 'partner_id', 'order_id'].forEach(field => {
    if (resolved[field] !== undefined) {
      resolved[field] = safeUUIDFormat(resolved[field]);
    }
  });
  
  return resolved;
};

// フォーム入力値の事前検証
export const validateFormInput = (fieldName: string, value: unknown): { isValid: boolean; cleanValue: unknown; error?: string } => {
  switch (fieldName) {
    case 'amount':
    case 'price':
    case 'total_amount':
    case 'unit_price':
    case 'standard_price':
      return validateAmountInput(String(value || ''));
      
    case 'quantity':
    case 'stock': {
      const qty = safeQuantityFormat(value);
      return { isValid: qty > 0, cleanValue: qty, error: qty <= 0 ? '数量は1以上を入力してください' : undefined };
    }
      
    case 'product_code': {
      const code = safeProductCodeFormat(value);
      return { isValid: code !== '', cleanValue: code };
    }
      
    case 'id':
    case 'product_id':
    case 'partner_id':
    case 'order_id': {
      const uuid = safeUUIDFormat(value);
      return { isValid: uuid !== '', cleanValue: uuid, error: uuid === '' ? '有効なIDを入力してください' : undefined };
    }
      
    default: {
      const str = safeStringFormat(value);
      return { isValid: str !== '未設定', cleanValue: str };
    }
  }
};