import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogBody,
  ModernDialogFooter
} from '../ui/modern-dialog';
import { ModernButton } from '../ui/modern-button';
import { ModernInput } from '../ui/modern-input';
import {
  AlertTriangle, Trash2, CheckCircle, XCircle, AlertCircle,
  Package, User, MapPin, Calendar, Lightbulb, Shield
} from 'lucide-react';

interface OutboundOrder {
  id: string;
  order_number: string;
  customer_name: string;
  destination: string;
  total_items: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
}

interface ModernDeleteConfirmationModalProps {
  order: OutboundOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (orderId: string) => Promise<void>;
  isDark?: boolean;
}

const ModernDeleteConfirmationModal: React.FC<ModernDeleteConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmDelete,
  isDark = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [currentStep, setCurrentStep] = useState<'confirm' | 'reason'>('confirm');

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: '保留中',
          color: 'yellow',
          icon: AlertCircle,
          canDelete: true,
          risk: 'low',
          warning: '保留中のオーダーです。削除すると復元できません。'
        };
      case 'processing':
        return {
          label: '処理中',
          color: 'blue',
          icon: Package,
          canDelete: true,
          risk: 'medium',
          warning: '処理中のオーダーです。作業が進行中の可能性があります。'
        };
      case 'shipped':
        return {
          label: '出荷済み',
          color: 'green',
          icon: CheckCircle,
          canDelete: false,
          risk: 'high',
          warning: '出荷済みのオーダーは削除できません。'
        };
      case 'delivered':
        return {
          label: '配送完了',
          color: 'green',
          icon: CheckCircle,
          canDelete: false,
          risk: 'high',
          warning: '配送完了のオーダーは削除できません。'
        };
      case 'cancelled':
        return {
          label: 'キャンセル',
          color: 'gray',
          icon: XCircle,
          canDelete: true,
          risk: 'low',
          warning: 'キャンセル済みのオーダーです。履歴として保持することを推奨します。'
        };
      default:
        return {
          label: status,
          color: 'gray',
          icon: AlertCircle,
          canDelete: false,
          risk: 'high',
          warning: 'このオーダーの削除可否を判定できません。'
        };
    }
  };

  const handleConfirmDelete = async () => {
    if (!order) return;

    setIsDeleting(true);
    try {
      await onConfirmDelete(order.id);
      onClose();
      setReason('');
      setCurrentStep('confirm');
    } catch (error) {
      console.error('削除処理エラー:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const proceedToReasonInput = () => {
    setCurrentStep('reason');
  };

  const canProceed = reason.trim().length >= 5;

  if (!order) return null;

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  const riskColors = {
    low: 'from-green-500 to-emerald-600',
    medium: 'from-yellow-500 to-orange-600',
    high: 'from-red-500 to-red-600'
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="lg">
        <ModernDialogHeader
          icon={
            <div className={`bg-gradient-to-br ${riskColors[statusInfo.risk]} text-white`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          }
        >
          <ModernDialogTitle
            subtitle={currentStep === 'confirm' ? 'この操作は取り消しできません' : '削除理由を入力してください'}
          >
            {statusInfo.canDelete ? 'オーダー削除確認' : '削除できません'}
          </ModernDialogTitle>
        </ModernDialogHeader>

        <ModernDialogBody>
          <AnimatePresence mode="wait">
            {currentStep === 'confirm' ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Order Information Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {order.order_number}
                      </h3>
                      <div className="flex items-center space-x-2 mt-2">
                        <StatusIcon className={`w-5 h-5 text-${statusInfo.color}-500`} />
                        <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${statusInfo.color}-100 text-${statusInfo.color}-800 dark:bg-${statusInfo.color}-900 dark:text-${statusInfo.color}-200`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${riskColors[statusInfo.risk]}/10 border border-current text-${statusInfo.color}-500`}>
                      <Trash2 className="w-8 h-8" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">顧客名</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {order.customer_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Package className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">商品点数</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {(order.total_items || 0).toLocaleString()} 点
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 text-gray-400 text-center">¥</div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">合計金額</p>
                          <p className="font-semibold text-2xl text-gray-900 dark:text-gray-100">
                            ¥{(order.total_amount || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">作成日時</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('ja-JP') : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Warning Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`p-6 rounded-2xl border ${
                    statusInfo.canDelete
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-xl ${
                      statusInfo.canDelete
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}>
                      {statusInfo.canDelete ? (
                        <AlertTriangle className="w-6 h-6 text-white" />
                      ) : (
                        <Shield className="w-6 h-6 text-white" />
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className={`font-bold text-lg mb-2 ${
                        statusInfo.canDelete
                          ? 'text-yellow-800 dark:text-yellow-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        {statusInfo.canDelete ? '削除可能' : '削除不可'}
                      </h4>
                      <p className={`mb-4 ${
                        statusInfo.canDelete
                          ? 'text-yellow-700 dark:text-yellow-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}>
                        {statusInfo.warning}
                      </p>

                      {!statusInfo.canDelete && (
                        <div className="mt-4">
                          <div className="flex items-start space-x-2">
                            <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                                推奨対応方法
                              </p>
                              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
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
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="reason"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center py-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mb-4">
                    <Trash2 className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    削除理由の入力
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    オーダー削除の理由を詳細に記入してください
                  </p>
                </div>

                <ModernInput
                  label="削除理由"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="削除する理由を詳しく入力してください（例: 顧客からのキャンセル要請、重複オーダーのため、等）"
                  helperText={`${reason.trim().length}/5文字以上入力してください`}
                  error={reason.trim().length > 0 && reason.trim().length < 5 ? '5文字以上入力してください' : ''}
                  success={reason.trim().length >= 5}
                  size="lg"
                />

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                >
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        最終確認
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        このオーダーを削除すると、すべてのデータが永久に失われます。
                        この操作は取り消しできません。
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </ModernDialogBody>

        <ModernDialogFooter>
          <ModernButton
            variant="ghost"
            size="lg"
            onClick={currentStep === 'reason' ? () => setCurrentStep('confirm') : onClose}
            disabled={isDeleting}
          >
            {currentStep === 'reason' ? '戻る' : 'キャンセル'}
          </ModernButton>

          {statusInfo.canDelete && (
            <>
              {currentStep === 'confirm' ? (
                <ModernButton
                  variant="danger"
                  size="lg"
                  onClick={proceedToReasonInput}
                  icon={<Trash2 className="w-5 h-5" />}
                  gradient
                >
                  削除理由を入力
                </ModernButton>
              ) : (
                <ModernButton
                  variant="danger"
                  size="lg"
                  onClick={handleConfirmDelete}
                  disabled={!canProceed}
                  loading={isDeleting}
                  icon={!isDeleting ? <Trash2 className="w-5 h-5" /> : undefined}
                  gradient
                >
                  削除を実行
                </ModernButton>
              )}
            </>
          )}
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default ModernDeleteConfirmationModal;