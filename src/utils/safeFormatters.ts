/**
 * 富士精工様向けシステム - 安全なフォーマッター
 * 
 * undefinedやnullに対して安全な表示フォーマット関数
 */

// 安全な価格フォーマット（円）
export const safeYenFormat = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '¥0';
  }
  return `¥${Number(value).toLocaleString()}`;
};

// 安全な数値フォーマット
export const safeNumberFormat = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0';
  }
  return Number(value).toLocaleString();
};

// 安全な文字列フォーマット
export const safeStringFormat = (value: string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

// 安全な日付フォーマット
export const safeDateFormat = (
  value: string | Date | null | undefined, 
  format: 'date' | 'datetime' | 'time' = 'date'
): string => {
  if (!value) return '';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Tokyo'
    };
    
    switch (format) {
      case 'date':
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        break;
      case 'datetime':
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
    }
    
    return new Intl.DateTimeFormat('ja-JP', options).format(date);
  } catch (error) {
    console.warn('Date formatting error:', error);
    return '';
  }
};

// 安全なステータス表示
export const safeStatusFormat = (status: string | null | undefined): string => {
  const statusMap: Record<string, string> = {
    'draft': '下書き',
    'pending': '保留中',
    'confirmed': '確定',
    'completed': '完了',
    'cancelled': 'キャンセル',
    'active': '有効',
    'inactive': '無効'
  };
  
  if (!status) return '不明';
  return statusMap[status.toLowerCase()] || status;
};

// 安全なパーセンテージフォーマット
export const safePercentFormat = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0%';
  }
  return `${Number(value).toFixed(1)}%`;
};