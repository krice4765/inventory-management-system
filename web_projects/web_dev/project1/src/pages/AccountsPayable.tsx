import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { supabase } from '../lib/supabase';
import { Calendar, AlertCircle, TrendingUp, DollarSign, Filter, CreditCard, Info, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { ExpenseCategory, EXPENSE_CATEGORIES } from '../types/purchase';
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

interface AccountsPayable {
  id: string;
  invoice_no: string;
  supplier_id: string;
  purchase_transaction_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  due_date: string;
  invoice_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  created_at: string;
  partners: Partner;
  purchase_transactions?: {
    expense_category: ExpenseCategory;
  };
  // 新規追加フィールド
  document_number?: string;
  expense_category?: string;
  planned_payment_date?: string;
  payment_method?: 'bank_transfer' | 'promissory_note' | 'cash' | 'card';
  approved_by?: string;
  approved_at?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
  source_table?: string;
}

type FilterType = 'all' | 'unpaid' | 'overdue' | 'paid';
type SortField = 'due_date' | 'balance' | 'partner_name';
type SortDirection = 'asc' | 'desc';

export default function AccountsPayable() {
  const navigate = useNavigate();
  const location = useLocation();
  const { savePageState, restorePageState } = usePageState();

  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  // フィルター状態
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<ExpenseCategory | ''>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<string>('');
  const [searchDocumentNumber, setSearchDocumentNumber] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [partners, setPartners] = useState<Partner[]>([]);

  // ソート状態
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 一括支払選択状態
  const [selectedPayables, setSelectedPayables] = useState<Set<string>>(new Set());

  // サマリー統計
  const [stats, setStats] = useState({
    totalUnpaid: 0,
    overdueCount: 0,
    monthlyPayment: 0,
  });

  // ページ読み込み時に状態を復元
  useEffect(() => {
    const restored = restorePageState();
    if (restored && restored.filters) {
      const filters = restored.filters;
      if (filters.filter) setFilter(filters.filter);
      if (filters.selectedPartner) setSelectedPartner(filters.selectedPartner);
      if (filters.selectedExpenseCategory) setSelectedExpenseCategory(filters.selectedExpenseCategory);
      if (filters.selectedPaymentMethod) setSelectedPaymentMethod(filters.selectedPaymentMethod);
      if (filters.selectedApprovalStatus) setSelectedApprovalStatus(filters.selectedApprovalStatus);
      if (filters.searchDocumentNumber) setSearchDocumentNumber(filters.searchDocumentNumber);
      if (filters.startDate) setStartDate(filters.startDate);
      if (filters.endDate) setEndDate(filters.endDate);
      if (filters.showFilters !== undefined) setShowFilters(filters.showFilters);
    }
  }, []);

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
        .in('partner_type', ['supplier', 'both'])
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
        .from('accounts_payable')
        .select(`
          *,
          partners (id, name, partner_code, closing_day, payment_day, payment_month_offset)
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // ステータスの計算（期限超過チェック + 部分支払判定）
      const today = new Date().toISOString().split('T')[0];
      const processedData = (data || []).map((item) => {
        let status: 'unpaid' | 'partial' | 'paid' | 'overdue';

        if (item.balance <= 0 || item.status === 'paid') {
          status = 'paid';  // 全額支払済み
        } else if (item.paid_amount > 0 && item.balance > 0) {
          status = item.due_date < today ? 'overdue' : 'partial';  // 一部支払（期限チェック）
        } else if (item.due_date < today) {
          status = 'overdue';  // 期限超過
        } else {
          status = 'unpaid';  // 未払い
        }

        return {
          ...item,
          status,
        } as AccountsPayable;
      });

      setPayables(processedData);
      calculateStats(processedData);
    } catch (error) {
      console.error('Data fetch error:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: AccountsPayable[]) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const totalUnpaid = data
      .filter(item => item.status !== 'paid')
      .reduce((sum, item) => sum + (item.balance ?? 0), 0);

    const overdueCount = data.filter(item => item.status === 'overdue').length;

    const monthlyPayment = data
      .filter(item => {
        if (item.status === 'paid') return false;
        const dueDate = new Date(item.due_date);
        return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
      })
      .reduce((sum, item) => sum + (item.balance ?? 0), 0);

    setStats({ totalUnpaid, overdueCount, monthlyPayment });
  };

  // フィルター適用後のデータ
  const filteredPayables = useMemo(() => {
    return payables
      .filter(item => {
        // ステータスフィルター
        if (filter !== 'all') {
          if (filter === 'unpaid' && item.status !== 'unpaid') return false;
          if (filter === 'overdue' && item.status !== 'overdue') return false;
          if (filter === 'paid' && item.status !== 'paid') return false;
        }

        // 取引先フィルター
        if (selectedPartner && item.supplier_id !== selectedPartner) return false;

        // 日付範囲フィルター
        if (startDate && item.due_date < startDate) return false;
        if (endDate && item.due_date > endDate) return false;

        // 伝票番号検索フィルター
        if (searchDocumentNumber && !item.document_number?.includes(searchDocumentNumber)) return false;

        // 経費科目フィルター
        if (selectedExpenseCategory && item.expense_category !== selectedExpenseCategory) return false;

        // 支払方法フィルター
        if (selectedPaymentMethod && item.payment_method !== selectedPaymentMethod) return false;

        // 承認状況フィルター
        if (selectedApprovalStatus && item.approval_status !== selectedApprovalStatus) return false;

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
  }, [payables, filter, selectedPartner, startDate, endDate, searchDocumentNumber, selectedExpenseCategory, selectedPaymentMethod, selectedApprovalStatus, sortField, sortDirection]);

  // 仕入先オプションをメモ化
  const partnerOptions = useMemo(() => {
    if (!partners) return [];
    return partners.map(partner => ({
      value: partner.id,
      label: `${partner.name} (${partner.partner_code})`
    }));
  }, [partners]);

  // アクティブなフィルター数（伝票番号検索は常時表示なので除外）
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter !== 'all') count++;
    if (selectedPartner) count++;
    if (selectedExpenseCategory) count++;
    if (selectedPaymentMethod) count++;
    if (selectedApprovalStatus) count++;
    if (startDate || endDate) count++;
    return count;
  }, [filter, selectedPartner, selectedExpenseCategory, selectedPaymentMethod, selectedApprovalStatus, startDate, endDate]);

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
    setSelectedExpenseCategory('');
    setSelectedPaymentMethod('');
    setSelectedApprovalStatus('');
    setSearchDocumentNumber('');
    setFilter('all');
  };

  // 詳細ページへの遷移（状態保存付き）
  const handleNavigateToDetail = (transactionId: string) => {
    // 現在のフィルター状態を保存
    const savedState = {
      filters: {
        filter,
        selectedPartner,
        selectedExpenseCategory,
        selectedPaymentMethod,
        selectedApprovalStatus,
        searchDocumentNumber,
        startDate,
        endDate,
        showFilters,
      }
    };

    savePageState(savedState);

    // 詳細ページへ遷移（戻り先パスを含む）
    navigate(`/transactions/${transactionId}`, {
      state: {
        ...savedState,
        fromPath: '/accounts-payable',
      }
    });
  };

  // 一括支払機能
  const togglePayableSelection = (payableId: string) => {
    const newSelection = new Set(selectedPayables);
    if (newSelection.has(payableId)) {
      newSelection.delete(payableId);
    } else {
      newSelection.add(payableId);
    }
    setSelectedPayables(newSelection);
  };

  const toggleAllPayables = () => {
    const selectablePayables = filteredPayables.filter(
      p => (p.status === 'unpaid' || p.status === 'partial' || p.status === 'overdue') && p.balance > 0
    );

    if (selectedPayables.size === selectablePayables.length) {
      // すべて選択されている場合は解除
      setSelectedPayables(new Set());
    } else {
      // すべて選択
      setSelectedPayables(new Set(selectablePayables.map(p => p.id)));
    }
  };

  const handleBatchPayment = () => {
    if (selectedPayables.size === 0) {
      toast.error('支払対象を選択してください');
      return;
    }

    // 選択された買掛金IDをカンマ区切りでクエリパラメータに追加
    const payableIds = Array.from(selectedPayables).join(',');
    navigate(`/payment/new?payable_ids=${payableIds}&batch=true`);
  };

  const getSelectedTotal = () => {
    return filteredPayables
      .filter(p => selectedPayables.has(p.id))
      .reduce((sum, p) => sum + p.balance, 0);
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
          <span className="px-2 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800">
            支払済
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800">
            一部支払
          </span>
        );
      case 'overdue':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-md bg-red-100 text-red-800">
            期限超過
          </span>
        );
      case 'unpaid':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-md bg-yellow-100 text-yellow-800">
            未払い
          </span>
        );
      default:
        return null;
    }
  };

  // FilterButtonは使用しないため削除

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">買掛金管理</h1>
            <p className="text-blue-100 mt-1 font-inter text-sm">仕入先への支払いを管理</p>
          </div>
          <PageManual {...manuals.accountsPayable} />
        </div>
      </div>

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">未払い総額</p>
              <p className="text-2xl font-bold text-red-600 mt-1">¥{stats.totalUnpaid.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <DollarSign className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">期限超過件数</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{stats.overdueCount}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">今月支払予定</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">¥{stats.monthlyPayment.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* フィルターセクション */}
      <div className="bg-white rounded-xl shadow-md p-6">
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
            placeholder="伝票番号で検索..."
            value={searchDocumentNumber}
            onChange={(e) => setSearchDocumentNumber(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
          />
          {searchDocumentNumber && (
            <button
              onClick={() => setSearchDocumentNumber('')}
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
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterType)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  <option value="unpaid">未払い</option>
                  <option value="overdue">期限超過</option>
                  <option value="paid">支払済み</option>
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
                  value={partnerOptions.find(opt => opt.value === selectedPartner) || null}
                  onChange={(option) => setSelectedPartner(option?.value || '')}
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

            {/* 第2行: 経費科目と支払方法 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  経費科目
                </label>
                <input
                  type="text"
                  placeholder="例: 原材料費、消耗品費"
                  value={selectedExpenseCategory}
                  onChange={(e) => setSelectedExpenseCategory(e.target.value as ExpenseCategory | '')}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  支払方法
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="">すべて</option>
                  <option value="bank_transfer">銀行振込</option>
                  <option value="promissory_note">手形</option>
                  <option value="cash">現金</option>
                  <option value="card">カード</option>
                </select>
              </div>
            </div>

            {/* 第3行: 承認状況 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  承認状況
                </label>
                <select
                  value={selectedApprovalStatus}
                  onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="">すべて</option>
                  <option value="pending">未承認</option>
                  <option value="approved">承認済</option>
                  <option value="rejected">却下</option>
                </select>
              </div>
            </div>

            {/* 第4行: 日付範囲 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  支払期限（開始）
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  支払期限（終了）
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
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

        {/* 検索結果表示 */}
        <p className="text-sm text-gray-500 mt-4">
          {filteredPayables.length}件の買掛金が見つかりました
        </p>
      </div>

      {/* 一括支払いバー */}
      {selectedPayables.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                {selectedPayables.size}件を選択中
              </span>
              <span className="text-sm text-gray-600">
                合計: <span className="font-semibold text-blue-600">¥{getSelectedTotal().toLocaleString()}</span>
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPayables(new Set())}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors font-medium"
              >
                選択解除
              </button>
              <button
                onClick={handleBatchPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                一括支払登録
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 買掛金一覧テーブル */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">買掛金一覧</h2>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-gradient-to-b from-slate-50 to-slate-100 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  <button
                    onClick={toggleAllPayables}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="すべて選択/解除"
                  >
                    {selectedPayables.size > 0 && selectedPayables.size === filteredPayables.filter(
                      p => (p.status === 'unpaid' || p.status === 'partial' || p.status === 'overdue') && p.balance > 0
                    ).length ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('partner_name')}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    仕入先
                    {getSortIcon('partner_name')}
                  </div>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  伝票番号
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  請求日
                </th>
                <th
                  onClick={() => handleSort('due_date')}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    支払期限
                    {getSortIcon('due_date')}
                  </div>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  支払予定日
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  金額
                </th>
                <th
                  onClick={() => handleSort('balance')}
                  className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    残高
                    {getSortIcon('balance')}
                  </div>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  科目
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  支払方法
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  承認状況
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  ステータス
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 whitespace-nowrap">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPayables.map((payable, index) => {
                const isSelectable = (payable.status === 'unpaid' || payable.status === 'partial' || payable.status === 'overdue') && payable.balance > 0;
                const isSelected = selectedPayables.has(payable.id);

                return (
                  <tr key={payable.id} className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                      {isSelectable ? (
                        <button
                          onClick={() => togglePayableSelection(payable.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <div className="h-4 w-4"></div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      <div className="font-medium">{payable.partners?.name ?? '不明'}</div>
                      <div className="text-slate-500">{payable.partners?.partner_code ?? '-'}</div>
                    </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {payable.document_number ? (
                      <button
                        onClick={() => handleNavigateToDetail(payable.purchase_transaction_id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {payable.document_number}
                      </button>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {new Date(payable.invoice_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
                  </td>
                  <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap">
                    <div className={`font-medium ${
                      payable.status === 'overdue' ? 'text-red-600' : 'text-slate-700'
                    }`}>
                      {new Date(payable.due_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
                    </div>
                    {formatClosingDaySettings(payable.partners) && (
                      <div className="text-slate-500 text-[10px] mt-0.5">
                        {formatClosingDaySettings(payable.partners)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {payable.planned_payment_date ? new Date(payable.planned_payment_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                    ¥{(payable.total_amount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                    ¥{(payable.balance ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {payable.expense_category ? (
                      <>
                        {EXPENSE_CATEGORIES.find(cat => cat.code === payable.expense_category)?.icon || ''}{' '}
                        {EXPENSE_CATEGORIES.find(cat => cat.code === payable.expense_category)?.label || payable.expense_category}
                      </>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {payable.payment_method === 'bank_transfer' ? '銀行振込' :
                     payable.payment_method === 'promissory_note' ? '手形' :
                     payable.payment_method === 'cash' ? '現金' :
                     payable.payment_method === 'card' ? 'カード' : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap text-center">
                    {payable.approval_status === 'approved' ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800">承認済</span>
                    ) : payable.approval_status === 'rejected' ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-md bg-red-100 text-red-800">却下</span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-md bg-yellow-100 text-yellow-800">未承認</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap text-center">
                    {getStatusBadge(payable.status)}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-center">
                    {(payable.status === 'unpaid' || payable.status === 'partial' || payable.status === 'overdue') && payable.balance > 0 && (
                      <button
                        onClick={() => navigate(`/payment/new?payable_id=${payable.id}`)}
                        className="px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                      >
                        納品
                      </button>
                    )}
                    {payable.status === 'paid' && (
                      <span className="px-2 py-1 text-xs text-slate-400">完了</span>
                    )}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
