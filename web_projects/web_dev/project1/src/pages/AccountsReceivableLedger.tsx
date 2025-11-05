import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
}

interface LedgerEntry {
  entry_date: string;
  entry_type: string;
  transaction_id: string | null;
  reference_no: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
}

export default function AccountsReceivableLedger() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  // 顧客一覧を取得
  useEffect(() => {
    fetchCustomers();

    // デフォルトの日付範囲を当月に設定
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name, partner_code')
      .eq('is_active', true)
      .in('partner_type', ['customer', 'both'])
      .order('name');

    if (error) {
      toast.error('顧客の取得に失敗しました');
      console.error('Error fetching customers:', error);
      return;
    }

    setCustomers(data || []);
  };

  const fetchLedger = async () => {
    if (!selectedCustomerId) {
      toast.error('顧客を選択してください');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('日付範囲を入力してください');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_receivable_ledger', {
        p_customer_id: selectedCustomerId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        toast.error('元帳データの取得に失敗しました');
        console.error('Error fetching ledger:', error);
        return;
      }

      setLedgerEntries(data || []);

      // 合計金額を計算（繰越を除く）
      const debitSum = (data || [])
        .filter((entry: LedgerEntry) => entry.entry_type !== '繰越')
        .reduce((sum: number, entry: LedgerEntry) => sum + Number(entry.debit_amount), 0);
      const creditSum = (data || [])
        .filter((entry: LedgerEntry) => entry.entry_type !== '繰越')
        .reduce((sum: number, entry: LedgerEntry) => sum + Number(entry.credit_amount), 0);

      setTotalDebit(debitSum);
      setTotalCredit(creditSum);

      if (!data || data.length === 0) {
        toast.info('該当する取引がありません');
      }
    } catch (err) {
      toast.error('元帳データの取得中にエラーが発生しました');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  const getEntryTypeColor = (entryType: string) => {
    switch (entryType) {
      case '繰越':
        return 'text-gray-600 bg-gray-100';
      case '売上':
        return 'text-blue-600 bg-blue-100';
      case '入金':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">売掛金元帳</h1>
          <p className="mt-2 text-sm text-gray-600">顧客別の詳細履歴を表示します</p>
        </div>
        <button
          onClick={() => navigate('/accounts-receivable')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          売掛金一覧に戻る
        </button>
      </div>

      {/* 検索フォーム */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              顧客 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.partner_code || ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              開始日 <span className="text-red-500">*</span>
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
              終了日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchLedger}
              disabled={loading}
              className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 transition-all"
            >
              {loading ? '検索中...' : '検索'}
            </button>
          </div>
        </div>
      </div>

      {/* 元帳テーブル */}
      {ledgerEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    日付
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    種類
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    伝票番号
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    摘要
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    借方（売掛）
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    貸方（入金）
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    残高
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ledgerEntries.map((entry, index) => (
                  <tr
                    key={`${entry.entry_date}-${entry.entry_type}-${index}`}
                    className={entry.entry_type === '繰越' ? 'bg-gray-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(entry.entry_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${getEntryTypeColor(
                          entry.entry_type
                        )}`}
                      >
                        {entry.entry_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.reference_no}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                      {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                      {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                      {formatCurrency(entry.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gradient-to-r from-green-50 to-emerald-50">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                    合計（繰越除く）
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    差額: {formatCurrency(totalDebit - totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* データなしメッセージ */}
      {!loading && ledgerEntries.length === 0 && selectedCustomerId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">該当する取引がありません</p>
        </div>
      )}
    </div>
  );
}
