import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  DollarSign, 
  Calendar, 
  RotateCcw,
  ChevronDown,
  Sparkles,
  TrendingUp,
  User
} from 'lucide-react';
import { ModernCard } from './ui/ModernCard';
import { useOrderManagers } from '../hooks/useOrderManagers';
import type { TransactionFilters } from '../utils/format';

interface ModernAdvancedFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onReset: () => void;
}

export function ModernAdvancedFilters({ filters, onFiltersChange, onReset }: ModernAdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: managers = [] } = useOrderManagers();
  
  const hasActiveFilters = Object.entries(filters).some(([, value]) => 
    value !== undefined && value !== '' && value !== 'all'
  );

  const quickFilters = [
    {
      icon: Calendar,
      label: '今日',
      action: () => {
        const today = new Date().toISOString().split('T')[0];
        onFiltersChange({ ...filters, startDate: today, endDate: today });
      }
    },
    {
      icon: TrendingUp,
      label: '高額取引',
      action: () => onFiltersChange({ ...filters, minAmount: 100000 })
    },
    {
      icon: Sparkles,
      label: '今週',
      action: () => {
        const today = new Date();
        const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
        const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        onFiltersChange({ 
          ...filters, 
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0]
        });
      }
    }
  ];

  return (
    <ModernCard className="mb-6" glass={hasActiveFilters}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">高度フィルター</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasActiveFilters ? 'フィルター適用中' : '条件を指定して検索'}
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
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
              >
                適用中
              </motion.span>
            )}
            <motion.button
              onClick={onReset}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              disabled={!hasActiveFilters}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-3 h-3" />
              リセット
            </motion.button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {quickFilters.map((quick) => (
            <motion.button
              key={quick.label}
              onClick={quick.action}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <quick.icon className="w-3 h-3" />
              {quick.label}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              {/* 🔥 完全解決策: 段階的ブレークポイント + min-w-0 + 最適化パディング */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 items-end">
                
                {/* 1列目: 金額範囲 */}
                <div className="space-y-2 min-w-0">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 h-4">
                    <DollarSign className="w-3 h-3" />
                    金額範囲
                  </label>
                  <div className="flex gap-1 items-center min-w-0">
                    <input
                      type="number"
                      placeholder="最小"
                      className="min-w-0 flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent h-9"
                      value={filters.minAmount || ''}
                      onChange={(e) => onFiltersChange({
                        ...filters,
                        minAmount: e.target.value ? Number(e.target.value) : undefined
                      })}
                    />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input
                      type="number"
                      placeholder="最大"
                      className="min-w-0 flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent h-9"
                      value={filters.maxAmount || ''}
                      onChange={(e) => onFiltersChange({
                        ...filters,
                        maxAmount: e.target.value ? Number(e.target.value) : undefined
                      })}
                    />
                  </div>
                </div>

                {/* 2列目: ステータス */}
                <div className="space-y-2 min-w-0">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 h-4">
                    <div className="w-3 h-3 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>
                    ステータス
                  </label>
                  <select
                    className="min-w-0 w-full px-2 py-1.5 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none h-9 overflow-hidden text-ellipsis"
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

                {/* 3列目: 発注担当者 */}
                <div className="space-y-2 min-w-0">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 h-4">
                    <User className="w-3 h-3" />
                    発注担当者
                  </label>
                  <select
                    className="min-w-0 w-full px-2 py-1.5 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none h-9 overflow-hidden text-ellipsis"
                    value={filters.orderManagerId || ''}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      orderManagerId: e.target.value || undefined
                    })}
                  >
                    <option value="">すべての担当者</option>
                    {managers.length > 0 ? (
                      managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} {manager.department && `(${manager.department})`}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>担当者データを読み込み中...</option>
                    )}
                  </select>
                </div>

                {/* 4列目: 作成日範囲 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 h-4">
                    <Calendar className="w-3 h-3" />
                    作成日範囲
                  </label>
                  <div className="flex gap-1 items-center">
                    <input
                      type="date"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent h-9"
                      value={filters.startDate || ''}
                      onChange={(e) => onFiltersChange({
                        ...filters,
                        startDate: e.target.value || undefined
                      })}
                    />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input
                      type="date"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent h-9"
                      value={filters.endDate || ''}
                      onChange={(e) => onFiltersChange({
                        ...filters,
                        endDate: e.target.value || undefined
                      })}
                    />
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ModernCard>
  );
}