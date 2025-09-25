import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, RefreshCw, Package, TrendingDown, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDarkMode } from '../hooks/useDarkMode';
import { ModernCard } from '../components/ui/ModernCard';
import { useOutboundManagement, OutboundUtils, OutboundOrder, OutboundOrderItem } from '../hooks/useOutboundManagement';

// フィルタの型定義
interface OutboundFilters {
  status: string;
  customer: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
}

export default function OutboundOrders() {
  const { isDark } = useDarkMode();
  const queryClient = useQueryClient();

  // 出庫管理フックの初期化
  const { useOutboundOrders } = useOutboundManagement();

  // モーダル状態管理
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // フィルタ状態管理（Inventory.tsxパターンに準拠）
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [filters, setFilters] = useState<OutboundFilters>({
    status: 'all',
    customer: '',
    startDate: '',
    endDate: '',
    searchTerm: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<OutboundFilters>({
    status: 'all',
    customer: '',
    startDate: '',
    endDate: '',
    searchTerm: '',
  });

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // 実際のデータ取得（useOutboundManagement.ts連携）
  const queryFilters = useMemo(() => ({
    status: appliedFilters.status === 'all' ? undefined : appliedFilters.status as any,
    customer_name: appliedFilters.customer || undefined,
    start_date: appliedFilters.startDate || undefined,
    end_date: appliedFilters.endDate || undefined,
    search_term: appliedFilters.searchTerm || undefined,
  }), [appliedFilters]);

  const {
    data: outboundOrders = [],
    isLoading,
    error,
    refetch
  } = useOutboundOrders(queryFilters);

  // 検索・フィルタ適用
  const handleSearch = useCallback(() => {
    setAppliedSearchTerm(searchInput.trim());
    setAppliedFilters({ ...filters, searchTerm: searchInput.trim() });
    setCurrentPage(1);
  }, [searchInput, filters]);

  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setAppliedSearchTerm('');
    const resetFilters: OutboundFilters = {
      status: 'all',
      customer: '',
      startDate: '',
      endDate: '',
      searchTerm: '',
    };
    setFilters(resetFilters);
    setAppliedFilters(resetFilters);
    setCurrentPage(1);
  }, []);

  // ステータス表示（OutboundUtils使用）
  const getStatusBadge = (status: OutboundOrder['status']) => {
    const statusConfig = {
      pending: { label: OutboundUtils.getStatusLabel(status), color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳' },
      processing: { label: OutboundUtils.getStatusLabel(status), color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔄' },
      completed: { label: OutboundUtils.getStatusLabel(status), color: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
      cancelled: { label: OutboundUtils.getStatusLabel(status), color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '❌' },
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // 納期緊急度表示（OutboundUtils使用）
  const getDueDateColor = (dueDate?: string) => {
    return OutboundUtils.isUrgent(dueDate) ? 'text-red-600 font-semibold' : '';
  };

  // ローディング・エラー処理
  if (error) {
    return (
      <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <ModernCard className="p-6 text-center">
            <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              データの読み込みに失敗しました
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              出庫指示データを取得できませんでした。
            </p>
            <button
              onClick={() => refetch()}
              className={`px-4 py-2 rounded-lg font-medium ${isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              再試行
            </button>
          </ModernCard>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー（ordersページと統一） */}
        <div className="flex justify-between items-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              出庫管理
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              出庫指示の作成・管理・実績登録
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className={`
              flex items-center px-4 py-2 rounded-lg font-medium transition-colors
              ${isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            <Plus className="w-4 h-4 mr-2" />
            出庫指示作成
          </motion.button>
        </div>

        {/* 検索・フィルタバー */}
        <ModernCard className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 検索フィールド */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="注文番号・顧客名で検索"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={`
                    w-full pl-10 pr-4 py-2 border rounded-lg
                    ${isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  `}
                />
              </div>
            </div>

            {/* ステータスフィルタ */}
            <div>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                `}
              >
                <option value="all">全てのステータス</option>
                <option value="pending">未処理</option>
                <option value="processing">処理中</option>
                <option value="completed">完了</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>

            {/* アクションボタン */}
            <div className="flex space-x-2">
              <button
                onClick={handleSearch}
                className={`
                  flex-1 flex items-center justify-center px-3 py-2 rounded-lg font-medium
                  ${isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }
                  transition-colors
                `}
              >
                <Search className="w-4 h-4 mr-1" />
                検索
              </button>
              <button
                onClick={handleResetFilters}
                className={`
                  px-3 py-2 rounded-lg font-medium border transition-colors
                  ${isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </ModernCard>

        {/* 統計サマリー（在庫管理ページと統一） */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {isLoading ? (
            // ローディング状態
            Array.from({ length: 4 }).map((_, index) => (
              <ModernCard key={index} className="p-4">
                <div className="animate-pulse">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-300 rounded-lg mr-3"></div>
                    <div>
                      <div className="h-4 bg-gray-300 rounded w-16 mb-2"></div>
                      <div className="h-6 bg-gray-300 rounded w-12"></div>
                    </div>
                  </div>
                </div>
              </ModernCard>
            ))
          ) : (
            <>
              <ModernCard className="p-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-100'} mr-3`}>
                    <Package className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>未処理</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {outboundOrders.filter(o => o.status === 'pending').length}件
                    </p>
                  </div>
                </div>
              </ModernCard>

              <ModernCard className="p-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'} mr-3`}>
                    <TrendingDown className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>処理中</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {outboundOrders.filter(o => o.status === 'processing').length}件
                    </p>
                  </div>
                </div>
              </ModernCard>

              <ModernCard className="p-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'} mr-3`}>
                    <Package className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>完了</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {outboundOrders.filter(o => o.status === 'completed').length}件
                    </p>
                  </div>
                </div>
              </ModernCard>

              <ModernCard className="p-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-red-900/30' : 'bg-red-100'} mr-3`}>
                    <AlertCircle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>緊急納期</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {outboundOrders.filter(o => OutboundUtils.isUrgent(o.due_date)).length}件
                    </p>
                  </div>
                </div>
              </ModernCard>
            </>
          )}
        </div>

        {/* 出庫指示一覧テーブル */}
        <ModernCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    出庫番号
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    顧客名
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    納期日
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    商品名
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    数量合計
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ステータス
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  // ローディング行
                  Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      {Array.from({ length: 7 }).map((_, colIndex) => (
                        <td key={colIndex} className="py-3 px-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-300 rounded w-full"></div>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  outboundOrders.map((order, index) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`
                      border-b transition-colors hover:bg-gray-50/50
                      ${isDark ? 'border-gray-700 hover:bg-gray-800/50' : 'border-gray-200'}
                    `}
                  >
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      <span className="font-mono text-sm">{order.order_number}</span>
                    </td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {order.customer_name}
                    </td>
                    <td className={`py-3 px-4 ${order.due_date ? getDueDateColor(order.due_date) : (isDark ? 'text-gray-400' : 'text-gray-500')}`}>
                      {order.due_date ? new Date(order.due_date).toLocaleDateString('ja-JP') : '未設定'}
                    </td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {order.items?.[0]?.product?.product_name || '商品未設定'}
                      {(order.items?.length || 0) > 1 && (
                        <span className={`ml-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          他{(order.items?.length || 1) - 1}品目
                        </span>
                      )}
                    </td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {order.items?.reduce((sum, item) => sum + item.quantity_requested, 0) || 0}個
                      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        ¥{order.total_amount.toLocaleString()}（税込）
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDetailModal(true);
                          }}
                          className={`
                            px-3 py-1 text-xs rounded-md font-medium transition-colors
                            ${isDark
                              ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }
                          `}
                        >
                          詳細
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                  ))
                )}
              </tbody>
            </table>

            {!isLoading && outboundOrders.length === 0 && (
              <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>出庫指示が見つかりません</p>
                {appliedSearchTerm && (
                  <p className="text-sm mt-2">
                    検索条件: "{appliedSearchTerm}" に一致する結果がありません
                  </p>
                )}
              </div>
            )}
          </div>
        </ModernCard>

        {/* TODO: モーダルコンポーネント実装 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={`bg-${isDark ? 'gray-800' : 'white'} rounded-lg p-6 w-full max-w-2xl mx-4`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                出庫指示作成
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                出庫指示作成機能は次のフェーズで実装されます
              </p>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`
                  px-4 py-2 rounded-lg font-medium
                  ${isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }
                `}
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {showDetailModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={`bg-${isDark ? 'gray-800' : 'white'} rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                出庫指示詳細: {selectedOrder.order_number}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                詳細表示機能は次のフェーズで実装されます
              </p>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedOrder(null);
                }}
                className={`
                  px-4 py-2 rounded-lg font-medium
                  ${isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }
                `}
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}