import type { ProductWithSupplier } from '../api/products';
import type { ProductFilters } from '../types/filters';

export const sortProducts = (
  products: ProductWithSupplier[],
  sortBy: ProductFilters['sortBy'],
  sortOrder: ProductFilters['sortOrder']
): ProductWithSupplier[] => {
  if (!products.length) return products;

  const sorted = [...products].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' });
        break;
      case 'product_code':
        comparison = a.product_code.localeCompare(b.product_code, 'ja', { sensitivity: 'base' });
        break;
      case 'purchase_price':
        comparison = Number(a.purchase_price) - Number(b.purchase_price);
        break;
      case 'sell_price':
        comparison = Number(a.sell_price) - Number(b.sell_price);
        break;
      case 'stock_quantity':
        comparison = a.stock_quantity - b.stock_quantity;
        break;
      default:
        comparison = a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' });
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return sorted;
};