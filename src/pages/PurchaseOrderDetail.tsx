import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, DollarSign, FileText, Clock, CheckCircle, Plus } from 'lucide-react';
import { supabase, db } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';
import { ConfirmOrderButton } from '../components/transactions/ConfirmOrderButton';
import { calculateDeliveryStatus, getStatusColorClasses } from '../utils/deliveryStatus';

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
  transaction_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    products?: {
      id: string;
      product_name: string;
      product_code: string;
    };
  }>;
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

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  products?: {
    id: string;
    product_name: string;
    product_code: string;
  };
}

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchaseOrderDetail = useCallback(async (orderId: string) => {
    try {
      setLoading(true);

      // 🚨 発注書基本データを取得
      const { data: orderDetailData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !orderDetailData) {
        console.error('🚨 発注書データ取得エラー:', orderError);
        throw new Error(orderError?.message || 'Failed to fetch purchase order details');
      }

      // 担当者情報を別途取得
      let assignedUserName = undefined;
      let assignedUserDepartment = undefined;
      if (orderDetailData.assigned_user_id) {

        // user_profilesテーブルの主キーはidカラムを使用
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('full_name, department')
          .eq('id', orderDetailData.assigned_user_id)
          .single();

        if (userError) {
          console.warn('⚠️ 担当者情報取得エラー:', userError);
          // フォールバック: user_idカラムで検索を試行
          const { data: userData2, error: userError2 } = await supabase
            .from('user_profiles')
            .select('full_name, department')
            .eq('user_id', orderDetailData.assigned_user_id)
            .single();

          if (!userError2 && userData2) {
            assignedUserName = userData2.full_name;
            assignedUserDepartment = userData2.department;
          }
        } else if (userData) {
          assignedUserName = userData.full_name;
          assignedUserDepartment = userData.department;
        }

      }

      // パートナー情報を別途取得
      let partnerName = '仕入先未設定';
      let partnerCode = '—';
      if (orderDetailData.partner_id) {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('name, partner_code')
          .eq('id', orderDetailData.partner_id)
          .single();

        if (partnerData) {
          partnerName = partnerData.name;
          partnerCode = partnerData.partner_code;
        }
      }

        orderNo: orderDetailData.order_no,
        assignedUser: { name: assignedUserName, department: assignedUserDepartment },
        deliveryDeadline: orderDetailData.delivery_deadline,
        partner: { name: partnerName, code: partnerCode }
      });

      // 発注基本情報を設定（直接取得データを使用）
      setOrderDetail({
        order_no: orderDetailData.order_no,
        partner_name: partnerName,
        partner_code: partnerCode,
        order_date: orderDetailData.order_date || orderDetailData.created_at,
        delivery_deadline: orderDetailData.delivery_deadline,
        order_manager_name: assignedUserName,
        order_manager_department: assignedUserDepartment,
        total_amount: orderDetailData.total_amount || 0,
        memo: orderDetailData.memo || orderDetailData.notes,
        created_at: orderDetailData.created_at,
      });

      // 🚨 関連取引をSupabaseから直接取得（分納記録に特化、商品情報も含める）
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          *,
          partners!transactions_partner_id_fkey (
            name,
            partner_code
          ),
          transaction_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_amount
          )
        `)
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .order('installment_no', { ascending: true });

      if (transactionError) {
        console.warn('Transactions fetch error, using order data only:', transactionError);
        setTransactions([]);
        return;
      }

      // 🔍 デバッグログ: 取得されたtransactionデータを確認
        orderId,
        transactionCount: transactionData?.length || 0,
        transactionData: transactionData?.map(tx => ({
          id: tx.id,
          transaction_type: tx.transaction_type,
          status: tx.status,
          total_amount: tx.total_amount,
          parent_order_id: tx.parent_order_id,
          delivery_sequence: tx.delivery_sequence,
          installment_no: tx.installment_no,
          created_at: tx.created_at,
          // 🔍 分納番号デバッグ詳細
          delivery_sequence_type: typeof tx.delivery_sequence,
          installment_no_type: typeof tx.installment_no,
          calculated_installment_no: tx.delivery_sequence || tx.installment_no || 1
        }))
      });

      // 🚨 取引データを安全にマッピング（分納シーケンス対応）
      const mappedTransactions = await Promise.all(transactionData?.map(async tx => {
        // 各取引の商品情報を個別に取得
        let transactionItems = [];

        // 1. transaction_itemsから取得を試行
        if (tx.transaction_items && tx.transaction_items.length > 0) {
          const productIds = tx.transaction_items.map(item => item.product_id).filter(Boolean);

          if (productIds.length > 0) {
            // 商品情報を別途取得
            const { data: productsData } = await supabase
              .from('products')
              .select('id, product_name, product_code')
              .in('id', productIds);

            // transaction_itemsに商品情報をマージ
            transactionItems = tx.transaction_items.map(item => ({
              ...item,
              products: productsData?.find(p => p.id === item.product_id) || null
            }));
          } else {
            transactionItems = tx.transaction_items;
          }
        }

        // 2. transaction_itemsが空の場合、purchase_order_itemsから発注内容を表示
        if (transactionItems.length === 0) {
          try {
            // 発注商品情報を取得
            const { data: orderItems } = await supabase
              .from('purchase_order_items')
              .select(`
                id,
                product_id,
                quantity,
                unit_price,
                total_amount,
                products (
                  id,
                  product_name,
                  product_code
                )
              `)
              .eq('purchase_order_id', orderId);

            if (orderItems && orderItems.length > 0) {
              // 分納の金額比率から推定数量を計算
              const orderTotalAmount = orderItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
              const installmentRatio = tx.total_amount / orderTotalAmount;

              transactionItems = orderItems.map(item => {
                const estimatedQuantity = Math.round((item.quantity || 0) * installmentRatio);
                return {
                  id: `est_${item.id}`,
                  product_id: item.product_id,
                  quantity: estimatedQuantity,
                  unit_price: item.unit_price || 0,
                  total_amount: (item.unit_price || 0) * estimatedQuantity,
                  products: item.products
                };
              }).filter(item => item.quantity > 0); // 数量0の商品は除外

                transactionId: tx.id,
                totalAmount: tx.total_amount,
                orderTotalAmount,
                ratio: installmentRatio,
                items: transactionItems
              });
            }
          } catch (error) {
            console.warn('⚠️ 発注データからの商品情報取得に失敗:', error);
          }
        }

        return {
          id: tx.id,
          transaction_no: tx.transaction_no || `分納-${tx.delivery_sequence || 1}`,
          partner_name: tx.partners?.name || partnerName,
          partner_code: tx.partners?.partner_code || partnerCode,
          transaction_date: tx.transaction_date || tx.created_at,
          status: tx.status,
          total_amount: tx.total_amount,
          installment_no: tx.installment_no || tx.delivery_sequence || 1,
          memo: tx.memo,
          confirmed_at: tx.confirmed_at,
          confirmed_by: tx.confirmed_by,
          transaction_items: transactionItems,
        };
      }) || []);

      setTransactions(mappedTransactions);

      // 🛒 発注商品一覧を取得
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          products (
            id,
            product_name,
            product_code
          )
        `)
        .eq('purchase_order_id', orderId)
        .order('created_at', { ascending: true });

      if (orderItemsError) {
        console.warn('⚠️ 発注商品一覧の取得に失敗:', orderItemsError);
        setOrderItems([]);
      } else {
        setOrderItems(orderItemsData || []);
      }
    } catch (error) {
      console.error('Purchase order detail fetch error:', error);
      toast.error(`発注明細の取得に失敗しました: ${(error as Error).message}`);
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchOrderDetail = useCallback(async (orderId: string) => {
    await fetchPurchaseOrderDetail(orderId);
  }, [fetchPurchaseOrderDetail]);

  useEffect(() => {
    if (id) {
      fetchOrderDetail(id);
    } else {
      console.warn('⚠️ IDが取得できません');
    }
  }, [id, fetchOrderDetail]);

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

  // 🎯 納品ステータス計算（共通ユーティリティ使用）
  const getDeliveryStatus = () => {
    if (!orderDetail) return null;

    return calculateDeliveryStatus({
      orderTotalAmount: orderDetail.total_amount,
      confirmedAmount: getTotalConfirmedAmount(),
      draftAmount: getTotalDraftAmount(),
      orderItems: orderItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      })),
      transactions: transactions.map(tx => ({
        status: tx.status,
        transaction_items: tx.transaction_items?.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity || 0
        }))
      }))
    });
  };

  const deliveryStatus = getDeliveryStatus();

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注明細を読み込み中...</span>
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
              onClick={() => navigate('/orders')}
              className={`flex items-center ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              発注管理に戻る
            </button>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              発注明細: {orderDetail.order_no}
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
                {/* 全納完了バッジ */}
                {deliveryStatus && deliveryStatus.isFullyDelivered && (
                  <div className="flex items-center justify-center mb-3">
                    <div className={`px-4 py-2 rounded-full flex items-center space-x-2 ${getStatusColorClasses(deliveryStatus.statusColor, isDark)}`}>
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {deliveryStatus.statusLabel}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>納品済み</span>
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
                  <span className={`font-medium ${
                    deliveryStatus && deliveryStatus.remainingAmount === 0
                      ? isDark ? 'text-green-400' : 'text-green-600'
                      : isDark ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    ¥{deliveryStatus ? deliveryStatus.remainingAmount.toLocaleString() : getRemainingAmount().toLocaleString()}
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

        {/* 納品進捗カード */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg overflow-hidden transition-colors duration-300`}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>納品進捗</h2>
            <span className={`text-sm px-3 py-1 rounded-full ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
              {transactions.length}回分納
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    分納回数・日付
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    納品商品
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    合計数量
                  </th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    分納金額
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    進捗状況
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    確定日時
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200 dark:divide-gray-700`}>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                    {/* 分納回数・日付 */}
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
                            {new Date(transaction.transaction_date).toLocaleDateString('ja-JP')}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {transaction.transaction_no}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 納品商品 */}
                    <td className="px-6 py-4">
                      {transaction.transaction_items && transaction.transaction_items.length > 0 ? (
                        <div className="space-y-1">
                          {transaction.transaction_items.map((item: any, idx: number) => (
                            <div key={idx} className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              <div className="font-medium">
                                {item.products?.product_name || '商品名未設定'} × {item.quantity || 0}
                              </div>
                              {item.products?.product_code && (
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  コード: {item.products.product_code}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          商品情報なし
                        </div>
                      )}
                    </td>

                    {/* 合計数量 */}
                    <td className={`px-6 py-4 whitespace-nowrap text-center text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {transaction.transaction_items && transaction.transaction_items.length > 0 ? (
                        <div>
                          {transaction.transaction_items.reduce((total: number, item: any) => total + (item.quantity || 0), 0)}個
                        </div>
                      ) : (
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>-</span>
                      )}
                    </td>

                    {/* 分納金額 */}
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <div className="text-green-600 dark:text-green-400">
                        ¥{transaction.total_amount.toLocaleString()}
                      </div>
                    </td>

                    {/* 進捗状況 */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                        {getStatusText(transaction.status)}
                      </span>
                    </td>

                    {/* 確定日時 */}
                    <td className={`px-6 py-4 whitespace-nowrap text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      {transaction.confirmed_at ? (
                        <div>
                          <div className="flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                            <span>{new Date(transaction.confirmed_at).toLocaleDateString('ja-JP')}</span>
                          </div>
                          {transaction.confirmed_by && (
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {transaction.confirmed_by}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>未確定</span>
                      )}
                    </td>

                    {/* アクション */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {transaction.status === 'draft' && (
                        <ConfirmOrderButton
                          transactionId={transaction.id}
                          currentStatus={transaction.status}
                          orderNo={transaction.transaction_no}
                          onConfirmed={() => fetchOrderDetail(id!)}
                          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                        />
                      )}
                      {transaction.status === 'confirmed' && (
                        <span className={`text-xs px-3 py-1 rounded ${isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
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

        {/* 発注商品一覧カード */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg overflow-hidden transition-colors duration-300`}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>発注商品一覧</h2>
            <span className={`text-sm px-3 py-1 rounded-full ${isDark ? 'bg-purple-900/20 text-purple-400' : 'bg-purple-100 text-purple-800'}`}>
              {orderItems.length}品目
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    商品名・コード
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    発注数量
                  </th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    単価
                  </th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    小計
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200 dark:divide-gray-700`}>
                {orderItems.map((item) => (
                  <tr key={item.id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                    {/* 商品名・コード */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${isDark ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                          <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {item.products?.product_name || '商品名未設定'}
                          </div>
                          {item.products?.product_code && (
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              コード: {item.products.product_code}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 発注数量 */}
                    <td className={`px-6 py-4 whitespace-nowrap text-center text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.quantity}個
                    </td>

                    {/* 単価 */}
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                      ¥{item.unit_price.toLocaleString()}
                    </td>

                    {/* 小計 */}
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <div className="text-blue-600 dark:text-blue-400">
                        ¥{item.total_amount.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orderItems.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className={`mt-2 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>発注商品がありません</h3>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>この発注書には商品が登録されていません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}