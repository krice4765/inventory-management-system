import React, { useState, useEffect } from 'react';
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
import { ModernSelect } from '../ui/modern-select';
import {
  Truck, Package, Calendar, MapPin, DollarSign,
  FileText, CheckCircle, AlertTriangle, Sparkles,
  ArrowRight, ShoppingBag
} from 'lucide-react';

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

interface ModernShippingProcessModalProps {
  order: OutboundOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onProcessShipping: (orderId: string, shippingInfo: ShippingInfo) => Promise<void>;
  isDark?: boolean;
}

const ModernShippingProcessModal: React.FC<ModernShippingProcessModalProps> = ({
  order,
  isOpen,
  onClose,
  onProcessShipping,
  isDark = false
}) => {
  const [currentStep, setCurrentStep] = useState<'input' | 'confirmation'>('input');
  const [isProcessing, setIsProcessing] = useState(false);

  const [shippingData, setShippingData] = useState<ShippingInfo>({
    method: '',
    carrier: '',
    tracking_number: '',
    estimated_delivery: '',
    shipping_cost: 0,
    special_instructions: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // シッピング方法のオプション
  const shippingMethods = [
    {
      value: 'standard',
      label: '標準配送',
      description: '3-5営業日、¥800',
      icon: <Truck className="w-5 h-5 text-blue-500" />
    },
    {
      value: 'express',
      label: '速達配送',
      description: '翌々日配達、¥1,200',
      icon: <Truck className="w-5 h-5 text-orange-500" />
    },
    {
      value: 'overnight',
      label: '翌日配送',
      description: '翌日午前配達、¥1,800',
      icon: <Truck className="w-5 h-5 text-red-500" />
    },
    {
      value: 'freight',
      label: '貨物配送',
      description: '大型商品対応、¥2,500',
      icon: <Package className="w-5 h-5 text-green-500" />
    }
  ];

  useEffect(() => {
    if (isOpen && order) {
      setCurrentStep('input');
      setShippingData({
        method: '',
        carrier: '',
        tracking_number: '',
        estimated_delivery: '',
        shipping_cost: 0,
        special_instructions: ''
      });
      setErrors({});
    }
  }, [isOpen, order]);

  const handleMethodChange = (value: string) => {
    const methodConfig = {
      standard: { carrier: 'ヤマト運輸', cost: 800, days: 3 },
      express: { carrier: '佐川急便', cost: 1200, days: 2 },
      overnight: { carrier: 'ヤマト運輸', cost: 1800, days: 1 },
      freight: { carrier: '日本通運', cost: 2500, days: 5 }
    };

    const config = methodConfig[value as keyof typeof methodConfig];
    if (config) {
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + config.days);

      setShippingData(prev => ({
        ...prev,
        method: value,
        carrier: config.carrier,
        shipping_cost: config.cost,
        estimated_delivery: estimatedDate.toISOString().split('T')[0]
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!shippingData.method) newErrors.method = '配送方法を選択してください';
    if (!shippingData.carrier) newErrors.carrier = '配送業者を入力してください';
    if (!shippingData.tracking_number) newErrors.tracking_number = '追跡番号を入力してください';
    if (!shippingData.estimated_delivery) newErrors.estimated_delivery = '配送予定日を選択してください';
    if (shippingData.shipping_cost <= 0) newErrors.shipping_cost = '送料を入力してください';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const proceedToConfirmation = () => {
    if (validateForm()) {
      setCurrentStep('confirmation');
    }
  };

  const handleProcessShipping = async () => {
    if (!order) return;

    setIsProcessing(true);
    try {
      await onProcessShipping(order.id, shippingData);
      onClose();
    } catch (error) {
      console.error('出荷処理エラー:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!order) return null;

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent size="xl" minimizable>
        <ModernDialogHeader
          icon={currentStep === 'input' ? <Truck className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
        >
          <ModernDialogTitle
            subtitle={currentStep === 'input' ? '配送情報を入力してください' : '出荷処理を実行します'}
          >
            {currentStep === 'input' ? '出荷処理' : '出荷確認'}
          </ModernDialogTitle>
        </ModernDialogHeader>

        <ModernDialogBody>
          <AnimatePresence mode="wait">
            {currentStep === 'input' ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Order Summary Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        オーダー情報
                      </h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {order.order_number}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <Package className="w-4 h-4 mr-1" />
                        顧客名
                      </p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {order.customer_name}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <ShoppingBag className="w-4 h-4 mr-1" />
                        商品点数
                      </p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {(order.total_items || 0).toLocaleString()} 点
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        合計金額
                      </p>
                      <p className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                        ¥{(order.total_amount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Shipping Form */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3">
                    <Sparkles className="w-6 h-6 text-purple-500" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      配送情報
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ModernSelect
                      label="配送方法"
                      placeholder="配送方法を選択..."
                      options={shippingMethods}
                      value={shippingData.method}
                      onChange={handleMethodChange}
                      error={errors.method}
                      searchable
                    />

                    <ModernInput
                      label="配送業者"
                      value={shippingData.carrier}
                      onChange={(e) => setShippingData(prev => ({ ...prev, carrier: e.target.value }))}
                      placeholder="配送業者名を入力"
                      leftIcon={<Truck className="w-5 h-5" />}
                      error={errors.carrier}
                    />

                    <ModernInput
                      label="追跡番号"
                      value={shippingData.tracking_number}
                      onChange={(e) => setShippingData(prev => ({ ...prev, tracking_number: e.target.value }))}
                      placeholder="追跡番号を入力"
                      leftIcon={<Package className="w-5 h-5" />}
                      error={errors.tracking_number}
                    />

                    <ModernInput
                      label="配送予定日"
                      type="date"
                      value={shippingData.estimated_delivery}
                      onChange={(e) => setShippingData(prev => ({ ...prev, estimated_delivery: e.target.value }))}
                      leftIcon={<Calendar className="w-5 h-5" />}
                      error={errors.estimated_delivery}
                    />

                    <ModernInput
                      label="送料"
                      type="number"
                      value={shippingData.shipping_cost}
                      onChange={(e) => setShippingData(prev => ({ ...prev, shipping_cost: Number(e.target.value) }))}
                      placeholder="0"
                      leftIcon={<DollarSign className="w-5 h-5" />}
                      error={errors.shipping_cost}
                    />

                    <ModernInput
                      label="配送先住所"
                      value={order.destination || ''}
                      readOnly
                      leftIcon={<MapPin className="w-5 h-5" />}
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  </div>

                  <div>
                    <ModernInput
                      label="特記事項"
                      value={shippingData.special_instructions}
                      onChange={(e) => setShippingData(prev => ({ ...prev, special_instructions: e.target.value }))}
                      placeholder="配送に関する特記事項があれば入力してください"
                      leftIcon={<FileText className="w-5 h-5" />}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                {/* Confirmation Header */}
                <div className="text-center py-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    出荷処理確認
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    以下の内容で出荷処理を実行します
                  </p>
                </div>

                {/* Confirmation Details */}
                <div className="space-y-6">
                  <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {Object.entries({
                      '配送方法': shippingMethods.find(m => m.value === shippingData.method)?.label,
                      '配送業者': shippingData.carrier,
                      '追跡番号': shippingData.tracking_number,
                      '配送予定日': new Date(shippingData.estimated_delivery).toLocaleDateString('ja-JP'),
                      '送料': `¥${shippingData.shipping_cost.toLocaleString()}`,
                      '配送先': order.destination
                    }).map(([key, value], index) => (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                      >
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                          {key}
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {value}
                        </p>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Warning */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl"
                  >
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          注意事項
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          出荷処理を実行すると、在庫から商品が減算され、オーダーステータスが「出荷済み」に変更されます。
                          この操作は取り消しできません。
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ModernDialogBody>

        <ModernDialogFooter>
          <ModernButton
            variant="ghost"
            size="lg"
            onClick={currentStep === 'confirmation' ? () => setCurrentStep('input') : onClose}
            disabled={isProcessing}
          >
            {currentStep === 'confirmation' ? '戻る' : 'キャンセル'}
          </ModernButton>

          {currentStep === 'input' ? (
            <ModernButton
              variant="primary"
              size="lg"
              onClick={proceedToConfirmation}
              icon={<ArrowRight className="w-5 h-5" />}
              iconPosition="right"
              gradient
            >
              確認画面へ
            </ModernButton>
          ) : (
            <ModernButton
              variant="success"
              size="lg"
              onClick={handleProcessShipping}
              loading={isProcessing}
              icon={!isProcessing ? <CheckCircle className="w-5 h-5" /> : undefined}
              gradient
            >
              出荷処理実行
            </ModernButton>
          )}
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default ModernShippingProcessModal;