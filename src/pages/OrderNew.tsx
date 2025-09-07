import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, FileText, Lock, Unlock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Partner, Product, OrderFormData, OrderItem } from '../types';

export default function OrderNew() {
  const navigate = useNavigate();
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
          .order('name')
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
    const purchasePrice = Number(product?.purchase_price ?? 0);

    setItems(prev => prev.map((row, i) => {
      if (i !== index) return row;

      const nextUnitPrice = row.unit_price_locked ? row.unit_price : purchasePrice;
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

    const sanitized = items.map(sanitizeRow);
    setItems(sanitized);
    const validItems = sanitized.filter(r => r.product_id && r.quantity > 0);

    if (validItems.length === 0) {
      toast.error('有効な明細行を追加してください');
      return;
    }

    setSubmitting(true);

    try {
      const { data: orderNo, error: rpcError } = await supabase.rpc('generate_order_no');
      if (rpcError) throw rpcError;

      const grandTotal = getGrandTotal();

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert([{
          order_no: orderNo,
          partner_id: formData.partner_id,
          order_date: formData.order_date,
          delivery_deadline: formData.delivery_deadline || null,
          total_amount: grandTotal,
          status: 'active',
          memo: formData.memo,
        }])
        .select()
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            発注管理に戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">新規発注書作成</h1>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">発注書情報</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ヘッダー情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">仕入先</label>
              <select
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.partner_id}
                onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
              >
                <option value="">仕入先を選択</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.partner_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">発注日</label>
              <input
                type="date"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">希望納期</label>
              <input
                type="date"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.delivery_deadline}
                onChange={(e) => setFormData({ ...formData, delivery_deadline: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">備考</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="備考を入力"
              />
            </div>
          </div>

          {/* 明細行 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">明細</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                行追加
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      商品
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      数量
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      単価
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      小計
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3">
                        <select
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={item.product_id}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                        >
                          <option value="">商品を選択</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.product_name} ({product.product_code})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className={`flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              item.quantity_locked 
                                ? 'bg-yellow-50 border-yellow-300' 
                                : 'border-gray-300'
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
                            className={`p-1 rounded text-xs transition-colors ${
                              item.quantity_locked
                                ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            title={item.quantity_locked ? '数量固定を解除' : '数量を固定'}
                          >
                            {item.quantity_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={`flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              item.unit_price_locked 
                                ? 'bg-orange-50 border-orange-300' 
                                : 'border-gray-300'
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
                            className={`p-1 rounded text-xs transition-colors ${
                              item.unit_price_locked
                                ? 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            title={item.unit_price_locked ? '単価固定を解除' : '単価を固定'}
                          >
                            {item.unit_price_locked ? <Lock className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm font-medium">
                        ¥{(isNaN(item.total_amount) ? 0 : item.total_amount).toLocaleString()}
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="行削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 合計計算 */}
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <div className="text-right space-y-2">
                <div className="flex justify-between text-sm">
                  <span>小計:</span>
                  <span>¥{getTotalAmount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>消費税 (10%):</span>
                  <span>¥{getTaxAmount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>合計:</span>
                  <span>¥{getGrandTotal().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '作成中...' : '発注書作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
