/**
 * Format a number as currency (Japanese Yen)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

/**
 * Format a date string to Japanese format (YYYY/MM/DD)
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '-';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}`;
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ja-JP').format(num);
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10; // Round to 1 decimal place
}
