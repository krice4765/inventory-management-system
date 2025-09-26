import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Package, Calendar, User, MapPin, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface OutboundOrder {
      id: string; order_number: string; customer_name: string; destination: string; total_items: number; total_amount: number; status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; created_at: string; scheduled_date?: string; assigned_user?: string; items?: { product_name: string; product_code: string; quantity: number; unit_price: number; total_price: number; }[];
      shipping_info?: { method: string; tracking_number?: string; estimated_delivery?: string; };
      notes?: string; }

interface OutboundOrderDetailModalProps {
      order: OutboundOrder | null; isOpen: boolean; onClose: () => void; isDark?: boolean; }

const OutboundOrderDetailModal: React.FC<OutboundOrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  isDark = false
}) => {
  if (!order) return null;

      const getStatusInfo = (status: string) => { switch (status) {
      case 'pending':
        return {
          label: '保留中',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      icon: Clock };
      case 'processing':
        return {
          label: '処理中',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      icon: Package };
      case 'shipped':
        return {
          label: '出荷済み',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      icon: CheckCircle };
      case 'delivered':
        return {
          label: '配送完了',
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: CheckCircle };
      case 'cancelled':
        return {
          label: 'キャンセル',
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      icon: AlertCircle };
      default:
        return {
          label: '不明',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      icon: AlertCircle };
    }
  };

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${
      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200' }`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
            出庫詳細 - {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本情報セクション */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`rounded-lg p-4 ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200' }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
              基本情報
            </h3>
      <div className="grid grid-cols-1 md: grid-cols-2 gap-4"><div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      顧客名
                    </p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.customer_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      配送先
                    </p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.destination}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <StatusIcon className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      ステータス
                    </p>
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Calendar className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      作成日時
                    </p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.created_at ? new Date(order.created_at).toLocaleString('ja-JP') : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 商品情報セクション */}
          {order.items && order.items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`rounded-lg p-4 ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200' }`}
            >
              <h3 className={`text-lg font-semibold mb-4 ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                商品明細
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <th className={`px-4 py-2 text-left text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                        商品名
                      </th>
                      <th className={`px-4 py-2 text-left text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                        商品コード
                      </th>
                      <th className={`px-4 py-2 text-right text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                        数量
                      </th>
                      <th className={`px-4 py-2 text-right text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                        単価
                      </th>
                      <th className={`px-4 py-2 text-right text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                        小計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index} className={`${
      isDark ? 'border-gray-600' : 'border-gray-200' } border-t`}>
                        <td className={`px-4 py-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.product_name}
                        </td>
                        <td className={`px-4 py-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {item.product_code}
                        </td>
                        <td className={`px-4 py-2 text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {(item.quantity || 0).toLocaleString()}
                        </td>
                        <td className={`px-4 py-2 text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          ¥{(item.unit_price || 0).toLocaleString()}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          ¥{(item.total_price || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border-t-2`}>
                      <td colSpan={4} className={`px-4 py-3 text-right font-semibold ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                        合計:
                      </td>
                      <td className={`px-4 py-3 text-right font-bold text-lg ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                        ¥{(order.total_amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          )}

          {/* 配送情報セクション */}
          {order.shipping_info && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={`rounded-lg p-4 ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200' }`}
            >
              <h3 className={`text-lg font-semibold mb-4 ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                配送情報
              </h3>
      <div className="grid grid-cols-1 md: grid-cols-3 gap-4"><div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    配送方法
                  </p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {order.shipping_info.method}
                  </p>
                </div>
                {order.shipping_info.tracking_number && (
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      追跡番号
                    </p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.shipping_info.tracking_number}
                    </p>
                  </div>
                )}
                {order.shipping_info.estimated_delivery && (
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      配送予定日
                    </p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {new Date(order.shipping_info.estimated_delivery).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* メモセクション */}
          {order.notes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className={`rounded-lg p-4 ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200' }`}
            >
              <h3 className={`text-lg font-semibold mb-4 ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                備考
              </h3>
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                {order.notes}
              </p>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutboundOrderDetailModal;