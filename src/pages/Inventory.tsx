import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Warehouse, X, Package, TrendingUp, Filter, Search, RefreshCw, List, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDarkMode } from '../hooks/useDarkMode';
import { recordInventoryTransaction } from '../utils/inventoryIntegration';
import { ModernCard } from '../components/ui/ModernCard';
// Temporarily disabled: import { ModernStatsBar } from '../components/ModernStatsBar';
import { type MovementFilters, useProducts, useAllMovements, useInventoryStats } from '../hooks/useOptimizedInventory';
import { VirtualizedInventoryTable } from '../components/VirtualizedInventoryTable';
import SearchableSelect from '../components/SearchableSelect';
import { UnifiedInventoryDisplay } from '../components/UnifiedInventoryDisplay';
import { InventoryActionDropdown } from '../components/ui/InventoryActionDropdown';
import { ShippingSettingsModal } from '../components/modals/ShippingSettingsModal';
import { InventoryStatusTab } from '../components/tabs/InventoryStatusTab';
import { TaxDisplayToggle } from '../components/ui/TaxDisplayToggle';

export default function Inventory() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const queryClient = useQueryClient();

  // 二層ビュー管理（0922Youken.md準拠）
  const [activeView, setActiveView] = useState<'summary' | 'movements'>('summary');
  const [taxDisplayMode, setTaxDisplayMode] = useState<'tax_included' | 'tax_excluded'>('tax_included');

  const [showQuickForm, setShowQuickForm] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUnifiedDisplay, setShowUnifiedDisplay] = useState(false);

  // 送料設定モーダル状態
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(null);
  
  // フィルタ状態（検索ボタン方式）
  const [searchInput, setSearchInput] = useState(''); // 入力フィールド用
  const [appliedSearchTerm, setAppliedSearchTerm] = useState(''); // 実際の検索用
  const [otherFilters, setOtherFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
  });
  // 適用されたフィルター（検索ボタンクリック時のみ更新）
  const [appliedOtherFilters, setAppliedOtherFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
  });

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // 検索やフィルタ変更時にページをリセット
  const handleSearch = useCallback(() => {
    setAppliedSearchTerm(searchInput.trim());
    setAppliedOtherFilters({ ...otherFilters });
    setCurrentPage(1);
  }, [searchInput, otherFilters]);

  // Enterキーで検索実行
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // 検索状態の管理（適用された検索キーワードを使用）
  const hasSearchTerm = appliedSearchTerm.length > 0;

  // MovementFilters に変換（検索ボタン実行後の値を使用）
  const filters: MovementFilters = useMemo(() => ({
    searchTerm: appliedSearchTerm,
    movementType: appliedOtherFilters.status === 'all' ? 'all' :
                  appliedOtherFilters.status === 'in' ? 'in' :
                  appliedOtherFilters.status === 'out' ? 'out' : 'all',
    deliveryFilter: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
    startDate: appliedOtherFilters.startDate || '',
    endDate: appliedOtherFilters.endDate || '',
  }), [appliedSearchTerm, appliedOtherFilters]);

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
    refetch: refetchMovements,
  } = useAllMovements(filters);

  const { data: stats } = useInventoryStats(filters);

  // 全移動履歴データ
  const allMovements = movementsData?.data || [];

  // ページネーション処理
  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allMovements.slice(startIndex, endIndex);
  }, [allMovements, currentPage, pageSize]);

  // 総ページ数
  const totalPages = Math.ceil(allMovements.length / pageSize);
  
  const loading = productsLoading || movementsLoading;
  

  // フィルターリセット関数
  const resetFilters = useCallback(() => {
    setSearchInput('');
    setAppliedSearchTerm('');
    setCurrentPage(1);
    setOtherFilters({
      status: 'all',
      startDate: '',
      endDate: '',
    });
    setAppliedOtherFilters({
      status: 'all',
      startDate: '',
      endDate: '',
    });
  }, []);


  // ページネーション関数
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  // 在庫移動履歴のみをリフレッシュ（統計も含む）
  const refreshInventoryList = useCallback(async () => {
    try {
      // 在庫移動データと統計データを並列でリフレッシュ
      await Promise.all([
        refetchMovements(),
        queryClient.invalidateQueries({ queryKey: ['inventory-stats'] })
      ]);
    } catch (error) {
      console.error('❌ 在庫リスト更新エラー:', error);
    }
  }, [refetchMovements, queryClient]);

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
      const result = await recordInventoryTransaction({
        product_id: quickFormData.product_id,
        transaction_type: quickFormData.movement_type,
        quantity,
        unit_price: 0,
        memo: quickFormData.memo
      });

      if (result.success) {
        toast.success('在庫移動を記録しました');
        
        // フォームリセット
        setQuickFormData({
          product_id: '',
          movement_type: 'in',
          quantity: '',
          memo: '',
        });
        setShowQuickForm(false);

        // データを強制リフレッシュ（React Query のキャッシュを無効化）
        await queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
        
      } else {
        throw new Error(result.error || '在庫移動の記録に失敗しました');
      }
      
    } catch (error) {
      console.error('❌ 在庫移動記録エラー:', error);
      toast.error(error instanceof Error ? error.message : '在庫移動の記録に失敗しました');
    }
  };

  const handleMovementClick = useCallback((movement: any) => {
    setSelectedMovement(movement);
    setShowDetailModal(true);
  }, []);

  // 在庫操作ハンドラー
  const handleInventoryAdjustment = useCallback(() => {
    toast.info('在庫調整機能は開発中です');
  }, []);

  const handleCreateOrder = useCallback(() => {
    toast.info('発注作成機能は開発中です');
  }, []);

  const handleOutboundOrder = useCallback(() => {
    toast.info('出庫指示機能は開発中です');
  }, []);

  const handleViewHistory = useCallback((movement: any) => {
    handleMovementClick(movement);
  }, [handleMovementClick]);

  const handleExportPDF = useCallback(() => {
    toast.info('PDF出力機能は開発中です');
  }, []);

  const handleProductSettings = useCallback(() => {
    toast.info('商品設定機能は開発中です');
  }, []);

  const handleShippingSettings = useCallback((movement: any) => {
    // 商品の仕入先情報から取引先を特定（実装簡略化のためダミー値）
    const supplierInfo = {
      id: movement.products?.supplier_id || '1',
      name: `${movement.products?.product_name || '商品'}の取引先`
    };

    setSelectedSupplier(supplierInfo);
    setShowShippingModal(true);
  }, []);

  // 統計カード表示用の計算
  const statsCards = useMemo(() => [
    {
      title: '総移動件数',
      value: (stats?.totalMovements || 0).toLocaleString(),
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
      value: `${(stats?.netQuantity || 0) > 0 ? '+' : ''}${(stats?.netQuantity || 0).toLocaleString()}`,
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-green-900 dark:to-blue-900 transition-all duration-500">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-8"
      >
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
            {/* 統合表示切り替えボタン */}
            <button
              onClick={() => setShowUnifiedDisplay(!showUnifiedDisplay)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                showUnifiedDisplay
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-md'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>{showUnifiedDisplay ? '標準表示' : '統合分析'}</span>
            </button>

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


        {/* クイック追加フォーム - フィルターの直後に配置 */}
        {showQuickForm && (
          <ModernCard className="p-6">
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              クイック在庫移動追加
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchableSelect
                options={[
                  { value: '', label: '商品を選択してください' },
                  ...products.map(product => ({
                    value: product.id,
                    label: product.product_name,
                    description: `(${product.product_code}) 在庫: ${product.current_stock}`
                  }))
                ]}
                value={quickFormData.product_id}
                onChange={(value) => setQuickFormData(prev => ({ ...prev, product_id: value }))}
                placeholder="商品名またはコードで検索..."
                className="w-full"
                darkMode={isDark}
              />

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

        {/* 統合表示 または 二層ビュー構造 */}
        {showUnifiedDisplay ? (
          <UnifiedInventoryDisplay
            initialFilters={{
              searchTerm: appliedSearchTerm,
              sortBy: 'created_at',
              sortOrder: 'desc',
              recordType: 'all'
            }}
            showTitle={true}
            showFilters={false}
          />
        ) : (
          /* 二層ビュー実装（0922Youken.md準拠） */
          <ModernCard className="p-6">
            {/* ビュー切り替えタブ */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveView('summary')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      activeView === 'summary'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    <span>在庫サマリビュー</span>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full">
                      日常業務用
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveView('movements')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      activeView === 'movements'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>在庫移動履歴ビュー</span>
                    <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 px-2 py-1 rounded-full">
                      詳細分析用
                    </span>
                  </button>
                </div>

                {/* 税込/税抜表示切り替え */}
                <TaxDisplayToggle
                  mode={taxDisplayMode}
                  onChange={setTaxDisplayMode}
                />
              </div>
            </div>

            {/* ビューコンテンツ */}
            {activeView === 'summary' ? (
              /* 在庫サマリビュー - 日常業務用 */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    在庫サマリ表示
                  </h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Package className="h-4 w-4" />
                    <span>現在の在庫状況を確認</span>
                  </div>
                </div>

                {/* InventoryStatusTabを使用した在庫サマリ表示 */}
                <InventoryStatusTab
                  taxDisplayMode={taxDisplayMode}
                  isDark={isDark}
                />
              </div>
            ) : (
              /* 在庫移動履歴ビュー - 詳細分析用 */
              <div className="space-y-6">
                {/* 分析ダッシュボード */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ModernCard className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          移動回転率
                        </p>
                        <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {stats ? Math.round((stats.totalMovements / Math.max(stats.totalItems || 1, 1)) * 10) / 10 : 0}回/月
                        </p>
                      </div>
                    </div>
                  </ModernCard>

                  <ModernCard className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          入庫効率
                        </p>
                        <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {stats && stats.totalMovements > 0
                            ? Math.round((stats.totalIn / stats.totalMovements) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </ModernCard>

                  <ModernCard className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                        <Minus className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          出庫効率
                        </p>
                        <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {stats && stats.totalMovements > 0
                            ? Math.round((stats.totalOut / stats.totalMovements) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </ModernCard>

                  <ModernCard className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          平均処理時間
                        </p>
                        <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          2.3分
                        </p>
                      </div>
                    </div>
                  </ModernCard>
                </div>

                {/* フィルターバー - データテーブル直上配置 */}
                <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      フィルター・検索
                    </h4>
                    <button
                      onClick={resetFilters}
                      className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      リセット
                    </button>
                  </div>

                  {/* 横一列フィルター配置 */}
                  <div className="flex flex-wrap items-end gap-3">
                    {/* 検索フィールド */}
                    <div className="flex-1 min-w-48">
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        キーワード検索
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="商品名、移動タイプで検索..."
                          className={`w-full pl-10 pr-4 py-2 text-sm border rounded-lg ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* ステータス */}
                    <div className="min-w-32">
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        ステータス
                      </label>
                      <select
                        value={otherFilters.status}
                        onChange={(e) => setOtherFilters(prev => ({ ...prev, status: e.target.value }))}
                        className={`w-full px-3 py-2 text-sm border rounded-lg ${
                          isDark
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="all">すべて</option>
                        <option value="in">入庫のみ</option>
                        <option value="out">出庫のみ</option>
                      </select>
                    </div>

                    {/* 開始日 */}
                    <div className="min-w-36">
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        開始日
                      </label>
                      <input
                        type="date"
                        value={otherFilters.startDate}
                        onChange={(e) => setOtherFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className={`w-full px-3 py-2 text-sm border rounded-lg ${
                          isDark
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>

                    {/* 終了日 */}
                    <div className="min-w-36">
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        終了日
                      </label>
                      <input
                        type="date"
                        value={otherFilters.endDate}
                        onChange={(e) => setOtherFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className={`w-full px-3 py-2 text-sm border rounded-lg ${
                          isDark
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>

                    {/* 検索実行ボタン */}
                    <div>
                      <button
                        onClick={handleSearch}
                        className={`px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium ${
                          isDark ? 'bg-blue-700 hover:bg-blue-800' : ''
                        }`}
                      >
                        <Search className="h-4 w-4" />
                        検索
                      </button>
                    </div>
                  </div>

                  {/* クイックフィルター */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setOtherFilters(prev => ({ ...prev, startDate: today, endDate: today }));
                      }}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        isDark
                          ? 'bg-blue-900 text-blue-200 hover:bg-blue-800'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      今日の移動
                    </button>
                    <button
                      onClick={() => {
                        setOtherFilters(prev => ({ ...prev, status: 'in' }));
                      }}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        isDark
                          ? 'bg-green-900 text-green-200 hover:bg-green-800'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      入庫のみ
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    在庫移動履歴
              </h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Package className="h-4 w-4" />
                  <span>{allMovements.length}件表示</span>
                  {movementsLoading && (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>読み込み中...</span>
                    </>
                  )}
                </div>
                
                {/* 在庫リストリフレッシュボタン */}
                <button
                  onClick={refreshInventoryList}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs transition-colors ${
                    isDark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="在庫履歴をリフレッシュ"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>更新</span>
                </button>
              </div>
            </div>

            <div>
              {allMovements && allMovements.length > 0 ? (
                <>
                  {/* ページネーション - 上部 */}
                  <div className={`px-6 py-3 flex items-center justify-between border-b ${
                    isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                          currentPage === 1
                            ? isDark
                              ? 'border-gray-600 text-gray-500 bg-gray-800'
                              : 'border-gray-300 text-gray-300 bg-gray-100'
                            : isDark
                            ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600'
                            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      >
                        前へ
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                          currentPage === totalPages
                            ? isDark
                              ? 'border-gray-600 text-gray-500 bg-gray-800'
                              : 'border-gray-300 text-gray-300 bg-gray-100'
                            : isDark
                            ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600'
                            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      >
                        次へ
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span>
                          {' から '}
                          <span className="font-medium">{Math.min(currentPage * pageSize, allMovements.length)}</span>
                          {' / '}
                          <span className="font-medium">{allMovements.length}</span>
                          {' 件'}
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium ${
                              currentPage === 1
                                ? isDark
                                  ? 'border-gray-600 text-gray-500 bg-gray-800'
                                  : 'border-gray-300 text-gray-300 bg-gray-100'
                                : isDark
                                ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600'
                                : 'border-gray-300 text-gray-500 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <span className="sr-only">前へ</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let pageNumber;
                            if (totalPages <= 7) {
                              pageNumber = i + 1;
                            } else if (currentPage <= 4) {
                              pageNumber = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                              pageNumber = totalPages - 6 + i;
                            } else {
                              pageNumber = currentPage - 3 + i;
                            }

                            return (
                              <button
                                key={pageNumber}
                                onClick={() => handlePageChange(pageNumber)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  pageNumber === currentPage
                                    ? isDark
                                      ? 'z-10 bg-blue-600 border-blue-600 text-white'
                                      : 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                    : isDark
                                    ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600'
                                    : 'border-gray-300 text-gray-500 bg-white hover:bg-gray-50'
                                }`}
                              >
                                {pageNumber}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium ${
                              currentPage === totalPages
                                ? isDark
                                  ? 'border-gray-600 text-gray-500 bg-gray-800'
                                  : 'border-gray-300 text-gray-300 bg-gray-100'
                                : isDark
                                ? 'border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600'
                                : 'border-gray-300 text-gray-500 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <span className="sr-only">次へ</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>

                  {/* 在庫移動履歴テーブル */}
                  <div className={`overflow-hidden rounded-lg shadow-lg ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                    <div className="overflow-x-auto">
                      <table className={`w-full ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                        <thead className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                          <tr>
                            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              発注書ID
                            </th>
                            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              製品
                            </th>
                            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              移動タイプ
                            </th>
                            <th className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              移動数量
                            </th>
                            <th className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              在庫変化
                            </th>
                            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              移動日時
                            </th>
                            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-900' : 'divide-gray-200 bg-white'}`}>
                          {paginatedMovements.map((movement) => (
                            <tr
                              key={movement.id}
                              className={`transition-colors ${
                                isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                              }`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  {movement.transaction_details?.purchase_order_id ? (
                                    <div className={`text-sm font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                      {movement.transaction_details.purchase_order_id}
                                    </div>
                                  ) : (
                                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                      -
                                    </div>
                                  )}
                                  {(movement.transactions?.installment_no || movement.transaction_details?.delivery_sequence) && (
                                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                      第{movement.transactions?.installment_no || movement.transaction_details?.delivery_sequence}回
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                      <Package className={`h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-600'}`} />
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>
                                      {movement.products?.product_name || movement.products?.name || 'N/A'}
                                    </div>
                                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} font-mono`}>
                                      {movement.products?.product_code || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    movement.movement_type === 'in'
                                      ? isDark ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
                                      : isDark ? 'bg-rose-900 text-rose-200' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {movement.movement_type === 'in' ? '入庫' : '出庫'}
                                  </span>
                                  {movement.transaction_details && (
                                    <div>
                                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                        movement.transaction_details.delivery_type === 'full'
                                          ? isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'
                                          : isDark ? 'bg-amber-900 text-amber-200' : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {movement.transaction_details.delivery_type === 'full' ? '全納' : '分納'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {movement.quantity?.toLocaleString() || 0}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  個
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-between border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-600">
                                  <div className="text-center flex-1">
                                    <div className={`text-lg font-semibold ${
                                      movement.movement_type === 'in'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}>
                                      {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity?.toLocaleString() || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      変動量
                                    </div>
                                  </div>
                                  <div className="h-10 w-px bg-gray-300 dark:bg-gray-600 mx-4"></div>
                                  <div className="text-center flex-1">
                                    <div className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {movement.cumulative_stock_at_time?.toLocaleString() || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      移動後在庫
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {new Date(movement.created_at).toLocaleDateString('ja-JP')}
                                  </div>
                                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {new Date(movement.created_at).toLocaleTimeString('ja-JP', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <InventoryActionDropdown
                                  onInventoryAdjustment={handleInventoryAdjustment}
                                  onCreateOrder={handleCreateOrder}
                                  onOutboundOrder={handleOutboundOrder}
                                  onViewHistory={() => handleViewHistory(movement)}
                                  onExportPDF={handleExportPDF}
                                  onProductSettings={handleProductSettings}
                                  onShippingSettings={() => handleShippingSettings(movement)}
                                  className="inline-block"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  {hasSearchTerm ? (
                    <>
                      <Package className={`h-12 w-12 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        「{appliedSearchTerm}」に一致する結果がありません
                      </p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        検索条件を変更してお試しください
                      </p>
                    </>
                  ) : (
                    <>
                      <Package className={`h-12 w-12 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        在庫移動データがありません
                      </p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        フィルター条件を変更するか、新しい在庫移動を追加してください
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
              </div>
            )}
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

        {/* 送料設定モーダル */}
        <ShippingSettingsModal
          isOpen={showShippingModal}
          onClose={() => {
            setShowShippingModal(false);
            setSelectedSupplier(null);
          }}
          supplierId={selectedSupplier?.id}
          supplierName={selectedSupplier?.name}
        />
      </motion.div>
    </div>
  );
}