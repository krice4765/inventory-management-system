import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  Calendar, 
  RotateCcw,
  ChevronDown,
  Search,
  Package,
  Users,
  FileText
} from 'lucide-react';
import { ModernCard } from '../ui/ModernCard';

interface BaseFilters {
      searchKeyword?: string; startDate?: string; endDate?: string; status?: string; category?: string; priceRange?: string; stockRange?: string; }

interface UniversalFiltersProps {
      filters: BaseFilters; onFiltersChange: (filters: BaseFilters) => void; onReset: () => void; filterType: 'products' | 'inventory' | 'partners' | 'orders'; className?: string; }

export function UniversalFilters({ 
  filters, 
  onFiltersChange, 
  onReset, 
  filterType,
  className = '' 
}: UniversalFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.searchKeyword || '');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasActiveFilters = Object.entries(filters).some(([, value]) => 
    value !== undefined && value !== '' && value !== 'all'
  );

  // 検索デバウンス処理
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchInput !== filters.searchKeyword) {
        onFiltersChange({ ...filters, searchKeyword: searchInput });
      }
    }, 300); // 300msのデバウンス（よりレスポンシブに）

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput, filters, onFiltersChange]);

  // 外部からのフィルター変更に対応
  useEffect(() => {
    if (filters.searchKeyword !== searchInput) {
      setSearchInput(filters.searchKeyword || '');
    }
  }, [filters.searchKeyword]);

  const getFilterConfig = () => {
    switch (filterType) {
      case 'products':
        return {
          title: '商品フィルター',
          icon: Package,
          searchPlaceholder: '商品名、商品コード、カテゴリーで検索...',
      quickFilters: [ {
              label: '低在庫',
              action: () => onFiltersChange({ ...filters, status: 'low-stock' })
            },
            {
              label: '今日追加',
      action: () => { const today = new Date().toISOString().split('T')[0];
                onFiltersChange({ ...filters, startDate: today, endDate: today });
              }
            }
          ]
        };
      case 'inventory':
        return {
          title: '在庫フィルター',
          icon: FileText,
          searchPlaceholder: '商品名、移動タイプで検索...',
      quickFilters: [ {
              label: '今日の移動',
      action: () => { const today = new Date().toISOString().split('T')[0];
                onFiltersChange({ ...filters, startDate: today, endDate: today });
              }
            },
            {
              label: '入庫のみ',
              action: () => onFiltersChange({ ...filters, status: 'in' })
            }
          ]
        };
      case 'partners':
        return {
          title: 'パートナーフィルター',
          icon: Users,
          searchPlaceholder: '会社名、担当者名で検索...',
      quickFilters: [ {
              label: '仕入先',
              action: () => onFiltersChange({ ...filters, status: 'supplier' })
            },
            {
              label: '販売先',
              action: () => onFiltersChange({ ...filters, status: 'customer' })
            }
          ]
        };
      case 'orders':
        return {
          title: '発注フィルター',
          icon: FileText,
          searchPlaceholder: '発注番号、担当者名で検索...',
      quickFilters: [ {
              label: '今週',
      action: () => { const today = new Date();
                const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
                const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                onFiltersChange({ 
                  ...filters, 
                  startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0] });
              }
            },
            {
              label: '完了済み',
              action: () => onFiltersChange({ ...filters, status: 'completed' })
            }
          ]
        };
      default:
        return {
          title: 'フィルター',
          icon: Filter,
          searchPlaceholder: '検索...',
      quickFilters: [] };
    }
  };

  const config = getFilterConfig();
  const IconComponent = config.icon;

  return (
    <ModernCard className={`mb-6 ${className}`} glass={hasActiveFilters}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
      className="flex items-center gap-3 text-gray-700 dark: text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
      <div className="p-2 rounded-lg bg-blue-50 dark: bg-blue-900/20"><IconComponent className="w-4 h-4 text-blue-600 dark: text-blue-400" /></div>
            <div>
              <h3 className="text-sm font-semibold">{config.title}</h3>
      <p className="text-xs text-gray-500 dark: text-gray-400">{hasActiveFilters ? 'フィルター適用中' : '条件を指定して検索'}
              </p>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </motion.button>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark: bg-blue-900/30 text-blue-800 dark:text-blue-200">
                適用中
              </motion.span>
            )}
            <motion.button
              onClick={onReset}
      className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark: text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-3 h-3" />
              リセット
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
      <div className="space-y-4 pt-4 border-t border-gray-200 dark: border-gray-700">{/* 統合検索 */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={config.searchPlaceholder}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark: border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all"/>
                </div>

                {/* クイックフィルター */}
                <div className="flex gap-2 flex-wrap">
                  {config.quickFilters.map((filter, index) => (
                    <motion.button
                      key={index}
                      onClick={filter.action}
      className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark: bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {filter.label}
                    </motion.button>
                  ))}
                </div>

                {/* 日付範囲 */}
      <div className="grid grid-cols-1 md: grid-cols-2 gap-4"><div>
      <label className="block text-xs font-medium text-gray-700 dark: text-gray-300 mb-1">開始日
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        value={filters.startDate || ''}
                        onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark: border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all"/>
                    </div>
                  </div>
                  <div>
      <label className="block text-xs font-medium text-gray-700 dark: text-gray-300 mb-1">終了日
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        value={filters.endDate || ''}
                        onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark: border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all"/>
                    </div>
                  </div>
                </div>

                {/* ステータス選択 (filterTypeに応じて動的変更) */}
                <div>
      <label className="block text-xs font-medium text-gray-700 dark: text-gray-300 mb-1">ステータス
                  </label>
                  <select
                    value={filters.status || 'all'}
                    onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 dark: border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all">
                    <option value="all">すべて</option>
                    {filterType === 'products' && (
                      <>
                        <option value="low-stock">低在庫</option>
                        <option value="out-of-stock">在庫切れ</option>
                      </>
                    )}
                    {filterType === 'inventory' && (
                      <>
                        <option value="in">入庫</option>
                        <option value="out">出庫</option>
                      </>
                    )}
                    {filterType === 'partners' && (
                      <>
                        <option value="supplier">仕入先</option>
                        <option value="customer">販売先</option>
                        <option value="both">両方</option>
                      </>
                    )}
                    {filterType === 'orders' && (
                      <>
                        <option value="active">有効</option>
                        <option value="completed">完了</option>
                        <option value="cancelled">キャンセル</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ModernCard>
  );
}