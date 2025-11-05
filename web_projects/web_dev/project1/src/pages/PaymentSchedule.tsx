import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Calendar, ArrowLeft, ChevronLeft, ChevronRight, CreditCard, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
}

interface PaymentScheduleItem {
  id: string;
  due_date: string;
  total_amount: number;
  balance: number;
  status: string;
  partners: Partner;
}

interface MonthlyTotal {
  month: string;
  total: number;
  count: number;
}

export default function PaymentSchedule() {
  const navigate = useNavigate();
  const [scheduleItems, setScheduleItems] = useState<PaymentScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  useEffect(() => {
    fetchPaymentSchedule();
  }, [currentDate]);

  const fetchPaymentSchedule = async () => {
    try {
      setLoading(true);

      // 当月の初日と最終日を計算
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('accounts_payable')
        .select(`
          *,
          partners (id, name, partner_code)
        `)
        .gte('balance', 0.01)
        .gte('due_date', startOfMonth.toISOString().split('T')[0])
        .lte('due_date', endOfMonth.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (error) throw error;

      setScheduleItems(data || []);
    } catch (error) {
      console.error('Error fetching payment schedule:', error);
      toast.error('支払予定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const monthlyTotal = scheduleItems.reduce((sum, item) => sum + (item.balance || 0), 0);

  // 日付ごとにグループ化
  const groupedByDate = scheduleItems.reduce((acc, item) => {
    const date = item.due_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, PaymentScheduleItem[]>);

  const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

  const formatMonthYear = () => {
    return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/accounts-payable')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          買掛金一覧に戻る
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              支払予定カレンダー
            </h1>
            <p className="mt-2 text-gray-600">月ごとの支払予定を確認します</p>
          </div>
          <PageManual {...manuals.paymentSchedule} />
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMonth}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            前月
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">{formatMonthYear()}</h2>
            </div>
            <button
              onClick={goToCurrentMonth}
              className="px-4 py-2 text-sm text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-all"
            >
              今月
            </button>
          </div>

          <button
            onClick={goToNextMonth}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            次月
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        </div>

        {/* Monthly Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">支払予定金額</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(monthlyTotal)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <CreditCard className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">支払予定件数</p>
                <p className="text-3xl font-bold mt-2">{scheduleItems.length}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">支払期日数</p>
                <p className="text-3xl font-bold mt-2">{Object.keys(groupedByDate).length}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <Calendar className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Schedule List */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-2xl font-bold text-gray-900">支払予定一覧</h2>
          <p className="text-sm text-gray-500 mt-1">
            期日ごとにグループ化されています
          </p>
        </div>

        {scheduleItems.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">この月の支払予定はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedByDate).map(([date, items]) => {
              const dateTotal = items.reduce((sum, item) => sum + (item.balance || 0), 0);
              const today = new Date().toISOString().split('T')[0];
              const isOverdue = date < today;

              return (
                <div key={date} className="p-6 hover:bg-gray-50 transition-colors">
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`px-4 py-2 rounded-xl font-bold ${
                        isOverdue
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {new Date(date).toLocaleDateString('ja-JP', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </div>
                      {isOverdue && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          期限超過
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">合計</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(dateTotal)}</p>
                    </div>
                  </div>

                  {/* Items for this date */}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-all cursor-pointer"
                        onClick={() => navigate(`/payment/new?payable_id=${item.id}`)}
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{item.partners?.name ?? '不明'}</p>
                          <p className="text-sm text-gray-500">{item.partners?.partner_code ?? '-'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(item.balance)}</p>
                          <button className="mt-1 inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                            <CreditCard className="h-3 w-3 mr-1" />
                            支払登録
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
