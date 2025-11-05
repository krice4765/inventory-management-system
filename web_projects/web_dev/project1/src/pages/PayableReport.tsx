import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Download, TrendingUp, Clock, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { useErrorHandler } from '../hooks/useErrorHandler';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

interface SupplierBalance {
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  total_balance: number;
  overdue_balance: number;
  current_balance: number;
  payable_count: number;
}

interface MonthlyTrend {
  month: string;
  amount: number;
}

export default function PayableReport() {
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; partner_code: string }[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [supplierBalances, setSupplierBalances] = useState<SupplierBalance[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [overdueBalance, setOverdueBalance] = useState(0);
  const [currentMonthDue, setCurrentMonthDue] = useState(0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
      fetchReportData();
    }
  }, [startDate, endDate, selectedSupplier]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_code')
        .eq('is_active', true)
        .in('partner_type', ['supplier', 'both'])
        .order('name');

      if (error) throw error;

      setSuppliers(data || []);
    } catch (error) {
      handleError(error, '仕入先の取得に失敗しました');
    }
  };

  const fetchReportData = async () => {
    setLoading(true);

    try {
      // Fetch supplier balances
      let query = supabase
        .from('accounts_payable')
        .select(`
          id,
          supplier_id,
          total_amount,
          paid_amount,
          balance,
          status,
          due_date,
          partners!supplier_id (name, partner_code)
        `)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .neq('status', 'paid');

      if (selectedSupplier) {
        query = query.eq('supplier_id', selectedSupplier);
      }

      const { data: payables, error: payablesError } = await query;

      if (payablesError) throw payablesError;

      // Calculate supplier balances
      const supplierMap = new Map<string, SupplierBalance>();
      let total = 0;
      let overdue = 0;

      payables?.forEach((payable: any) => {
        const supplierId = payable.supplier_id;
        const balance = payable.balance || 0;
        const isOverdue = new Date(payable.due_date) < new Date();

        total += balance;
        if (isOverdue) {
          overdue += balance;
        }

        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: payable.partners?.name || '不明',
            supplier_code: payable.partners?.partner_code || '',
            total_balance: 0,
            overdue_balance: 0,
            current_balance: 0,
            payable_count: 0,
          });
        }

        const supplier = supplierMap.get(supplierId)!;
        supplier.total_balance += balance;
        supplier.payable_count += 1;

        if (isOverdue) {
          supplier.overdue_balance += balance;
        } else {
          supplier.current_balance += balance;
        }
      });

      setSupplierBalances(Array.from(supplierMap.values()).sort((a, b) => b.total_balance - a.total_balance));
      setTotalBalance(total);
      setOverdueBalance(overdue);

      // Calculate current month due
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const currentMonthPayables = payables?.filter((p: any) => {
        const dueDate = new Date(p.due_date);
        return dueDate >= currentMonthStart && dueDate <= currentMonthEnd;
      });

      const currentMonthTotal = currentMonthPayables?.reduce((sum: number, p: any) => sum + (p.balance || 0), 0) || 0;
      setCurrentMonthDue(currentMonthTotal);

      // Fetch monthly trends (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: trendsData, error: trendsError } = await supabase
        .from('accounts_payable')
        .select('due_date, balance')
        .gte('due_date', sixMonthsAgo.toISOString().split('T')[0])
        .neq('status', 'paid');

      if (trendsError) throw trendsError;

      // Group by month
      const monthMap = new Map<string, number>();
      trendsData?.forEach((item: any) => {
        const date = new Date(item.due_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (item.balance || 0));
      });

      const trends = Array.from(monthMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyTrends(trends);
    } catch (error) {
      handleError(error, 'レポートデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };;

  const exportToCSV = () => {
    const data = supplierBalances.map(sb => ({
      '仕入先コード': sb.supplier_code,
      '仕入先名': sb.supplier_name,
      '残高合計': sb.total_balance,
      '期限超過額': sb.overdue_balance,
      '正常残高': sb.current_balance,
      '件数': sb.payable_count,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '買掛金残高');

    const fileName = `買掛金残高レポート_${new Date().toISOString().split('T')[0]}.xlsx`;
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

  if (loading && supplierBalances.length === 0) {
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
            買掛金残高レポート
          </h1>
          <p className="mt-2 text-sm text-gray-600">仕入先別の買掛金残高を分析します</p>
        </div>
        <div className="flex items-center gap-3">
          <PageManual {...manuals.payableReport} />
          <button
            onClick={exportToCSV}
            disabled={supplierBalances.length === 0}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            CSVエクスポート
          </button>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-green-100" />
          </div>
          <p className="text-green-100 text-sm">未払総額</p>
          <p className="text-4xl font-bold mt-2">{formatCurrency(totalBalance)}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-red-100" />
          </div>
          <p className="text-red-100 text-sm">期限超過額</p>
          <p className="text-4xl font-bold mt-2">{formatCurrency(overdueBalance)}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-blue-100" />
          </div>
          <p className="text-blue-100 text-sm">今月支払予定</p>
          <p className="text-4xl font-bold mt-2">{formatCurrency(currentMonthDue)}</p>
        </div>
      </div>

      {/* Charts */}
      {monthlyTrends.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            月次推移（過去6ヶ月）
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="amount" name="買掛金残高" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Supplier Balance Table & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        {supplierBalances.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">仕入先別構成比</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={supplierBalances.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ supplier_name, total_balance }) =>
                    `${supplier_name}: ${formatCurrency(total_balance)}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total_balance"
                >
                  {supplierBalances.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">仕入先別残高一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    仕入先
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    残高合計
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    期限超過
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    件数
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {supplierBalances.map((supplier) => (
                  <tr key={supplier.supplier_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{supplier.supplier_name}</div>
                      <div className="text-xs text-gray-500">{supplier.supplier_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(supplier.total_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                      {formatCurrency(supplier.overdue_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {supplier.payable_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* No Data Message */}
      {!loading && supplierBalances.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">指定期間のデータがありません</p>
        </div>
      )}
    </div>
  );
}
