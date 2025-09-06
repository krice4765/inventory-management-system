import React from 'react';
import { Filter, DollarSign, Calendar, RotateCcw } from 'lucide-react';
import type { TransactionFilters } from '../utils/format';

interface AdvancedFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onReset: () => void;
}

export function AdvancedFilters({ filters, onFiltersChange, onReset }: AdvancedFiltersProps) {
  const hasActiveFilters = Object.entries(filters).some(([, value]) => 
    value !== undefined && value !== '' && value !== 'all'
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">高度フィルター</h3>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              フィルター適用中
            </span>
          )}
        </div>
        
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          disabled={!hasActiveFilters}
        >
          <RotateCcw className="w-3 h-3" />
          リセット
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 金額フィルター */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            金額範囲
          </label>
          <div className="flex gap-1 items-center">
            <input
              type="number"
              placeholder="最小"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.minAmount || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                minAmount: e.target.value ? Number(e.target.value) : undefined
              })}
            />
            <span className="text-gray-400 text-xs">〜</span>
            <input
              type="number"
              placeholder="最大"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.maxAmount || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                maxAmount: e.target.value ? Number(e.target.value) : undefined
              })}
            />
          </div>
        </div>

        {/* ステータスフィルター */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">ステータス</label>
          <select
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.status || 'all'}
            onChange={(e) => onFiltersChange({
              ...filters,
              status: e.target.value as 'all' | 'confirmed' | 'draft'
            })}
          >
            <option value="all">すべて</option>
            <option value="confirmed">確定のみ</option>
            <option value="draft">未確定のみ</option>
          </select>
        </div>

        {/* 作成日フィルター */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            作成日範囲
          </label>
          <div className="flex gap-1 items-center">
            <input
              type="date"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.startDate || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                startDate: e.target.value || undefined
              })}
            />
            <span className="text-gray-400 text-xs">〜</span>
            <input
              type="date"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.endDate || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                endDate: e.target.value || undefined
              })}
            />
          </div>
        </div>

        {/* クイックフィルター */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">クイック選択</label>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                onFiltersChange({ ...filters, startDate: today, endDate: today });
              }}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              今日
            </button>
            <button
              onClick={() => onFiltersChange({ ...filters, minAmount: 100000 })}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              高額(10万円以上)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}