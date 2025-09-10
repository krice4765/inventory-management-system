import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, AlertTriangle, DollarSign, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';
import { motion } from 'framer-motion';
import { ModernCard } from '../components/ui/ModernCard';

interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  totalValue: number;
  monthlySales: number;
  totalCustomers: number;
  pendingOrders: number;
  monthlyProfit: number;
}

export default function Dashboard() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalStock: 0,
    lowStockItems: 0,
    totalValue: 0,
    monthlySales: 0,
    totalCustomers: 0,
    pendingOrders: 0,
    monthlyProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [weeklyActivity, setWeeklyActivity] = useState({
    products: { thisWeek: 0, lastWeek: 0 },
    inventory: { thisWeek: 0, lastWeek: 0 },
    orders: { thisWeek: 0, lastWeek: 0 },
    partners: { thisWeek: 0, lastWeek: 0 }
  });

  useEffect(() => {
    fetchDashboardStats();
    fetchWeeklyActivity();
  }, []);

  const fetchWeeklyActivity = async () => {
    try {
      const now = new Date();
      const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);

      // 商品登録活動
      const { data: productsThisWeek } = await supabase
        .from('products')
        .select('id')
        .gte('created_at', thisWeekStart.toISOString());
      
      const { data: productsLastWeek } = await supabase
        .from('products')
        .select('id')
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', lastWeekEnd.toISOString());

      // 在庫移動活動
      const { data: inventoryThisWeek } = await supabase
        .from('inventory_movements')
        .select('id')
        .gte('created_at', thisWeekStart.toISOString());
      
      const { data: inventoryLastWeek } = await supabase
        .from('inventory_movements')
        .select('id')
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', lastWeekEnd.toISOString());

      // 発注活動
      const { data: ordersThisWeek } = await supabase
        .from('purchase_orders')
        .select('id')
        .gte('created_at', thisWeekStart.toISOString());
      
      const { data: ordersLastWeek } = await supabase
        .from('purchase_orders')
        .select('id')
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', lastWeekEnd.toISOString());

      // 取引先活動
      const { data: partnersThisWeek } = await supabase
        .from('partners')
        .select('id')
        .gte('created_at', thisWeekStart.toISOString());
      
      const { data: partnersLastWeek } = await supabase
        .from('partners')
        .select('id')
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', lastWeekEnd.toISOString());

      setWeeklyActivity({
        products: { 
          thisWeek: productsThisWeek?.length || 0, 
          lastWeek: productsLastWeek?.length || 0 
        },
        inventory: { 
          thisWeek: inventoryThisWeek?.length || 0, 
          lastWeek: inventoryLastWeek?.length || 0 
        },
        orders: { 
          thisWeek: ordersThisWeek?.length || 0, 
          lastWeek: ordersLastWeek?.length || 0 
        },
        partners: { 
          thisWeek: partnersThisWeek?.length || 0, 
          lastWeek: partnersLastWeek?.length || 0 
        }
      });
    } catch (error) {
      console.error('Weekly activity fetch error:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, current_stock, selling_price, min_stock_level');

      if (error) throw error;

      const totalProducts = products?.length || 0;
      const totalStock = products?.reduce((sum, product) => sum + (product.current_stock || 0), 0) || 0;
      const lowStockItems = products?.filter(product => 
        (product.current_stock || 0) <= (product.min_stock_level || 0)
      ).length || 0;
      const totalValue = products?.reduce((sum, product) => 
        sum + ((product.current_stock || 0) * (product.selling_price || 0)), 0
      ) || 0;

      // モック売上データ（将来的には実際のデータベースから取得）
      const currentMonth = new Date().getMonth();
      const mockMonthlySales = Math.floor(Math.random() * 5000000) + 2000000; // 200万〜700万
      const mockTotalCustomers = Math.floor(Math.random() * 200) + 50; // 50〜250顧客
      const mockPendingOrders = Math.floor(Math.random() * 15) + 5; // 5〜20件
      const mockMonthlyProfit = Math.floor(mockMonthlySales * 0.15); // 売上の15%を利益と仮定

      setStats({
        totalProducts,
        totalStock,
        lowStockItems,
        totalValue,
        monthlySales: mockMonthlySales,
        totalCustomers: mockTotalCustomers,
        pendingOrders: mockPendingOrders,
        monthlyProfit: mockMonthlyProfit,
      });
    } catch (error) {
      console.error('Dashboard stats fetch error:', error);
      toast.error('ダッシュボード情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"
          />
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-4 text-lg font-medium text-gray-700 dark:text-gray-300"
          >
            ダッシュボードを読み込み中...
          </motion.span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
      <div className="p-6 space-y-8">
        {/* ヘッダー */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15 }}
              className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ダッシュボード
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">システム概要とリアルタイム統計</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => {
                fetchDashboardStats();
                fetchWeeklyActivity();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RefreshCw className="w-4 h-4" />
              更新
            </motion.button>
            <motion.button
              onClick={toggleDarkMode}
              className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? '☀️' : '🌙'}
            </motion.button>
          </div>
        </motion.div>

        {/* 統計カードグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                    総商品数
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalProducts}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </ModernCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                    総在庫数
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalStock}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </ModernCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                    在庫不足
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.lowStockItems}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </ModernCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                    在庫評価額
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ¥{stats.totalValue.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <DollarSign className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </ModernCard>
          </motion.div>
        </div>

        {/* 売上統計セクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">売上統計</h2>
            <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full font-medium">
              PREVIEW - モックデータ
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 月間売上 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      月間売上
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      ¥{stats.monthlySales.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>

            {/* 顧客数 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      総顧客数
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalCustomers}</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>

            {/* 保留中注文 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      保留中注文
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingOrders}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>

            {/* 月間利益 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      月間利益
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      ¥{stats.monthlyProfit.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <DollarSign className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>
          </div>
        </motion.div>

        {/* 1週間の活動早見表 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <ModernCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">1週間の活動早見表</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">今週 vs 先週</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 商品管理活動 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">商品管理</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700 dark:text-blue-300">今週:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{weeklyActivity.products.thisWeek}件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-600 dark:text-blue-400">先週:</span>
                    <span className="text-blue-700 dark:text-blue-300">{weeklyActivity.products.lastWeek}件</span>
                  </div>
                  {weeklyActivity.products.thisWeek !== weeklyActivity.products.lastWeek && (
                    <div className="flex justify-between pt-1 border-t border-blue-200 dark:border-blue-700">
                      <span className="text-xs text-blue-600 dark:text-blue-400">増減:</span>
                      <span className={`text-xs font-medium ${
                        weeklyActivity.products.thisWeek > weeklyActivity.products.lastWeek 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {weeklyActivity.products.thisWeek > weeklyActivity.products.lastWeek ? '↗' : '↘'} {Math.abs(weeklyActivity.products.thisWeek - weeklyActivity.products.lastWeek)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 在庫管理活動 */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">在庫管理</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700 dark:text-green-300">今週:</span>
                    <span className="font-bold text-green-900 dark:text-green-100">{weeklyActivity.inventory.thisWeek}件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-green-600 dark:text-green-400">先週:</span>
                    <span className="text-green-700 dark:text-green-300">{weeklyActivity.inventory.lastWeek}件</span>
                  </div>
                  {weeklyActivity.inventory.thisWeek !== weeklyActivity.inventory.lastWeek && (
                    <div className="flex justify-between pt-1 border-t border-green-200 dark:border-green-700">
                      <span className="text-xs text-green-600 dark:text-green-400">増減:</span>
                      <span className={`text-xs font-medium ${
                        weeklyActivity.inventory.thisWeek > weeklyActivity.inventory.lastWeek 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {weeklyActivity.inventory.thisWeek > weeklyActivity.inventory.lastWeek ? '↗' : '↘'} {Math.abs(weeklyActivity.inventory.thisWeek - weeklyActivity.inventory.lastWeek)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 発注管理活動 */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">発注管理</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-amber-700 dark:text-amber-300">今週:</span>
                    <span className="font-bold text-amber-900 dark:text-amber-100">{weeklyActivity.orders.thisWeek}件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-amber-600 dark:text-amber-400">先週:</span>
                    <span className="text-amber-700 dark:text-amber-300">{weeklyActivity.orders.lastWeek}件</span>
                  </div>
                  {weeklyActivity.orders.thisWeek !== weeklyActivity.orders.lastWeek && (
                    <div className="flex justify-between pt-1 border-t border-amber-200 dark:border-amber-700">
                      <span className="text-xs text-amber-600 dark:text-amber-400">増減:</span>
                      <span className={`text-xs font-medium ${
                        weeklyActivity.orders.thisWeek > weeklyActivity.orders.lastWeek 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {weeklyActivity.orders.thisWeek > weeklyActivity.orders.lastWeek ? '↗' : '↘'} {Math.abs(weeklyActivity.orders.thisWeek - weeklyActivity.orders.lastWeek)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 取引先管理活動 */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">取引先管理</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700 dark:text-purple-300">今週:</span>
                    <span className="font-bold text-purple-900 dark:text-purple-100">{weeklyActivity.partners.thisWeek}件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-600 dark:text-purple-400">先週:</span>
                    <span className="text-purple-700 dark:text-purple-300">{weeklyActivity.partners.lastWeek}件</span>
                  </div>
                  {weeklyActivity.partners.thisWeek !== weeklyActivity.partners.lastWeek && (
                    <div className="flex justify-between pt-1 border-t border-purple-200 dark:border-purple-700">
                      <span className="text-xs text-purple-600 dark:text-purple-400">増減:</span>
                      <span className={`text-xs font-medium ${
                        weeklyActivity.partners.thisWeek > weeklyActivity.partners.lastWeek 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {weeklyActivity.partners.thisWeek > weeklyActivity.partners.lastWeek ? '↗' : '↘'} {Math.abs(weeklyActivity.partners.thisWeek - weeklyActivity.partners.lastWeek)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                📊 各機能での今週と先週の活動件数を比較表示 | データはリアルタイムで更新されます
              </p>
            </div>
          </ModernCard>
        </motion.div>

        {/* システム概要セクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <ModernCard className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">システム概要</h2>
            </div>
            <div className="prose prose-lg text-gray-600 dark:text-gray-400 max-w-none">
              <p className="text-lg leading-relaxed mb-6">
                統合業務管理システムへようこそ。このダッシュボードでは、商品管理・在庫管理・発注管理・取引先管理の各機能を統合的に確認できます。
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <strong className="text-blue-900 dark:text-blue-100">商品管理</strong>
                      <p className="text-sm text-blue-700 dark:text-blue-300">商品マスターの登録・編集</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <strong className="text-green-900 dark:text-green-100">在庫管理</strong>
                      <p className="text-sm text-green-700 dark:text-green-300">入出庫履歴の確認・Quick操作</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <strong className="text-purple-900 dark:text-purple-100">取引先管理</strong>
                      <p className="text-sm text-purple-700 dark:text-purple-300">仕入先・販売先の管理</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                    <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <strong className="text-amber-900 dark:text-amber-100">発注管理</strong>
                      <p className="text-sm text-amber-700 dark:text-amber-300">発注・仕入伝票の管理</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl">
                    <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <strong className="text-indigo-900 dark:text-indigo-100">仕入伝票管理</strong>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">仕入実績・入荷処理の管理</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModernCard>
        </motion.div>
      </div>
    </div>
  );
}