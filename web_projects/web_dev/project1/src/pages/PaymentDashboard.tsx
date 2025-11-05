import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  PieChart,
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import PaymentTrendChart from '../components/charts/PaymentTrendChart';

interface PaymentStats {
  currentMonth: number;
  previousMonth: number;
  yearToDate: number;
  percentageChange: number;
}

interface MonthlyTrend {
  month: string;
  amount: number;
}

interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  percentage: number;
}

interface SupplierRanking {
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  paymentCount: number;
}

export default function PaymentDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PaymentStats>({
    currentMonth: 0,
    previousMonth: 0,
    yearToDate: 0,
    percentageChange: 0,
  });
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBreakdown[]>([]);
  const [supplierRankings, setSupplierRankings] = useState<SupplierRanking[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'6months' | '12months'>('6months');

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchMonthlyTrend(),
        fetchPaymentMethodBreakdown(),
        fetchSupplierRankings(),
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('ダッシュボードデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const currentMonthEnd = endOfMonth(today);
    const previousMonthStart = startOfMonth(subMonths(today, 1));
    const previousMonthEnd = endOfMonth(subMonths(today, 1));
    const yearStart = new Date(today.getFullYear(), 0, 1);

    try {
      // Current month total
      const { data: currentMonthData, error: currentMonthError } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('transaction_type', 'payable')
        .gte('payment_date', currentMonthStart.toISOString().split('T')[0])
        .lte('payment_date', currentMonthEnd.toISOString().split('T')[0]);

      if (currentMonthError) throw currentMonthError;

      const currentMonthTotal = (currentMonthData || []).reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );

      // Previous month total
      const { data: previousMonthData, error: previousMonthError } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('transaction_type', 'payable')
        .gte('payment_date', previousMonthStart.toISOString().split('T')[0])
        .lte('payment_date', previousMonthEnd.toISOString().split('T')[0]);

      if (previousMonthError) throw previousMonthError;

      const previousMonthTotal = (previousMonthData || []).reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );

      // Year to date total
      const { data: ytdData, error: ytdError } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('transaction_type', 'payable')
        .gte('payment_date', yearStart.toISOString().split('T')[0]);

      if (ytdError) throw ytdError;

      const ytdTotal = (ytdData || []).reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );

      const percentageChange =
        previousMonthTotal > 0
          ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
          : 0;

      setStats({
        currentMonth: currentMonthTotal,
        previousMonth: previousMonthTotal,
        yearToDate: ytdTotal,
        percentageChange,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  };

  const fetchMonthlyTrend = async () => {
    const today = new Date();
    const monthsToShow = selectedPeriod === '6months' ? 6 : 12;
    const startDate = subMonths(today, monthsToShow - 1);

    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('payment_date, amount')
        .eq('transaction_type', 'payable')
        .gte('payment_date', startOfMonth(startDate).toISOString().split('T')[0])
        .order('payment_date', { ascending: true });

      if (error) throw error;

      // Group by month
      const monthlyData: { [key: string]: number } = {};
      (data || []).forEach((item) => {
        const month = format(new Date(item.payment_date), 'yyyy-MM', { locale: ja });
        monthlyData[month] = (monthlyData[month] || 0) + parseFloat(item.amount);
      });

      // Create trend array with all months (including zero-amount months)
      const trend: MonthlyTrend[] = [];
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = subMonths(today, i);
        const monthKey = format(date, 'yyyy-MM', { locale: ja });
        const monthLabel = format(date, 'yyyy年M月', { locale: ja });
        trend.push({
          month: monthLabel,
          amount: monthlyData[monthKey] || 0,
        });
      }

      setMonthlyTrend(trend);
    } catch (error) {
      console.error('Error fetching monthly trend:', error);
      throw error;
    }
  };

  const fetchPaymentMethodBreakdown = async () => {
    const today = new Date();
    const startDate = subMonths(today, selectedPeriod === '6months' ? 6 : 12);

    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(
          `payment_method_cash,
           payment_method_check,
           payment_method_note,
           payment_method_bank_transfer,
           payment_method_offset,
           discount_amount,
           other_amount`
        )
        .eq('transaction_type', 'payable')
        .gte('payment_date', startDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Sum up each payment method
      const totals = {
        cash: 0,
        check: 0,
        note: 0,
        bank_transfer: 0,
        offset: 0,
        discount: 0,
        other: 0,
      };

      (data || []).forEach((item) => {
        totals.cash += parseFloat(item.payment_method_cash || 0);
        totals.check += parseFloat(item.payment_method_check || 0);
        totals.note += parseFloat(item.payment_method_note || 0);
        totals.bank_transfer += parseFloat(item.payment_method_bank_transfer || 0);
        totals.offset += parseFloat(item.payment_method_offset || 0);
        totals.discount += parseFloat(item.discount_amount || 0);
        totals.other += parseFloat(item.other_amount || 0);
      });

      const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

      const breakdown: PaymentMethodBreakdown[] = [
        { method: '現金', amount: totals.cash, percentage: (totals.cash / grandTotal) * 100 },
        { method: '小切手', amount: totals.check, percentage: (totals.check / grandTotal) * 100 },
        { method: '手形', amount: totals.note, percentage: (totals.note / grandTotal) * 100 },
        { method: '銀行振込', amount: totals.bank_transfer, percentage: (totals.bank_transfer / grandTotal) * 100 },
        { method: '相殺', amount: totals.offset, percentage: (totals.offset / grandTotal) * 100 },
        { method: '値引', amount: totals.discount, percentage: (totals.discount / grandTotal) * 100 },
        { method: 'その他', amount: totals.other, percentage: (totals.other / grandTotal) * 100 },
      ].filter((item) => item.amount > 0); // Only show non-zero methods

      setPaymentMethods(breakdown);
    } catch (error) {
      console.error('Error fetching payment method breakdown:', error);
      throw error;
    }
  };

  const fetchSupplierRankings = async () => {
    const today = new Date();
    const startDate = subMonths(today, selectedPeriod === '6months' ? 6 : 12);

    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(
          `amount,
           partner_id,
           partners!partner_id (name)`
        )
        .eq('transaction_type', 'payable')
        .gte('payment_date', startDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by supplier
      const supplierData: { [key: string]: { name: string; total: number; count: number } } = {};

      (data || []).forEach((item) => {
        const partnerId = item.partner_id;
        const partnerName = item.partners?.name || '不明';
        const amount = parseFloat(item.amount);

        if (!supplierData[partnerId]) {
          supplierData[partnerId] = { name: partnerName, total: 0, count: 0 };
        }
        supplierData[partnerId].total += amount;
        supplierData[partnerId].count += 1;
      });

      // Convert to array and sort by total amount
      const rankings: SupplierRanking[] = Object.entries(supplierData)
        .map(([id, data]) => ({
          supplierId: id,
          supplierName: data.name,
          totalAmount: data.total,
          paymentCount: data.count,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10); // Top 10

      setSupplierRankings(rankings);
    } catch (error) {
      console.error('Error fetching supplier rankings:', error);
      throw error;
    }
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    toast.success('CSV出力機能は実装予定です');
  };

  const handleExportExcel = () => {
    // TODO: Implement Excel export
    toast.success('Excel出力機能は実装予定です');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            支払分析ダッシュボード
          </h1>
          <p className="text-gray-600 mt-2">支払データの可視化と分析</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as '6months' | '12months')}
            className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
          >
            <option value="6months">過去6ヶ月</option>
            <option value="12months">過去12ヶ月</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Month Card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <p className="text-blue-100 text-sm font-medium">今月の支払</p>
            </div>
            {stats.percentageChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                stats.percentageChange > 0 ? 'text-red-200' : 'text-green-200'
              }`}>
                {stats.percentageChange > 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                {Math.abs(stats.percentageChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-3xl font-bold">¥{stats.currentMonth.toLocaleString()}</p>
          <p className="text-blue-100 text-sm mt-2">
            前月: ¥{stats.previousMonth.toLocaleString()}
          </p>
        </div>

        {/* Year to Date Card */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <p className="text-purple-100 text-sm font-medium">年累計</p>
          </div>
          <p className="text-3xl font-bold">¥{stats.yearToDate.toLocaleString()}</p>
          <p className="text-purple-100 text-sm mt-2">
            {new Date().getFullYear()}年1月〜{format(new Date(), 'M月', { locale: ja })}
          </p>
        </div>

        {/* Average Payment Card */}
        <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5" />
            <p className="text-green-100 text-sm font-medium">月平均支払額</p>
          </div>
          <p className="text-3xl font-bold">
            ¥{Math.round(stats.yearToDate / (new Date().getMonth() + 1)).toLocaleString()}
          </p>
          <p className="text-green-100 text-sm mt-2">
            過去{new Date().getMonth() + 1}ヶ月の平均
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">月別支払推移</h2>
          </div>
          <PaymentTrendChart data={monthlyTrend} />
        </div>

        {/* Payment Method Breakdown Chart (Placeholder) */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">支払方法別内訳</h2>
          </div>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded-xl">
            <p className="text-gray-500">円グラフコンポーネント（実装予定）</p>
          </div>
        </div>
      </div>

      {/* Supplier Rankings Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">仕入先別支払ランキング (Top 10)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  順位
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  仕入先
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                  支払回数
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                  支払総額
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {supplierRankings.map((supplier, index) => (
                <tr key={supplier.supplierId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-50 text-blue-800'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{supplier.supplierName}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">
                    {supplier.paymentCount}回
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="font-bold text-gray-900">
                      ¥{supplier.totalAmount.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
