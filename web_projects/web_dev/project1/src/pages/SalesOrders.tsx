import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Package, CheckCircle, XCircle, Clock, Truck } from 'lucide-react';

// 型定義
interface SalesOrder {
  id: string;
  order_no: string;
  order_date: string;
  delivery_date: string | null;
  delivery_address: string | null;
  total_amount: number;
  tax_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string;
    partner_code: string;
  };
}

// ステータスの日本語表示マッピング
const statusLabels: Record<SalesOrder['status'], string> = {
  pending: '受注確認待ち',
  confirmed: '受注確定',
  shipped: '出荷済み',
  completed: '完了',
  cancelled: 'キャンセル',
};

// ステータスのスタイル
const statusStyles: Record<SalesOrder['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ステータスアイコン
const statusIcons: Record<SalesOrder['status'], React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  confirmed: <CheckCircle className="h-4 w-4" />,
  shipped: <Truck className="h-4 w-4" />,
  completed: <Package className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

// データ取得関数
const fetchSalesOrders = async (): Promise<SalesOrder[]> => {
  const { data, error } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customer:partners!customer_id (
        id,
        name,
        partner_code
      )
    `)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SalesOrder[];
};

export default function SalesOrders() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<SalesOrder['status'] | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 受注データ取得
  const { data: salesOrders, isLoading, error } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: fetchSalesOrders,
    staleTime: 0,
  });

  // フィルタリング処理
  const filteredOrders = salesOrders?.filter((order) => {
    // ステータスフィルタ
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }

    // 検索キーワード（受注番号・顧客名）
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      const matchesOrderNo = order.order_no.toLowerCase().includes(keyword);
      const matchesCustomer = order.customer.name.toLowerCase().includes(keyword);
      if (!matchesOrderNo && !matchesCustomer) {
        return false;
      }
    }

    // 日付フィルタ
    if (dateFilter === 'this_month') {
      const now = new Date();
      const orderDate = new Date(order.order_date);
      if (
        orderDate.getFullYear() !== now.getFullYear() ||
        orderDate.getMonth() !== now.getMonth()
      ) {
        return false;
      }
    } else if (dateFilter === 'last_month') {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const orderDate = new Date(order.order_date);
      if (
        orderDate.getFullYear() !== lastMonth.getFullYear() ||
        orderDate.getMonth() !== lastMonth.getMonth()
      ) {
        return false;
      }
    } else if (dateFilter === 'custom') {
      if (customStartDate && new Date(order.order_date) < new Date(customStartDate)) {
        return false;
      }
      if (customEndDate && new Date(order.order_date) > new Date(customEndDate)) {
        return false;
      }
    }

    return true;
  });

  // 合計金額計算
  const totalAmount = filteredOrders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          エラーが発生しました: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">受注管理</h1>
          <p className="text-sm text-gray-600 mt-1">
            受注の登録・確認・出荷管理を行います
          </p>
        </div>
        <Link
          to="/sales-orders/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          新規受注
        </Link>
      </div>

      {/* フィルタ・検索エリア */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 space-y-4">
        {/* 検索バー */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="受注番号・顧客名で検索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* フィルタ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ステータスフィルタ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="inline h-4 w-4 mr-1" />
              ステータス
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SalesOrder['status'] | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">すべて</option>
              <option value="pending">受注確認待ち</option>
              <option value="confirmed">受注確定</option>
              <option value="shipped">出荷済み</option>
              <option value="completed">完了</option>
              <option value="cancelled">キャンセル</option>
            </select>
          </div>

          {/* 期間フィルタ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              期間
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">すべて</option>
              <option value="this_month">今月</option>
              <option value="last_month">先月</option>
              <option value="custom">カスタム期間</option>
            </select>
          </div>

          {/* カスタム期間 */}
          {dateFilter === 'custom' && (
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カスタム期間
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="self-center text-gray-500">〜</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* サマリー */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">表示件数</p>
            <p className="text-2xl font-bold text-gray-900">
              {filteredOrders?.length || 0} 件
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">合計金額（税込）</p>
            <p className="text-2xl font-bold text-blue-600">
              ¥{totalAmount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">全受注件数</p>
            <p className="text-2xl font-bold text-gray-900">
              {salesOrders?.length || 0} 件
            </p>
          </div>
        </div>
      </div>

      {/* 受注一覧テーブル */}
      {isLoading ? (
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      ) : filteredOrders && filteredOrders.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    受注番号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    受注日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    顧客
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    納期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    金額（税込）
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.order_no}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(order.order_date).toLocaleDateString('ja-JP')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.customer.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.customer.partner_code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.delivery_date
                          ? new Date(order.delivery_date).toLocaleDateString('ja-JP')
                          : '未指定'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ¥{Number(order.total_amount).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        税額: ¥{Number(order.tax_amount).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusStyles[order.status]
                        }`}
                      >
                        {statusIcons[order.status]}
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/sales-orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">受注データがありません</p>
          <Link
            to="/sales-orders/new"
            className="inline-block mt-4 text-blue-600 hover:text-blue-800"
          >
            最初の受注を登録する
          </Link>
        </div>
      )}
    </div>
  );
}
