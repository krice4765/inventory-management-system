import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, FileText, Check, X, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
}

interface Product {
  id: string;
  name: string;
  product_code: string;
  purchase_price: number;
}

interface PurchaseOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface PurchaseOrder {
  id: string;
  transaction_no: string;
  partner_id: string;
  purchase_date: string;
  payment_due_date: string;
  status: 'draft' | 'confirmed';
  total_amount: number;
  memo: string;
  created_at: string;
  partners: Partner;
  transaction_items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    products: Product;
  }>;
}

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    partner_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    payment_due_date: '',
    memo: '',
  });

  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, total_amount: 0 }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersResult, partnersResult, productsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id,
            transaction_no,
            partner_id,
            purchase_date:transaction_date,
            payment_due_date:due_date,
            status,
            total_amount,
            memo,
            created_at,
            partners (id, name, partner_code),
            transaction_items (
              product_id,
              quantity,
              unit_price,
              total_amount,
              products (id, name, product_code, purchase_price)
            )
          `)
          .eq('transaction_type', 'purchase')
          .order('created_at', { ascending: false }),
        
        supabase
          .from('partners')
          .select('id, name, partner_code')
          .eq('is_active', true)
          .in('partner_type', ['supplier', 'both']),
        
        supabase
          .from('products')
          .select('id, name, product_code, purchase_price')
          .order('name')
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (partnersResult.error) throw partnersResult.error;
      if (productsResult.error) throw productsResult.error;

      setPurchaseOrders(ordersResult.data || []);
      setPartners(partnersResult.data || []);
      setProducts(productsResult.data || []);
    } catch (error) {
      console.error('Data fetch error:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      unit_price: product ? product.purchase_price : 0,
      total_amount: newItems[index].quantity * (product ? product.purchase_price : 0)
    };
    setItems(newItems);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      quantity,
      total_amount: quantity * newItems[index].unit_price
    };
    setItems(newItems);
  };

  const handleUnitPriceChange = (index: number, unitPrice: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      unit_price: unitPrice,
      total_amount: newItems[index].quantity * unitPrice
    };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total_amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error('明細行は最低1行必要です');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_amount, 0);
  };

  const getTaxAmount = () => {
    return Math.floor(getTotalAmount() * 0.1);
  };

  const getGrandTotal = () => {
    return getTotalAmount() + getTaxAmount();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.partner_id) {
      toast.error('仕入先を選択してください');
      return;
    }

    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('有効な明細行を追加してください');
      return;
    }

    try {
      // 伝票番号の生成
      const { data: transactionNo, error: rpcError } = await supabase
        .rpc('generate_transaction_no', { transaction_type: 'purchase' });

      if (rpcError) throw rpcError;

      const totalAmount = getGrandTotal();

      // トランザクション作成
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          transaction_no: transactionNo,
          transaction_type: 'purchase',
          partner_id: formData.partner_id,
          transaction_date: formData.purchase_date,
          due_date: formData.payment_due_date || null,
          status: 'draft',
          total_amount: totalAmount,
          memo: formData.memo,
        }])
        .select()
        .single();

      if (transactionError) throw transactionError;

      // 明細行作成
      const transactionItems = validItems.map(item => ({
        transaction_id: transaction.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems);

      if (itemsError) throw itemsError;

      toast.success(`仕入伝票「${transactionNo}」を作成しました`);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Purchase order creation error:', error);
      toast.error('仕入伝票の作成に失敗しました');
    }
  };

  const handleConfirm = async (id: string) => {
    if (!confirm('伝票を確定しますか？確定後は在庫が更新されます。')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'confirmed' })
        .eq('id', id);

      if (error) throw error;

      toast.success('伝票を確定しました');
      fetchData();
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error('伝票の確定に失敗しました');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('伝票を下書きに戻しますか？在庫への影響が取り消されます。')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'draft' })
        .eq('id', id);

      if (error) throw error;

      toast.success('伝票を下書きに戻しました');
      fetchData();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('伝票の取消に失敗しました');
    }
  };

  const handleDelete = async (id: string, status: string) => {
    if (status === 'confirmed') {
      toast.error('確定済みの伝票は削除できません。先に下書きに戻してください。');
      return;
    }

    if (!confirm('この伝票を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('伝票を削除しました');
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('伝票の削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      partner_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      payment_due_date: '',
      memo: '',
    });
    setItems([{ product_id: '', quantity: 1, unit_price: 0, total_amount: 0 }]);
    setShowForm(false);
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">仕入伝票管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          新規仕入伝票
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">新規仕入伝票作成</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">仕入先</label>
                <select
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
                <label className="block text-sm font-medium text-gray-700">仕入日</label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">支払期限</label>
                <input
                  type="date"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.payment_due_date}
                  onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">備考</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">明細</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  行追加
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left">商品</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">数量</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">単価</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">小計</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 px-4 py-2">
                          <select
                            className="w-full border border-gray-300 rounded px-2 py-1"
                            value={item.product_id}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                          >
                            <option value="">商品を選択</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.product_code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            className="w-full border border-gray-300 rounded px-2 py-1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="w-full border border-gray-300 rounded px-2 py-1"
                            value={item.unit_price}
                            onChange={(e) => handleUnitPriceChange(index, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          ¥{item.total_amount.toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 bg-gray-50 p-4 rounded">
                <div className="text-right space-y-2">
                  <div className="flex justify-between">
                    <span>小計:</span>
                    <span>¥{getTotalAmount().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>消費税 (10%):</span>
                    <span>¥{getTaxAmount().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>合計:</span>
                    <span>¥{getGrandTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                伝票作成
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">仕入伝票一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  伝票情報
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  仕入先
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchaseOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{order.transaction_no}</div>
                        <div className="text-sm text-gray-500">
                          <Calendar className="inline w-4 h-4 mr-1" />
                          {new Date(order.purchase_date).toLocaleDateString('ja-JP')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.partners.name}</div>
                    <div className="text-sm text-gray-500">{order.partners.partner_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">¥{order.total_amount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      order.status === 'confirmed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status === 'confirmed' ? '確定' : '下書き'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {order.status === 'draft' ? (
                      <button
                        onClick={() => handleConfirm(order.id)}
                        className="text-green-600 hover:text-green-900 mr-2"
                        title="確定"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCancel(order.id)}
                        className="text-orange-600 hover:text-orange-900 mr-2"
                        title="取消"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(order.id, order.status)}
                      className="text-red-600 hover:text-red-900"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}