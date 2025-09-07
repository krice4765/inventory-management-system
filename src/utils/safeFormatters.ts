/**
 * 富士精工システム用安全フォーマッタ（完全修正版）
 * 全ての「N/A」「-」「undefined」表示問題を解決
 */

export const safeStringFormat = (value: any): string => {
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

export const safeYenFormat = (value: any): string => {
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

export const safeDateFormat = (value: any): string => {
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

export const safeNumberFormat = (value: any): string => {
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

export const safeStatusFormat = (status: any): string => {
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

// 商品表示用統合フォーマッタ
export const formatProductDisplay = (product: any) => {
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

// 仕入先表示用統合フォーマッタ
export const formatPartnerDisplay = (partner: any) => {
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

// 発注表示用統合フォーマッタ
export const formatOrderDisplay = (order: any) => {
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