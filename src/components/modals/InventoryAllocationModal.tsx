import React, { useState, useMemo, useEffect } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogBody,
  ModernDialogFooter
} from '../ui/modern-dialog';
import { ModernButton } from '../ui/modern-button';
import { Badge } from '../ui/badge';
import { Package, AlertTriangle, CheckCircle, Loader2, Search, Info, HelpCircle, ArrowRight, Zap, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface InventoryItem {
      id: string; product_name: string; product_code: string; current_stock: number; allocated_stock: number; available_stock: number; unit_price: number; location?: string; }

interface AllocationItem {
      product_id: string; product_name: string; product_code: string; requested_quantity: number; allocated_quantity: number; available_stock: number; status: 'pending' | 'allocated' | 'insufficient'; }

interface InventoryAllocationModalProps {
      orderId: string; orderNumber: string; allocationItems: AllocationItem[]; isOpen: boolean; onClose: () => void; onAllocate: (orderId: string, allocations: AllocationItem[]) => Promise<void>;
      isDark?: boolean; }

const InventoryAllocationModal: React.FC<InventoryAllocationModalProps> = ({
  orderId,
  orderNumber,
  allocationItems,
  isOpen,
  onClose,
  onAllocate,
  isDark = false
}) => {
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // allocationItemsが変更された時にallocationsを更新
  useEffect(() => {
    setAllocations(allocationItems);
  }, [allocationItems]);

  // フィルタリングされた引当アイテム
  const filteredAllocations = useMemo(() => {
    if (!searchTerm) return allocations;
    return allocations.filter(item =>
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allocations, searchTerm]);

  // 引当状況の統計
  const allocationStats = useMemo(() => {
    return allocations.reduce((acc, item) => {
      if (item.status === 'allocated') acc.allocated++;
      else if (item.status === 'insufficient') acc.insufficient++;
      else acc.pending++;
      acc.total++;
      return acc;
    }, { allocated: 0, insufficient: 0, pending: 0, total: 0 });
  }, [allocations]);

  // 引当数量の更新
  const updateAllocation = (productId: string, quantity: number) => {
    setAllocations(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(0, Math.min(quantity, item.available_stock, item.requested_quantity));
        const status = newQuantity === item.requested_quantity
          ? 'allocated'
      : newQuantity === 0 ? 'pending'
      : item.available_stock < item.requested_quantity ? 'insufficient'
      : 'allocated'; return {
          ...item,
          allocated_quantity: newQuantity,
          status
        };
      }
      return item;
    }));
  };

  // 自動引当処理
  const handleAutoAllocate = () => {
    setAllocations(prev => prev.map(item => {
      const maxAllocation = Math.min(item.requested_quantity, item.available_stock);
      const status = maxAllocation === item.requested_quantity
        ? 'allocated'
      : maxAllocation === 0 ? 'pending'
      : 'insufficient'; return {
        ...item,
        allocated_quantity: maxAllocation,
        status
      };
    }));
  };

  // 引当実行
  const handleAllocate = async () => {
    setIsProcessing(true);
    try {
      await onAllocate(orderId, allocations);
      onClose();
    } catch (error) {
      console.error('在庫引当処理エラー:', error);
    } finally {
      setIsProcessing(false);
    }
  };

      const getStatusInfo = (status: string) => { switch (status) {
      case 'allocated':
        return {
          label: '引当済み',
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: CheckCircle };
      case 'insufficient':
        return {
          label: '在庫不足',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      icon: AlertTriangle };
      case 'pending':
        return {
          label: '未引当',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      icon: Package };
      default:
        return {
          label: '不明',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      icon: Package };
    }
  };

  const canAllocate = allocationStats.allocated > 0 || allocationStats.insufficient > 0;

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="ultra" minimizable>
        <ModernDialogHeader
          icon={<Package className="w-7 h-7" />}
        >
          <ModernDialogTitle
            subtitle={`${orderNumber} の商品を適切に引当て、出荷準備を完了します • ${allocationStats.allocated}/${allocations.length}件完了`}
          >
            📦 スマート在庫引当プロセス
          </ModernDialogTitle>
        </ModernDialogHeader>

        <ModernDialogBody className="p-8">
          {/* スマートガイド */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl p-8 ${isDark ? 'bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/50' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200'}`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10 flex items-start space-x-4">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg flex-shrink-0">
                <Info className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className={`text-xl font-bold mb-4 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                  🎯 スマート引当ガイド
                </h4>
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 text-base ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>要求数量に合わせて調整</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>「自動引当」で最適配分</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    <span>在庫不足は黄色で表示</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-base font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>合計アイテム</p>
                  <p className={`text-4xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {allocationStats.total}
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>商品種類</p>
                </div>
                <div className={`p-3 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <Package className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`p-6 rounded-xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>引当済み</p>
                  <p className="text-3xl font-bold mt-2 text-green-600">
                    {allocationStats.allocated}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`p-6 rounded-xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>在庫不足</p>
                  <p className="text-3xl font-bold mt-2 text-yellow-600">
                    {allocationStats.insufficient}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className={`p-6 rounded-xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>未引当</p>
                  <p className={`text-3xl font-bold mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {allocationStats.pending}
                  </p>
                </div>
                <Package className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
              </div>
            </motion.div>
          </div>

          {/* エンハンスド検索とアクション */}
          <div className="space-y-6">
            <div className="flex justify-between items-center gap-6">
              <div className="relative flex-1 max-w-md">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="🔍 商品名や商品コードで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-14 pr-6 py-5 border-2 rounded-2xl transition-all duration-300 text-base font-medium ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:bg-gray-800'
                      : 'bg-white/80 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:bg-white'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:shadow-lg`}
                />
              </div>
              <button
                onClick={handleAutoAllocate}
                className={`flex items-center space-x-3 px-8 py-5 rounded-2xl font-medium text-base transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                  isDark
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white hover:from-purple-700 hover:to-indigo-800'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                }`}
              >
                <Zap className="w-5 h-5" />
                <span>⚡ 自動引当</span>
              </button>
            </div>
            {allocationStats.total > 0 && (
              <div className="flex items-center justify-center">
                <div className={`px-8 py-4 rounded-2xl text-base font-medium border-2 ${
                  allocationStats.allocated === allocationStats.total
                    ? isDark
                      ? 'bg-green-900/30 text-green-300 border-green-700/50'
                      : 'bg-green-50 text-green-700 border-green-200'
                    : allocationStats.insufficient > 0
                    ? isDark
                      ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    : isDark
                      ? 'bg-gray-800 text-gray-400 border-gray-700'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      allocationStats.allocated === allocationStats.total
                        ? 'bg-green-500'
                        : allocationStats.insufficient > 0
                        ? 'bg-yellow-500'
                        : 'bg-gray-500'
                    } animate-pulse`}></div>
                    <span>{allocationStats.allocated}/{allocationStats.total} アイテム引当完了</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 引当テーブル */}
          <div className={`rounded-xl overflow-hidden shadow-lg ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`px-6 py-4 text-left text-base font-semibold ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                      商品
                    </th>
                    <th className={`px-6 py-4 text-right text-base font-semibold ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                      要求数量
                    </th>
                    <th className={`px-6 py-4 text-right text-base font-semibold ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                      利用可能
                    </th>
                    <th className={`px-6 py-4 text-right text-base font-semibold ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                      引当数量
                    </th>
                    <th className={`px-6 py-4 text-center text-base font-semibold ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
                      状態
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllocations.map((item, index) => {
                    const statusInfo = getStatusInfo(item.status);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <motion.tr
                        key={item.product_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`${
      isDark ? 'border-gray-600' : 'border-gray-200' } border-t hover:${isDark ? 'bg-gray-750' : 'bg-gray-50'} transition-colors`}
                      >
                        <td className={`px-6 py-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          <div>
                            <div className="font-semibold text-base">{item.product_name}</div>
                            <div className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {item.product_code}
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-5 text-right font-semibold text-base ${
      isDark ? 'text-white' : 'text-gray-900' }`}>
                          {item.requested_quantity.toLocaleString()}
                        </td>
                        <td className={`px-6 py-5 text-right text-base font-medium ${
                          item.available_stock < item.requested_quantity
                            ? 'text-yellow-600'
      : isDark ? 'text-gray-300' : 'text-gray-600' }`}>
                          {item.available_stock.toLocaleString()}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={Math.min(item.requested_quantity, item.available_stock)}
                            value={item.allocated_quantity}
                            onChange={(e) => updateAllocation(item.product_id, parseInt(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 text-right border rounded ${
                              isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
      : 'bg-white border-gray-300 text-gray-900' }`}
                          />
                        </td>
                        <td className="px-6 py-5 text-center">
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </ModernDialogBody>

        <ModernDialogFooter>
          <ModernButton
            variant="ghost"
            size="lg"
            onClick={onClose}
            disabled={isProcessing}
          >
            キャンセル
          </ModernButton>
          <ModernButton
            variant="success"
            size="lg"
            onClick={handleAllocate}
            disabled={!canAllocate || isProcessing}
            loading={isProcessing}
            icon={!isProcessing ? <CheckCircle className="w-5 h-5" /> : undefined}
            gradient
          >
            引当実行
          </ModernButton>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default InventoryAllocationModal;