import React from 'react';
import { Filter, RotateCcw, ChevronDown, ArrowUpDown } from 'lucide-react';
import type { ProductFilters } from '../../types/filters';
import { useSuppliers } from '../../hooks/useProducts';

interface ProductFilterBarProps {
  filters: ProductFilters;
  onFilterChange: (newFilters: Partial<ProductFilters>) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export const ProductFilterBar: React.FC<ProductFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  totalCount,
  filteredCount,
}) => {
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers();

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({ supplierId: value === '' ? null : Number(value) });
  };

  const handleStockStatusChange = (status: ProductFilters['stockStatus']) => {
    onFilterChange({ stockStatus: status });
  };

  const handlePriceChange = (field: 'min' | 'max', value: string) => {
    const numValue = value === '' ? null : Number(value);
    onFilterChange({
      priceRange: {
        ...filters.priceRange,
        [field]: numValue,
      },
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortBy: e.target.value as ProductFilters['sortBy'] });
  };

  const toggleSortOrder = () => {
    onFilterChange({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
  };

  const hasActiveFilters = 
    filters.supplierId !== null ||
    filters.stockStatus !== 'all' ||
    filters.priceRange.min !== null ||
    filters.priceRange.max !== null ||
    filters.sortBy !== 'name' ||
    filters.sortOrder !== 'asc';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Filter className="h-5 w-5 mr-2 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">フィルタ・並び替え</h3>
          {filteredCount !== totalCount && (
            <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              {filteredCount}件表示
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RotateCcw size={16} className="mr-2" />
            フィルタクリア
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 仕入先フィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            仕入先で絞り込み
          </label>
          <div className="relative">
            <select
              value={filters.supplierId ?? ''}
              onChange={handleSupplierChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none"
              disabled={isLoadingSuppliers}
            >
              <option value="">全ての仕入先</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 在庫状況フィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            在庫状況で絞り込み
          </label>
          <div className="flex space-x-1">
            {[
              { value: 'all', label: '全て' },
              { value: 'normal', label: '正常' },
              { value: 'low', label: '不足' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleStockStatusChange(value as ProductFilters['stockStatus'])}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  filters.stockStatus === value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 価格帯フィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            販売価格で絞り込み（円）
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="最小"
              value={filters.priceRange.min ?? ''}
              onChange={(e) => handlePriceChange('min', e.target.value)}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              min="0"
            />
            <span className="flex items-center text-gray-500">〜</span>
            <input
              type="number"
              placeholder="最大"
              value={filters.priceRange.max ?? ''}
              onChange={(e) => handlePriceChange('max', e.target.value)}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              min="0"
            />
          </div>
        </div>

        {/* 並び替え */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            並び替え
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <select
                value={filters.sortBy}
                onChange={handleSortChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none"
              >
                <option value="name">商品名</option>
                <option value="product_code">商品コード</option>
                <option value="purchase_price">仕入単価</option>
                <option value="sell_price">販売単価</option>
                <option value="stock_quantity">在庫数</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={toggleSortOrder}
              className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
                filters.sortOrder === 'asc'
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={filters.sortOrder === 'asc' ? '昇順' : '降順'}
            >
              <ArrowUpDown 
                size={16} 
                className={`transition-transform ${filters.sortOrder === 'desc' ? 'rotate-180' : ''}`} 
              />
            </button>
          </div>
        </div>
      </div>

      {/* アクティブフィルタの表示 */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.supplierId !== null && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                仕入先: {suppliers.find(s => s.id === filters.supplierId)?.name}
              </span>
            )}
            {filters.stockStatus !== 'all' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {filters.stockStatus === 'low' ? '安全在庫割れ' : '正常在庫'}
              </span>
            )}
            {(filters.priceRange.min !== null || filters.priceRange.max !== null) && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                価格: {filters.priceRange.min ?? '0'}円 〜 {filters.priceRange.max ?? '∞'}円
              </span>
            )}
            {(filters.sortBy !== 'name' || filters.sortOrder !== 'asc') && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                並び替え: {
                  filters.sortBy === 'name' ? '商品名' : 
                  filters.sortBy === 'product_code' ? '商品コード' :
                  filters.sortBy === 'purchase_price' ? '仕入単価' :
                  filters.sortBy === 'sell_price' ? '販売単価' : '在庫数'
                } ({filters.sortOrder === 'asc' ? '昇順' : '降順'})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};