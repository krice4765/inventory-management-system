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