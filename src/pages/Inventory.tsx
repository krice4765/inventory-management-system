import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Plus, Minus, Package, Calendar, Search, X, Eye, Warehouse, TrendingUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';
import { recordInventoryTransaction } from '../utils/inventoryIntegration';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernStatsBar } from '../components/ModernStatsBar';

interface Product {
  id: string;
  name: string;
  product_code: string;
  current_stock: number;
}

interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo: string;
  created_at: string;
  products: Product;
  // 分納連動情報
  related_order_no?: string;
  delivery_sequence?: number;
}

export default function Inventory() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'partial_delivery' | 'manual'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'product_name' | 'total_amount'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // 日付範囲フィルター状態
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [quickFormData, setQuickFormData] = useState({
    product_id: '',
    movement_type: 'in' as 'in' | 'out',
    quantity: '',
    unit_price: '',
    memo: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  // 検索・フィルタリング・ソート機能（日付範囲フィルター追加）
  useEffect(() => {
    if (!movements.length) return;

    let filtered = movements.filter(movement => {
      const matchesSearch = !searchTerm || (
        movement.products.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.products.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.memo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (movement.related_order_no && movement.related_order_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (movement.delivery_sequence && movement.delivery_sequence.toString().includes(searchTerm))
      );

      const matchesType = movementTypeFilter === 'all' || movement.movement_type === movementTypeFilter;

      // 分納フィルター
      let matchesDelivery = true;
      if (deliveryFilter === 'partial_delivery') {
        matchesDelivery = movement.memo.includes('[分納:') || movement.memo.includes('分納入力');
      } else if (deliveryFilter === 'manual') {
        matchesDelivery = !movement.memo.includes('[分納:') && !movement.memo.includes('分納入力');
      }

      // 日付範囲フィルター
      let matchesDateRange = true;
      const movementDate = new Date(movement.created_at).toDateString();
      if (startDate) {
        const start = new Date(startDate).toDateString();
        matchesDateRange = matchesDateRange && movementDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate).toDateString();
        matchesDateRange = matchesDateRange && movementDate <= end;
      }

      return matchesSearch && matchesType && matchesDelivery && matchesDateRange;
    });

    // ソート処理（Orders画面と同様）
    filtered.sort((a: InventoryMovement, b: InventoryMovement) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'product_name':
          valueA = a.products.product_name || '';
          valueB = b.products.product_name || '';
          break;
        case 'total_amount':
          valueA = a.total_amount || 0;
          valueB = b.total_amount || 0;
          break;
        case 'created_at':
        default:
          valueA = new Date(a.created_at).getTime();
          valueB = new Date(b.created_at).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    setFilteredMovements(filtered);
  }, [movements, searchTerm, movementTypeFilter, deliveryFilter, sortBy, sortOrder, startDate, endDate]);

  // フィルターリセット関数
  const resetFilters = () => {
    setSearchTerm('');
    setMovementTypeFilter('all');
    setDeliveryFilter('all');
    setStartDate('');
    setEndDate('');
  };

  // クイックフィルター関数
  const setQuickDateFilter = (days: number) => {
    const today = new Date();
    const startDate = new Date(today.setDate(today.getDate() - days));
    setStartDate(startDate.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  const fetchData = async () => {
    try {
      const [productsResult, movementsResult] = await Promise.all([
        supabase.from('products').select('id, product_name, product_code, current_stock').order('product_name'),
        supabase
          .from('inventory_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      const products = productsResult.data || [];
      const movements = movementsResult.data || [];
      
      // 手動でproductsとmovementsを結合
      const enhancedMovements = movements.map(movement => ({
        ...movement,
        products: products.find(p => p.id === movement.product_id) || {
          id: movement.product_id,
          product_name: '商品情報なし',
          product_code: '',
          current_stock: 0
        }
      }));

      setProducts(products);
      setMovements(enhancedMovements);
      setFilteredMovements(enhancedMovements);
    } catch (error) {
      console.error('Data fetch error:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ソート・フィルター制御関数（Orders画面と同様）
  const clearFilters = () => {
    setSearchTerm('');
    setMovementTypeFilter('all');
    setDeliveryFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const handleSort = (field: 'created_at' | 'product_name' | 'total_amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: 'created_at' | 'product_name' | 'total_amount') => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleQuickMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const quantity = parseInt(quickFormData.quantity);
      const unitPrice = parseFloat(quickFormData.unit_price);

      // 🔄 新しい統合在庫システムを使用
      const result = await recordInventoryTransaction({
        product_id: quickFormData.product_id,
        transaction_type: quickFormData.movement_type,
        quantity,
        unit_price: unitPrice,
        memo: quickFormData.memo || 'Quick入出庫'
      });

      if (!result.success) {
        throw new Error(result.error || '在庫記録に失敗しました');
      }

      toast.success('在庫移動を記録し、在庫数を更新しました');
      resetQuickForm();
      fetchData();
    } catch (error) {
      console.error('Inventory movement error:', error);
      toast.error(`在庫移動の記録に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const resetQuickForm = () => {
    setQuickFormData({
      product_id: '',
      movement_type: 'in',
      quantity: '',
      unit_price: '',
      memo: '',
    });
    setShowQuickForm(false);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-green-900/20 dark:to-blue-900/20 transition-all duration-500">
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent"
          />
          <span className="ml-3 text-gray-700 dark:text-gray-300 font-medium">在庫データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-green-900/20 dark:to-blue-900/20 transition-all duration-500">
      <div className="p-6 space-y-6">
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl">
              <Warehouse className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                在庫管理
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">入出庫履歴の確認・Quick操作</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setShowQuickForm(true)}
              className="flex items-center px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:from-green-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Package className="w-4 h-4 mr-2" />
              Quick入出庫
            </motion.button>
            <motion.button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? '☀️' : '🌙'}
            </motion.button>
          </div>
        </motion.div>

        {/* モダン統計バー */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ModernStatsBar items={filteredMovements} />
        </motion.div>

        {/* 検索・フィルター機能 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ModernCard className="p-6">
            <div className="p-0">
            {/* 検索バー（上段） */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="商品名・商品コード・商品ID・発注番号・移動ID・メモで検索..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* フィルター行（中段） */}
            <div className="flex flex-wrap gap-3 items-center mb-4">
              {/* 移動種別フィルター */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">種別:</label>
                <select
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[120px]"
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value as 'all' | 'in' | 'out')}
                >
                  <option value="all">すべて</option>
                  <option value="in">入庫</option>
                  <option value="out">出庫</option>
                </select>
              </div>

              {/* 分納フィルター */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">分納:</label>
                <select
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[120px]"
                  value={deliveryFilter}
                  onChange={(e) => setDeliveryFilter(e.target.value as 'all' | 'partial_delivery' | 'manual')}
                >
                  <option value="all">すべて</option>
                  <option value="partial_delivery">分納のみ</option>
                  <option value="manual">手動のみ</option>
                </select>
              </div>


              {/* 日付範囲フィルター展開ボタン */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                  showAdvancedFilters || startDate || endDate
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Calendar className="w-4 h-4 mr-1" />
                <span className="whitespace-nowrap">日付範囲</span>
                {(startDate || endDate) && <span className="ml-1 text-xs">●</span>}
              </button>

              {/* リセットボタン */}
              {(searchTerm || movementTypeFilter !== 'all' || deliveryFilter !== 'all' || startDate || endDate || sortBy !== 'created_at' || sortOrder !== 'desc') && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  title="すべてのフィルターをクリア"
                >
                  <X className="w-4 h-4 mr-1" />
                  <span className="whitespace-nowrap">全リセット</span>
                </button>
              )}
            </div>

            {/* 高度なフィルター（日付範囲） */}
            {showAdvancedFilters && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 開始日 */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">開始日</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  
                  {/* 終了日 */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">終了日</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* クイック日付フィルター */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">クイック選択</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setQuickDateFilter(7)}
                        className="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        7日
                      </button>
                      <button
                        onClick={() => setQuickDateFilter(30)}
                        className="flex-1 px-3 py-2 text-sm bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                      >
                        30日
                      </button>
                      <button
                        onClick={() => setQuickDateFilter(90)}
                        className="flex-1 px-3 py-2 text-sm bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/40 transition-colors"
                      >
                        90日
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 検索結果数表示（下段） */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {searchTerm || movementTypeFilter !== 'all' || deliveryFilter !== 'all' || startDate || endDate ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{filteredMovements.length}件の結果</span>
                  <span className="text-gray-500 dark:text-gray-500">(全{movements.length}件中)</span>
                  {searchTerm && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                      「{searchTerm}」で検索中
                    </span>
                  )}
                  {startDate && endDate && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                      期間: {startDate} ～ {endDate}
                    </span>
                  )}
                </div>
              ) : (
                <span className="font-medium">全{movements.length}件の入出庫履歴</span>
              )}
              {searchTerm && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 rounded-lg">
                  💡 商品名・商品コード・商品ID（UUID）・発注番号（PO250910004）・移動ID・分納回次・メモで検索可能
                </div>
              )}
            </div>
            </div>
          </ModernCard>
        </motion.div>

      {showQuickForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Quick入出庫</h2>
          <form onSubmit={handleQuickMovement} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">商品</label>
              <select
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                value={quickFormData.product_id}
                onChange={(e) => setQuickFormData({ ...quickFormData, product_id: e.target.value })}
              >
                <option value="">商品を選択</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name} ({product.product_code}) - 🔢 残り：{product.current_stock}個
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">入出庫種別</label>
              <select
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.movement_type}
                onChange={(e) => setQuickFormData({ ...quickFormData, movement_type: e.target.value as 'in' | 'out' })}
              >
                <option value="in">入庫</option>
                <option value="out">出庫</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">数量</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.quantity}
                onChange={(e) => setQuickFormData({ ...quickFormData, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">単価</label>
              <input
                type="number"
                step="0.01"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.unit_price}
                onChange={(e) => setQuickFormData({ ...quickFormData, unit_price: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">メモ</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.memo}
                onChange={(e) => setQuickFormData({ ...quickFormData, memo: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetQuickForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                記録
              </button>
            </div>
          </form>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <ModernCard className="overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-green-600 dark:text-green-400" />
              入出庫履歴
            </h2>
          </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>日時</span>
                    <span className="text-gray-400">{getSortIcon('created_at')}</span>
                    {sortBy === 'created_at' && (
                      <span className="text-blue-600 dark:text-blue-400 text-xs font-normal lowercase">
                        ({sortOrder === 'asc' ? '昇順' : '降順'})
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('product_name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>商品</span>
                    <span className="text-gray-400">{getSortIcon('product_name')}</span>
                    {sortBy === 'product_name' && (
                      <span className="text-blue-600 dark:text-blue-400 text-xs font-normal lowercase">
                        ({sortOrder === 'asc' ? '昇順' : '降順'})
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  種別
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  単価
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center space-x-1">
                    <span>金額</span>
                    <span className="text-gray-400">{getSortIcon('total_amount')}</span>
                    {sortBy === 'total_amount' && (
                      <span className="text-blue-600 dark:text-blue-400 text-xs font-normal lowercase">
                        ({sortOrder === 'asc' ? '昇順' : '降順'})
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">該当する履歴が見つかりません</p>
                      <p className="text-sm">
                        {searchTerm || movementTypeFilter !== 'all' 
                          ? '検索条件を変更してお試しください' 
                          : '入出庫履歴がまだありません'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div>{new Date(movement.created_at).toLocaleDateString('ja-JP')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(movement.created_at).toLocaleTimeString('ja-JP')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{movement.products.product_name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{movement.products.product_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {movement.movement_type === 'in' ? (
                        <Plus className="h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-600 dark:text-red-400 mr-1" />
                      )}
                      <div>
                        <span className={`text-sm font-medium ${
                          movement.movement_type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {movement.movement_type === 'in' ? '入庫' : '出庫'}
                        </span>
                        {/* 分納情報表示 */}
                        {movement.memo && (movement.memo.includes('[分納:') || movement.memo.includes('分納入力')) && (
                          <div className="flex items-center mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              分納
                            </span>
                            {movement.memo.includes('[個数指定]') && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-1">
                                個数指定
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {movement.quantity}
                    </div>
                    {/* 分納の場合は発注番号も表示 */}
                    {movement.memo && movement.memo.includes('[分納:') && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {movement.memo.match(/\[分納: ([^\]]+)\]/)?.[1] || ''}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ¥{movement.unit_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      ¥{movement.total_amount.toLocaleString()}
                    </div>
                    {/* 分納の場合は追加情報 */}
                    {movement.memo && movement.memo.includes('[分納:') && (
                      <div className="text-xs text-purple-600 dark:text-purple-400">
                        分納連動
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedMovement(movement);
                        setShowDetailModal(true);
                      }}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      詳細
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </ModernCard>
      </motion.div>

      {/* 在庫履歴詳細モーダル */}
      {showDetailModal && selectedMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">在庫履歴詳細</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedMovement(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* 基本情報 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">基本情報</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">処理日時:</span>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedMovement.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">処理種別:</span>
                    <p className={`font-medium ${
                      selectedMovement.movement_type === 'in' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {selectedMovement.movement_type === 'in' ? '入庫' : '出庫'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 商品情報 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">商品情報</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 font-medium">商品名:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {selectedMovement.products.product_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 font-medium">商品コード:</span>
                    <p className="text-gray-900 dark:text-white">
                      {selectedMovement.products.product_code}
                    </p>
                  </div>
                </div>
              </div>

              {/* 数量・金額情報 */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">数量・金額</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-700 dark:text-green-300 font-medium">数量:</span>
                    <p className="text-gray-900 dark:text-white text-lg font-bold">
                      {selectedMovement.quantity}
                    </p>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-300 font-medium">単価:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      ¥{selectedMovement.unit_price.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-300 font-medium">合計金額:</span>
                    <p className="text-gray-900 dark:text-white text-lg font-bold">
                      ¥{selectedMovement.total_amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* メモ・備考 */}
              {selectedMovement.memo && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-3">処理詳細</h4>
                  <p className="text-gray-900 dark:text-white text-sm whitespace-pre-wrap">
                    {selectedMovement.memo}
                  </p>
                </div>
              )}

              {/* 関連発注情報（分納記録の場合） */}
              {selectedMovement.memo && selectedMovement.memo.includes('[分納:') && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">分納連動情報</h4>
                  <div className="text-sm">
                    <p className="text-gray-900 dark:text-white">
                      この在庫更新は発注システムからの分納処理により自動実行されました
                    </p>
                    {selectedMovement.memo.match(/\[分納: ([^\]]+)\]/) && (
                      <p className="text-purple-700 dark:text-purple-300 font-medium mt-2">
                        関連発注: {selectedMovement.memo.match(/\[分納: ([^\]]+)\]/)?.[1]}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedMovement(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
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
