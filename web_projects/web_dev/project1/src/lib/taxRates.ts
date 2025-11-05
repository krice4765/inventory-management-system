// =====================================================
// 税率定数定義
// =====================================================

export const TAX_RATES = {
  standard_10: 10.0,
  reduced_8: 8.0,
} as const;

export type TaxCategory = keyof typeof TAX_RATES;

// 税率区分の表示名
export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  standard_10: '標準税率（10%）',
  reduced_8: '軽減税率（8%）',
};

// 税率区分から税率（数値）を取得
export function getTaxRate(category: TaxCategory): number {
  return TAX_RATES[category];
}

// 税率区分の選択肢（セレクトボックス用）
export const TAX_CATEGORY_OPTIONS: Array<{ value: TaxCategory; label: string }> = [
  { value: 'standard_10', label: '標準税率（10%）' },
  { value: 'reduced_8', label: '軽減税率（8%）' },
];
