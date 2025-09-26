import React, { useState } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogBody,
  ModernDialogFooter
} from '../ui/modern-dialog';
import { Badge } from '../ui/badge';
import { ModernButton } from '../ui/modern-button';
import {
  X,
  Package,
  DollarSign,
  Hash,
  TrendingUp,
  Building,
  MapPin,
  Calendar,
  Clock,
  Truck,
  Copy,
  CheckCircle,
  Edit,
  ArrowRight,
  Info,
  Users,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OutboundOrder } from '../../hooks/useOutboundManagement';
import toast from 'react-hot-toast';

interface ModernOutboundOrderDetailModalProps {
  order: OutboundOrder | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (order: OutboundOrder) => void;
  isDark?: boolean;
}

const ModernOutboundOrderDetailModal: React.FC<ModernOutboundOrderDetailModalProps> = ({
  order,
  open,
  onClose,
  onEdit,
  isDark = false
}) => {
  if (!order) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("クリップボードにコピーされました");
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error("コピーに失敗しました");
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '出庫待ち', color: 'bg-yellow-500', progress: 25 };
      case 'processing':
        return { label: '出庫準備中', color: 'bg-blue-500', progress: 50 };
      case 'shipped':
        return { label: '出庫完了', color: 'bg-green-500', progress: 75 };
      case 'delivered':
        return { label: '配送完了', color: 'bg-emerald-500', progress: 100 };
      default:
        return { label: '未確定', color: 'bg-gray-500', progress: 0 };
    }
  };

  const statusInfo = getStatusInfo(order.status);

  return (
    <ModernDialog open={open} onOpenChange={onClose}>
      <ModernDialogContent size="ultra" minimizable>
        <ModernDialogHeader
          icon={<Package className="w-7 h-7" />}
        >
          <ModernDialogTitle
            subtitle={`${statusInfo.label} • 商品 ${order.items?.length || 2}点 • 合計 ¥${(order.total_amount || 150000).toLocaleString()}`}
          >
            📦 出庫詳細 - {order.order_number || 'OUT-2025-001'}
            <button
              onClick={() => copyToClipboard(order.order_number || 'OUT-2025-001')}
              className="p-1 ml-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Copy className="w-4 h-4 text-gray-400" />
            </button>
          </ModernDialogTitle>
        </ModernDialogHeader>

        <ModernDialogBody className="p-8">
          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">進捗状況</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{statusInfo.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <motion.div
                className={`h-3 rounded-full ${statusInfo.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${statusInfo.progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          <div className="space-y-8">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">合計金額</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">¥{(order.total_amount || 150000).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-full">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">商品点数</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{order.items?.reduce((sum, item) => sum + item.quantity, 0) || 8}</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-full">
                    <Hash className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">平均単価</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">¥{Math.round((order.total_amount || 150000) / (order.items?.reduce((sum, item) => sum + item.quantity, 0) || 8)).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-full">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Customer Information and Date Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Customer Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <Building className="w-5 h-5 mr-2 text-blue-500" />
                  顧客情報
                </h3>
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">顧客名</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{order.customer_name || '株式会社サンプル'}</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">配送先住所</p>
                      <p className="text-gray-900 dark:text-gray-100">{order.shipping_address || order.destination || '東京都渋谷区神南1-1-1'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Date Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                  日付情報
                </h3>
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">作成日時</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{new Date(order.created_at || '2025-09-22T19:00:00').toLocaleString('ja-JP')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">配送予定日</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{new Date(order.due_date || '2025-09-25').toLocaleDateString('ja-JP')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">最終更新</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{new Date(order.updated_at || '2025-09-22T19:00:00').toLocaleString('ja-JP')}</p>
                  </div>
                </div>
              </motion.div>

              {/* Shipping Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <Truck className="w-5 h-5 mr-2 text-blue-500" />
                  配送情報
                </h3>
                {order.status === 'pending' || order.status === 'processing' ? (
                  <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">配送準備中</p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">商品の準備が完了次第、配送手続きを開始いたします</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">配送完了</p>
                        <p className="text-green-700 dark:text-green-300 text-sm mt-1">商品の配送が完了しました</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </ModernDialogBody>

        <ModernDialogFooter>
          <ModernButton
            variant="ghost"
            size="lg"
            onClick={onClose}
          >
            閉じる
          </ModernButton>

          {onEdit && (
            <ModernButton
              variant="primary"
              size="lg"
              onClick={() => onEdit(order)}
              icon={<Edit className="w-5 h-5" />}
              gradient
            >
              編集
            </ModernButton>
          )}
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default ModernOutboundOrderDetailModal;