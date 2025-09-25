import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Loader2, Truck, Package, Calendar, BarChart3, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ShippingInfo {
  method: string;
  carrier: string;
  tracking_number: string;
  estimated_delivery: string;
  shipping_cost: number;
  special_instructions?: string;
}

interface OutboundOrder {
  id: string;
  order_number: string;
  customer_name: string;
  destination: string;
  total_items: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items?: {
    product_name: string;
    product_code: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

interface ShippingProcessModalProps {
  order: OutboundOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onProcessShipping: (orderId: string, shippingInfo: ShippingInfo) => Promise<void>;
  isDark?: boolean;
}

const ShippingProcessModal: React.FC<ShippingProcessModalProps> = ({
  order,
  isOpen,
  onClose,
  onProcessShipping,
  isDark = false
}) => {
  const [shippingData, setShippingData] = useState<ShippingInfo>({
    method: '',
    carrier: '',
    tracking_number: '',
    estimated_delivery: '',
    shipping_cost: 0,
    special_instructions: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmationStep, setConfirmationStep] = useState(false);

  // フォームデータの初期化
  useEffect(() => {
    if (order && isOpen) {
      // デフォルトの配送予定日（3営業日後）を設定
      const defaultDeliveryDate = new Date();
      defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 3);

      setShippingData({
        method: '',
        carrier: '',
        tracking_number: '',
        estimated_delivery: defaultDeliveryDate.toISOString().split('T')[0],
        shipping_cost: 0,
        special_instructions: ''
      });
      setConfirmationStep(false);
      setErrors({});
    }
  }, [order, isOpen]);

  // フォームデータの更新
  const updateShippingData = (field: keyof ShippingInfo, value: any) => {
    setShippingData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 配送方法に基づく自動設定
  const handleMethodChange = (method: string) => {
    updateShippingData('method', method);

    // 配送方法に応じてデフォルト値を設定
    switch (method) {
      case 'standard':
        updateShippingData('carrier', 'ヤマト運輸');
        updateShippingData('shipping_cost', 800);
        break;
      case 'express':
        updateShippingData('carrier', '佐川急便');
        updateShippingData('shipping_cost', 1200);
        break;
      case 'overnight':
        updateShippingData('carrier', 'ヤマト運輸');
        updateShippingData('shipping_cost', 1800);
        break;
      case 'freight':
        updateShippingData('carrier', '日本通運');
        updateShippingData('shipping_cost', 2500);
        break;
      default:
        updateShippingData('carrier', '');
        updateShippingData('shipping_cost', 0);
    }
  };

  // バリデーション
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!shippingData.method) {
      newErrors.method = '配送方法は必須です';
    }

    if (!shippingData.carrier.trim()) {
      newErrors.carrier = '配送業者は必須です';
    }

    if (!shippingData.tracking_number.trim()) {
      newErrors.tracking_number = '追跡番号は必須です';
    }

    if (!shippingData.estimated_delivery) {
      newErrors.estimated_delivery = '配送予定日は必須です';
    } else {
      const deliveryDate = new Date(shippingData.estimated_delivery);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (deliveryDate < today) {
        newErrors.estimated_delivery = '配送予定日は本日以降の日付を選択してください';
      }
    }

    if (shippingData.shipping_cost < 0) {
      newErrors.shipping_cost = '送料は0以上である必要があります';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 確認ステップへ進む
  const proceedToConfirmation = () => {
    if (validateForm()) {
      setConfirmationStep(true);
    }
  };

  // 出荷処理実行
  const handleProcessShipping = async () => {
    if (!order) return;

    setIsProcessing(true);
    try {
      await onProcessShipping(order.id, shippingData);
      onClose();
    } catch (error) {
      console.error('出荷処理エラー:', error);
      // エラー処理をここに追加可能
    } finally {
      setIsProcessing(false);
    }
  };

  const getMethodInfo = (method: string) => {
    switch (method) {
      case 'standard':
        return { label: '標準配送', icon: Package, color: 'text-blue-600', description: '通常3-5営業日' };
      case 'express':
        return { label: '速達配送', icon: Truck, color: 'text-green-600', description: '翌々日配達' };
      case 'overnight':
        return { label: '翌日配送', icon: Truck, color: 'text-purple-600', description: '翌日午前配達' };
      case 'freight':
        return { label: '貨物配送', icon: Truck, color: 'text-orange-600', description: '大型商品対応' };
      default:
        return { label: '未選択', icon: Package, color: 'text-gray-600', description: '' };
    }
  };

  if (!order) return null;

  const methodInfo = getMethodInfo(shippingData.method);
  const MethodIcon = methodInfo.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {confirmationStep ? '出荷処理確認' : '出荷処理'} - {order.order_number}
          </DialogTitle>
        </DialogHeader>

        {!confirmationStep ? (
          // 入力ステップ
          <div className="space-y-6">
            {/* オーダー概要 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <h3 className={`text-lg font-semibold mb-3 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                出荷対象オーダー
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>顧客名</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {order.customer_name}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>商品点数</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {(order.total_items || 0).toLocaleString()} 点
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>合計金額</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{(order.total_amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* 配送情報入力 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <h3 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                配送情報
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    <Truck className="w-4 h-4 inline mr-2" />
                    配送方法 *
                  </Label>
                  <Select value={shippingData.method} onValueChange={handleMethodChange}>
                    <SelectTrigger className={errors.method ? 'border-red-500' : ''}>
                      <SelectValue placeholder="配送方法を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">標準配送</SelectItem>
                      <SelectItem value="express">速達配送</SelectItem>
                      <SelectItem value="overnight">翌日配送</SelectItem>
                      <SelectItem value="freight">貨物配送</SelectItem>
                    </SelectContent>
                  </Select>
                  {shippingData.method && (
                    <div className="flex items-center space-x-2 mt-2">
                      <MethodIcon className={`w-4 h-4 ${methodInfo.color}`} />
                      <span className={`text-sm ${methodInfo.color}`}>
                        {methodInfo.label} - {methodInfo.description}
                      </span>
                    </div>
                  )}
                  {errors.method && (
                    <div className="flex items-center space-x-2 mt-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.method}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carrier" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    配送業者 *
                  </Label>
                  <Input
                    id="carrier"
                    value={shippingData.carrier}
                    onChange={(e) => updateShippingData('carrier', e.target.value)}
                    placeholder="配送業者名を入力"
                    className={errors.carrier ? 'border-red-500' : ''}
                  />
                  {errors.carrier && (
                    <div className="flex items-center space-x-2 mt-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.carrier}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tracking_number" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    <BarChart3 className="w-4 h-4 inline mr-2" />
                    追跡番号 *
                  </Label>
                  <Input
                    id="tracking_number"
                    value={shippingData.tracking_number}
                    onChange={(e) => updateShippingData('tracking_number', e.target.value)}
                    placeholder="追跡番号を入力"
                    className={errors.tracking_number ? 'border-red-500' : ''}
                  />
                  {errors.tracking_number && (
                    <div className="flex items-center space-x-2 mt-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.tracking_number}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated_delivery" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    <Calendar className="w-4 h-4 inline mr-2" />
                    配送予定日 *
                  </Label>
                  <Input
                    id="estimated_delivery"
                    type="date"
                    value={shippingData.estimated_delivery}
                    onChange={(e) => updateShippingData('estimated_delivery', e.target.value)}
                    className={errors.estimated_delivery ? 'border-red-500' : ''}
                  />
                  {errors.estimated_delivery && (
                    <div className="flex items-center space-x-2 mt-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.estimated_delivery}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipping_cost" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    送料
                  </Label>
                  <Input
                    id="shipping_cost"
                    type="number"
                    min="0"
                    step="10"
                    value={shippingData.shipping_cost}
                    onChange={(e) => updateShippingData('shipping_cost', parseFloat(e.target.value) || 0)}
                    className={errors.shipping_cost ? 'border-red-500' : ''}
                  />
                  {errors.shipping_cost && (
                    <div className="flex items-center space-x-2 mt-1">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.shipping_cost}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="special_instructions" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  特記事項
                </Label>
                <Textarea
                  id="special_instructions"
                  value={shippingData.special_instructions || ''}
                  onChange={(e) => updateShippingData('special_instructions', e.target.value)}
                  rows={3}
                  placeholder="配送に関する特記事項があれば入力してください..."
                />
              </div>
            </motion.div>
          </div>
        ) : (
          // 確認ステップ
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* 警告メッセージ */}
            <div className={`p-4 rounded-lg border ${
              isDark
                ? 'bg-yellow-900/20 border-yellow-600 text-yellow-200'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="font-medium">出荷処理の確認</span>
              </div>
              <p className="mt-2 text-sm">
                この処理を実行すると、オーダーのステータスが「出荷済み」に変更され、在庫から商品が確定的に減算されます。
                処理後の取り消しはできませんので、内容をご確認ください。
              </p>
            </div>

            {/* 確認内容 */}
            <div className={`p-4 rounded-lg ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                出荷情報確認
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>配送方法</p>
                  <div className="flex items-center space-x-2">
                    <MethodIcon className={`w-4 h-4 ${methodInfo.color}`} />
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {methodInfo.label}
                    </span>
                  </div>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>配送業者</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {shippingData.carrier}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>追跡番号</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {shippingData.tracking_number}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>配送予定日</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {new Date(shippingData.estimated_delivery).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>送料</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ¥{(shippingData.shipping_cost || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>配送先</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {order.destination}
                  </p>
                </div>
              </div>

              {shippingData.special_instructions && (
                <div className="mt-4">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>特記事項</p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {shippingData.special_instructions}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
          <Button
            variant="outline"
            size="lg"
            onClick={confirmationStep ? () => setConfirmationStep(false) : onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            {confirmationStep ? '戻る' : 'キャンセル'}
          </Button>

          {confirmationStep ? (
            <Button
              size="lg"
              onClick={handleProcessShipping}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto order-1 sm:order-2"
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              出荷処理実行
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={proceedToConfirmation}
              className="w-full sm:w-auto order-1 sm:order-2 bg-blue-600 hover:bg-blue-700"
            >
              確認画面へ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingProcessModal;