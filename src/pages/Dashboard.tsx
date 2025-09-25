import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, AlertTriangle, DollarSign, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOrders, useAllOrders } from '../hooks/useOptimizedOrders';
import { motion } from 'framer-motion';
import { ModernCard } from '../components/ui/ModernCard';
import { PreloadManager } from '../utils/preloadStrategies';

interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  totalValue: number;
  monthlySales: number;
  totalCustomers: number;
  pendingOrders: number;
  monthlyProfit: number;
  // 分納関連KPI
  activeOrders: number;
  deliveryProgress: {
    completed: number;
    partial: number;
    pending: number;
    completionRate: number;
  };
  monthlyDeliveryAmount: number;
  averageDeliveryTime: number;
}

export default function Dashboard() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  
  // OrdersページとData同期のため、useOrdersを使用（キャッシュ戦略を短縮）
  const { data: ordersData, refetch: refetchOrders, isLoading: ordersLoading, dataUpdatedAt } = useAllOrders({});
  
  // ordersDataの変化を監視
  useEffect(() => {
    // Data monitoring logic here if needed
  }, [ordersData, dataUpdatedAt]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalStock: 0,
    lowStockItems: 0,
    totalValue: 0,
    monthlySales: 0,
    totalCustomers: 0,
    pendingOrders: 0,
    monthlyProfit: 0,
    activeOrders: 0,
    deliveryProgress: {
      completed: 0,
      partial: 0,
      pending: 0,
      completionRate: 0,
    },
    monthlyDeliveryAmount: 0,
    averageDeliveryTime: 0,
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
    // インテリジェントプリローディング
    PreloadManager.preloadLikelyRoutes();
  }, [ordersData]); // ordersDataの変更を監視

  // 手動リフレッシュ機能を追加
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refetchOrders(); // 発注データを強制再取得
      await fetchDashboardStats(); // ダッシュボード統計を再計算
      await fetchWeeklyActivity(); // 週次活動を再取得
    } catch (error) {
      console.error('❌ ダッシュボード更新エラー:', error);
    } finally {
      setLoading(false);
    }
  };

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

      // 発注活動（今回の対象問題のコア部分）
      const { data: ordersThisWeek } = await supabase
        .from('purchase_orders')
        .select('id')
        .gte('created_at', thisWeekStart.toISOString());
      
      const { data: ordersLastWeek } = await supabase
        .from('purchase_orders')
        .select('id')
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', lastWeekEnd.toISOString());

        今週の発注数: ordersThisWeek?.length || 0,
        先週の発注数: ordersLastWeek?.length || 0,
        timestamp: new Date().toLocaleTimeString()
      });

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
      // 発注数を直接データベースから取得（キャッシュバイパス） - 全件診断版
      const { data: ordersCount, error: ordersCountError } = await supabase
        .from('purchase_orders')
        .select('id, status, order_no, created_at', { count: 'exact' })
        .order('created_at', { ascending: false }); // 制限を解除して全件取得

      if (ordersCountError) {
        console.error('❌ 発注数取得エラー:', ordersCountError);
      } else {
        const statusBreakdown = ordersCount?.reduce((acc, order) => {
          acc[order.status] = (acc[order.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};
        
          総発注数: ordersCount?.length || 0,
          ステータス別: statusBreakdown,
          直近5件: ordersCount?.slice(0, 5).map(o => ({
            order_no: o.order_no,
            status: o.status,
            created_at: o.created_at
          })),
          最古5件: ordersCount?.slice(-5).map(o => ({
            order_no: o.order_no,
            status: o.status,
            created_at: o.created_at
          }))
        });
      }

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

      // 発注データはuseOrdersフックから取得（Ordersページとデータ同期）
      const allOrders = ordersData?.data || [];
      
        timestamp: new Date().toISOString(),
        ordersData: !!ordersData,
        dataStructure: ordersData ? Object.keys(ordersData) : null,
        allOrdersCount: allOrders.length,
        allOrdersSample: allOrders.map(o => ({ 
          id: o.id, 
          status: o.status, 
          orderNo: o.order_no,
          createdAt: o.created_at
        })).slice(0, 3),
        isLoading: ordersLoading,
        cacheStatus: `Generated at ${new Date().toLocaleTimeString()}`
      });
      
      // アクティブ発注（未完了）
      const activeOrders = allOrders.filter(order => 
        order.status === 'pending' || order.status === 'confirmed'
      ).length;

      // 分納進捗計算 - useOptimizedOrdersのdelivery_progressを直接使用
      const completed = allOrders.filter(order => 
        order.delivery_progress >= 100
      ).length;
      
      const partial = allOrders.filter(order => 
        order.delivery_progress > 0 && order.delivery_progress < 100
      ).length;
      
      const pending = allOrders.filter(order => 
        order.delivery_progress === 0
      ).length;
      
      const totalOrders = allOrders.length;
      const completionRate = totalOrders > 0 ? (completed / totalOrders) * 100 : 0;

      // 今月の分納金額（allOrdersからdelivered_amountの合計を計算）
      const currentMonth = new Date();
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthlyDeliveryAmount = allOrders
        .filter(order => order.latest_delivery_date && new Date(order.latest_delivery_date) >= monthStart)
        .reduce((sum, order) => sum + (order.delivered_amount || 0), 0);

      // 平均分納時間（発注から初回分納まで）の計算
      const ordersWithDeliveries = allOrders.filter(order => 
        order.delivered_amount > 0 && order.latest_delivery_date
      );
      
      let totalDeliveryTime = 0;
      let deliveryCount = 0;
      
      for (const order of ordersWithDeliveries) {
        if (order.latest_delivery_date) {
          const orderDate = new Date(order.created_at);
          const deliveryDate = new Date(order.latest_delivery_date);
          const timeDiff = deliveryDate.getTime() - orderDate.getTime();
          totalDeliveryTime += timeDiff / (1000 * 60 * 60 * 24); // 日数に変換
          deliveryCount++;
        }
      }
      
      const averageDeliveryTime = deliveryCount > 0 ? Math.round(totalDeliveryTime / deliveryCount) : 0;

      // モック売上データ（固定値でユーザーが混乱しないように）
      // 実際のデータベースと連携するまでの仮のデータ
      const mockMonthlySales = 5974515; // 固定値
      const mockTotalCustomers = 58; // 固定値
      const mockPendingOrders = 15; // 固定値
      const mockMonthlyProfit = 896177; // 固定値

      setStats({
        totalProducts,
        totalStock,
        lowStockItems,
        totalValue,
        monthlySales: mockMonthlySales,
        totalCustomers: mockTotalCustomers,
        pendingOrders: ordersCount?.length || totalOrders, // データベース直接取得を優先
        monthlyProfit: mockMonthlyProfit,
        activeOrders,
        deliveryProgress: {
          completed,
          partial,
          pending,
          completionRate,
        },
        monthlyDeliveryAmount,
        averageDeliveryTime,
      });
      
        useOrdersの発注数: totalOrders,
        データベース直接の発注数: ordersCount?.length || 0,
        採用した発注数: ordersCount?.length || totalOrders,
        timestamp: new Date().toLocaleTimeString()
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
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    在庫評価額
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    現在の在庫数×販売価格の合計
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

        {/* システム概要セクション - 位置を上部に移動 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <ModernCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">システム概要</h2>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '更新中...' : '最新データを取得'}
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              統合業務管理システムへようこそ。商品管理・在庫管理・発注管理・取引先管理の各機能を統合的に確認できます。
            </p>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div className="text-sm">
                  <strong className="text-blue-900 dark:text-blue-100">商品管理</strong>
                  <p className="text-xs text-blue-700 dark:text-blue-300">商品マスター登録</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div className="text-sm">
                  <strong className="text-green-900 dark:text-green-100">在庫管理</strong>
                  <p className="text-xs text-green-700 dark:text-green-300">入出庫履歴確認</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div className="text-sm">
                  <strong className="text-purple-900 dark:text-purple-100">取引先管理</strong>
                  <p className="text-xs text-purple-700 dark:text-purple-300">仕入先・販売先管理</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <strong className="text-amber-900 dark:text-amber-100">発注管理</strong>
                  <p className="text-xs text-amber-700 dark:text-amber-300">発注・仕入伝票管理</p>
                </div>
              </div>
            </div>
          </ModernCard>
        </motion.div>

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
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                      保留中注文
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      処理待ちの注文件数
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

        {/* 分納進捗KPIセクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">分納進捗KPI</h2>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
              リアルタイム更新
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* アクティブ発注数 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      アクティブ発注
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.activeOrders}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">進行中の発注</p>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <Package className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>

            {/* 完了率 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.3 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      完了率
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {Math.round(stats.deliveryProgress.completionRate)}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {stats.deliveryProgress.completed}件完了
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                {/* 進捗バー */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(stats.deliveryProgress.completionRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </ModernCard>
            </motion.div>

            {/* 月間分納金額 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.4 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      月間分納金額
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      ¥{stats.monthlyDeliveryAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">今月の実績</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>

            {/* 平均分納日数 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.5 }}
            >
              <ModernCard className="p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      平均分納日数
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.averageDeliveryTime}日
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">発注〜初回分納</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <Calendar className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </ModernCard>
            </motion.div>
          </div>

          {/* 分納状況詳細 */}
          <div className="mt-6">
            <ModernCard className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">分納状況詳細</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 完了 */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-900 dark:text-green-100">完了</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.deliveryProgress.completed}
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    全数量の分納が完了した発注
                  </p>
                </div>

                {/* 部分完了 */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span className="font-medium text-amber-900 dark:text-amber-100">部分完了</span>
                    </div>
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {stats.deliveryProgress.partial}
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    一部分納済みで残数量がある発注
                  </p>
                </div>

                {/* 未着手 */}
                <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">未着手</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {stats.deliveryProgress.pending}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    まだ分納が開始されていない発注
                  </p>
                </div>
              </div>
            </ModernCard>
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

      </div>
    </div>
  );
}