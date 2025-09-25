import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useDarkMode } from '../hooks/useDarkMode';
import SearchableSelect from '../components/SearchableSelect';
import { useCustomers } from '../hooks/usePartners';
import { useOutboundManagement, type CreateOutboundRequest } from '../hooks/useOutboundManagement';
import type { Product } from '../types';

interface OutboundOrderItem {
  product_id: string;
  quantity_requested: number;
  unit_price_tax_excluded: number;
}

interface OutboundFormData {
  customer_name: string;
  request_date: string;
  due_date: string;
  notes: string;
}

export default function OutboundOrderNew() {
  const navigate = useNavigate();
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  const { useCreateOutboundOrder } = useOutboundManagement();
  const createMutation = useCreateOutboundOrder();

  const [formData, setFormData] = useState<OutboundFormData>({
    customer_name: '',
    request_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const [items, setItems] = useState<OutboundOrderItem[]>([
    {
      product_id: '',
      quantity_requested: 1,
      unit_price_tax_excluded: 0
    }
  ]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, current_stock')
        .order('product_name');

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Products fetch error:', error);
      toast.error('商品データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    const customer = customers.find(c => c.id === customerId);
    setFormData(prev => ({
      ...prev,
      customer_name: customer?.name || ''
    }));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    const sellingPrice = Number(product?.selling_price ?? 0);

    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;

      return {
        ...item,
        product_id: productId,
        unit_price_tax_excluded: sellingPrice,
      };
    }));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index
        ? { ...item, quantity_requested: quantity }
        : item
    ));
  };

  const handleUnitPriceChange = (index: number, unitPrice: number) => {
    setItems(prev => prev.map((item, i) =>
      i === index
        ? { ...item, unit_price_tax_excluded: unitPrice }
        : item
    ));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        product_id: '',
        quantity_requested: 1,
        unit_price_tax_excluded: 0
      }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error('明細行は最低1行必要です');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      const taxRate = product?.tax_category === 'reduced_8' ? 0.08 : 0.10;
      const unitPriceTaxIncluded = Math.floor(item.unit_price_tax_excluded * (1 + taxRate));
      return sum + (unitPriceTaxIncluded * item.quantity_requested);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer || !formData.customer_name) {
      toast.error('顧客を選択してください');
      return;
    }

    if (!formData.due_date) {
      toast.error('希望納期を設定してください');
      return;
    }

    const validItems = items.filter(item => item.product_id && item.quantity_requested > 0);

    if (validItems.length === 0) {
      toast.error('有効な明細行を追加してください');
      return;
    }

    // 重複商品チェック
    const selectedProductIds = validItems.map(item => item.product_id);
    const uniqueSelectedIds = [...new Set(selectedProductIds)];

    if (selectedProductIds.length !== uniqueSelectedIds.length) {
      const duplicateIds = selectedProductIds.filter((id, index) => selectedProductIds.indexOf(id) !== index);
      const duplicateProducts = products.filter(p => duplicateIds.includes(p.id));
      const duplicateNames = duplicateProducts.map(p => p.product_name).join(', ');

      toast.error(`🚫 重複商品があります\n\n同じ商品が複数の明細行で選択されています:\n${duplicateNames}\n\n各商品は1つの明細行でのみ選択してください。`, {
        duration: 4000,
        style: {
          background: '#FEF2F2',
          border: '2px solid #F87171',
          color: '#DC2626',
          fontSize: '14px'
        }
      });
      return;
    }

    setSubmitting(true);

    try {
      const request: CreateOutboundRequest = {
        customer_name: formData.customer_name,
        request_date: formData.request_date,
        due_date: formData.due_date,
        notes: formData.notes,
        items: validItems
      };

      await createMutation.mutateAsync(request);

      toast.success('出庫指示を作成しました');
      navigate('/orders');
    } catch (error) {
      console.error('Outbound order creation error:', error);
      toast.error(error instanceof Error ? error.message : '出庫指示の作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              発注管理に戻る
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">新規出庫指示作成</h1>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Package className="h-6 w-6 text-green-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">出庫指示情報</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* ヘッダー情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  顧客 <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={customers.map(customer => ({
                    value: customer.id,
                    label: customer.name,
                    description: `コード: ${customer.partner_code} | ${customer.partner_type === 'customer' ? '顧客' : '顧客・仕入先'}`
                  }))}
                  value={selectedCustomer}
                  onChange={handleCustomerChange}
                  placeholder="顧客を選択"
                  required
                  darkMode={isDark}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  出庫依頼日
                </label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={formData.request_date}
                  onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  希望納期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  備考
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="備考を入力"
                />
              </div>
            </div>

            {/* 明細行 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">明細</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  行追加
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                      {/* 商品選択エリア */}
                      <div className="lg:col-span-5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          商品 <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={products.map(product => ({
                            value: product.id,
                            label: product.product_name,
                            description: `コード: ${product.product_code} | 販売価格: ¥${Number(product.selling_price || 0).toLocaleString()}`
                          }))}
                          value={item.product_id}
                          onChange={(value) => handleProductChange(index, value)}
                          placeholder="商品を選択"
                          required
                          darkMode={isDark}
                          className="text-sm"
                        />
                        {item.product_id && (() => {
                          const selectedProduct = products.find(p => p.id === item.product_id);
                          return selectedProduct ? (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700">
                              <div className="font-medium text-green-900 dark:text-green-100">{selectedProduct.product_name}</div>
                              <div className="flex justify-between mt-1">
                                <span>コード: {selectedProduct.product_code}</span>
                                <span>販売価格: ¥{Number(selectedProduct.selling_price || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                                  在庫: {selectedProduct.current_stock || 0}個
                                </span>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* 数量エリア */}
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          数量 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={isNaN(item.quantity_requested) ? '' : item.quantity_requested}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            handleQuantityChange(index, value);
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            const validatedQuantity = Math.max(1, isNaN(value) ? 1 : Math.floor(value));
                            if (validatedQuantity !== item.quantity_requested) {
                              handleQuantityChange(index, validatedQuantity);
                            }
                          }}
                        />
                      </div>

                      {/* 単価エリア */}
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          単価（税抜）<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={isNaN(item.unit_price_tax_excluded) ? '' : item.unit_price_tax_excluded}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            handleUnitPriceChange(index, value);
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            const validatedPrice = Math.max(0, isNaN(value) ? 0 : value);
                            if (validatedPrice !== item.unit_price_tax_excluded) {
                              handleUnitPriceChange(index, validatedPrice);
                            }
                          }}
                        />
                      </div>

                      {/* 合計金額エリア */}
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          合計金額（税込）
                        </label>
                        <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                          ¥{(() => {
                            const product = products.find(p => p.id === item.product_id);
                            const taxRate = product?.tax_category === 'reduced_8' ? 0.08 : 0.10;
                            const unitPriceTaxIncluded = Math.floor(item.unit_price_tax_excluded * (1 + taxRate));
                            const totalAmount = unitPriceTaxIncluded * item.quantity_requested;
                            return (isNaN(totalAmount) ? 0 : totalAmount).toLocaleString();
                          })()}
                        </div>
                      </div>

                      {/* 操作ボタンエリア */}
                      <div className="lg:col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-full bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800 border border-red-200 dark:border-red-700 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                          title="この明細行を削除"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 合計計算 */}
              <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-right space-y-2 text-gray-900 dark:text-white">
                  <div className="flex justify-between text-lg font-bold border-t border-gray-300 dark:border-gray-600 pt-2">
                    <span>合計金額（税込）:</span>
                    <span>¥{getTotalAmount().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 送信ボタン */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '作成中...' : '出庫指示作成'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}