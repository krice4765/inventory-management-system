// 統合在庫履歴表示用の高度フィルタコンポーネント（Phase 2）
import React, { useState, useCallback } from 'react';
import { Search, Calendar, Hash, Filter, X, RotateCcw } from 'lucide-react';
import { MovementFilters } from '../hooks/useOptimizedInventory';
import { ModernCard } from './ui/ModernCard';
import { useDarkMode } from '../hooks/useDarkMode';

interface AdvancedUnifiedFiltersProps {
  filters: MovementFilters;
  onFiltersChange: (filters: MovementFilters) => void;
  isLoading?: boolean;
  totalRecords?: number;
}

export const AdvancedUnifiedFilters: React.FC<AdvancedUnifiedFiltersProps> = ({
  filters,
  onFiltersChange,
  isLoading = false,
  totalRecords = 0
}) => {
  const { isDark } = useDarkMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<MovementFilters>(filters);

  // フィルター適用
  const applyFilters = useCallback(() => {
    onFiltersChange(localFilters);
  }, [localFilters, onFiltersChange]);

  // フィルターリセット
  const resetFilters = useCallback(() => {
    const resetData: MovementFilters = {
      searchTerm: '',
      recordType: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
      startDate: '',
      endDate: '',
      installmentNo: '',
      orderNo: ''
    };
    setLocalFilters(resetData);
    onFiltersChange(resetData);
  }, [onFiltersChange]);

  // ローカルフィルター更新
  const updateLocalFilter = useCallback((key: keyof MovementFilters, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Enterキーでフィルタ適用
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  }, [applyFilters]);

  // アクティブフィルタ数の計算
  const activeFiltersCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === 'sortBy' || key === 'sortOrder') return false;
    if (key === 'recordType') return value !== 'all';
    return value && value !== '';
  }).length;

  return (
    <ModernCard className="p-6">
      <div className="space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Filter className={`h-5 w-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              統合フィルター
            </h3>
            {activeFiltersCount > 0 && (
              <span className={`px-2 py-1 text-xs rounded-full ${
                isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'
              }`}>
                {activeFiltersCount}個のフィルタが適用中
              </span>
            )}
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              ({totalRecords}件)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-3 py-1 text-xs rounded ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } transition-colors`}
            >
              {isExpanded ? '簡単表示' : '詳細表示'}
            </button>
            <button
              onClick={resetFilters}
              className={`p-1 rounded transition-colors ${
                isDark
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="フィルターをリセット"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 基本フィルター（常時表示） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 検索フィールド */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              value={localFilters.searchTerm || ''}
              onChange={(e) => updateLocalFilter('searchTerm', e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="商品名、メモで検索..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            />
          </div>

          {/* レコード種別 */}
          <div>
            <select
              value={localFilters.recordType || 'all'}
              onChange={(e) => updateLocalFilter('recordType', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="all">全てのレコード</option>
              <option value="inventory_movement">在庫移動のみ</option>
              <option value="amount_only_transaction">金額分納のみ</option>
            </select>
          </div>

          {/* ソート */}
          <div>
            <select
              value={`${localFilters.sortBy || 'created_at'}-${localFilters.sortOrder || 'desc'}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                updateLocalFilter('sortBy', sortBy);
                updateLocalFilter('sortOrder', sortOrder);
              }}
              className={`w-full px-3 py-2 border rounded-lg ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="created_at-desc">日付（新しい順）</option>
              <option value="created_at-asc">日付（古い順）</option>
              <option value="total_amount-desc">金額（高い順）</option>
              <option value="total_amount-asc">金額（安い順）</option>
              <option value="product_name-asc">商品名（昇順）</option>
              <option value="product_name-desc">商品名（降順）</option>
            </select>
          </div>
        </div>

        {/* 高度フィルター（展開時のみ表示） */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 開始日 */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <Calendar className="inline h-4 w-4 mr-1" />
                  開始日
                </label>
                <input
                  type="date"
                  value={localFilters.startDate || ''}
                  onChange={(e) => updateLocalFilter('startDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>

              {/* 終了日 */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <Calendar className="inline h-4 w-4 mr-1" />
                  終了日
                </label>
                <input
                  type="date"
                  value={localFilters.endDate || ''}
                  onChange={(e) => updateLocalFilter('endDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>

              {/* 分納回数 */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <Hash className="inline h-4 w-4 mr-1" />
                  分納回数
                </label>
                <input
                  type="number"
                  min="1"
                  value={localFilters.installmentNo || ''}
                  onChange={(e) => updateLocalFilter('installmentNo', e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="例: 1, 2, 3..."
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>

              {/* 発注番号 */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  📄 発注番号
                </label>
                <input
                  type="text"
                  value={localFilters.orderNo || ''}
                  onChange={(e) => updateLocalFilter('orderNo', e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="発注番号で検索..."
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>
            </div>

            {/* クイックフィルターボタン */}
            <div className="mt-4">
              <div className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                クイックフィルター:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    updateLocalFilter('startDate', today);
                    updateLocalFilter('endDate', today);
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isDark
                      ? 'bg-blue-900 text-blue-200 hover:bg-blue-800'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  今日
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    updateLocalFilter('startDate', weekAgo.toISOString().split('T')[0]);
                    updateLocalFilter('endDate', today.toISOString().split('T')[0]);
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isDark
                      ? 'bg-green-900 text-green-200 hover:bg-green-800'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  過去7日間
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    updateLocalFilter('startDate', monthAgo.toISOString().split('T')[0]);
                    updateLocalFilter('endDate', today.toISOString().split('T')[0]);
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isDark
                      ? 'bg-purple-900 text-purple-200 hover:bg-purple-800'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  過去30日間
                </button>
                <button
                  onClick={() => updateLocalFilter('recordType', 'inventory_movement')}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isDark
                      ? 'bg-emerald-900 text-emerald-200 hover:bg-emerald-800'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                >
                  在庫移動のみ
                </button>
                <button
                  onClick={() => updateLocalFilter('recordType', 'amount_only_transaction')}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isDark
                      ? 'bg-orange-900 text-orange-200 hover:bg-orange-800'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  金額分納のみ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {isLoading ? '検索中...' : `${totalRecords}件のレコード`}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={applyFilters}
              disabled={isLoading}
              className={`flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-blue-700 hover:bg-blue-800' : ''
              }`}
            >
              <Search className="h-4 w-4" />
              <span>{isLoading ? '適用中...' : 'フィルター適用'}</span>
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <X className="h-4 w-4" />
                <span>リセット</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </ModernCard>
  );
};