import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Loader2, Calendar, User, MapPin, Package, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface OutboundOrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OutboundOrder {
  id: string;
  order_number: string;
  customer_name: string;
  destination: string;
  total_items: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  scheduled_date?: string;
  assigned_user?: string;
  items?: OutboundOrderItem[];
  shipping_method?: string;
  notes?: string;
}

interface OutboundOrderEditModalProps {
  order: OutboundOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderId: string, orderData: Partial<OutboundOrder>) => Promise<void>;
  isDark?: boolean;
}

const OutboundOrderEditModal: React.FC<OutboundOrderEditModalProps> = ({
  order,
  isOpen,
  onClose,
  onSave,
  isDark = false
}) => {
  const [formData, setFormData] = useState<Partial<OutboundOrder>>({});
  const [items, setItems] = useState<OutboundOrderItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // フォームデータの初期化
  useEffect(() => {
    if (order) {
      setFormData({
        customer_name: order.customer_name,
        destination: order.destination,
        status: order.status,
        scheduled_date: order.scheduled_date,
        assigned_user: order.assigned_user,
        shipping_method: order.shipping_method,
        notes: order.notes
      });
      setItems(order.items || []);
    }
  }, [order]);

  // 合計金額の計算
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // フォームデータの更新
  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // アイテムの更新
  const updateItem = (index: number, field: keyof OutboundOrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updatedItem.total_price = updatedItem.quantity * updatedItem.unit_price;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  // アイテムの削除
  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // アイテムの追加
  const addItem = () => {
    const newItem: OutboundOrderItem = {
      product_id: '',
      product_name: '',
      product_code: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  // バリデーション
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name?.trim()) {
      newErrors.customer_name = '顧客名は必須です';
    }

    if (!formData.destination?.trim()) {
      newErrors.destination = '配送先は必須です';
    }

    if (!formData.status) {
      newErrors.status = 'ステータスは必須です';
    }

    items.forEach((item, index) => {
      if (!item.product_name.trim()) {
        newErrors[`item_${index}_name`] = '商品名は必須です';
      }
      if (item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = '数量は1以上である必要があります';
      }
      if (item.unit_price < 0) {
        newErrors[`item_${index}_price`] = '単価は0以上である必要があります';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存処理
  const handleSave = async () => {
    if (!order || !validateForm()) return;

    setIsSaving(true);
    try {
      const updatedOrderData = {
        ...formData,
        items,
        total_items: totalItems,
        total_amount: totalAmount
      };

      await onSave(order.id, updatedOrderData);
      onClose();
    } catch (error) {
      console.error('出庫オーダー更新エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '保留中', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
      case 'processing':
        return { label: '処理中', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
      case 'shipped':
        return { label: '出荷済み', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
      case 'delivered':
        return { label: '配送完了', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
      case 'cancelled':
        return { label: 'キャンセル', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
      default:
        return { label: '不明', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-6xl max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            出庫オーダー編集 - {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本情報セクション */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              基本情報
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  <User className="w-4 h-4 inline mr-2" />
                  顧客名 *
                </Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name || ''}
                  onChange={(e) => updateFormData('customer_name', e.target.value)}
                  className={errors.customer_name ? 'border-red-500' : ''}
                />
                {errors.customer_name && (
                  <p className="text-sm text-red-500">{errors.customer_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  <MapPin className="w-4 h-4 inline mr-2" />
                  配送先 *
                </Label>
                <Input
                  id="destination"
                  value={formData.destination || ''}
                  onChange={(e) => updateFormData('destination', e.target.value)}
                  className={errors.destination ? 'border-red-500' : ''}
                />
                {errors.destination && (
                  <p className="text-sm text-red-500">{errors.destination}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  <Package className="w-4 h-4 inline mr-2" />
                  ステータス *
                </Label>
                <Select value={formData.status} onValueChange={(value) => updateFormData('status', value)}>
                  <SelectTrigger className={errors.status ? 'border-red-500' : ''}>
                    <SelectValue placeholder="ステータスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">保留中</SelectItem>
                    <SelectItem value="processing">処理中</SelectItem>
                    <SelectItem value="shipped">出荷済み</SelectItem>
                    <SelectItem value="delivered">配送完了</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
                {formData.status && (
                  <div className="mt-2">
                    <Badge className={getStatusInfo(formData.status).color}>
                      {getStatusInfo(formData.status).label}
                    </Badge>
                  </div>
                )}
                {errors.status && (
                  <p className="text-sm text-red-500">{errors.status}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_date" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  <Calendar className="w-4 h-4 inline mr-2" />
                  予定日
                </Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date || ''}
                  onChange={(e) => updateFormData('scheduled_date', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="notes" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                備考
              </Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateFormData('notes', e.target.value)}
                rows={3}
                placeholder="備考を入力してください..."
              />
            </div>
          </motion.div>

          {/* 商品明細セクション */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`p-4 rounded-lg ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                商品明細
              </h3>
              <Button onClick={addItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                商品追加
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    isDark ? 'border-gray-600' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      商品 {index + 1}
                    </span>
                    <Button
                      onClick={() => removeItem(index)}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2 space-y-2">
                      <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        商品名 *
                      </Label>
                      <Input
                        value={item.product_name}
                        onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                        placeholder="商品名を入力"
                        className={errors[`item_${index}_name`] ? 'border-red-500' : ''}
                      />
                      {errors[`item_${index}_name`] && (
                        <p className="text-sm text-red-500">{errors[`item_${index}_name`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        数量 *
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className={errors[`item_${index}_quantity`] ? 'border-red-500' : ''}
                      />
                      {errors[`item_${index}_quantity`] && (
                        <p className="text-sm text-red-500">{errors[`item_${index}_quantity`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        単価
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className={errors[`item_${index}_price`] ? 'border-red-500' : ''}
                      />
                      {errors[`item_${index}_price`] && (
                        <p className="text-sm text-red-500">{errors[`item_${index}_price`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        小計
                      </Label>
                      <div className={`p-2 rounded ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      } font-medium`}>
                        ¥{item.total_price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 合計表示 */}
            <div className={`mt-6 p-4 rounded-lg ${
              isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100 border border-gray-200'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className={`text-lg font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    合計: {totalItems.toLocaleString()} 点
                  </span>
                </div>
                <div>
                  <span className={`text-xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    ¥{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutboundOrderEditModal;