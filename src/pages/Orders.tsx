import { Link } from 'react-router-dom';
import { Plus, FileText, Calendar, TrendingUp, Package, AlertCircle, Search, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { DeliveryProgress } from '../types';
import { useDeliveryModal } from '../stores/deliveryModal.store';



const fetchOrders = async () => {
  const { data, error } = await supabase
    .from('delivery_progress')
    .select('*')
    .order('order_date', { ascending: false });

  if (error) throw error;
  return data || [];
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '未納品' | '一部納品' | '納品完了'>('all');
  
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

  // 検索・フィルタリング機能
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter(order => {
      const matchesSearch = !searchTerm || (
        order.order_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.partner_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesStatus = statusFilter === 'all' || order.progress_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
                <div className="flex items-center">
          <h1 className="text-3xl font-bold text-gray-900">発注管理</h1>
          <button onClick={() => refetch()} disabled={isFetching} className="ml-4 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {isFetching ? '更新中…' : '最新表示に更新'}
          </button>
        </div>
        <Link
          to="/orders/new"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          新規発注
        </Link>
      </div>

      {/* 検索・フィルター機能 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {/* 検索バー */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="発注番号・仕入先で検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* ステータスフィルター */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">状態:</label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          {(searchTerm || statusFilter !== 'all') && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4 mr-1" />
              クリア
            </button>
          )}
        </div>

        {/* 検索結果数表示 */}
        <div className="mt-3 text-sm text-gray-600">
          {searchTerm || statusFilter !== 'all' ? (
            <span>
              {filteredOrders.length}件の結果 (全{orders?.length || 0}件中)
            </span>
          ) : (
            <span>全{orders?.length || 0}件の発注</span>
          )}
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">総発注数</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredOrders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">完了率</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredOrders.length > 0 
                  ? Math.round((filteredOrders.filter(o => o.progress_status === '納品完了').length / filteredOrders.length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">未納品件数</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredOrders.filter(o => o.remaining_amount > 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">総発注額</p>
              <p className="text-2xl font-semibold text-gray-900">
                ¥{filteredOrders.reduce((sum, o) => sum + o.ordered_amount, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 発注一覧テーブル */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">発注一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  発注情報
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  仕入先
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額・進捗
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const progressPercentage = getProgressPercentage(order.delivered_amount, order.ordered_amount);
                return (
                  <tr key={order.purchase_order_id} className="hover:bg-gray-50">
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
                          <div className="text-sm text-gray-500">
                            <Calendar className="inline w-4 h-4 mr-1" />
                            <div>発注日: {new Date(order.order_date).toLocaleDateString('ja-JP')}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              発行時刻: {new Date(order.order_date).toLocaleTimeString('ja-JP')}
                            </div>
                          </div>
                          {order.delivery_deadline && (
                            <div className="text-sm text-gray-500">
                              納期: {new Date(order.delivery_deadline).toLocaleDateString('ja-JP')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.partner_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
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
                        <div className="text-xs text-gray-500 mt-1">{progressPercentage}% 完了</div>
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchTerm || statusFilter !== 'all' ? '該当する発注が見つかりません' : '発注がありません'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
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
      </div>
    </div>
  );
}
