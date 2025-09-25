import { Link } from 'react-router-dom';
import { Plus, FileText, Calendar, Search, X, Filter, Package, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useDeliveryModal } from '../stores/deliveryModal.store';
import { DeliveryModal } from '../components/DeliveryModal';
// Temporarily disabled: import { ModernStatsBar } from '../components/ModernStatsBar';
import { ModernCard } from '../components/ui/ModernCard';
import { useOrders, useAllOrders, useInfiniteOrders, usePartners, type OrderFilters, type PurchaseOrder } from '../hooks/useOptimizedOrders';
import SearchableSelect from '../components/SearchableSelect';
import { getFirstProductName, formatQuantitySummary } from '../hooks/useOrderDetail';
import { TaxDisplayToggle } from '../components/ui/TaxDisplayToggle';
import { UnifiedStatusBadge, StatusWithProgress, StatusStatsDisplay } from '../components/ui/UnifiedStatusBadge';
import { UnifiedOrderStatus, StatusStatsUtils, StatusFilterUtils } from '../utils/statusUtils';
import { QuantitySummaryDisplay } from '../components/display/QuantitySummaryDisplay';
import { AssignedUserDisplay } from '../components/display/AssignedUserDisplay';
import { useOutboundManagement, type OutboundOrder } from '../hooks/useOutboundManagement';
import { OutboundOrdersTab } from '../components/tabs/OutboundOrdersTab';
import { useNavigate } from 'react-router-dom';

// タブ定義
type OrdersTab = 'orders' | 'outbound';

const ORDERS_TABS = [
  { id: 'orders' as const, label: '発注管理', icon: FileText },
  { id: 'outbound' as const, label: '出庫管理', icon: TrendingUp }
] as const;

export default function Orders() {
  const { isDark } = useDarkMode();
  const openDeliveryModal = useDeliveryModal((state) => state.open);

  // タブ状態
  const [activeTab, setActiveTab] = useState<OrdersTab>('orders');

  const navigate = useNavigate();

  // フィルタ状態（クライアントサイド検索用）
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UnifiedOrderStatus>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'overdue'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState<'created_at' | 'delivery_deadline'>('created_at');
  const [partnerIdFilter, setPartnerIdFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'delivery_deadline' | 'total_amount' | 'delivery_progress'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const [taxDisplayMode, setTaxDisplayMode] = useState<'tax_included' | 'tax_excluded'>('tax_included');

  // 発注管理データ（従来通り）
  const { data: allOrdersData, isLoading, error, refetch, isFetching } = useAllOrders({});
  const { data: partners = [] } = usePartners();

  // 出庫管理データ（新規）
  const {
    outboundOrders,
    isLoading: isOutboundLoading,
    createOutboundOrder,
    updateOutboundOrder,
    deleteOutboundOrder,
    allocateStock,
    processShipment,
    error: outboundError,
    refetch: refetchOutbound
  } = useOutboundManagement();
  
  // 全件データ
  const allOrders = allOrdersData?.data || [];
  
  // クライアントサイドフィルタリング（Partnersパターン）
  const orders = useMemo(() => {
    if (!allOrders.length) return [];

    try {
      const filtered = allOrders.filter(order => {
        // 検索条件（発注番号、仕入先名、コードで検索）
        const matchesSearch = !searchTerm || (
          (order.order_no?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (order.partners?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (order.partners?.partner_code?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );

        // ステータスフィルタ（統一ステータスシステム使用）
        const matchesStatus = statusFilter === 'all' ||
          StatusFilterUtils.filterByStatus([order], statusFilter).length > 0;

        // 仕入先フィルタ
        const matchesPartner = !partnerIdFilter || order.partner_id === partnerIdFilter;

        // 日付範囲フィルタ
        let matchesDateRange = true;
        
        // カスタム日付範囲がある場合は優先
        if (startDate || endDate) {
          const targetDate = new Date(dateField === 'created_at' ? order.created_at : order.delivery_deadline);
          const targetDateStr = targetDate.toISOString().split('T')[0];
          
          if (startDate && endDate) {
            matchesDateRange = targetDateStr >= startDate && targetDateStr <= endDate;
          } else if (startDate) {
            matchesDateRange = targetDateStr >= startDate;
          } else if (endDate) {
            matchesDateRange = targetDateStr <= endDate;
          }
        } else if (dateRangeFilter !== 'all') {
          // 既定の日付範囲フィルタ
          const now = new Date();
          const orderDate = new Date(order.created_at);
          const deliveryDate = new Date(order.delivery_deadline);
          
          switch (dateRangeFilter) {
            case 'today': {
              const today = now.toISOString().split('T')[0];
              matchesDateRange = orderDate.toISOString().split('T')[0] === today;
              break;
            }
            case 'week': {
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              matchesDateRange = orderDate >= weekAgo;
              break;
            }
            case 'month': {
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              matchesDateRange = orderDate >= monthAgo;
              break;
            }
            case 'overdue':
              matchesDateRange = deliveryDate < now && order.delivery_progress < 100;
              break;
          }
        }

        return matchesSearch && matchesStatus && matchesPartner && matchesDateRange;
      });

      // ソート
      filtered.sort((a, b) => {
        let aValue, bValue;
        switch (sortBy) {
          case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case 'delivery_deadline':
            aValue = new Date(a.delivery_deadline).getTime();
            bValue = new Date(b.delivery_deadline).getTime();
            break;
          case 'total_amount':
            aValue = a.total_amount;
            bValue = b.total_amount;
            break;
          case 'delivery_progress':
            aValue = a.delivery_progress;
            bValue = b.delivery_progress;
            break;
          default:
            return 0;
        }
        
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      });

      return filtered;
    } catch (error) {
      console.error('Filter error in Orders:', error);
      return allOrders; // エラー時は全発注を表示
    }
  }, [allOrders, searchTerm, statusFilter, partnerIdFilter, dateRangeFilter, startDate, endDate, dateField, sortBy, sortOrder]);

  // 統計情報は全件データから計算（フィルタ・ページネーション制限なし）
  const stats = useMemo(() => {
    const allOrdersForStats = allOrders; // 同じデータソースを使用
    const now = new Date();
    const statusStats = StatusStatsUtils.calculateStatusStats(orders);

    return {
      totalOrders: allOrdersForStats.length, // 全件数を使用（52件）
      totalAmount: allOrdersForStats.reduce((sum, o) => sum + o.total_amount, 0),
      // delivery_progress >= 100 が納品完了の条件
      deliveredOrders: allOrdersForStats.filter(o => o.delivery_progress >= 100).length,
      overdueOrders: allOrdersForStats.filter(o =>
        new Date(o.delivery_deadline) < now && o.delivery_progress < 100
      ).length,

      // 統一ステータス統計（分離管理）
      undelivered: statusStats.undelivered,
      partial: statusStats.partial,
      completed: statusStats.completed,
      cancelled: statusStats.cancelled,
    };
  }, [allOrders, orders]); // ordersも依存に追加

  // ページネーション計算（フィルタリング結果に基づく）
  const filteredTotalCount = orders.length; // フィルタリング後の件数
  const totalPages = Math.ceil(filteredTotalCount / pageSize);

  // 現在ページがフィルタリング後の総ページ数を超えている場合、1ページ目に戻す（useEffectで処理）
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // ページネーション適用済みの表示データ
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return orders.slice(startIndex, endIndex);
  }, [orders, currentPage, pageSize]);

  // ページネーション関数（totalPages定義後）
  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);
  
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // クイック日付フィルター関数
  const setQuickDateFilter = useCallback((days: number) => {
    const today = new Date();
    const startDateObj = new Date(today);
    startDateObj.setDate(today.getDate() - days);
    
    setStartDate(startDateObj.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setDateRangeFilter('all'); // カスタム日付を使用する場合は既定の日付範囲をリセット
  }, []);

  // フィルターリセット
  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateRangeFilter('all');
    setStartDate('');
    setEndDate('');
    setDateField('created_at');
    setPartnerIdFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
  }, []);

  // 統計カード
  const statsCards = useMemo(() => [
    {
      title: '総発注数',
      value: stats?.totalOrders.toLocaleString() || '0',
      icon: <FileText className="h-5 w-5" />,
      color: 'blue',
    },
    {
      title: '納品完了',
      value: stats?.deliveredOrders.toLocaleString() || '0',
      icon: <Package className="h-5 w-5" />,
      color: 'green',
    },
    {
      title: '納期遅れ',
      value: stats?.overdueOrders.toLocaleString() || '0',
      icon: <AlertCircle className="h-5 w-5" />,
      color: 'red',
    },
    {
      title: '総発注額',
      value: `¥${stats?.totalAmount.toLocaleString() || '0'}`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'purple',
    },
  ], [stats]);

  // 進捗状態の変換
  const getProgressStatus = (order: PurchaseOrder) => {
    if (order.delivery_progress >= 100) return '納品完了';
    if (order.delivery_progress > 0) return '一部納品';
    return '未納品';
  };

  // 進捗バーの色
  const getProgressColor = (order: PurchaseOrder) => {
    if (order.is_overdue && order.delivery_progress < 100) return 'bg-red-500';
    if (order.delivery_progress >= 100) return 'bg-green-500';
    if (order.delivery_progress > 0) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  // 第1商品名取得（0922Youken.md要件対応）
  const getFirstProductName = (order: PurchaseOrder): string => {
    if (order.first_product?.length > 0) {
      const firstProduct = order.first_product[0];
      return firstProduct.product_name?.product_name || '商品名取得中...';
    }
    return '商品なし';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 space-y-8"
        >
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-lg text-gray-700 dark:text-gray-300 font-medium">
              発注データを読み込み中...
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 space-y-8"
        >
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              データ取得エラー
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error.message}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              再試行
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-8"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg">
              {(() => {
                const currentTab = ORDERS_TABS.find(tab => tab.id === activeTab);
                const IconComponent = currentTab?.icon;
                return IconComponent ? <IconComponent className="h-8 w-8 text-white" /> : <FileText className="h-8 w-8 text-white" />;
              })()}
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {activeTab === 'orders' ? '発注管理' : '出庫管理'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                {activeTab === 'orders'
                  ? '仕入先への発注・納期管理・分納入荷処理'
                  : '在庫引当・出庫指示・出荷管理'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* 出庫管理タブの場合のアクションボタン */}
            {activeTab === 'outbound' && (
              <button
                onClick={() => navigate('/outbound-orders/new')}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>出庫指示作成</span>
              </button>
            )}
            <button
              onClick={() => activeTab === 'orders' ? refetch() : refetchOutbound()}
              disabled={activeTab === 'orders' ? isFetching : isOutboundLoading}
              className={`p-2 rounded-lg transition-colors ${
                (activeTab === 'orders' ? isFetching : isOutboundLoading)
                  ? 'text-gray-400 cursor-not-allowed'
                  : isDark
                    ? 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100'
              }`}
            >
              <RefreshCw className={`h-5 w-5 ${(activeTab === 'orders' ? isFetching : isOutboundLoading) ? 'animate-spin' : ''}`} />
            </button>

            {activeTab === 'orders' && (
              <Link
                to="/orders/new"
                className="group relative flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center justify-center w-5 h-5 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all duration-300">
                  <Plus className="h-3 w-3" />
                </div>
                <span className="font-semibold text-base">新規発注</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300" />
              </Link>
            )}

          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex">
            {ORDERS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center px-6 py-4 text-sm font-medium transition-all duration-200 relative ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                      layoutId="activeTab"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* タブコンテンツ */}
        {activeTab === 'orders' && (
          <>
            {/* 発注管理統計カード */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* 未納品 */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                className={`
                  relative group overflow-hidden rounded-xl p-6 cursor-pointer
                  transition-all duration-300 ease-out
                  ${isDark
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 hover:border-gray-600'
                    : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
                  }
                `}
              >
                {/* 背景の装飾エフェクト */}
                <div className="absolute inset-0 opacity-5 bg-gradient-to-r bg-orange-100 dark:bg-orange-900" />

                {/* アクセントライン */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-sm font-medium tracking-wide uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      未納品
                    </div>
                    <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
                  </div>

                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} group-hover:scale-105 transition-transform duration-200`}>
                    {stats?.undelivered || 0}
                  </div>

                  {/* プログレスインジケーター */}
                  <div className="mt-4">
                    <div className={`h-1 rounded-full overflow-hidden ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <motion.div
                        className="h-full bg-orange-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((stats?.undelivered || 0) / Math.max(1, stats?.totalOrders || 1)) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 一部納品 */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                className={`
                  relative group overflow-hidden rounded-xl p-6 cursor-pointer
                  transition-all duration-300 ease-out
                  ${isDark
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 hover:border-gray-600'
                    : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
                  }
                `}
              >
                {/* 背景の装飾エフェクト */}
                <div className="absolute inset-0 opacity-5 bg-gradient-to-r bg-blue-100 dark:bg-blue-900" />

                {/* アクセントライン */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-sm font-medium tracking-wide uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      一部納品
                    </div>
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                  </div>

                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} group-hover:scale-105 transition-transform duration-200`}>
                    {stats?.partial || 0}
                  </div>

                  {/* プログレスインジケーター */}
                  <div className="mt-4">
                    <div className={`h-1 rounded-full overflow-hidden ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((stats?.partial || 0) / Math.max(1, stats?.totalOrders || 1)) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 納品完了 */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                className={`
                  relative group overflow-hidden rounded-xl p-6 cursor-pointer
                  transition-all duration-300 ease-out
                  ${isDark
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 hover:border-gray-600'
                    : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
                  }
                `}
              >
                {/* 背景の装飾エフェクト */}
                <div className="absolute inset-0 opacity-5 bg-gradient-to-r bg-green-100 dark:bg-green-900" />

                {/* アクセントライン */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-sm font-medium tracking-wide uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      納品完了
                    </div>
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" />
                  </div>

                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} group-hover:scale-105 transition-transform duration-200`}>
                    {stats?.completed || 0}
                  </div>

                  {/* プログレスインジケーター */}
                  <div className="mt-4">
                    <div className={`h-1 rounded-full overflow-hidden ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <motion.div
                        className="h-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((stats?.completed || 0) / Math.max(1, stats?.totalOrders || 1)) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* キャンセル */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                className={`
                  relative group overflow-hidden rounded-xl p-6 cursor-pointer
                  transition-all duration-300 ease-out
                  ${isDark
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 hover:border-gray-600'
                    : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
                  }
                `}
              >
                {/* 背景の装飾エフェクト */}
                <div className="absolute inset-0 opacity-5 bg-gradient-to-r bg-red-100 dark:bg-red-900" />

                {/* アクセントライン */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-sm font-medium tracking-wide uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      キャンセル
                    </div>
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  </div>

                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} group-hover:scale-105 transition-transform duration-200`}>
                    {stats?.cancelled || 0}
                  </div>

                  {/* プログレスインジケーター */}
                  <div className="mt-4">
                    <div className={`h-1 rounded-full overflow-hidden ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <motion.div
                        className="h-full bg-red-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((stats?.cancelled || 0) / Math.max(1, stats?.totalOrders || 1)) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
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
                    placeholder="発注番号、仕入先名で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    title="発注番号や仕入先名を入力して検索できます"
                  />
                </div>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">すべてのステータス</option>
                <option value="undelivered">未納品</option>
                <option value="partial">一部納品</option>
                <option value="completed">納品完了</option>
                <option value="cancelled">キャンセル</option>
              </select>

              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className={`px-3 py-2 border rounded-lg ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">全期間</option>
                <option value="today">今日</option>
                <option value="week">今週</option>
                <option value="month">今月</option>
                <option value="overdue">納期遅れ</option>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    仕入先検索
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'すべての仕入先' },
                      ...partners.map(partner => ({
                        value: partner.id,
                        label: partner.name,
                        description: `(${partner.partner_code})`
                      }))
                    ]}
                    value={partnerIdFilter}
                    onChange={(value) => setPartnerIdFilter(value)}
                    placeholder="仕入先を検索..."
                    className="w-full"
                    darkMode={isDark}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ※仕入先名やコードで検索できます
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    並び順
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="created_at">作成日時</option>
                    <option value="delivery_deadline">納期</option>
                    <option value="total_amount">発注額</option>
                    <option value="delivery_progress">進捗率</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    順序
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
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

                {/* カレンダー検索セクション */}
                <div className="md:col-span-3 mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <Calendar className="inline h-4 w-4 mr-2" />
                      日付範囲検索
                    </h4>
                    
                    {/* 日付フィールド選択 */}
                    <select
                      value={dateField}
                      onChange={(e) => setDateField(e.target.value as any)}
                      className={`px-3 py-1 text-sm border rounded ${
                        isDark
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="created_at">発注日で絞込</option>
                      <option value="delivery_deadline">納期で絞込</option>
                    </select>
                  </div>
                  
                  {/* クイック期間選択 */}
                  <div className="mb-4">
                    <p className={`text-xs mb-2 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      クイック選択
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
                          className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            isDark
                              ? 'bg-blue-900 text-blue-200 hover:bg-blue-800'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* カスタム日付範囲 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        開始日
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
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
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg ${
                          isDark 
                            ? 'bg-gray-800 border-gray-700 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                  </div>

                  {/* アクティブフィルターの表示と日付クリアボタン */}
                  {(startDate || endDate) && (
                    <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${
                            isDark ? 'text-blue-200' : 'text-blue-800'
                          }`}>
                            🔍 アクティブな日付フィルター
                          </p>
                          <p className={`text-xs mt-1 ${
                            isDark ? 'text-blue-300' : 'text-blue-600'
                          }`}>
                            {dateField === 'created_at' ? '発注日' : '納期'}：
                            {startDate && endDate ? (
                              ` ${startDate} 〜 ${endDate}`
                            ) : startDate ? (
                              ` ${startDate} 以降`
                            ) : (
                              ` ${endDate} 以前`
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setStartDate('');
                            setEndDate('');
                          }}
                          className={`text-sm px-3 py-1 rounded transition-colors ${
                            isDark
                              ? 'text-blue-300 hover:text-white hover:bg-blue-800'
                              : 'text-blue-600 hover:text-blue-800 hover:bg-blue-100'
                          }`}
                        >
                          <X className="inline h-4 w-4 mr-1" />
                          クリア
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ModernCard>

        {/* 発注一覧 */}
        <ModernCard className="p-6">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    発注一覧
                  </h3>
                  {/* 検索結果件数表示 */}
                  {(searchTerm || statusFilter !== 'all' || dateRangeFilter !== 'all' || partnerIdFilter || startDate || endDate) && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      filteredTotalCount === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {filteredTotalCount === 0
                        ? '🔍 検索結果: 該当なし'
                        : `🔍 検索結果: ${filteredTotalCount}件`
                      }
                    </div>
                  )}

                  {/* 税表示切り替えコントロール */}
                  <TaxDisplayToggle
                    taxDisplayMode={taxDisplayMode}
                    onToggle={setTaxDisplayMode}
                    size="sm"
                  />
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <FileText className="h-4 w-4" />
                  <span>ページ{currentPage} (20件表示)</span>
                  {isFetching && (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>更新中...</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* ページネーションコントロール（上部） */}
              {(totalPages > 1 || filteredTotalCount > pageSize) && (
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    ページ {currentPage} / {totalPages} (全{filteredTotalCount}件)
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage <= 1}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        currentPage <= 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                          : isDark
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      <span>← 前へ</span>
                    </button>
                    
                    {/* ページ番号ボタン */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = currentPage <= 3 
                          ? i + 1 
                          : currentPage >= totalPages - 2
                          ? totalPages - 4 + i
                          : currentPage - 2 + i;
                        
                        if (pageNum < 1 || pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`w-8 h-8 rounded-md text-sm transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : isDark
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={goToNextPage}
                      disabled={currentPage >= totalPages}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        currentPage >= totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                          : isDark
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      <span>次へ →</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {filteredTotalCount === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  発注データがありません
                </h3>
                <p className={`text-gray-500 mb-4 ${isDark ? 'text-gray-400' : ''}`}>
                  条件を変更して再検索してください
                </p>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  フィルターをリセット
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 新しいテーブル形式の発注一覧 */}
                <div className="overflow-x-auto">
                <table className={`w-full min-w-full table-auto ${
                  isDark ? 'bg-gray-900' : 'bg-white'
                }`}>
                  <thead className={`${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <tr>
                      <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '15%'}}>
                        仕入先
                      </th>
                      <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '12%'}}>
                        発注番号
                      </th>
                      <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '9%'}}>
                        納期日
                      </th>
                      <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '14%'}}>
                        商品名
                      </th>
                      <th className={`px-3 py-2 text-right text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '10%'}}>
                        数量合計
                      </th>
                      <th className={`px-6 py-2 text-center text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '12%'}}>
                        担当者
                      </th>
                      <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '8%'}}>
                        発注日
                      </th>
                      <th className={`px-3 py-2 text-center text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '10%'}}>
                        ステータス
                      </th>
                      <th className={`px-3 py-2 text-center text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-500'
                      }`} style={{width: '11%'}}>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`${isDark ? 'bg-gray-900' : 'bg-white'} divide-y ${
                    isDark ? 'divide-gray-700' : 'divide-gray-200'
                  }`}>
                    {paginatedOrders.map((order) => {
                      // 納期緊急度判定（7日以内をJST基準で赤色表示）
                      const deliveryDate = new Date(order.delivery_deadline);
                      const today = new Date();
                      const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isUrgent = daysUntilDelivery <= 7 && daysUntilDelivery >= 0;

                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`transition-all duration-200 ${
                            isDark
                              ? 'hover:bg-gray-800'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* 仕入先 */}
                          <td className={`px-3 py-2 text-sm ${
                            isDark ? 'text-gray-300' : 'text-gray-900'
                          }`} style={{width: '15%'}}>
                            <div>
                              <div className="font-medium text-sm truncate">{order.partners.name}</div>
                              <div className={`text-xs ${
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {order.partners.partner_code}
                              </div>
                            </div>
                          </td>

                          {/* 発注番号（クリックで明細確認モーダル） */}
                          <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`} style={{width: '12%'}}>
                            <Link
                              to={`/purchase-orders/${order.id}`}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="クリックで発注明細を確認"
                            >
                              {order.order_no}
                            </Link>
                          </td>

                          {/* 納期日 */}
                          <td className={`px-3 py-2 whitespace-nowrap text-sm ${
                            isUrgent
                              ? 'text-red-600 font-semibold'
                              : order.is_overdue
                                ? 'text-red-500 font-medium'
                                : isDark ? 'text-gray-300' : 'text-gray-900'
                          }`} style={{width: '9%'}}>
                            <div className="text-xs">
                              {new Date(order.delivery_deadline).toLocaleDateString('ja-JP')}
                              {(isUrgent || order.is_overdue) && (
                                <AlertCircle className="h-3 w-3 text-red-500 inline ml-1" />
                              )}
                            </div>
                          </td>

                          {/* 商品名（第1商品名のみ表示、クリック→明細確認モーダル） */}
                          <td className={`px-3 py-2 text-sm ${
                            isDark ? 'text-gray-300' : 'text-gray-900'
                          }`} style={{width: '14%'}}>
                            <div className="truncate">
                              <Link
                                to={`/purchase-orders/${order.id}`}
                                className="text-left truncate hover:text-blue-600 transition-colors"
                                title="クリックで全明細を確認"
                              >
                                {getFirstProductName(order)}
                              </Link>
                            </div>
                          </td>

                          {/* 数量合計（税込/税抜表示統一対応） */}
                          <td className={`px-3 py-2 whitespace-nowrap text-sm text-right ${
                            isDark ? 'text-gray-300' : 'text-gray-900'
                          }`} style={{width: '10%'}}>
                            {/* 実際の商品明細データ表示 */}
                            <QuantitySummaryDisplay orderId={order.id} totalAmount={order.total_amount} />
                          </td>

                          {/* 発注担当者 */}
                          <td className={`px-6 py-2 whitespace-nowrap text-sm text-center ${
                            isDark ? 'text-gray-300' : 'text-gray-900'
                          }`} style={{width: '12%'}}>
                            {/* 実際の担当者データ表示 */}
                            <AssignedUserDisplay userId={order.assigned_user_id} />
                          </td>

                          {/* 発注日 */}
                          <td className={`px-3 py-2 whitespace-nowrap text-sm ${
                            isDark ? 'text-gray-300' : 'text-gray-900'
                          }`} style={{width: '8%'}}>
                            <div className="text-xs">
                              {new Date(order.created_at).toLocaleDateString('ja-JP')}
                            </div>
                          </td>

                          {/* ステータス（4種類統一：未納品/一部納品/納品完了/キャンセル） */}
                          <td className="px-3 py-2 whitespace-nowrap text-center" style={{width: '10%'}}>
                            {(() => {
                              // モダンなステータス表示（Inventory/Outboundページの色合いを参考）
                              const getOrderStatusDisplay = () => {
                                if (order.status === 'cancelled') {
                                  return {
                                    label: 'キャンセル',
                                    textColor: 'text-red-800 dark:text-red-200',
                                    bgColor: 'bg-red-100 dark:bg-red-900',
                                    progressColor: 'bg-red-500'
                                  };
                                }

                                if (order.delivery_progress >= 100) {
                                  return {
                                    label: '納品完了',
                                    textColor: 'text-green-800 dark:text-green-200',
                                    bgColor: 'bg-green-100 dark:bg-green-900',
                                    progressColor: 'bg-green-500'
                                  };
                                }

                                if (order.delivery_progress > 0) {
                                  return {
                                    label: '一部納品',
                                    textColor: 'text-blue-800 dark:text-blue-200',
                                    bgColor: 'bg-blue-100 dark:bg-blue-900',
                                    progressColor: 'bg-blue-500'
                                  };
                                }

                                return {
                                  label: '未納品',
                                  textColor: 'text-orange-800 dark:text-orange-200',
                                  bgColor: 'bg-orange-100 dark:bg-orange-900',
                                  progressColor: 'bg-orange-500'
                                };
                              };

                              const statusDisplay = getOrderStatusDisplay();

                              return (
                                <div className="flex items-center space-x-3">
                                  {/* モダンなステータスバッジ */}
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${statusDisplay.bgColor} ${statusDisplay.textColor} transition-all duration-200 hover:shadow-sm`}>
                                    {statusDisplay.label}
                                  </span>

                                  {/* 進捗表示（キャンセル以外） */}
                                  {order.status !== 'cancelled' && (
                                    <div className="flex items-center space-x-2">
                                      <span className={`text-xs font-medium ${
                                        isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                        進捗
                                      </span>
                                      <span className={`text-xs font-semibold ${statusDisplay.textColor}`}>
                                        {order.delivery_progress.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* 操作 */}
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-center" style={{width: '11%'}}>
                            <div className="flex justify-center space-x-1">
                              <button
                                onClick={() => openDeliveryModal(order.id, 'partial')}
                                disabled={order.status === 'cancelled' || order.delivery_progress >= 100}
                                className={`px-1 py-0.5 text-xs rounded transition-colors ${
                                  (order.status !== 'cancelled' && order.delivery_progress < 100)
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                分納
                              </button>
                              <button
                                onClick={() => openDeliveryModal(order.id, 'full')}
                                disabled={order.status === 'cancelled' || order.delivery_progress >= 100}
                                className={`px-1 py-0.5 text-xs rounded transition-colors ${
                                  (order.status !== 'cancelled' && order.delivery_progress < 100)
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                全納
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        </ModernCard>
        </>
        )}

        {/* 出庫管理タブ */}
        {activeTab === 'outbound' && (
          <OutboundOrdersTab
            outboundOrders={outboundOrders || []}
            isLoading={isOutboundLoading}
            error={outboundError}
            createOutboundOrder={createOutboundOrder}
            updateOutboundOrder={updateOutboundOrder}
            deleteOutboundOrder={deleteOutboundOrder}
            allocateStock={allocateStock}
            processShipment={processShipment}
            taxDisplayMode={taxDisplayMode}
            isDark={isDark}
          />
        )}


      </motion.div>

      <DeliveryModal />


    </div>
  );
}