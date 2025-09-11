import { Link } from 'react-router-dom';
import { Plus, FileText, Calendar, TrendingUp, Package, AlertCircle, Search, X, Filter, RefreshCw, FileDown, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useDeliveryModal } from '../stores/deliveryModal.store';
import { DeliveryModal } from '../components/DeliveryModal';
import { ModernStatsBar } from '../components/ModernStatsBar';
import { ModernCard } from '../components/ui/ModernCard';
import { useOrders, usePartners, useOrderStats, type OrderFilters, type PurchaseOrder } from '../hooks/useOptimizedOrders';
import SearchableSelect from '../components/SearchableSelect';

export default function Orders() {
  const { isDark } = useDarkMode();
  const openDeliveryModal = useDeliveryModal((state) => state.open);
  
  // フィルタ状態（クライアントサイド検索用）
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'undelivered' | 'partial' | 'completed' | 'cancelled'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'overdue'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState<'created_at' | 'delivery_deadline'>('created_at');
  const [partnerIdFilter, setPartnerIdFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'delivery_deadline' | 'total_amount' | 'delivery_progress'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // データフック（フィルタなしで全データ取得）
  const { data: ordersData, isLoading, error, refetch, isFetching } = useOrders({});
  const { data: partners = [] } = usePartners();
  
  const allOrders = ordersData?.data || [];
  
  // クライアントサイドフィルタリング（Partnersパターン）
  const orders = useMemo(() => {
    if (!allOrders.length) return [];

    try {
      let filtered = allOrders.filter(order => {
        // 検索条件（発注番号、仕入先名、コードで検索）
        const matchesSearch = !searchTerm || (
          (order.order_no?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (order.partners?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (order.partners?.partner_code?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );

        // ステータスフィルタ（納品進捗ベース）
        let matchesStatus = true;
        if (statusFilter !== 'all') {
          switch (statusFilter) {
            case 'undelivered':
              matchesStatus = order.delivery_progress === 0;
              break;
            case 'partial':
              matchesStatus = order.delivery_progress > 0 && order.delivery_progress < 100;
              break;
            case 'completed':
              matchesStatus = order.delivery_progress >= 100;
              break;
            case 'cancelled':
              matchesStatus = order.status === 'cancelled';
              break;
          }
        }

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
            case 'today':
              const today = now.toISOString().split('T')[0];
              matchesDateRange = orderDate.toISOString().split('T')[0] === today;
              break;
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              matchesDateRange = orderDate >= weekAgo;
              break;
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              matchesDateRange = orderDate >= monthAgo;
              break;
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

  // 統計情報も filtered orders から計算
  const stats = useMemo(() => {
    const now = new Date();
    return {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.total_amount, 0),
      confirmedOrders: orders.filter(o => o.status === 'confirmed').length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      overdueOrders: orders.filter(o => 
        new Date(o.delivery_deadline) < now && o.delivery_progress < 100
      ).length,
      draftOrders: orders.filter(o => o.status === 'draft').length,
    };
  }, [orders]);

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
      title: '確定済',
      value: stats?.confirmedOrders.toLocaleString() || '0',
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

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-lg text-gray-700 dark:text-gray-300 font-medium">
              発注データを読み込み中...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                発注管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                仕入先への発注・納期管理・分納入荷処理
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={`p-2 rounded-lg transition-colors ${
                isFetching
                  ? 'text-gray-400 cursor-not-allowed'
                  : isDark
                    ? 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100'
              }`}
            >
              <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            
            <Link
              to="/orders/new"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>新規発注</span>
            </Link>
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
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                発注一覧
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span>{orders.length}件表示</span>
                {isFetching && (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>更新中...</span>
                  </>
                )}
              </div>
            </div>

            {orders.length === 0 ? (
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
                {orders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border p-6 transition-all duration-200 hover:shadow-md ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* 発注基本情報 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {order.order_no}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status === 'completed' ? '納品完了' :
                             order.status === 'confirmed' ? '確定済み' :
                             order.status === 'cancelled' ? 'キャンセル' : '未確定'}
                          </span>
                        </div>
                        
                        <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">仕入先:</span>
                            <span>{order.partners.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">発注日:</span>
                            <span>{new Date(order.created_at).toLocaleDateString('ja-JP')}</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Calendar className="h-4 w-4" />
                            <span>納期: {new Date(order.delivery_deadline).toLocaleDateString('ja-JP')}</span>
                            {order.is_overdue && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">発注額:</span>
                            <span className="font-semibold">¥{order.total_amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* 分納進捗情報 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            分納進捗
                          </span>
                          <span className={`text-sm font-medium ${
                            getProgressStatus(order) === '納品完了' ? 'text-green-600' :
                            getProgressStatus(order) === '一部納品' ? 'text-blue-600' :
                            order.is_overdue ? 'text-red-600' :
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {getProgressStatus(order)}{order.is_overdue && order.delivery_progress < 100 ? ' (納期遅れ)' : ''}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(order)}`}
                              style={{ width: `${Math.min(order.delivery_progress, 100)}%` }}
                            ></div>
                          </div>
                          
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <div className="flex justify-between">
                              <span>納品済: ¥{order.delivered_amount.toLocaleString()}</span>
                              <span>{order.delivery_progress.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>残り: ¥{order.remaining_amount.toLocaleString()}</span>
                              <span>分納回数: {order.delivery_count}回</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* アクション */}
                      <div className="flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          {order.latest_delivery_date && (
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              最終分納: {new Date(order.latest_delivery_date).toLocaleString('ja-JP')}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          {/* 分納登録ボタン */}
                          <button
                            onClick={() => openDeliveryModal(order.id, 'partial')}
                            disabled={order.status === 'cancelled' || order.delivery_progress >= 100}
                            className={`flex-1 px-2 py-2 text-xs rounded-md transition-colors ${
                              (order.status !== 'cancelled' && order.delivery_progress < 100)
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            分納登録
                          </button>
                          
                          {/* 全納登録ボタン */}
                          <button
                            onClick={() => openDeliveryModal(order.id, 'full')}
                            disabled={order.status === 'cancelled' || order.delivery_progress >= 100}
                            className={`flex-1 px-2 py-2 text-xs rounded-md transition-colors ${
                              (order.status !== 'cancelled' && order.delivery_progress < 100)
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            全納登録
                          </button>
                          <Link
                            to={`/orders/${order.id}`}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            詳細
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </ModernCard>
      </div>

      <DeliveryModal />
    </div>
  );
}