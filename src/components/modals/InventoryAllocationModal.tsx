import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Package, AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface InventoryItem {
  id: string;
  product_name: string;
  product_code: string;
  current_stock: number;
  allocated_stock: number;
  available_stock: number;
  unit_price: number;
  location?: string;
}

interface AllocationItem {
  product_id: string;
  product_name: string;
  product_code: string;
  requested_quantity: number;
  allocated_quantity: number;
  available_stock: number;
  status: 'pending' | 'allocated' | 'insufficient';
}

interface InventoryAllocationModalProps {
  orderId: string;
  orderNumber: string;
  allocationItems: AllocationItem[];
  isOpen: boolean;
  onClose: () => void;
  onAllocate: (orderId: string, allocations: AllocationItem[]) => Promise<void>;
  isDark?: boolean;
}

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
          : newQuantity === 0
          ? 'pending'
          : item.available_stock < item.requested_quantity
          ? 'insufficient'
          : 'allocated';

        return {
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
        : maxAllocation === 0
        ? 'pending'
        : 'insufficient';

      return {
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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'allocated':
        return {
          label: '引当済み',
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          icon: CheckCircle
        };
      case 'insufficient':
        return {
          label: '在庫不足',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          icon: AlertTriangle
        };
      case 'pending':
        return {
          label: '未引当',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          icon: Package
        };
      default:
        return {
          label: '不明',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          icon: Package
        };
    }
  };

  const canAllocate = allocationStats.allocated > 0 || allocationStats.insufficient > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-5xl max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            在庫引当 - {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>合計</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {allocationStats.total}
                  </p>
                </div>
                <Package className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>引当済み</p>
                  <p className="text-2xl font-bold text-green-600">
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
              className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>在庫不足</p>
                  <p className="text-2xl font-bold text-yellow-600">
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
              className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>未引当</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {allocationStats.pending}
                  </p>
                </div>
                <Package className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
              </div>
            </motion.div>
          </div>

          {/* 検索とアクション */}
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="商品名、商品コードで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                  isDark
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            <Button
              onClick={handleAutoAllocate}
              variant="outline"
              className="ml-4"
            >
              自動引当
            </Button>
          </div>

          {/* 引当テーブル */}
          <div className={`rounded-lg overflow-hidden ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      商品
                    </th>
                    <th className={`px-4 py-3 text-right text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      要求数量
                    </th>
                    <th className={`px-4 py-3 text-right text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      利用可能
                    </th>
                    <th className={`px-4 py-3 text-right text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      引当数量
                    </th>
                    <th className={`px-4 py-3 text-center text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
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
                          isDark ? 'border-gray-600' : 'border-gray-200'
                        } border-t hover:${isDark ? 'bg-gray-750' : 'bg-gray-50'} transition-colors`}
                      >
                        <td className={`px-4 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          <div>
                            <div className="font-medium">{item.product_name}</div>
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {item.product_code}
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {item.requested_quantity.toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 text-right ${
                          item.available_stock < item.requested_quantity
                            ? 'text-yellow-600'
                            : isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {item.available_stock.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={Math.min(item.requested_quantity, item.available_stock)}
                            value={item.allocated_quantity}
                            onChange={(e) => updateAllocation(item.product_id, parseInt(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 text-right border rounded ${
                              isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleAllocate}
            disabled={!canAllocate || isProcessing}
          >
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            引当実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryAllocationModal;