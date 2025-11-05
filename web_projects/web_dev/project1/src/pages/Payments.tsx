import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, DollarSign, Filter, CreditCard, Building2, Check, TrendingUp, Search, X, FileText, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentTransaction {
  id: string;
  transaction_type: string;
  payment_method: 'cash' | 'bank_transfer' | 'check' | 'offset';
  amount: number;
  payment_date: string;
  bank_name: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
  partner_name: string;
  partner_code: string;
  partner_id: string;
  invoice_no: string | null;
  // Phase 1: 複数支払方法
  payment_method_cash: number;
  payment_method_check: number;
  payment_method_note: number;
  payment_method_bank_transfer: number;
  payment_method_offset: number;
  discount_amount: number;
  other_amount: number;
  transaction_fee: number;
  issuing_bank_name: string | null;
  payee_bank_name: string | null;
}

interface Partner {
  id: string;
  name: string;
  partner_code: string;
}

type PeriodFilter = 'all' | 'this_month' | 'last_month' | 'custom';

export default function Payments() {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PeriodFilter>('this_month');

  // Search filters
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Payment detail modal
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Summary statistics
  const [stats, setStats] = useState({
    totalAmount: 0,
    thisMonthAmount: 0,
    paymentCount: 0,
    byMethod: {
      cash: 0,
      bank_transfer: 0,
      check: 0,
      offset: 0,
    },
  });

  useEffect(() => {
    fetchPayments();
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_code')
        .in('partner_type', ['supplier', 'both'])
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('仕入先一覧の取得に失敗しました');
    }
  };

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          transaction_type,
          payment_method,
          amount,
          payment_date,
          bank_name,
          reference_no,
          notes,
          created_at,
          partner_id,
          payment_method_cash,
          payment_method_check,
          payment_method_note,
          payment_method_bank_transfer,
          payment_method_offset,
          discount_amount,
          other_amount,
          transaction_fee,
          issuing_bank_name,
          payee_bank_name,
          partners!partner_id (name, partner_code),
          accounts_payable!accounts_payable_id (invoice_no)
        `)
        .eq('transaction_type', 'payable')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to flat structure
      const transformedData: PaymentTransaction[] = (data || []).map((item) => ({
        id: item.id,
        transaction_type: item.transaction_type,
        payment_method: item.payment_method,
        amount: parseFloat(item.amount),
        payment_date: item.payment_date,
        bank_name: item.bank_name,
        reference_no: item.reference_no,
        notes: item.notes,
        created_at: item.created_at,
        partner_id: item.partner_id,
        partner_name: item.partners?.name || '不明',
        partner_code: item.partners?.partner_code || '-',
        invoice_no: item.accounts_payable?.invoice_no || null,
        // Phase 1: 複数支払方法
        payment_method_cash: parseFloat(item.payment_method_cash || 0),
        payment_method_check: parseFloat(item.payment_method_check || 0),
        payment_method_note: parseFloat(item.payment_method_note || 0),
        payment_method_bank_transfer: parseFloat(item.payment_method_bank_transfer || 0),
        payment_method_offset: parseFloat(item.payment_method_offset || 0),
        discount_amount: parseFloat(item.discount_amount || 0),
        other_amount: parseFloat(item.other_amount || 0),
        transaction_fee: parseFloat(item.transaction_fee || 0),
        issuing_bank_name: item.issuing_bank_name,
        payee_bank_name: item.payee_bank_name,
      }));

      setPayments(transformedData);
      calculateStats(transformedData);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('支払履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: PaymentTransaction[]) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
    const paymentCount = data.length;

    const thisMonthAmount = data
      .filter(item => {
        const paymentDate = new Date(item.payment_date);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      })
      .reduce((sum, item) => sum + item.amount, 0);

    const byMethod = {
      cash: data.filter(item => item.payment_method === 'cash').reduce((sum, item) => sum + item.amount, 0),
      bank_transfer: data.filter(item => item.payment_method === 'bank_transfer').reduce((sum, item) => sum + item.amount, 0),
      check: data.filter(item => item.payment_method === 'check').reduce((sum, item) => sum + item.amount, 0),
      offset: data.filter(item => item.payment_method === 'offset').reduce((sum, item) => sum + item.amount, 0),
    };

    setStats({ totalAmount, thisMonthAmount, paymentCount, byMethod });
  };

  const getFilteredPayments = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let filtered = payments;

    // Period filter
    switch (filter) {
      case 'this_month':
        filtered = filtered.filter(item => {
          const paymentDate = new Date(item.payment_date);
          return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
        });
        break;
      case 'last_month':
        filtered = filtered.filter(item => {
          const paymentDate = new Date(item.payment_date);
          return paymentDate.getMonth() === lastMonth && paymentDate.getFullYear() === lastMonthYear;
        });
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          filtered = filtered.filter(item => {
            const paymentDate = new Date(item.payment_date);
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            return paymentDate >= start && paymentDate <= end;
          });
        }
        break;
      case 'all':
      default:
        // No period filter
        break;
    }

    // Supplier filter
    if (selectedSupplier) {
      filtered = filtered.filter(item => item.partner_id === selectedSupplier);
    }

    // Payment method filter
    if (selectedPaymentMethod) {
      filtered = filtered.filter(item => item.payment_method === selectedPaymentMethod);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      const min = minAmount ? parseFloat(minAmount) : 0;
      const max = maxAmount ? parseFloat(maxAmount) : Infinity;
      filtered = filtered.filter(item => item.amount >= min && item.amount <= max);
    }

    return filtered;
  };

  const filteredPayments = getFilteredPayments();

  const resetFilters = () => {
    setSelectedSupplier('');
    setSelectedPaymentMethod('');
    setMinAmount('');
    setMaxAmount('');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilter('this_month');
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return '現金';
      case 'bank_transfer': return '銀行振込';
      case 'check': return '小切手';
      case 'offset': return '相殺';
      default: return method;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <DollarSign className="h-4 w-4" />;
      case 'bank_transfer': return <Building2 className="h-4 w-4" />;
      case 'check': return <Check className="h-4 w-4" />;
      case 'offset': return <CreditCard className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const FilterButton = ({ type, label }: { type: PeriodFilter; label: string }) => (
    <button
      onClick={() => setFilter(type)}
      className={`px-4 py-2 rounded-xl font-medium transition-all ${
        filter === type
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
          : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
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
            支払履歴
          </h1>
          <p className="mt-2 text-gray-600">仕入先への支払記録を確認します</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">総支払額</p>
              <p className="text-3xl font-bold mt-2">¥{stats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <DollarSign className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">今月の支払額</p>
              <p className="text-3xl font-bold mt-2">¥{stats.thisMonthAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">支払件数</p>
              <p className="text-3xl font-bold mt-2">{stats.paymentCount}</p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <CreditCard className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Summary */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">支払方法別集計</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.byMethod).map(([method, amount]) => (
            <div key={method} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                {getPaymentMethodIcon(method)}
                <span className="text-sm font-medium text-gray-700">
                  {getPaymentMethodLabel(method)}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-900">
                ¥{amount.toLocaleString()}
              </span>
            </div>
          ))}
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
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
          >
            <Search className="h-4 w-4" />
            {showFilters ? '詳細検索を閉じる' : '詳細検索'}
          </button>
        </div>

        {/* Basic Period Filter */}
        <div className="flex flex-wrap gap-3 mb-4">
          <FilterButton type="this_month" label="今月" />
          <FilterButton type="last_month" label="先月" />
          <FilterButton type="custom" label="期間指定" />
          <FilterButton type="all" label="全期間" />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Supplier Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  仕入先
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
                >
                  <option value="">すべて</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.partner_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  支払方法
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
                >
                  <option value="">すべて</option>
                  <option value="cash">現金</option>
                  <option value="bank_transfer">銀行振込</option>
                  <option value="check">小切手</option>
                  <option value="offset">相殺</option>
                </select>
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  金額範囲
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="最小"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
                  />
                  <span className="flex items-center text-gray-500">〜</span>
                  <input
                    type="number"
                    placeholder="最大"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
                  />
                </div>
              </div>

              {/* Custom Date Range */}
              {filter === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      開始日
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      終了日
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Reset Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                <X className="h-4 w-4" />
                フィルターをクリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-2xl font-bold text-gray-900">支払一覧</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filteredPayments.length}件の支払記録
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  支払日
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  仕入先
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  請求番号
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  支払方法
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  参照番号
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(payment.payment_date).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{payment.partner_name}</div>
                    <div className="text-sm text-gray-500">{payment.partner_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{payment.invoice_no || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getPaymentMethodIcon(payment.payment_method)}
                      <span className="text-sm font-medium text-gray-700">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-mono font-bold text-gray-900">
                      ¥{payment.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{payment.reference_no || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => {
                        setSelectedPayment(payment);
                        setShowDetailModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Eye className="h-4 w-4" />
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">支払詳細</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {new Date(selectedPayment.payment_date).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">仕入先</p>
                  <p className="text-lg font-bold text-gray-900">{selectedPayment.partner_name}</p>
                  <p className="text-sm text-gray-500">{selectedPayment.partner_code}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">支払金額</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ¥{selectedPayment.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">支払方法詳細</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedPayment.payment_method_cash > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">現金</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.payment_method_cash.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.payment_method_bank_transfer > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">銀行振込</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.payment_method_bank_transfer.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.payment_method_check > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">小切手</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.payment_method_check.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.payment_method_note > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">手形</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.payment_method_note.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.payment_method_offset > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">相殺</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.payment_method_offset.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.discount_amount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">値引き</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.discount_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.other_amount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">その他</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ¥{selectedPayment.other_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayment.transaction_fee > 0 && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-700">振込手数料</span>
                      </div>
                      <span className="text-sm font-bold text-yellow-900">
                        ¥{selectedPayment.transaction_fee.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">その他の情報</h3>
                {selectedPayment.issuing_bank_name && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">振出銀行</p>
                    <p className="text-gray-900">{selectedPayment.issuing_bank_name}</p>
                  </div>
                )}
                {selectedPayment.payee_bank_name && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">支払先銀行</p>
                    <p className="text-gray-900">{selectedPayment.payee_bank_name}</p>
                  </div>
                )}
                {selectedPayment.reference_no && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">参照番号</p>
                    <p className="text-gray-900">{selectedPayment.reference_no}</p>
                  </div>
                )}
                {selectedPayment.notes && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">備考</p>
                    <p className="text-gray-900">{selectedPayment.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-8 py-4 rounded-b-2xl border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
