import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Calendar, AlertCircle, TrendingUp, DollarSign, Filter, CreditCard, Info, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
  closing_day: number | null;
  payment_day: number | null;
  payment_month_offset: number | null;
}

interface AccountsReceivable {
  id: string;
  invoice_no: string;
  customer_id: string;
  sales_transaction_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  received_amount: number;
  balance: number;
  due_date: string;
  invoice_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  created_at: string;
  partners: Partner;
}

type FilterType = 'all' | 'unpaid' | 'overdue' | 'paid';
type SortField = 'due_date' | 'balance' | 'partner_name';
type SortDirection = 'asc' | 'desc';

export default function AccountsReceivable() {
  const navigate = useNavigate();
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  // フィルター状態
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [partners, setPartners] = useState<Partner[]>([]);

  // ソート状態
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 一括入金選択状態
  const [selectedReceivables, setSelectedReceivables] = useState<Set<string>>(new Set());

  // サマリー統計
  const [stats, setStats] = useState({
    totalUnpaid: 0,
    overdueCount: 0,
    monthlyReceipt: 0,
  });

  useEffect(() => {
    fetchData();
    fetchPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_code, closing_day, payment_day, payment_month_offset')
        .in('partner_type', ['customer', 'both'])
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Partners fetch error:', error);
      toast.error('取引先一覧の取得に失敗しました');
    }
  };

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          *,
          partners!customer_id (id, name, partner_code, closing_day, payment_day, payment_month_offset)
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // ステータスの計算（期限超過チェック + 部分入金判定）
      const today = new Date().toISOString().split('T')[0];
      const processedData = (data || []).map((item) => {
        let status: 'unpaid' | 'partial' | 'paid' | 'overdue';

        if (item.balance <= 0 || item.status === 'paid') {
          status = 'paid';  // 全額入金済み
        } else if (item.received_amount > 0 && item.balance > 0) {
          status = item.due_date < today ? 'overdue' : 'partial';  // 一部入金（期限チェック）
        } else if (item.due_date < today) {
          status = 'overdue';  // 期限超過
        } else {
          status = 'unpaid';  // 未入金
        }

        return {
          ...item,
          status,
        } as AccountsReceivable;
      });

      setReceivables(processedData);
      calculateStats(processedData);
    } catch (error) {
      console.error('Data fetch error:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: AccountsReceivable[]) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const totalUnpaid = data
      .filter(item => item.status !== 'paid')
      .reduce((sum, item) => sum + (item.balance ?? 0), 0);

    const overdueCount = data.filter(item => item.status === 'overdue').length;

    const monthlyReceipt = data
      .filter(item => {
        if (item.status === 'paid') return false;
        const dueDate = new Date(item.due_date);
        return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
      })
      .reduce((sum, item) => sum + (item.balance ?? 0), 0);

    setStats({ totalUnpaid, overdueCount, monthlyReceipt });
  };

  const filteredReceivables = receivables
    .filter(item => {
      // ステータスフィルター
      if (filter !== 'all') {
        if (filter === 'unpaid' && item.status !== 'unpaid') return false;
        if (filter === 'overdue' && item.status !== 'overdue') return false;
        if (filter === 'paid' && item.status !== 'paid') return false;
      }

      // 取引先フィルター
      if (selectedPartner && item.customer_id !== selectedPartner) return false;

      // 日付範囲フィルター
      if (startDate && item.due_date < startDate) return false;
      if (endDate && item.due_date > endDate) return false;

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      if (sortField === 'due_date') {
        comparison = a.due_date.localeCompare(b.due_date);
      } else if (sortField === 'balance') {
        comparison = (a.balance ?? 0) - (b.balance ?? 0);
      } else if (sortField === 'partner_name') {
        comparison = (a.partners?.name ?? '').localeCompare(b.partners?.name ?? '');
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 同じフィールドをクリックしたら方向を反転
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 新しいフィールドは昇順から開始
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const clearFilters = () => {
    setSelectedPartner('');
    setStartDate('');
    setEndDate('');
    setFilter('all');
  };

  // 一括入金機能
  const toggleReceivableSelection = (receivableId: string) => {
    const newSelection = new Set(selectedReceivables);
    if (newSelection.has(receivableId)) {
      newSelection.delete(receivableId);
    } else {
      newSelection.add(receivableId);
    }
    setSelectedReceivables(newSelection);
  };

  const toggleAllReceivables = () => {
    const selectableReceivables = filteredReceivables.filter(
      r => (r.status === 'unpaid' || r.status === 'partial' || r.status === 'overdue') && r.balance > 0
    );

    if (selectedReceivables.size === selectableReceivables.length) {
      // すべて選択されている場合は解除
      setSelectedReceivables(new Set());
    } else {
      // すべて選択
      setSelectedReceivables(new Set(selectableReceivables.map(r => r.id)));
    }
  };

  const handleBatchReceipt = () => {
    if (selectedReceivables.size === 0) {
      toast.error('入金対象を選択してください');
      return;
    }

    // 選択された売掛金IDをカンマ区切りでクエリパラメータに追加
    const receivableIds = Array.from(selectedReceivables).join(',');
    navigate(`/receipt/new?receivable_ids=${receivableIds}&batch=true`);
  };

  const getSelectedTotal = () => {
    return filteredReceivables
      .filter(r => selectedReceivables.has(r.id))
      .reduce((sum, r) => sum + r.balance, 0);
  };

  const formatClosingDaySettings = (partner: Partner | null) => {
    if (!partner || partner.closing_day === null || partner.payment_day === null || partner.payment_month_offset === null) {
      return null;
    }

    const closingDayStr = partner.closing_day === 0 ? '月末' : `${partner.closing_day}日`;
    const paymentDayStr = partner.payment_day === 0 ? '月末' : `${partner.payment_day}日`;
    const offsetStr = partner.payment_month_offset === 0 ? '当月'
                    : partner.payment_month_offset === 1 ? '翌月'
                    : partner.payment_month_offset === 2 ? '翌々月'
                    : `${partner.payment_month_offset}ヶ月後`;

    return `${closingDayStr}締め${offsetStr}${paymentDayStr}払い`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
            <CreditCard className="h-3 w-3 mr-1" />
            入金済
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            <DollarSign className="h-3 w-3 mr-1" />
            一部入金
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            期限超過
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
            <DollarSign className="h-3 w-3 mr-1" />
            未入金
          </span>
        );
      default:
        return null;
    }
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: FilterType; label: string; icon: React.ComponentType<{ className?: string }> }) => (
    <button
      onClick={() => setFilter(type)}
      className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all ${
        filter === type
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
          : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            売掛金管理
          </h1>
          <p className="mt-2 text-gray-600">顧客からの入金を管理します</p>
        </div>
        <div className="flex items-center gap-3">
          <PageManual {...manuals.accountsReceivable} />
          <button
            onClick={() => navigate('/sales-transactions/new')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all"
          >
            <Plus className="h-5 w-5" />
            新規売上伝票登録
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">未入金総額</p>
              <p className="text-3xl font-bold mt-2">¥{stats.totalUnpaid.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <DollarSign className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">期限超過件数</p>
              <p className="text-3xl font-bold mt-2">{stats.overdueCount}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <AlertCircle className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">今月入金予定</p>
              <p className="text-3xl font-bold mt-2">¥{stats.monthlyReceipt.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">フィルター</h2>
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            フィルタークリア
          </button>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <FilterButton type="all" label="すべて" icon={Filter} />
          <FilterButton type="unpaid" label="未入金" icon={DollarSign} />
          <FilterButton type="overdue" label="期限超過" icon={AlertCircle} />
          <FilterButton type="paid" label="入金済" icon={CreditCard} />
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Partner Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              顧客
            </label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">すべての顧客</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name} ({partner.partner_code})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              入金期日（開始）
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              入金期日（終了）
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedReceivables.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                {selectedReceivables.size}件選択中
              </span>
              <span className="text-sm text-gray-600">
                合計: ¥{getSelectedTotal().toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleBatchReceipt}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              一括入金登録
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={toggleAllReceivables}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {selectedReceivables.size > 0 ? (
                      <CheckSquare className="h-5 w-5" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  伝票番号
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('partner_name')}
                    className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                  >
                    顧客名
                    {getSortIcon('partner_name')}
                  </button>
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('due_date')}
                    className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    入金期日
                    {getSortIcon('due_date')}
                  </button>
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  合計金額
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入金済
                </th>
                <th className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleSort('balance')}
                    className="flex items-center justify-end gap-2 w-full text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                  >
                    残高
                    {getSortIcon('balance')}
                  </button>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReceivables.map((receivable) => {
                const isSelectable = (receivable.status === 'unpaid' || receivable.status === 'partial' || receivable.status === 'overdue') && receivable.balance > 0;
                const closingSettings = formatClosingDaySettings(receivable.partners);

                return (
                  <tr
                    key={receivable.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      receivable.status === 'overdue' ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isSelectable && (
                        <button
                          onClick={() => toggleReceivableSelection(receivable.id)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {selectedReceivables.has(receivable.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {receivable.invoice_no || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {receivable.partners?.name || '不明な顧客'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {receivable.partners?.partner_code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm text-gray-900">
                            {new Date(receivable.due_date).toLocaleDateString('ja-JP')}
                          </div>
                          {closingSettings && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Info className="h-3 w-3" />
                              {closingSettings}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ¥{(receivable.total_amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      ¥{(receivable.received_amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      ¥{(receivable.balance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(receivable.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {receivable.status !== 'paid' && receivable.balance > 0 && (
                        <button
                          onClick={() => navigate(`/receipt/new?receivable_id=${receivable.id}`)}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-green-500/30 transition-all"
                        >
                          入金登録
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredReceivables.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">売掛金がありません</h3>
              <p className="mt-1 text-sm text-gray-500">
                フィルター条件を変更してください
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
