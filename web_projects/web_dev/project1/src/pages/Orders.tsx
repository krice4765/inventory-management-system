import { Link, useLocation } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Calendar, TrendingUp, Package, AlertCircle, Filter, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import type { DeliveryProgress, UserRole } from '../types';
import { roleDisplayNames } from '../types';
import { useDeliveryModal } from '../stores/deliveryModal.store';
import { useAuthStore } from '../stores/authStore';
import { usePurchaseOrderForPDF } from '../hooks/usePurchaseOrderForPDF';
import { generatePurchaseOrderPDF } from '../lib/pdfGenerator';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';



const fetchOrders = async () => {
  const { data, error } = await supabase
    .from('delivery_progress')
    .select('*')
    .order('order_date', { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchPartners = async () => {
  const { data, error } = await supabase
    .from('partners')
    .select('id, name, partner_code, partner_type')
    .order('name');

  if (error) throw error;

  // 仕入先のみをフィルター（英語の"supplier"または日本語の"仕入先"、および"both"を含む）
  const suppliers = data?.filter(p =>
    p.partner_type === 'supplier' ||
    p.partner_type === '仕入先' ||
    p.partner_type === 'both'
  ) || [];

  return suppliers;
};

// 担当者一覧を取得（Edge Function経由でロール情報含む）
const fetchUsers = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error('認証セッションが見つかりません');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`,
    {
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('ユーザー一覧の取得に失敗しました');
  }

  const result = await response.json();

  // ユーザー情報をマッピング（ロール情報を含む）
  return result.users.map((user: any) => ({
    created_by_user_id: user.id,
    created_by_name: user.user_metadata?.full_name || '未設定',
    created_by_email: user.email,
    role: user.user_metadata?.role || 'staff',
  }));
};

export default function Orders() {
  // ログインユーザー情報を取得
  const { userProfile } = useAuthStore();
  const location = useLocation();
  const { savePageState, restorePageState } = usePageState();

  // フィルター状態
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // ページ読み込み時に状態を復元
  useEffect(() => {
    const restored = restorePageState();
    if (restored && restored.filters) {
      const filters = restored.filters;
      if (filters.statusFilter) setStatusFilter(filters.statusFilter);
      if (filters.partnerFilter) setPartnerFilter(filters.partnerFilter);
      if (filters.userFilter) setUserFilter(filters.userFilter);
      if (filters.searchText) setSearchText(filters.searchText);
      if (filters.dateFrom) setDateFrom(filters.dateFrom);
      if (filters.dateTo) setDateTo(filters.dateTo);
      if (filters.showFilters !== undefined) setShowFilters(filters.showFilters);
    }
  }, []);

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

  const { data: partners, isLoading: isLoadingPartners, error: partnersError } = useQuery({
    queryKey: ['partners-for-filter'],
    queryFn: fetchPartners,
  });

  const { data: users } = useQuery({
    queryKey: ['users-for-filter'],
    queryFn: fetchUsers,
  });

  const openDeliveryModal = useDeliveryModal((state) => state.open);

  // 仕入先オプションをメモ化
  const partnerOptions = useMemo(() => {
    if (!partners) return [];
    return partners.map(partner => ({
      value: partner.name,
      label: `${partner.name} (${partner.partner_code})`
    }));
  }, [partners]);

  // 担当者オプションをメモ化（ロール情報付き）
  const userOptions = useMemo(() => {
    if (!users) return [];
    return users.map((user: any) => {
      const userName = user.created_by_name || user.created_by_email || '不明';
      const roleLabel = roleDisplayNames[user.role as UserRole] || roleDisplayNames.staff;
      return {
        value: user.created_by_user_id || '',
        label: `${userName} (${roleLabel})`,
        role: user.role, // ソート用にロール情報も保持
      };
    })
    // 発注担当者を優先的に上に表示
    .sort((a, b) => {
      const roleOrder: Record<string, number> = {
        'purchasing_staff': 1,
        'admin': 2,
        'manager': 3,
        'inventory_staff': 4,
        'sales_staff': 5,
        'accounting_staff': 6,
        'staff': 7,
        'readonly': 8,
      };
      const aOrder = roleOrder[a.role] || 99;
      const bOrder = roleOrder[b.role] || 99;
      return aOrder - bOrder;
    });
  }, [users]);

  // フィルター適用後のデータ
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter(order => {
      // ステータスフィルター
      if (statusFilter !== 'all') {
        if (statusFilter === '未納品' && order.progress_status !== '未納品') return false;
        if (statusFilter === '一部納品' && order.progress_status !== '一部納品') return false;
        if (statusFilter === '納品完了' && order.progress_status !== '納品完了') return false;
      }

      // 仕入先フィルター
      if (partnerFilter && order.partner_name !== partnerFilter) {
        return false;
      }

      // 担当者フィルター
      if (userFilter && order.created_by_user_id !== userFilter) {
        return false;
      }

      // テキスト検索（発注番号）
      if (searchText && !order.order_no.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      // 日付範囲フィルター
      if (dateFrom && order.order_date < dateFrom) {
        return false;
      }
      if (dateTo && order.order_date > dateTo) {
        return false;
      }

      return true;
    });
  }, [orders, statusFilter, partnerFilter, userFilter, searchText, dateFrom, dateTo]);

  // フィルタークリア
  const clearFilters = () => {
    setStatusFilter('all');
    setPartnerFilter('');
    setUserFilter('');
    setSearchText('');
    setDateFrom('');
    setDateTo('');
  };

  // アクティブなフィルター数（検索は常時表示なので除外）
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (partnerFilter) count++;
    if (userFilter) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [statusFilter, partnerFilter, userFilter, dateFrom, dateTo]);

  const getProgressColor = (status: string) => {
    switch (status) {
      case '未納品': return 'bg-red-100 text-red-800';
      case '一部納品': return 'bg-yellow-100 text-yellow-800';
      case '納品完了': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-display font-bold text-white tracking-tight">発注管理</h1>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                {isFetching ? '更新中…' : '最新表示に更新'}
              </button>
            </div>
            <p className="text-blue-100 mt-1 font-inter text-sm">発注から納品までのプロセスを管理</p>
          </div>
          <div className="flex items-center gap-3">
            <PageManual {...manuals.orders} />
            <Link
              to="/orders/new"
              className="flex items-center px-5 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-xl font-jakarta font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              新規発注
            </Link>
          </div>
        </div>
      </div>

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総発注数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{filteredOrders.length}</p>
              {activeFilterCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">（全{orders?.length || 0}件中）</p>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">完了率</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {filteredOrders.length > 0
                  ? Math.round((filteredOrders.filter(o => o.progress_status === '納品完了').length / filteredOrders.length) * 100)
                  : 0}%
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">未納品件数</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {filteredOrders.filter(o => o.remaining_amount > 0).length}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総発注額</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                ¥{filteredOrders ? filteredOrders.reduce((sum, o) => sum + o.ordered_amount, 0).toLocaleString() : 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 検索・フィルターセクション */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* フィルターヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-inter font-semibold text-gray-800 text-lg">フィルター</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showFilters ? '閉じる' : '開く'}
          </button>
        </div>

        {/* 検索ボックス */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="発注番号で検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-gray-600"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
            </button>
          )}
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* 第1行: ステータスと仕入先 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  ステータス
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  <option value="未納品">未納品</option>
                  <option value="一部納品">一部納品</option>
                  <option value="納品完了">納品完了</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  仕入先
                </label>
                <Select
                  isClearable
                  isSearchable
                  options={partnerOptions}
                  value={partnerOptions.find(opt => opt.value === partnerFilter) || null}
                  onChange={(option) => setPartnerFilter(option?.value || '')}
                  placeholder="仕入先を選択..."
                  noOptionsMessage={() => '該当する仕入先がありません'}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                      borderColor: '#e5e7eb',
                      borderWidth: '2px',
                      padding: '0.125rem',
                    }),
                    menu: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                    }),
                  }}
                />
              </div>
            </div>

            {/* 第2行: 担当者 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  発注担当者
                </label>
                <Select
                  isClearable
                  isSearchable
                  options={userOptions}
                  value={userOptions.find(opt => opt.value === userFilter) || null}
                  onChange={(option) => setUserFilter(option?.value || '')}
                  placeholder="担当者を選択..."
                  noOptionsMessage={() => '該当する担当者がありません'}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                      borderColor: '#e5e7eb',
                      borderWidth: '2px',
                      padding: '0.125rem',
                    }),
                    menu: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                    }),
                  }}
                />
              </div>
            </div>

            {/* 第3行: 日付範囲 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  発注日（開始）
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  発注日（終了）
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* フィルタークリアボタン */}
            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4 mr-2" />
                  フィルターをクリア ({activeFilterCount})
                </button>
              </div>
            )}
          </div>
        )}

        {/* フィルター結果件数 */}
        <div className="mt-4 text-sm font-inter text-gray-600">
          {filteredOrders.length}件の発注が見つかりました
        </div>
      </div>

      {/* 発注一覧テーブル */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">発注一覧</h2>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-gradient-to-b from-slate-50 to-slate-100 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  発注番号
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  発注日
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  納期
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  発注者
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  仕入先
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  発注額
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  残額
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  納品済額
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  納品個数
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  ステータス
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 whitespace-nowrap">
                  納品
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredOrders.map((order, index) => {
                return (
                  <tr key={order.purchase_order_id} className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-3 py-2 text-xs font-medium border-r border-slate-200 whitespace-nowrap">
                      <Link
                        to={`/orders/${order.purchase_order_id}`}
                        state={savePageState({
                          filters: {
                            statusFilter,
                            partnerFilter,
                            userFilter,
                            searchText,
                            dateFrom,
                            dateTo,
                            showFilters,
                          },
                        })}
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {order.order_no}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {new Date(order.order_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {order.delivery_deadline ? new Date(order.delivery_deadline).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {order.created_by_name || '未設定'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {order.partner_name}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                      ¥{order.ordered_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                      ¥{order.remaining_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-emerald-700 border-r border-slate-200 whitespace-nowrap text-right">
                      ¥{order.delivered_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap text-center">
                      {order.delivered_quantity} / {order.ordered_quantity}
                    </td>
                    <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-md ${getProgressColor(order.progress_status)}`}>
                        {order.progress_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-center">
                      <div className="flex justify-center gap-1.5">
                        {order.remaining_amount > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeliveryModal(order.purchase_order_id)
                            }}
                            className="px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          >
                            納品
                          </button>
                        ) : (
                          <span className="px-2 py-1 text-xs text-slate-400">完了</span>
                        )}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              // PDF用のデータを取得
                              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_purchase_order_for_pdf`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                                },
                                body: JSON.stringify({ order_id: order.purchase_order_id })
                              });

                              if (!response.ok) {
                                // Supabase RPCがない場合、直接データを取得
                                const { data: orderData, error: orderError } = await supabase
                                  .from('purchase_orders')
                                  .select(`
                                    id,
                                    order_no,
                                    order_date,
                                    delivery_deadline,
                                    total_amount,
                                    partner_id,
                                    notes
                                  `)
                                  .eq('id', order.purchase_order_id)
                                  .single();

                                if (orderError) throw orderError;

                                // 仕入先情報を別途取得（詳細情報含む）
                                const { data: partnerData } = await supabase
                                  .from('partners')
                                  .select('name, address, phone, contact_person')
                                  .eq('id', orderData.partner_id)
                                  .single();

                                const { data: items, error: itemsError } = await supabase
                                  .from('purchase_order_items')
                                  .select(`
                                    quantity,
                                    unit_price,
                                    products (product_name, product_code)
                                  `)
                                  .eq('purchase_order_id', order.purchase_order_id);

                                if (itemsError) throw itemsError;

                                // 会社情報を取得
                                const { data: companySettings, error: companyError } = await supabase
                                  .from('company_settings')
                                  .select('*')
                                  .limit(1)
                                  .single();

                                if (companyError) throw companyError;

                                const pdfData = {
                                  order_no: orderData.order_no,
                                  order_date: orderData.order_date,
                                  delivery_deadline: orderData.delivery_deadline,
                                  partner: {
                                    name: partnerData?.name || '不明な仕入先',
                                    address: partnerData?.address || undefined,
                                    phone: partnerData?.phone || undefined,
                                    contact_person: partnerData?.contact_person || undefined
                                  },
                                  total_amount: orderData.total_amount,
                                  items: items.map(item => ({
                                    product_name: (item.products as any)?.product_name || '不明な商品',
                                    product_code: (item.products as any)?.product_code || '',
                                    quantity: item.quantity,
                                    unit_price: item.unit_price,
                                    total_price: item.quantity * item.unit_price
                                  })),
                                  notes: orderData.notes || undefined,
                                  created_by: userProfile?.full_name || userProfile?.email || '担当者不明',
                                  company: {
                                    name: companySettings.company_name,
                                    address: `〒${companySettings.postal_code} ${companySettings.address}`,
                                    phone: `TEL: ${companySettings.phone}`,
                                    fax: companySettings.fax ? `FAX: ${companySettings.fax}` : undefined
                                  }
                                };

                                await generatePurchaseOrderPDF(pdfData);
                                toast.success('PDFをダウンロードしました');
                              }
                            } catch (error) {
                              console.error('PDF生成エラー:', error);
                              toast.error('PDFの生成に失敗しました');
                            }
                          }}
                          className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                        >
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              {activeFilterCount > 0 ? (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">該当する発注がありません</h3>
                  <p className="mt-1 text-sm text-gray-500">フィルター条件を変更してください</p>
                  <div className="mt-6">
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <X className="w-4 h-4 mr-2" />
                      フィルターをクリア
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">発注がありません</h3>
                  <p className="mt-1 text-sm text-gray-500">新しい発注を作成してください</p>
                  <div className="mt-6">
                    <Link
                      to="/orders/new"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      新規発注
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
