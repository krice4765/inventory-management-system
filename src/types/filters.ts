export interface ProductFilters {
  search: string;
  supplierId: number | null;
  stockStatus: 'all' | 'low' | 'normal';
  priceRange: {
    min: number | null;
    max: number | null;
  };
  sortBy: 'name' | 'product_code' | 'purchase_price' | 'sell_price' | 'stock_quantity';
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  supplierId: null,
  stockStatus: 'all',
  priceRange: { min: null, max: null },
  sortBy: 'name',
  sortOrder: 'asc',
};