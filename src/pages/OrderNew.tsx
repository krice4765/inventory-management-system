import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, FileText, Lock, Unlock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useDarkMode } from '../hooks/useDarkMode';
import SearchableSelect from '../components/SearchableSelect';
import type { Partner, Product, OrderFormData, OrderItem } from '../types';

export default function OrderNew() {
  const navigate = useNavigate();
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<OrderFormData>({
    partner_id: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_deadline: '',
    memo: '',
  });

  const [items, setItems] = useState<OrderItem[]>([
    { 
      product_id: '', 
      quantity: 1, 
      unit_price: 0, 
      total_amount: 0,
      quantity_locked: false,
      unit_price_locked: false
    }
  ]);

  const toggleQuantityLock = (index: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index 
        ? { ...item, quantity_locked: !item.quantity_locked }
        : item
    ));
  };

  const toggleUnitPriceLock = (index: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index 
        ? { ...item, unit_price_locked: !item.unit_price_locked }
        : item
    ));
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [partnersResult, productsResult] = await Promise.all([
        supabase
          .from('partners')
          .select('*')
          .eq('is_active', true)
          .in('partner_type', ['supplier', 'both'])
          .order('name'),
        
        supabase
          .from('products')
          .select('*')
          .order('product_name')
      ]);

      if (partnersResult.error) throw partnersResult.error;
      if (productsResult.error) throw productsResult.error;

      setPartners(partnersResult.data || []);
      setProducts(productsResult.data || []);
    } catch (error) {
      console.error('Master data fetch error:', error);
      toast.error('マスターデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    // 🚨 商品マスターのstandard_priceを参照（purchase_price → standard_price）
    const standardPrice = Number(product?.standard_price ?? 0);

    setItems(prev => prev.map((row, i) => {
      if (i !== index) return row;

      // 単価ロックされていない場合のみ商品マスターの価格を自動設定
      const nextUnitPrice = row.unit_price_locked ? row.unit_price : standardPrice;
      const nextQuantity = row.quantity_locked ? row.quantity : (isNaN(row.quantity) ? 1 : Math.max(1, Math.floor(row.quantity)));
      const nextTotal = (isNaN(nextQuantity) ? 0 : nextQuantity) * (isNaN(nextUnitPrice) ? 0 : nextUnitPrice);

      return {
        ...row,
        product_id: productId,
        unit_price: nextUnitPrice,
        quantity: nextQuantity,
        total_amount: nextTotal,
      };
    }));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index 
        ? { 
            ...item, 
            quantity: quantity, // 一時的にNaNや0を許容
            total_amount: quantity * item.unit_price 
          }
        : item
    ));
  };

  const handleUnitPriceChange = (index: number, unitPrice: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index 
        ? { 
            ...item, 
            unit_price: unitPrice, // 一時的にNaNを許容
            total_amount: item.quantity * unitPrice 
          }
        : item
    ));
  };

  const addItem = () => {
    setItems([
      ...items, 
      { 
        product_id: '', 
        quantity: 1, 
        unit_price: 0, 
        total_amount: 0,
        quantity_locked: false,
        unit_price_locked: false
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
      const amount = isNaN(item.total_amount) ? 0 : item.total_amount;
      return sum + amount;
    }, 0);
  };

  const getTaxAmount = () => {
    const total = getTotalAmount();
    return Math.floor(total * 0.1);
  };

  const getGrandTotal = () => {
    return getTotalAmount() + getTaxAmount();
  };

  const sanitizeRow = (row: OrderItem) => {
    const q = Math.max(1, isNaN(Number(row.quantity)) ? 1 : Math.floor(row.quantity));
    const p = Math.max(0, isNaN(Number(row.unit_price)) ? 0 : row.unit_price);
    return {
      ...row,
      quantity: q,
      unit_price: p,
      total_amount: q * p,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.partner_id) {
      toast.error('仕入先を選択してください');
      return;
    }

    if (!formData.delivery_deadline) {
      toast.error('納期を設定してください');
      return;
    }

    const sanitized = items.map(sanitizeRow);
    setItems(sanitized);
    const validItems = sanitized.filter(r => r.product_id && r.quantity > 0);

    if (validItems.length === 0) {
      toast.error('有効な明細行を追加してください');
      return;
    }

    // 🛡️ 重複商品チェック（OrderNew.tsx）
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
      const { data: orderNo, error: rpcError } = await supabase.rpc('generate_order_no');
      if (rpcError) throw rpcError;

      const grandTotal = getGrandTotal();

      // 🚨 緊急回避: 2段階処理でSupabaseライブラリの問題を回避
      const orderData = {
        order_no: orderNo,
        partner_id: formData.partner_id,
        order_date: formData.order_date,
        delivery_deadline: formData.delivery_deadline || null,
        total_amount: grandTotal,
        status: 'active',
        memo: formData.memo,
      };

      // 1段階目: INSERT （selectなし）
      const { error: insertError } = await supabase
        .from('purchase_orders')
        .insert([orderData]);

      if (insertError) throw insertError;

      // 2段階目: 作成されたorderを取得
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('order_no', orderNo)
        .single();

      if (orderError) throw orderError;

      const orderItems = validItems.map(item => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success(`発注書「${orderNo}」を作成しました`);
      navigate('/orders');
    } catch (error) {
      console.error('Purchase order creation error:', error);
      toast.error('発注書の作成に失敗しました');
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">新規発注書作成</h1>
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
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">発注書情報</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ヘッダー情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">仕入先</label>
              <SearchableSelect
                options={partners.map(partner => ({
                  value: partner.id,
                  label: partner.name,
                  description: `コード: ${partner.partner_code} | ${partner.partner_type === 'supplier' ? '仕入先' : '仕入先・顧客'}`
                }))}
                value={formData.partner_id}
                onChange={(value) => setFormData({ ...formData, partner_id: value })}
                placeholder="仕入先を選択"
                required
                darkMode={isDark}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">発注日</label>
              <input
                type="date"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">希望納期</label>
              <input
                type="date"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.delivery_deadline}
                onChange={(e) => setFormData({ ...formData, delivery_deadline: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">備考</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
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
                          description: `コード: ${product.product_code} | 標準価格: ¥${Number(product.standard_price || 0).toLocaleString()}`
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
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-700">
                            <div className="font-medium text-blue-900 dark:text-blue-100">{selectedProduct.product_name}</div>
                            <div className="flex justify-between mt-1">
                              <span>コード: {selectedProduct.product_code}</span>
                              <span>標準価格: ¥{Number(selectedProduct.standard_price || 0).toLocaleString()}</span>
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
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            item.quantity_locked 
                              ? 'bg-yellow-50 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-600 text-gray-900 dark:text-white' 
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                          }`}
                          value={isNaN(item.quantity) ? '' : item.quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numValue = parseInt(value, 10);
                            handleQuantityChange(index, numValue);
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            const validatedQuantity = Math.max(1, isNaN(value) ? 1 : Math.floor(value));
                            if (validatedQuantity !== item.quantity) {
                              handleQuantityChange(index, validatedQuantity);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => toggleQuantityLock(index)}
                          className={`p-2 rounded transition-colors ${
                            item.quantity_locked
                              ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                          title={item.quantity_locked ? '数量固定を解除' : '数量を固定'}
                        >
                          {item.quantity_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* 単価エリア */}
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        単価 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            item.unit_price_locked 
                              ? 'bg-orange-50 dark:bg-orange-900 border-orange-300 dark:border-orange-600 text-gray-900 dark:text-white' 
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                          }`}
                          value={isNaN(item.unit_price) ? '' : item.unit_price}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numValue = parseFloat(value);
                            handleUnitPriceChange(index, numValue);
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            const validatedPrice = Math.max(0, isNaN(value) ? 0 : value);
                            if (validatedPrice !== item.unit_price) {
                              handleUnitPriceChange(index, validatedPrice);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => toggleUnitPriceLock(index)}
                          className={`p-2 rounded transition-colors ${
                            item.unit_price_locked
                              ? 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                          title={item.unit_price_locked ? '単価固定を解除' : '単価を固定'}
                        >
                          {item.unit_price_locked ? <Lock className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* 合計金額エリア */}
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        合計金額
                      </label>
                      <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                        ¥{(isNaN(item.total_amount) ? 0 : item.total_amount).toLocaleString()}
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
                <div className="flex justify-between text-sm">
                  <span>小計:</span>
                  <span>¥{getTotalAmount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>消費税 (10%):</span>
                  <span>¥{getTaxAmount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 dark:border-gray-600 pt-2">
                  <span>合計:</span>
                  <span>¥{getGrandTotal().toLocaleString()}</span>
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
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '作成中...' : '発注書作成'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
