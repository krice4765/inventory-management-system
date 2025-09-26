import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertTriangle, Loader2, Package, User, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface OutboundOrder {
      id: string; order_number: string; customer_name: string; destination: string; total_items: number; total_amount: number; status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; created_at: string; }

interface DeleteConfirmationModalProps {
      order: OutboundOrder | null; isOpen: boolean; onClose: () => void; onConfirmDelete: (orderId: string) => Promise<void>; isDark?: boolean; }

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmDelete,
  isDark = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [reason, setReason] = useState('');

  const handleConfirmDelete = async () => {
    if (!order) return;

    setIsDeleting(true);
    try {
      await onConfirmDelete(order.id);
      onClose();
      setReason(''); // リセット
    } catch (error) {
      console.error('削除処理エラー:', error);
    } finally {
      setIsDeleting(false);
    }
  };

      const getStatusInfo = (status: string) => { switch (status) {
      case 'pending':
        return {
          label: '保留中',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          canDelete: true,
      warning: '保留中のオーダーです。削除すると復元できません。' };
      case 'processing':
        return {
          label: '処理中',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          canDelete: true,
      warning: '処理中のオーダーです。在庫引当が行われている可能性があります。削除すると在庫状態も調整されます。' };
      case 'shipped':
        return {
          label: '出荷済み',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          canDelete: false,
      warning: '出荷済みのオーダーは削除できません。キャンセル処理を行ってください。' };
      case 'delivered':
        return {
          label: '配送完了',
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          canDelete: false,
      warning: '配送完了のオーダーは削除できません。' };
      case 'cancelled':
        return {
          label: 'キャンセル',
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          canDelete: true,
      warning: 'キャンセル済みのオーダーです。削除すると履歴から完全に削除されます。' };
      default:
        return {
          label: '不明',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          canDelete: false,
      warning: 'ステータスが不明なため削除できません。' };
    }
  };

  if (!order) return null;

  const statusInfo = getStatusInfo(order.status);
  const canProceed = statusInfo.canDelete && reason.trim().length >= 5;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-3xl p-8 ${
      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200' }`}>
        <DialogHeader className="pb-6">
          <DialogTitle className={`text-2xl font-bold flex items-center ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
            <AlertTriangle className="w-7 h-7 text-red-500 mr-3" />
            出庫オーダー削除確認
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* 警告メッセージ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-lg border ${
              statusInfo.canDelete
                ? isDark
                  ? 'bg-red-900/20 border-red-600 text-red-200'
      : 'bg-red-50 border-red-200 text-red-800' : isDark ? 'bg-yellow-900/20 border-yellow-600 text-yellow-200'
      : 'bg-yellow-50 border-yellow-200 text-yellow-800' }`}
          >
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium block">
                  {statusInfo.canDelete ? '削除の警告' : '削除不可'}
                </span>
                <p className="mt-1 text-sm">
                  {statusInfo.warning}
                </p>
              </div>
            </div>
          </motion.div>

          {/* オーダー情報 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`p-4 rounded-lg ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200' }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
              削除対象オーダー
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  オーダー番号: {order.order_number}
                </span>
                <Badge className={statusInfo.color}>
                  {statusInfo.label}
                </Badge>
              </div>

      <div className="grid grid-cols-1 md: grid-cols-2 gap-4"><div className="flex items-center space-x-3">
                  <User className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>顧客名</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.customer_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>配送先</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.destination}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Package className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>商品点数</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {(order.total_items || 0).toLocaleString()} 点
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'} text-center`}>
                    ¥
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>合計金額</p>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ¥{(order.total_amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>作成日時</p>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {order.created_at ? new Date(order.created_at).toLocaleString('ja-JP') : '-'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* 削除理由入力（削除可能な場合のみ） */}
          {statusInfo.canDelete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <label className={`block text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                削除理由 * (5文字以上)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
      placeholder="削除する理由を詳しく入力してください（例: 顧客からのキャンセル要請、重複オーダーのため、等）" className={`w-full px-4 py-3 border rounded-lg resize-none text-sm ${
                  isDark
      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500' } ${reason.trim().length > 0 && reason.trim().length < 5 ? 'border-red-500' : ''} focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              <div className="flex justify-between items-center">
                <p className={`text-xs ${
                  reason.trim().length >= 5
                    ? 'text-green-600'
      : reason.trim().length > 0 ? 'text-red-500'
      : isDark ? 'text-gray-400' : 'text-gray-600' }`}>
                  {reason.trim().length}/5文字以上
                </p>
              </div>
            </motion.div>
          )}

          {/* 削除不可の場合の説明 */}
          {!statusInfo.canDelete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-4 rounded-lg ${
      isDark ? 'bg-gray-800 border border-gray-600' : 'bg-gray-100 border border-gray-200' }`}
            >
              <h4 className={`font-medium mb-2 ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                推奨される対応方法
              </h4>
              <ul className={`text-sm space-y-1 ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                {order.status === 'shipped' && (
                  <>
                    <li>• 配送業者に連絡して配送停止を依頼</li>
                    <li>• 顧客に連絡して返品手続きを案内</li>
                    <li>• オーダーステータスを「キャンセル」に変更</li>
                  </>
                )}
                {order.status === 'delivered' && (
                  <>
                    <li>• 顧客に連絡して返品手続きを案内</li>
                    <li>• 返金処理を別途実施</li>
                    <li>• 記録として履歴を保持することを推奨</li>
                  </>
                )}
              </ul>
            </motion.div>
          )}
        </div>

      <DialogFooter className="flex flex-col sm: flex-row gap-3 pt-6"><Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={isDeleting}
      className="w-full sm: w-auto order-2 sm:order-1">
            キャンセル
          </Button>

          {statusInfo.canDelete && (
            <Button
              variant="destructive"
              size="lg"
              onClick={handleConfirmDelete}
              disabled={!canProceed || isDeleting}
      className="w-full sm: w-auto order-1 sm:order-2">
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              削除実行
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmationModal;