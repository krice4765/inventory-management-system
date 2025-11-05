import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

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

export default function AccountsPayableLedger() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();

    // デフォルト期間設定（今月）
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
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

  const handleSearch = async () => {
    if (!selectedSupplier) {
      toast.error('仕入先を選択してください');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_payable_ledger', {
        p_supplier_id: selectedSupplier,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) throw error;

      setLedgerEntries(data || []);

      if (!data || data.length === 0) {
        toast('該当する取引がありません', { icon: 'ℹ️' });
      }
    } catch (error) {
      console.error('Error fetching ledger:', error);
      toast.error('買掛元帳の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 期間プリセット関数
  const setPeriod = (period: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'allTime') => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'allTime':
        start = new Date(2020, 0, 1); // 適切な開始日を設定
        end = now;
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const selectedSupplierInfo = suppliers.find(s => s.id === selectedSupplier);

  const openingBalance = ledgerEntries.length > 0 && ledgerEntries[0].entry_type === '繰越'
    ? ledgerEntries[0].balance
    : 0;

  const closingBalance = ledgerEntries.length > 0
    ? ledgerEntries[ledgerEntries.length - 1].balance
    : 0;

  const totalDebit = ledgerEntries
    .filter(e => e.entry_type !== '繰越')
    .reduce((sum, entry) => sum + Number(entry.debit_amount || 0), 0);

  const totalCredit = ledgerEntries
    .filter(e => e.entry_type !== '繰越')
    .reduce((sum, entry) => sum + Number(entry.credit_amount || 0), 0);

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
              買掛元帳
            </h1>
            <p className="mt-2 text-gray-600">仕入先別の詳細履歴を表示します</p>
          </div>
          <PageManual {...manuals.accountsPayableLedger} />
        </div>
      </div>

      {/* Search Form */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              仕入先 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
            >
              <option value="">選択してください</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.partner_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              開始日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              終了日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-colors"
            />
          </div>
        </div>

        {/* 期間プリセットボタン */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm font-semibold text-gray-600 self-center mr-2">クイック選択:</span>
          <button
            type="button"
            onClick={() => setPeriod('thisMonth')}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            今月
          </button>
          <button
            type="button"
            onClick={() => setPeriod('lastMonth')}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            前月
          </button>
          <button
            type="button"
            onClick={() => setPeriod('thisYear')}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            今年度
          </button>
          <button
            type="button"
            onClick={() => setPeriod('lastYear')}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            前年度
          </button>
          <button
            type="button"
            onClick={() => setPeriod('allTime')}
            className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            全期間
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search className="w-5 h-5 mr-2" />
            {loading ? '検索中...' : '検索'}
          </button>

          {ledgerEntries.length > 0 && (
            <button
              onClick={() => toast('PDF出力機能は未実装です', { icon: 'ℹ️' })}
              className="flex items-center px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              <Download className="w-5 h-5 mr-2" />
              PDFエクスポート
            </button>
          )}
        </div>
      </div>

      {/* Ledger Display */}
      {selectedSupplierInfo && ledgerEntries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Ledger Header */}
          <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedSupplierInfo.name} 様
            </h2>
            <div className="mt-2 flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                期間: {new Date(startDate).toLocaleDateString('ja-JP')} ~ {new Date(endDate).toLocaleDateString('ja-JP')}
              </div>
              <div>
                前月繰越: ¥{openingBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">日付</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">種別</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">伝票番号</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">摘要</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase">
                    借方(支払)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase">
                    貸方(仕入)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase">残高</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {ledgerEntries.map((entry, index) => (
                  <tr
                    key={`${entry.entry_date}-${entry.entry_type}-${index}`}
                    className={`transition-colors ${
                      entry.entry_type === '繰越'
                        ? 'bg-amber-50 border-l-4 border-amber-400 font-semibold'
                        : 'hover:bg-blue-50/50'
                    }`}
                  >
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      entry.entry_type === '繰越' ? 'font-bold text-amber-900' : 'font-medium text-gray-900'
                    }`}>
                      {new Date(entry.entry_date).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          entry.entry_type === '仕入'
                            ? 'bg-red-100 text-red-800'
                            : entry.entry_type === '支払'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-200 text-amber-900 border-2 border-amber-400'
                        }`}
                      >
                        {entry.entry_type === '繰越' && '📊 '}
                        {entry.entry_type}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      entry.entry_type === '繰越' ? 'font-bold text-amber-900' : 'text-gray-600'
                    }`}>
                      {entry.reference_no}
                    </td>
                    <td className={`px-6 py-4 text-sm ${
                      entry.entry_type === '繰越' ? 'font-bold text-amber-900' : 'text-gray-900'
                    }`}>
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-medium text-red-600">
                      {entry.debit_amount > 0 ? `¥${Number(entry.debit_amount).toLocaleString()}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-medium text-green-600">
                      {entry.credit_amount > 0 ? `¥${Number(entry.credit_amount).toLocaleString()}` : ''}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold ${
                      entry.entry_type === '繰越' ? 'text-amber-700 text-lg bg-amber-100 rounded' : 'text-gray-900'
                    }`}>
                      ¥{Number(entry.balance).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right text-sm text-gray-700">
                    合計:
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono text-red-600">
                    ¥{totalDebit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono text-green-600">
                    ¥{totalCredit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-lg font-mono text-blue-600">
                    ¥{closingBalance.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedSupplierInfo && ledgerEntries.length === 0 && !loading && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-12 text-center">
          <p className="text-gray-500">該当する取引がありません</p>
        </div>
      )}
    </div>
  );
}
