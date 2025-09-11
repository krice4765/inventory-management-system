import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Package, DollarSign, FileText, Clock, CheckCircle } from 'lucide-react';
import { supabase, db } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';

interface OrderDetail {
  purchase_order_id: string;
  order_no: string;
  partner_name: string;
  partner_code: string;
  order_date: string;
  delivery_deadline?: string;
  order_manager_name?: string;
  order_manager_department?: string;
  ordered_amount: number;
  delivered_amount: number;
  remaining_amount: number;
  progress_status: string;
  memo?: string;
  created_at: string;
}

interface OrderItem {
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrderDetail(id);
    }
  }, [id]);

  const fetchOrderDetail = async (orderId: string) => {
    try {
      setLoading(true);

      // 🚨 納期表示のため直接purchase_ordersテーブルから取得
      const { data: orderDetailData, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          partners!purchase_orders_partner_id_fkey (
            name,
            partner_code
          ),
          purchase_order_items (
            *,
            products (
              product_name,
              product_code
            )
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to fetch order details');
      }
      
      if (!orderDetailData) {
        throw new Error('Order not found');
      }
      
      // 分納実績を集計
      const { data: deliveries, error: deliveryError } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('parent_order_id', orderDetailData.id)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed');
      
      if (deliveryError) {
        console.warn(`分納実績取得エラー (Order: ${orderDetailData.id}):`, deliveryError);
      }
      
      const delivered_amount = (deliveries || []).reduce(
        (sum, delivery) => sum + (delivery.total_amount || 0), 0
      );
      
      const ordered_amount = orderDetailData.total_amount || 0;
      const remaining_amount = Math.max(0, ordered_amount - delivered_amount);
      
      // 進捗状況を正確に判定
      let progress_status: string;
      if (remaining_amount === 0 && delivered_amount > 0) {
        progress_status = '納品完了';
      } else if (delivered_amount > 0) {
        progress_status = '一部納品';
      } else {
        progress_status = '未納品';
      }

      // 発注基本情報を設定（分納実績反映）
      const orderInfo: OrderDetail = {
        purchase_order_id: orderDetailData.id,
        order_no: orderDetailData.order_no,
        partner_name: orderDetailData.partners?.name || '取引先不明',
        partner_code: orderDetailData.partners?.partner_code || '—',
        order_date: orderDetailData.created_at,
        delivery_deadline: orderDetailData.delivery_deadline,
        order_manager_name: undefined, // TODO: order_managersテーブルとの関連付け
        order_manager_department: undefined,
        ordered_amount,
        delivered_amount,
        remaining_amount,
        progress_status,
        memo: orderDetailData.memo,
        created_at: orderDetailData.created_at
      };
      
      setOrder(orderInfo);
      
      // 🚨 明細データを安全に整形
      console.log('📋 発注明細データ確認:', {
        order_id: orderDetailData.id,
        order_no: orderDetailData.order_no,
        has_items: !!orderDetailData.purchase_order_items,
        items_count: orderDetailData.purchase_order_items?.length || 0,
        raw_items: orderDetailData.purchase_order_items
      });

      const formattedItems: OrderItem[] = Array.isArray(orderDetailData.purchase_order_items) && orderDetailData.purchase_order_items.length > 0
        ? orderDetailData.purchase_order_items.map((item: any) => ({
            product_name: item.products?.product_name || '商品名未設定',
            product_code: item.products?.product_code || '—',
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            total_amount: item.total_amount || 0,
          }))
        : []; // 明細がない場合は空配列
      
      console.log('📦 整形後の明細データ:', formattedItems);
      
      setItems(formattedItems);
    } catch (error) {
      console.error('Order detail fetch error:', error);
      toast.error(`発注詳細の取得に失敗しました: ${(error as Error).message}`);
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '未納品': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      case '一部納品': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case '納品完了': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400';
    }
  };

  const getProgressPercentage = (delivered: number, total: number) => {
    return total > 0 ? Math.round((delivered / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className={`ml-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注詳細を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!order) {
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
              発注詳細: {order.order_no}
            </h1>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.progress_status)}`}>
            {order.progress_status}
          </div>
        </div>

        {/* 基本情報カード */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg p-6 transition-colors duration-300`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>仕入先</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{order.partner_name}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>({order.partner_code})</p>
                </div>
              </div>

              {order.order_manager_name && (
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
                    <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注担当者</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{order.order_manager_name}</p>
                    {order.order_manager_department && (
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>({order.order_manager_department})</p>
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
                    {new Date(order.order_date).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>

              {order.delivery_deadline && (
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                    <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>納期</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {new Date(order.delivery_deadline).toLocaleDateString('ja-JP')}
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
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>発注額</p>
                  <p className={`font-medium text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{order.ordered_amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>納品済み</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{order.delivered_amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>残額</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{order.remaining_amount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2">
                  <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(order.delivered_amount, order.ordered_amount)}%` }}
                    ></div>
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {getProgressPercentage(order.delivered_amount, order.ordered_amount)}% 完了
                  </div>
                </div>
              </div>
            </div>
          </div>

          {order.memo && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>備考</p>
              <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{order.memo}</p>
            </div>
          )}
        </div>

        {/* 発注明細カード */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow rounded-lg overflow-hidden transition-colors duration-300`}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>発注明細</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    商品
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    数量
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    単価
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                    金額
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200 dark:divide-gray-700`}>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className={`text-gray-500 ${isDark ? 'dark:text-gray-400' : ''}`}>
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">発注明細が見つかりません</p>
                        <p className="text-sm">
                          この発注の明細データが存在しないか、読み込みに失敗しました。
                        </p>
                        <p className="text-xs mt-2 text-red-500">
                          デバッグ: Order ID = {order?.purchase_order_id}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {item.product_name}
                            </div>
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {item.product_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {item.quantity}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ¥{item.unit_price.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ¥{item.total_amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 合計 */}
          <div className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex justify-end">
              <div className="text-right">
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>合計金額</div>
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ¥{order.ordered_amount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}