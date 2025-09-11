import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Package, Calendar, Search, X, Eye, Warehouse, TrendingUp, RefreshCw, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';
import { recordInventoryTransaction } from '../utils/inventoryIntegration';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernStatsBar } from '../components/ModernStatsBar';
import { useProducts, useInfiniteMovements, useInventoryStats, type MovementFilters } from '../hooks/useOptimizedInventory';
import { VirtualizedInventoryTable } from '../components/VirtualizedInventoryTable';

export default function Inventory() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // フィルタ状態
  const [filters, setFilters] = useState<MovementFilters>({
    searchTerm: '',
    movementType: 'all',
    deliveryFilter: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
    startDate: '',
    endDate: '',
  });

  const [quickFormData, setQuickFormData] = useState({
    product_id: '',
    movement_type: 'in' as 'in' | 'out',
    quantity: '',
    memo: '',
  });
  
  // React Queryフック使用
  const { data: products = [], isLoading: productsLoading } = useProducts();
  
  const {
    data: movementsData,
    isLoading: movementsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteMovements(filters);
  
  const { data: stats } = useInventoryStats(filters);
  
  // 無限スクロールデータをフラット化
  const allMovements = useMemo(() => {
    return movementsData?.pages?.flatMap(page => page.data) ?? [];
  }, [movementsData]);
  
  const loading = productsLoading || movementsLoading;
  
  // フィルター更新関数を最適化
  const updateFilter = useCallback((key: keyof MovementFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // フィルターリセット関数
  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      movementType: 'all',
      deliveryFilter: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
      startDate: '',
      endDate: '',
    });
  }, []);

  // クイックフィルター関数
  const setQuickDateFilter = useCallback((days: number) => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    
    setFilters(prev => ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    }));
  }, []);
  
  // 無限スクロールローダー
  const loadNextPage = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleQuickAdd = async () => {
    if (!quickFormData.product_id || !quickFormData.quantity || !quickFormData.memo) {
      toast.error('すべての項目を入力してください');
      return;
    }

    try {
      const product = products.find(p => p.id === quickFormData.product_id);
      if (!product) {
        toast.error('商品が見つかりません');
        return;
      }

      const quantity = parseInt(quickFormData.quantity);
      await recordInventoryTransaction({
        product_id: quickFormData.product_id,
        transaction_type: quickFormData.movement_type,
        quantity,
        unit_price: 0,
        memo: quickFormData.memo
      });

      toast.success('在庫移動を記録しました');
      
      // フォームリセット
      setQuickFormData({
        product_id: '',
        movement_type: 'in',
        quantity: '',
        memo: '',
      });
      setShowQuickForm(false);
      
    } catch (error) {
      console.error('❌ 在庫移動記録エラー:', error);
      toast.error('在庫移動の記録に失敗しました');
    }
  };

  const handleMovementClick = useCallback((movement: any) => {
    setSelectedMovement(movement);
    setShowDetailModal(true);
  }, []);

  // 統計カード表示用の計算
  const statsCards = useMemo(() => [
    {
      title: '総移動件数',
      value: ((stats?.totalIn || 0) + (stats?.totalOut || 0)).toLocaleString(),
      icon: <Package className="h-5 w-5" />,
      color: 'blue',
    },
    {
      title: '入庫件数',
      value: (stats?.totalIn || 0).toLocaleString(),
      icon: <Plus className="h-5 w-5" />,
      color: 'green',
    },
    {
      title: '出庫件数',
      value: (stats?.totalOut || 0).toLocaleString(),
      icon: <Minus className="h-5 w-5" />,
      color: 'red',
    },
    {
      title: '純在庫増減',
      value: `${(stats?.totalIn || 0) - (stats?.totalOut || 0) > 0 ? '+' : ''}${((stats?.totalIn || 0) - (stats?.totalOut || 0)).toLocaleString()}`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'purple',
    },
  ], [stats]);

  if (loading) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-green-900 dark:to-blue-900 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mr-3"></div>
            <span className="text-lg text-gray-700 dark:text-gray-300 font-medium">
              在庫データを読み込み中...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-green-900 dark:to-blue-900 transition-all duration-500">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
              <Warehouse className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                在庫管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                商品在庫の確認・入出庫履歴管理・在庫移動処理
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowQuickForm(!showQuickForm)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>クイック追加</span>
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'
              }`}
            >
              {isDark ? '🌞' : '🌙'}
            </button>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <ModernCard key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {stat.title}
                  </p>
                  <p className={`text-2xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-full bg-${stat.color}-100`}>
                  {stat.icon}
                </div>
              </div>
            </ModernCard>
          ))}
        </div>

        {/* フィルターセクション */}
        <ModernCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                フィルター・検索
              </h3>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <Filter className="h-4 w-4" />
                <span>{showAdvancedFilters ? '簡易表示' : '詳細フィルター'}</span>
              </button>
            </div>

            {/* 基本検索 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="商品名、コード、メモで検索..."
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <select
                value={filters.movementType}
                onChange={(e) => updateFilter('movementType', e.target.value)}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">すべての移動</option>
                <option value="in">入庫のみ</option>
                <option value="out">出庫のみ</option>
              </select>

              <select
                value={filters.deliveryFilter}
                onChange={(e) => updateFilter('deliveryFilter', e.target.value)}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                title="在庫移動の種類でフィルター"
              >
                <option value="all">すべての移動</option>
                <option value="partial_delivery">分納連動（発注から自動生成）</option>
                <option value="manual">手動入力（直接登録）</option>
              </select>

              <button
                onClick={resetFilters}
                className="flex items-center space-x-1 px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                <span>リセット</span>
              </button>
            </div>

            {/* 詳細フィルター */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    開始日
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => updateFilter('startDate', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    終了日
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => updateFilter('endDate', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    並び順
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="created_at">日時順</option>
                    <option value="product_name">商品名順</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    順序
                  </label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => updateFilter('sortOrder', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="desc">降順</option>
                    <option value="asc">昇順</option>
                  </select>
                </div>

                {/* クイック日付フィルター */}
                <div className="col-span-full">
                  <p className={`text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    クイック期間選択
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '今日', days: 0 },
                      { label: '1週間', days: 7 },
                      { label: '1ヶ月', days: 30 },
                      { label: '3ヶ月', days: 90 },
                    ].map(period => (
                      <button
                        key={period.days}
                        onClick={() => setQuickDateFilter(period.days)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModernCard>

        {/* 仮想化テーブル */}
        <ModernCard className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                在庫移動履歴
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Package className="h-4 w-4" />
                <span>{allMovements.length}件表示</span>
                {isFetchingNextPage && (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>読み込み中...</span>
                  </>
                )}
              </div>
            </div>

            {allMovements && allMovements.length > 0 ? (
              <VirtualizedInventoryTable
                movements={allMovements || []}
                hasNextPage={hasNextPage ?? false}
                isNextPageLoading={isFetchingNextPage ?? false}
                loadNextPage={loadNextPage}
                onMovementClick={handleMovementClick}
                isDark={isDark ?? false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className={`h-12 w-12 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  在庫移動データがありません
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  フィルター条件を変更するか、新しい在庫移動を追加してください
                </p>
              </div>
            )}
          </div>
        </ModernCard>

        {/* クイック追加フォーム */}
        {showQuickForm && (
          <ModernCard className="p-6">
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              クイック在庫移動追加
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={quickFormData.product_id}
                onChange={(e) => setQuickFormData(prev => ({ ...prev, product_id: e.target.value }))}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">商品を選択</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.product_code})
                  </option>
                ))}
              </select>

              <select
                value={quickFormData.movement_type}
                onChange={(e) => setQuickFormData(prev => ({ ...prev, movement_type: e.target.value as 'in' | 'out' }))}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="in">入庫</option>
                <option value="out">出庫</option>
              </select>

              <input
                type="number"
                placeholder="数量"
                value={quickFormData.quantity}
                onChange={(e) => setQuickFormData(prev => ({ ...prev, quantity: e.target.value }))}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />

              <input
                type="text"
                placeholder="メモ"
                value={quickFormData.memo}
                onChange={(e) => setQuickFormData(prev => ({ ...prev, memo: e.target.value }))}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div className="flex items-center space-x-3 mt-4">
              <button
                onClick={handleQuickAdd}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>追加</span>
              </button>
              <button
                onClick={() => setShowQuickForm(false)}
                className="px-4 py-2 text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </ModernCard>
        )}

        {/* 詳細モーダル */}
        {showDetailModal && selectedMovement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`bg-white rounded-lg p-6 max-w-lg w-full mx-4 ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                在庫移動詳細
              </h3>
              
              {/* デバッグ情報 */}
              <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                <pre>{JSON.stringify(selectedMovement, null, 2)}</pre>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">商品名</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>
                    {selectedMovement.products?.product_name || selectedMovement.products?.name || '商品情報なし'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">移動種別</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>
                    {selectedMovement.movement_type === 'in' ? '入庫' : '出庫'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">数量</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>
                    {selectedMovement.quantity || 0}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">メモ</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>
                    {selectedMovement.memo || 'なし'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">日時</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>
                    {selectedMovement.created_at ? new Date(selectedMovement.created_at).toLocaleString('ja-JP') : '不明'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}