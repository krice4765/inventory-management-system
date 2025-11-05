import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Download, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useErrorHandler } from '../hooks/useErrorHandler';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';
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

interface CustomerBalance {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  total_balance: number;
  overdue_balance: number;
  current_balance: number;
  receivable_count: number;
}

interface MonthlyTrend {
  month: string;
  amount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export default function ReceivableReport() {
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [customerBalances, setCustomerBalances] = useState<CustomerBalance[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [totalBalance, setTotalBalance] = useState(0);
  const [overdueBalance, setOverdueBalance] = useState(0);
  const [currentMonthDue, setCurrentMonthDue] = useState(0);

  useEffect(() => {
    fetchReceivables();
  }, [startDate, endDate, selectedCustomer]);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('accounts_receivable')
        .select(`
          id,
          customer_id,
          balance,
          due_date,
          partners!customer_id (
            id,
            name,
            partner_code
          )
        `)
        .gt('balance', 0);

      if (startDate) {
        query = query.gte('due_date', startDate);
      }
      if (endDate) {
        query = query.lte('due_date', endDate);
      }
      if (selectedCustomer) {
        query = query.eq('customer_id', selectedCustomer);
      }

      const { data, error } = await query.order('due_date', { ascending: false });

      if (error) throw error;

      setReceivables(data || []);
      calculateBalances(data || []);
      calculateMonthlyTrends(data || []);
    } catch (error) {
      handleError(error, '売掛金データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = (data: any[]) => {
    const customerMap = new Map<string, CustomerBalance>();
    let total = 0;
    let overdue = 0;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let currentMonthTotal = 0;

    data.forEach((receivable: any) => {
      const customerId = receivable.customer_id;
      const balance = receivable.balance || 0;
      const dueDate = new Date(receivable.due_date);
      const isOverdue = dueDate < today;
      const isCurrentMonth = dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;

      total += balance;
      if (isOverdue) {
        overdue += balance;
      }
      if (isCurrentMonth) {
        currentMonthTotal += balance;
      }

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: receivable.partners?.name || '不明',
          customer_code: receivable.partners?.partner_code || '',
          total_balance: 0,
          overdue_balance: 0,
          current_balance: 0,
          receivable_count: 0,
        });
      }

      const customer = customerMap.get(customerId)!;
      customer.total_balance += balance;
      customer.receivable_count += 1;

      if (isOverdue) {
        customer.overdue_balance += balance;
      } else {
        customer.current_balance += balance;
      }
    });

    setTotalBalance(total);
    setOverdueBalance(overdue);
    setCurrentMonthDue(currentMonthTotal);

    const balances = Array.from(customerMap.values()).sort((a, b) => b.total_balance - a.total_balance);
    setCustomerBalances(balances);
  };

  const calculateMonthlyTrends = (data: any[]) => {
    const monthMap = new Map<string, number>();

    // Get last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }

    data.forEach((receivable: any) => {
      const dueDate = new Date(receivable.due_date);
      const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthMap.has(key)) {
        monthMap.set(key, monthMap.get(key)! + (receivable.balance || 0));
      }
    });

    const trends = Array.from(monthMap.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));

    setMonthlyTrends(trends);
  };

  const exportToCSV = () => {
    const data = customerBalances.map(cb => ({
      '得意先コード': cb.customer_code,
      '得意先名': cb.customer_name,
      '残高合計': cb.total_balance,
      '期限超過額': cb.overdue_balance,
      '正常残高': cb.current_balance,
      '件数': cb.receivable_count,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '売掛金残高');

    const fileName = `売掛金残高レポート_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success('CSVファイルをダウンロードしました');
  };

  const uniqueCustomers = React.useMemo(() => {
    const customerMap = new Map();
    receivables.forEach(r => {
      if (r.partners && !customerMap.has(r.customer_id)) {
        customerMap.set(r.customer_id, {
          id: r.customer_id,
          name: r.partners.name,
          code: r.partners.partner_code,
        });
      }
    });
    return Array.from(customerMap.values());
  }, [receivables]);

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
            <h1 className="text-2xl font-bold text-gray-900">売掛金残高レポート</h1>
            <p className="text-sm text-gray-500 mt-1">得意先別の売掛金残高と推移を分析</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PageManual {...manuals.receivableReport} />
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            CSVエクスポート
          </button>
        </div>
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
                <option key={customer.id} value={customer.id}>
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
              <p className="text-blue-100 text-sm font-medium">総売掛金残高</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalBalance)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">期限超過額</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(overdueBalance)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">当月入金予定</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(currentMonthDue)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-200" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">月別推移</h2>
          {monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="amount" name="売掛金残高" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>

        {/* Customer Distribution Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">得意先別構成比（上位8社）</h2>
          {customerBalances.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={customerBalances.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ customer_name, total_balance }) =>
                    `${customer_name}: ${formatCurrency(total_balance)}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_balance"
                >
                  {customerBalances.slice(0, 8).map((entry, index) => (
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

      {/* Customer Balance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">得意先別残高一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  得意先
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  残高合計
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  期限超過額
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  正常残高
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  件数
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customerBalances.length > 0 ? (
                customerBalances.map((customer) => (
                  <tr key={customer.customer_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{customer.customer_name}</div>
                      <div className="text-xs text-gray-500">{customer.customer_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(customer.total_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      {formatCurrency(customer.overdue_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                      {formatCurrency(customer.current_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {customer.receivable_count}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    売掛金データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Receivables Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">売掛金明細</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入金予定日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  得意先
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  売上金額
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  残高
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receivables.length > 0 ? (
                receivables.map((receivable) => {
                  const isOverdue = new Date(receivable.due_date) < new Date();
                  return (
                    <tr key={receivable.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(receivable.due_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {receivable.partners?.name || '不明'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {receivable.partners?.partner_code || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(receivable.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(receivable.balance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isOverdue ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            期限超過
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    売掛金データがありません
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
