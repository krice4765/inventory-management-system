import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Download, DollarSign, CreditCard, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

interface PaymentHistory {
  id: string;
  payment_date: string;
  supplier_name: string;
  supplier_code: string;
  amount: number;
  payment_method_cash: number;
  payment_method_check: number;
  payment_method_note: number;
  payment_method_bank_transfer: number;
  payment_method_offset: number;
  notes: string | null;
}

interface PaymentMethodSummary {
  method: string;
  amount: number;
}

interface MonthlyPayment {
  month: string;
  amount: number;
}

export default function PaymentHistoryReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; partner_code: string }[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [paymentMethodSummary, setPaymentMethodSummary] = useState<PaymentMethodSummary[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<MonthlyPayment[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const PAYMENT_METHODS = [
    { key: 'payment_method_cash', label: '現金' },
    { key: 'payment_method_check', label: '小切手' },
    { key: 'payment_method_note', label: '手形' },
    { key: 'payment_method_bank_transfer', label: '銀行振込' },
    { key: 'payment_method_offset', label: '相殺' },
  ];

  useEffect(() => {
    fetchSuppliers();

    // Set default date range (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchPaymentHistory();
    }
  }, [startDate, endDate, selectedSupplier]);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name, partner_code')
      .eq('is_active', true)
      .in('partner_type', ['supplier', 'both'])
      .order('name');

    if (error) {
      toast.error('仕入先の取得に失敗しました');
      console.error('Error fetching suppliers:', error);
      return;
    }

    setSuppliers(data || []);
  };

  const fetchPaymentHistory = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('payment_transactions')
        .select(`
          id,
          payment_date,
          amount,
          payment_method_cash,
          payment_method_check,
          payment_method_note,
          payment_method_bank_transfer,
          payment_method_offset,
          notes,
          partners!partner_id (name, partner_code)
        `)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });

      if (selectedSupplier) {
        query = query.eq('partner_id', selectedSupplier);
      }

      const { data, error } = await query;

      if (error) throw error;

      const history: PaymentHistory[] = (data || []).map((payment: any) => ({
        id: payment.id,
        payment_date: payment.payment_date,
        supplier_name: payment.partners?.name || '不明',
        supplier_code: payment.partners?.partner_code || '',
        amount: payment.amount || 0,
        payment_method_cash: payment.payment_method_cash || 0,
        payment_method_check: payment.payment_method_check || 0,
        payment_method_note: payment.payment_method_note || 0,
        payment_method_bank_transfer: payment.payment_method_bank_transfer || 0,
        payment_method_offset: payment.payment_method_offset || 0,
        notes: payment.notes,
      }));

      setPaymentHistory(history);

      // Calculate total
      const total = history.reduce((sum, payment) => sum + payment.amount, 0);
      setTotalPayments(total);

      // Calculate payment method summary
      const methodSummary: Record<string, number> = {};
      PAYMENT_METHODS.forEach(method => {
        methodSummary[method.label] = 0;
      });

      history.forEach(payment => {
        methodSummary['現金'] += payment.payment_method_cash;
        methodSummary['小切手'] += payment.payment_method_check;
        methodSummary['手形'] += payment.payment_method_note;
        methodSummary['銀行振込'] += payment.payment_method_bank_transfer;
        methodSummary['相殺'] += payment.payment_method_offset;
      });

      const summary = Object.entries(methodSummary)
        .filter(([_, amount]) => amount > 0)
        .map(([method, amount]) => ({ method, amount }));

      setPaymentMethodSummary(summary);

      // Calculate monthly payments (last 6 months)
      const monthMap = new Map<string, number>();
      history.forEach(payment => {
        const date = new Date(payment.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + payment.amount);
      });

      const monthly = Array.from(monthMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyPayments(monthly);
    } catch (error: any) {
      console.error('Error fetching payment history:', error);
      toast.error('支払履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const data = paymentHistory.map(payment => ({
      '支払日': formatDate(payment.payment_date),
      '仕入先コード': payment.supplier_code,
      '仕入先名': payment.supplier_name,
      '支払金額': payment.amount,
      '現金': payment.payment_method_cash,
      '小切手': payment.payment_method_check,
      '手形': payment.payment_method_note,
      '銀行振込': payment.payment_method_bank_transfer,
      '相殺': payment.payment_method_offset,
      '備考': payment.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '支払履歴');

    const fileName = `支払履歴レポート_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success('CSVファイルをダウンロードしました');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading && paymentHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('/accounts-payable')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            買掛金一覧に戻る
          </button>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            支払履歴レポート
          </h1>
          <p className="mt-2 text-sm text-gray-600">支払実績を分析します</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={paymentHistory.length === 0}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 transition-all"
        >
          <Download className="w-4 h-4 mr-2" />
          CSVエクスポート
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">フィルター</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              仕入先
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">すべての仕入先</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.partner_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <DollarSign className="w-8 h-8 text-green-100" />
          <span className="text-green-100 text-sm">支払件数: {paymentHistory.length}件</span>
        </div>
        <p className="text-green-100 text-sm">支払総額</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(totalPayments)}</p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        {monthlyPayments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-green-600" />
              月次推移
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyPayments}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="amount" name="支払金額" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Payment Method Distribution */}
        {paymentMethodSummary.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-green-600" />
              支払方法別構成比
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodSummary}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, amount }) => `${method}: ${formatCurrency(amount)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {paymentMethodSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Payment History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">支払履歴一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  支払日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  仕入先
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  支払方法内訳
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paymentHistory.map((payment) => {
                const methods: string[] = [];
                if (payment.payment_method_cash > 0) methods.push(`現金: ${formatCurrency(payment.payment_method_cash)}`);
                if (payment.payment_method_check > 0) methods.push(`小切手: ${formatCurrency(payment.payment_method_check)}`);
                if (payment.payment_method_note > 0) methods.push(`手形: ${formatCurrency(payment.payment_method_note)}`);
                if (payment.payment_method_bank_transfer > 0) methods.push(`振込: ${formatCurrency(payment.payment_method_bank_transfer)}`);
                if (payment.payment_method_offset > 0) methods.push(`相殺: ${formatCurrency(payment.payment_method_offset)}`);

                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.supplier_name}</div>
                      <div className="text-xs text-gray-500">{payment.supplier_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="space-y-1">
                        {methods.map((method, index) => (
                          <div key={index} className="text-xs">{method}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* No Data Message */}
      {!loading && paymentHistory.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">指定期間のデータがありません</p>
        </div>
      )}
    </div>
  );
}
