import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Minus, Package, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  product_code: string;
  current_stock: number;
}

interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo: string;
  created_at: string;
  products: Product;
}

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickForm, setShowQuickForm] = useState(false);

  const [quickFormData, setQuickFormData] = useState({
    product_id: '',
    movement_type: 'in' as 'in' | 'out',
    quantity: '',
    unit_price: '',
    memo: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsResult, movementsResult] = await Promise.all([
        supabase.from('products').select('id, name, product_code, current_stock').order('name'),
        supabase
          .from('inventory_movements')
          .select(`
            *,
            products (id, name, product_code, current_stock)
          `)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      setProducts(productsResult.data || []);
      setMovements(movementsResult.data || []);
    } catch (error) {
      console.error('Data fetch error:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const quantity = parseInt(quickFormData.quantity);
      const unitPrice = parseFloat(quickFormData.unit_price);
      const totalAmount = quantity * unitPrice;

      const { error } = await supabase.from('inventory_movements').insert([{
        product_id: quickFormData.product_id,
        movement_type: quickFormData.movement_type,
        quantity,
        unit_price: unitPrice,
        total_amount,        memo: quickFormData.memo,
      }]);

      if (error) throw error;

      toast.success('在庫移動を記録しました');
      resetQuickForm();
      fetchData();
    } catch (error) {
      console.error('Inventory movement error:', error);
      toast.error('在庫移動の記録に失敗しました');
    }
  };

  const resetQuickForm = () => {
    setQuickFormData({
      product_id: '',
      movement_type: 'in',
      quantity: '',
      unit_price: '',
      memo: '',
    });
    setShowQuickForm(false);
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
        <h1 className="text-3xl font-bold text-gray-900">在庫管理</h1>
        <button
          onClick={() => setShowQuickForm(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          <Package className="w-4 h-4 mr-2" />
          Quick入出庫
        </button>
      </div>

      {showQuickForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Quick入出庫</h2>
          <form onSubmit={handleQuickMovement} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">商品</label>
              <select
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                value={quickFormData.product_id}
                onChange={(e) => setQuickFormData({ ...quickFormData, product_id: e.target.value })}
              >
                <option value="">商品を選択</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.product_code}) - 在庫: {product.current_stock}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">入出庫種別</label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                value={quickFormData.movement_type}
                onChange={(e) => setQuickFormData({ ...quickFormData, movement_type: e.target.value as 'in' | 'out' })}
              >
                <option value="in">入庫</option>
                <option value="out">出庫</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">数量</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                value={quickFormData.quantity}
                onChange={(e) => setQuickFormData({ ...quickFormData, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">単価</label>
              <input
                type="number"
                step="0.01"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                value={quickFormData.unit_price}
                onChange={(e) => setQuickFormData({ ...quickFormData, unit_price: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">メモ</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                value={quickFormData.memo}
                onChange={(e) => setQuickFormData({ ...quickFormData, memo: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetQuickForm}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                記録
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">入出庫履歴</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  種別
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  単価
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メモ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <div className="text-sm text-gray-900">
                        {new Date(movement.created_at).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{movement.products.name}</div>
                    <div className="text-sm text-gray-500">{movement.products.product_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {movement.movement_type === 'in' ? (
                        <Plus className="h-4 w-4 text-green-600 mr-1" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        movement.movement_type === 'in' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movement.movement_type === 'in' ? '入庫' : '出庫'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {movement.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ¥{movement.unit_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ¥{movement.total_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {movement.memo}
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
