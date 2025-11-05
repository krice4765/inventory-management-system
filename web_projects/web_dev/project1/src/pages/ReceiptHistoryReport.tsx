import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Download, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ReceiptHistory {
  id: string;
  payment_date: string;
  customer_name: string;
  customer_code: string;
  amount: number;
  receipt_method_cash: number;
  receipt_method_check: number;
  receipt_method_note: number;
  receipt_method_bank_transfer: number;
  receipt_method_offset: number;
  notes: string | null;
}

interface MonthlyTrend {
  month: string;
  amount: number;
}

interface ReceiptMethodSummary {
  method: string;
  amount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

const RECEIPT_METHODS = [
  { key: 'receipt_method_cash', label: '現金' },
  { key: 'receipt_method_check', label: '小切手' },
  { key: 'receipt_method_note', label: '手形' },
  { key: 'receipt_method_bank_transfer', label: '銀行振込' },
  { key: 'receipt_method_offset', label: '相殺' },
];

export default function ReceiptHistoryReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistory[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [receiptMethodSummary, setReceiptMethodSummary] = useState<ReceiptMethodSummary[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [totalAmount, setTotalAmount] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [averageAmount, setAverageAmount] = useState(0);

  useEffect(() => {
    fetchReceiptHistory();
  }, [startDate, endDate, selectedCustomer]);

  const fetchReceiptHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('receipt_transactions')
        .select(`
          id,
          payment_date,
          partner_id,
          amount,
          payment_method_cash,
          payment_method_check,
          payment_method_note,
          payment_method_bank_transfer,
          payment_method_offset,
          notes,
          partners!partner_id (
            id,
            name,
            partner_code
          )
        `);

      if (startDate) {
        query = query.gte('payment_date', startDate);
      }
      if (endDate) {
        query = query.lte('payment_date', endDate);
      }
      if (selectedCustomer) {
        query = query.eq('partner_id', selectedCustomer);
      }

      const { data, error } = await query.order('payment_date', { ascending: false });

      if (error) throw error;

      const history: ReceiptHistory[] = (data || []).map((item: any) => ({
        id: item.id,
        payment_date: item.payment_date,
        customer_name: item.partners?.name || '不明',
        customer_code: item.partners?.partner_code || '',
        amount: item.amount || 0,
        receipt_method_cash: item.payment_method_cash || 0,
        receipt_method_check: item.payment_method_check || 0,
        receipt_method_note: item.payment_method_note || 0,
        receipt_method_bank_transfer: item.payment_method_bank_transfer || 0,
        receipt_method_offset: item.payment_method_offset || 0,
        notes: item.notes,
      }));

      setReceiptHistory(history);
      calculateSummaries(history);
      calculateMonthlyTrends(history);
      calculateReceiptMethodSummary(history);
    } catch (error: any) {
      console.error('Error fetching receipt history:', error);
      toast.error('入金履歴データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaries = (history: ReceiptHistory[]) => {
    const total = history.reduce((sum, item) => sum + item.amount, 0);
    const count = history.length;
    const avg = count > 0 ? total / count : 0;

    setTotalAmount(total);
    setTransactionCount(count);
    setAverageAmount(avg);
  };

  const calculateMonthlyTrends = (history: ReceiptHistory[]) => {
    const monthMap = new Map<string, number>();

    // Get last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }

    history.forEach((receipt) => {
      const receiptDate = new Date(receipt.payment_date);
      const key = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthMap.has(key)) {
        monthMap.set(key, monthMap.get(key)! + receipt.amount);
      }
    });

    const trends = Array.from(monthMap.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));

    setMonthlyTrends(trends);
  };

  const calculateReceiptMethodSummary = (history: ReceiptHistory[]) => {
    const methodSummary: Record<string, number> = {};

    RECEIPT_METHODS.forEach(method => {
      methodSummary[method.label] = 0;
    });

    history.forEach(receipt => {
      methodSummary['現金'] += receipt.receipt_method_cash;
      methodSummary['小切手'] += receipt.receipt_method_check;
      methodSummary['手形'] += receipt.receipt_method_note;
      methodSummary['銀行振込'] += receipt.receipt_method_bank_transfer;
      methodSummary['相殺'] += receipt.receipt_method_offset;
    });

    const summary = Object.entries(methodSummary)
      .filter(([_, amount]) => amount > 0)
      .map(([method, amount]) => ({ method, amount }));

    setReceiptMethodSummary(summary);
  };

  const exportToCSV = () => {
    const data = receiptHistory.map(rh => ({
      '入金日': formatDate(rh.payment_date),
      '得意先コード': rh.customer_code,
      '得意先名': rh.customer_name,
      '入金額': rh.amount,
      '現金': rh.receipt_method_cash,
      '小切手': rh.receipt_method_check,
      '手形': rh.receipt_method_note,
      '銀行振込': rh.receipt_method_bank_transfer,
      '相殺': rh.receipt_method_offset,
      '備考': rh.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '入金履歴');

    const fileName = `入金履歴レポート_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success('CSVファイルをダウンロードしました');
  };

  const uniqueCustomers = React.useMemo(() => {
    const customerMap = new Map();
    receiptHistory.forEach(r => {
      if (!customerMap.has(r.customer_code)) {
        customerMap.set(r.customer_code, {
          code: r.customer_code,
          name: r.customer_name,
        });
      }
    });
    return Array.from(customerMap.values());
  }, [receiptHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">入金履歴レポート</h1>
            <p className="text-sm text-gray-500 mt-1">入金取引の履歴と入金方法の分析</p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="h-5 w-5 mr-2" />
          CSVエクスポート
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              得意先
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべての得意先</option>
              {uniqueCustomers.map((customer: any) => (
                <option key={customer.code} value={customer.code}>
                  {customer.code} - {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">総入金額</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalAmount)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">取引件数</p>
              <p className="text-3xl font-bold mt-2">{transactionCount.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">平均入金額</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(averageAmount)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">月別入金推移</h2>
          {monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="amount" name="入金額" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>

        {/* Receipt Method Distribution Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">入金方法別構成比</h2>
          {receiptMethodSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={receiptMethodSummary}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, amount }) =>
                    `${method}: ${formatCurrency(amount)}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {receiptMethodSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>
      </div>

      {/* Receipt Method Summary Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">入金方法別集計</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入金方法
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  構成比
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receiptMethodSummary.length > 0 ? (
                receiptMethodSummary.map((method) => {
                  const percentage = totalAmount > 0 ? (method.amount / totalAmount) * 100 : 0;
                  return (
                    <tr key={method.method} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {method.method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(method.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    入金方法データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt History Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">入金履歴明細</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入金日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  得意先
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入金方法
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  備考
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receiptHistory.length > 0 ? (
                receiptHistory.map((receipt) => {
                  const methods: string[] = [];
                  if (receipt.receipt_method_cash > 0) methods.push(`現金: ${formatCurrency(receipt.receipt_method_cash)}`);
                  if (receipt.receipt_method_check > 0) methods.push(`小切手: ${formatCurrency(receipt.receipt_method_check)}`);
                  if (receipt.receipt_method_note > 0) methods.push(`手形: ${formatCurrency(receipt.receipt_method_note)}`);
                  if (receipt.receipt_method_bank_transfer > 0) methods.push(`振込: ${formatCurrency(receipt.receipt_method_bank_transfer)}`);
                  if (receipt.receipt_method_offset > 0) methods.push(`相殺: ${formatCurrency(receipt.receipt_method_offset)}`);

                  return (
                    <tr key={receipt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(receipt.payment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{receipt.customer_name}</div>
                        <div className="text-xs text-gray-500">{receipt.customer_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(receipt.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="space-y-1">
                          {methods.map((method, index) => (
                            <div key={index} className="text-xs">{method}</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {receipt.notes}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    入金履歴データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
