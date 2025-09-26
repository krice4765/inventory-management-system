import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  X,
  Plus,
  Minus,
  Package,
  Building,
  Calendar,
  MapPin,
  Save,
  Trash2,
  AlertCircle,
  FileText,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import SearchableSelect from '../SearchableSelect';

interface Product {
      id: string; product_name: string; product_code: string; current_stock: number; selling_price: number; }

interface OutboundOrderItem {
      id: string; product_id: string; product_name: string; product_code: string; quantity_requested: number; unit_price_tax_excluded: number; unit_price_tax_included: number; subtotal: number; }

interface CreateOutboundOrderModalProps {
      open: boolean; onClose: () => void; onSave: (orderData: any) => Promise<void>; }

const CreateOutboundOrderModal: React.FC<CreateOutboundOrderModalProps> = ({
  open,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    request_date: new Date().toISOString().split('T')[0],
    due_date: '',
    shipping_address: '',
      notes: '' });

  const [items, setItems] = useState<OutboundOrderItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 商品データを取得
  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  const fetchProducts = async () => {
    try {
      // Supabaseから実際の商品データを取得
      const { supabase } = await import('../../lib/supabase');

      const { data: products, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, current_stock, selling_price')
        .gt('current_stock', 0) // 在庫がある商品のみ
        .order('product_name');

      if (error) {
        console.error('Product fetch error:', error);
        toast.error('商品データの取得に失敗しました');
        return;
      }

      setAvailableProducts(products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('商品データの取得に失敗しました');
    }
  };

  const addItem = () => {
    if (availableProducts.length === 0) return;

    const firstProduct = availableProducts[0];
      const newItem: OutboundOrderItem = { id: `temp-${Date.now()}`,
      product_id: firstProduct.id,
      product_name: firstProduct.product_name,
      product_code: firstProduct.product_code,
      quantity_requested: 1,
      unit_price_tax_excluded: Math.round(firstProduct.selling_price / 1.1),
      unit_price_tax_included: firstProduct.selling_price,
      subtotal: firstProduct.selling_price };

    setItems([...items, newItem]);
  };

      const removeItem = (index: number) => { setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OutboundOrderItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'product_id') {
      const product = availableProducts.find(p => p.id === value);
      if (product) {
        updatedItems[index].product_name = product.product_name;
        updatedItems[index].product_code = product.product_code;
        updatedItems[index].unit_price_tax_excluded = Math.round(product.selling_price / 1.1);
        updatedItems[index].unit_price_tax_included = product.selling_price;
        // 商品変更時は小計も自動で再計算
        updatedItems[index].subtotal =
          updatedItems[index].quantity_requested * product.selling_price;
      }
    }

    if (field === 'quantity_requested' || field === 'unit_price_tax_included') {
      updatedItems[index].subtotal =
        updatedItems[index].quantity_requested * updatedItems[index].unit_price_tax_included;
    }

    setItems(updatedItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleSave = async () => {
    if (!formData.customer_name) {
      toast.error('顧客名を入力してください');
      return;
    }

    if (items.length === 0) {
      toast.error('商品を1つ以上追加してください');
      return;
    }

    setIsLoading(true);
    try {
      const orderData = {
        ...formData,
        total_amount: calculateTotal(),
        status: 'pending',
      items: items };

      await onSave(orderData);
      toast.success('出庫指示を作成しました');
      handleClose();
    } catch (error) {
      console.error('Failed to save outbound order:', error);
      toast.error('出庫指示の作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      customer_name: '',
      request_date: new Date().toISOString().split('T')[0],
      due_date: '',
      shipping_address: '',
      notes: '' });
    setItems([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl w-full max-h-[92vh] p-0 bg-white dark:bg-gray-900 shadow-2xl"><DialogHeader className="p-8 pb-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800"><div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl"><Package className="w-7 h-7 text-blue-600 dark:text-blue-400" /></div>
      <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">新規出庫指示作成
              </DialogTitle>
            </div>
            <Button onClick={handleClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

      <div className="bg-white dark:bg-gray-900 min-h-full">{/* 発注書情報セクション */}
      <div className="border-b border-gray-200 dark:border-gray-600"><div className="p-6">
      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center mb-4"><FileText className="w-5 h-5 mr-2 text-blue-500" />
                発注書情報
              </h3>

              {/* 第1行: 仕入先、希望期日、備考 */}
              <div className="grid grid-cols-3 gap-6 mb-4">
                <div>
      <Label htmlFor="customer_name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">仕入先</Label> <SearchableSelect
                    options={[
                      { value: 'supplier1', label: '仕入先を選択', description: '' }
                    ]}
                    value={formData.customer_name}
                    onChange={(value) => setFormData({...formData, customer_name: value})}
                    placeholder="仕入先を選択"
                    className="w-full"
                    darkMode={true}
                  />
                </div>

                <div>
      <Label htmlFor="due_date" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">希望期日</Label> <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"/>
                </div>

                <div>
      <Label htmlFor="notes" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">備考</Label> <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="備考を入力"
      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"/>
                </div>
              </div>

              {/* 第2行: 発注日、送料設定 */}
              <div className="grid grid-cols-3 gap-6">
                <div>
      <Label htmlFor="request_date" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">発注日</Label> <Input
                    id="request_date"
                    type="date"
                    value={formData.request_date}
                    onChange={(e) => setFormData({...formData, request_date: e.target.value})}
      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"/>
                </div>

                <div>
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">送料</Label> <div className="flex items-center h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700"><span className="text-sm text-gray-600 dark:text-gray-400">¥</span> <span className="ml-2 text-sm text-gray-900 dark:text-gray-100 font-medium">0</span> </div>
                </div>

                <div></div>
              </div>
            </div>
          </div>

          {/* 商品明細セクション */}
      <div className="border-b border-gray-200 dark:border-gray-600"><div className="p-6">
              <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center"><Package className="w-5 h-5 mr-2 text-blue-500" />
                  商品明細 (1件)
                </h3>
                <Button
                  onClick={addItem}
      className="bg-blue-600 hover: bg-blue-700 text-white px-3 py-2 rounded text-sm flex items-center space-x-2"disabled={availableProducts.length === 0}
                >
                  <Plus className="w-4 h-4" />
                  <span>商品追加</span>
                </Button>
              </div>

              {/* 商品明細テーブル */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">{/* テーブルヘッダー */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300"><div className="col-span-5">商品検索</div>
                  <div className="col-span-2 text-center">数量</div>
                  <div className="col-span-2 text-center">単価 (税込)</div>
                  <div className="col-span-2 text-right">小計</div>
                  <div className="col-span-1"></div>
                </div>

                {/* 商品明細行 */}
      <div className="divide-y divide-gray-200 dark: divide-gray-600"><AnimatePresence>
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover: bg-gray-50 dark:hover:bg-gray-700">
                        <div className="col-span-5">
                          <SearchableSelect
                            options={availableProducts.map(product => ({
                              value: product.id,
                              label: product.product_name,
                              description: `${product.product_code}`
                            }))}
                            value={item.product_id}
                            onChange={(value) => updateItem(index, 'product_id', value)}
                            placeholder="商品を選択"
                            className="w-full"
                            darkMode={true}
                          />
                        </div>

                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity_requested}
                            onChange={(e) => updateItem(index, 'quantity_requested', parseInt(e.target.value) || 1)}
      className="w-full text-center bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"/>
                        </div>

                        <div className="col-span-2">
                          <div className="flex items-center">
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">¥</span> <Input
                              type="number"
                              min="0"
                              value={item.unit_price_tax_included}
                              onChange={(e) => updateItem(index, 'unit_price_tax_included', parseInt(e.target.value) || 0)}
      className="w-full text-right bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"/>
                          </div>
                        </div>

                        <div className="col-span-2 text-right">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">¥{item.subtotal.toLocaleString()}
                          </span>
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <Button
                            onClick={() => removeItem(index)}
                            variant="outline"
                            size="sm"
      className="text-red-600 hover: text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 p-1">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {items.length === 0 && availableProducts.length > 0 && (
                    <div className="px-4 py-8 text-center">
      <p className="text-gray-500 dark:text-gray-400 mb-4">商品を追加してください
                      </p>
                      <Button
                        onClick={addItem}
      className="bg-blue-600 hover: bg-blue-700 text-white px-4 py-2 rounded">
                        <Plus className="w-4 h-4 mr-2" />
                        商品を追加
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 備考・特記事項セクション */}
      <div className="border-b border-gray-200 dark:border-gray-600"><div className="p-6">
      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center"><FileText className="w-5 h-5 mr-2 text-blue-500" />
                備考・特記事項
              </h3>
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="緊急出荷、特別配送指示、梱包要求など..."
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
            </div>
          </div>

          {/* 合計金額セクション */}
          {items.length > 0 && (
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"><div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
      <Package className="w-7 h-7 text-blue-600 dark:text-blue-400 mr-2" /><div>
      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">出庫指示
                      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">合計金額 (税込)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">¥{calculateTotal().toLocaleString()}
                    </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{items.length}商品
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッターボタン */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center"><Button
            onClick={handleClose}
            variant="outline"
            size="lg"
      className="px-6 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2">
            <X className="w-4 h-4" />
            <span>キャンセル</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !formData.customer_name || items.length === 0}
            size="lg"
      className="px-6 py-2 text-sm font-medium bg-blue-600 hover: bg-blue-700 text-white flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>作成中...</span>
              </>
      ) : ( <>
                <FileText className="w-4 h-4" />
                <span>出庫指示を作成</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOutboundOrderModal;