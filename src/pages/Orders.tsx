import { Link } from 'react-router-dom';
import { Plus, FileText, Calendar, TrendingUp, Package, AlertCircle, Search, X, Filter, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useDarkMode } from '../hooks/useDarkMode';
import type { DeliveryProgress } from '../types';
import { useDeliveryModal } from '../stores/deliveryModal.store';
import { DeliveryModal } from '../components/DeliveryModal';
import { ModernStatsBar } from '../components/ModernStatsBar';
import { ModernCard } from '../components/ui/ModernCard';



const fetchOrders = async () => {
  // 🚨 購入発注データと分納実績を統合取得（納期表示のため直接テーブル使用）
  const { data: purchaseOrders, error: ordersError } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      partners!purchase_orders_partner_id_fkey (
        name,
        partner_code
      )
    `)
    .order('created_at', { ascending: false });

  if (ordersError) throw ordersError;
  
  // 🚨 各発注に対する分納実績を計算
  const deliveryProgressData = await Promise.all(
    (purchaseOrders || []).map(async (order: any) => {
      // 分納実績を集計
      const { data: deliveries, error: deliveryError } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('parent_order_id', order.id)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed');
      
      if (deliveryError) {
        console.warn(`分納実績取得エラー (Order: ${order.id}):`, deliveryError);
      }
      
      const delivered_amount = (deliveries || []).reduce(
        (sum, delivery) => sum + (delivery.total_amount || 0), 0
      );
      
      const ordered_amount = order.total_amount || 0;
      const remaining_amount = Math.max(0, ordered_amount - delivered_amount);
      
      // 進捗状況を正確に判定
      let progress_status: string;
      if (remaining_amount === 0 && delivered_amount > 0) {
        progress_status = '納品完了';
      } else if (delivered_amount > 0) {
        progress_status = '一部納品';
      } else {
        progress_status = '未納品';
      }
      
      return {
        purchase_order_id: order.id,
        order_no: order.order_no,
        partner_name: order.partners?.name || '取引先不明',
        order_date: order.created_at,
        delivery_deadline: order.delivery_deadline,
        ordered_amount,
        delivered_amount,
        remaining_amount,
        progress_status
      };
    })
  );
  
  return deliveryProgressData;
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '未納品' | '一部納品' | '納品完了'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'delivery_deadline' | 'partner_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const { data: orders, isLoading, isError, error, refetch, isFetching } = useQuery<DeliveryProgress[], Error>({
    queryKey: ['orders'],
    queryFn: fetchOrders,
    staleTime: 0,                // キャッシュを常に古い扱い
    refetchOnMount: 'always',    // マウント時は必ず再取得
    refetchOnWindowFocus: true,  // タブに戻るたびに再取得
    refetchOnReconnect: true,
    onError: (err) => {
      console.error('発注データ取得エラー:', err);
      toast.error(`データ取得に失敗しました: ${err?.message ?? '不明なエラー'}`);
    }
  });
  const openDeliveryModal = useDeliveryModal((state) => state.open);

  // 検索・フィルタリング・ソート機能
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let filtered = orders.filter(order => {
      const matchesSearch = !searchTerm || (
        order.order_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.purchase_order_id.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesStatus = statusFilter === 'all' || order.progress_status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // ソート処理
    filtered.sort((a: any, b: any) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'delivery_deadline':
          valueA = a.delivery_deadline ? new Date(a.delivery_deadline).getTime() : 0;
          valueB = b.delivery_deadline ? new Date(b.delivery_deadline).getTime() : 0;
          break;
        case 'partner_name':
          valueA = a.partner_name || '';
          valueB = b.partner_name || '';
          break;
        case 'created_at':
        default:
          valueA = new Date(a.order_date).getTime();
          valueB = new Date(b.order_date).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    return filtered;
  }, [orders, searchTerm, statusFilter, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const handleSort = (field: 'created_at' | 'delivery_deadline' | 'partner_name') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: 'created_at' | 'delivery_deadline' | 'partner_name') => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case '未納品': return 'bg-red-100 text-red-800';
      case '一部納品': return 'bg-yellow-100 text-yellow-800';
      case '納品完了': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercentage = (delivered: number, total: number) => {
    return total > 0 ? Math.round((delivered / total) * 100) : 0;
  };

  const { isDark, toggle: toggleDarkMode } = useDarkMode();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 transition-all duration-500">
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"
          />
          <span className="ml-3 text-gray-700 dark:text-gray-300 font-medium">発注データを読み込み中...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded">
        エラーが発生しました: {error?.message ?? '不明なエラー'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 transition-all duration-500">
      <div className="p-6 space-y-6">
        <motion.div 
          className="flex justify-between items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                発注管理
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">発注・分納・納期管理</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button 
              onClick={() => refetch()} 
              disabled={isFetching} 
              className="flex items-center px-4 py-2 text-sm bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? '更新中…' : '最新表示に更新'}
            </motion.button>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/orders/new"
                className="flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                新規発注
              </Link>
            </motion.div>
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
          <ModernStatsBar items={filteredOrders} />
        </motion.div>

      {/* 検索・フィルター機能 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <ModernCard className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* 検索バー */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="発注番号（PO250910004など）・仕入先名で検索..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-500 dark:placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* ステータスフィルター */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">状態:</label>
              <select
                className="px-4 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | '未納品' | '一部納品' | '納品完了')}
              >
                <option value="all">すべて</option>
                <option value="未納品">未納品</option>
                <option value="一部納品">一部納品</option>
                <option value="納品完了">納品完了</option>
              </select>
            </div>

            {/* クリアボタン */}
            {(searchTerm || statusFilter !== 'all' || sortBy !== 'created_at' || sortOrder !== 'desc') && (
              <motion.button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 hover:text-red-600 dark:hover:text-red-400 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4 mr-1" />
                リセット
              </motion.button>
            )}
          </div>

          {/* 検索結果数表示 */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {searchTerm || statusFilter !== 'all' ? (
                <>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {filteredOrders.length}件の結果
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    (全{orders?.length || 0}件中)
                  </span>
                  {searchTerm && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                      「{searchTerm}」で検索中
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                      {statusFilter}でフィルタ中
                    </span>
                  )}
                </>
              ) : (
                <span className="font-medium text-gray-900 dark:text-white">全{orders?.length || 0}件の発注</span>
              )}
              {searchTerm && (
                <div className="w-full mt-2 text-xs text-gray-500 dark:text-gray-500 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 rounded-lg">
                  💡 発注番号（PO250910004）、発注ID（UUID）、仕入先名で検索可能
                </div>
              )}
            </div>
          </div>
        </ModernCard>
      </motion.div>

      {/* 発注一覧テーブル */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <ModernCard className="overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              発注一覧
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
                    <span>発注情報</span>
                    <span className="text-gray-400">{getSortIcon('created_at')}</span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('partner_name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>仕入先</span>
                    <span className="text-gray-400">{getSortIcon('partner_name')}</span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('delivery_deadline')}
                >
                  <div className="flex items-center space-x-1">
                    <span>納期</span>
                    <span className="text-gray-400">{getSortIcon('delivery_deadline')}</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  金額・進捗
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order) => {
                const progressPercentage = getProgressPercentage(order.delivered_amount, order.ordered_amount);
                return (
                  <tr key={order.purchase_order_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                          <Link 
                            to={`/orders/${order.purchase_order_id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {order.order_no}
                          </Link>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="inline w-4 h-4 mr-1" />
                            <div>発注日: {new Date(order.order_date).toLocaleDateString('ja-JP')}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              発行時刻: {new Date(order.order_date).toLocaleTimeString('ja-JP')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{order.partner_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.delivery_deadline ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          <Calendar className="inline w-4 h-4 mr-1 text-orange-500" />
                          {new Date(order.delivery_deadline).toLocaleDateString('ja-JP')}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">未設定</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div>発注額: ¥{order.ordered_amount.toLocaleString()}</div>
                        <div>納品済: ¥{order.delivered_amount.toLocaleString()}</div>
                        <div>残額: ¥{order.remaining_amount.toLocaleString()}</div>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{progressPercentage}% 完了</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProgressColor(order.progress_status)}`}>
                        {order.progress_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {order.remaining_amount > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeliveryModal(order.purchase_order_id)
                          }}
                          className="text-green-600 hover:text-green-800 font-medium mr-3"
                        >
                          分納入力
                        </button>
                      ) : (
                        <span className="text-gray-400 mr-3">完了済み</span>
                      )}
                      <button className="text-blue-600 hover:text-blue-900">
                        PDF出力
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {searchTerm || statusFilter !== 'all' ? '該当する発注が見つかりません' : '発注がありません'}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' 
                  ? '検索条件を変更してお試しください' 
                  : '新しい発注を作成してください'
                }
              </p>
              {!(searchTerm || statusFilter !== 'all') && (
                <div className="mt-6">
                  <Link
                    to="/orders/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    新規発注
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
        </ModernCard>
      </motion.div>

      <DeliveryModal />
      </div>
    </div>
  );
}
