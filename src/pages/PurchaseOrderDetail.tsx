import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Package, DollarSign, FileText, Clock, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';
import { ConfirmOrderButton } from '../components/transactions/ConfirmOrderButton';

interface PurchaseTransaction {
  id: string;
  transaction_no: string;
  partner_name: string;
  partner_code: string;
  transaction_date: string;
  status: string;
  total_amount: number;
  installment_no: number;
  memo?: string;
  confirmed_at?: string;
  confirmed_by?: string;
}

interface PurchaseOrderDetail {
  order_no: string;
  partner_name: string;
  partner_code: string;
  order_date: string;
  delivery_deadline?: string;
  order_manager_name?: string;
  order_manager_department?: string;
  total_amount: number;
  memo?: string;
  created_at: string;
}

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPurchaseOrderDetail(id);
    }
  }, [id]);

  const fetchPurchaseOrderDetail = async (orderId: string) => {
    try {
      setLoading(true);

      // 直接transaction_idで取得を試す
      const { data: orderData, error: orderError } = await supabase
        .from('transactions')
        .select(`
          *,
          partners (
            name,
            partner_code
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;

      // 関連する全ての取引を取得（parent_order_idまたは同じIDの取引）
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          *,
          partners (
            name,
            partner_code
          )
        `)
        .or(`parent_order_id.eq.${orderId},id.eq.${orderId}`)
        .order('installment_no', { ascending: true });

      if (transactionError) throw transactionError;

      if (orderData) {
        setOrderDetail({
          order_no: orderData.transaction_no,
          partner_name: orderData.partners?.name || 'N/A',
          partner_code: orderData.partners?.partner_code || 'N/A',
          order_date: orderData.created_at,
          delivery_deadline: orderData.delivery_date,
          order_manager_name: orderData.order_manager_name,
          order_manager_department: orderData.order_manager_department,
          total_amount: orderData.total_amount,
          memo: orderData.memo,
          created_at: orderData.created_at,
        });
      }

      setTransactions(transactionData?.map(tx => ({
        id: tx.id,
        transaction_no: tx.transaction_no,
        partner_name: tx.partners?.name || 'N/A',
        partner_code: tx.partners?.partner_code || 'N/A',
        transaction_date: tx.created_at,
        status: tx.status,
        total_amount: tx.total_amount,
        installment_no: tx.installment_no || 1,
        memo: tx.memo,
        confirmed_at: tx.confirmed_at,
        confirmed_by: tx.confirmed_by,
      })) || []);
    } catch (error) {
      console.error('Purchase order detail fetch error:', error);
      toast.error('分納詳細の取得に失敗しました');
      navigate('/purchase-orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'confirmed': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '未確定';
      case 'confirmed': return '確定';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getTotalConfirmedAmount = () => {
    return transactions
      .filter(tx => tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.total_amount, 0);
  };

  const getTotalDraftAmount = () => {
    return transactions
      .filter(tx => tx.status === 'draft')
      .reduce((sum, tx) => sum + tx.total_amount, 0);
  };

  const getRemainingAmount = () => {
    if (!orderDetail) return 0;
    return orderDetail.total_amount - getTotalConfirmedAmount() - getTotalDraftAmount();
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>分納詳細を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className={`mt-2 text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>発注が見つかりません</h3>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/purchase-orders')}
              className={`flex items-center ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              分納管理に戻る
            </button>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              分納詳細: {orderDetail.order_no}
            </h1>
          </div>
        </div>

        {/* 基本情報カード */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6 transition-colors duration-300`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>発注基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>仕入先</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{orderDetail.partner_name}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>({orderDetail.partner_code})</p>
                </div>
              </div>

              {orderDetail.order_manager_name && (
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
                    <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注担当者</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{orderDetail.order_manager_name}</p>
                    {orderDetail.order_manager_department && (
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>({orderDetail.order_manager_department})</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                  <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注日</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {new Date(orderDetail.order_date).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>

              {orderDetail.delivery_deadline && (
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                    <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>納期</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {new Date(orderDetail.delivery_deadline).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注総額</p>
                  <p className={`font-medium text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{orderDetail.total_amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>確定済み</span>
                  <span className={`font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    ¥{getTotalConfirmedAmount().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>未確定</span>
                  <span className={`font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    ¥{getTotalDraftAmount().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>残額</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{getRemainingAmount().toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {orderDetail.memo && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>備考</p>
              <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{orderDetail.memo}</p>
            </div>
          )}
        </div>

        {/* 分納一覧カード */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg overflow-hidden transition-colors duration-300`}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>分納一覧</h2>
            <span className={`text-sm px-3 py-1 rounded-full ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
              {transactions.length}回分納
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    分納情報
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    金額
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    ステータス
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    確定情報
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200 dark:divide-gray-700`}>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            第{transaction.installment_no}回分納
                          </div>
                          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {transaction.transaction_no}
                          </div>
                          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {new Date(transaction.transaction_date).toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ¥{transaction.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                        {getStatusText(transaction.status)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {transaction.confirmed_at ? (
                        <div>
                          <div className="flex items-center">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                            <span>{new Date(transaction.confirmed_at).toLocaleDateString('ja-JP')}</span>
                          </div>
                          {transaction.confirmed_by && (
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              by {transaction.confirmed_by}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>未確定</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {transaction.status === 'draft' && (
                        <ConfirmOrderButton
                          transactionId={transaction.id}
                          currentStatus={transaction.status}
                          orderNo={transaction.transaction_no}
                          onConfirmed={() => fetchPurchaseOrderDetail(id!)}
                          className="text-xs px-2 py-1"
                        />
                      )}
                      {transaction.status === 'confirmed' && (
                        <span className={`text-xs px-2 py-1 rounded ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          確定済み
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transactions.length === 0 && (
            <div className="text-center py-12">
              <Plus className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>分納がありません</h3>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>新しい分納を追加してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}