import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Minus, Package, Calendar, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDarkMode } from '../hooks/useDarkMode';

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
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'in' | 'out'>('all');

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

  // 検索・フィルタリング機能
  useEffect(() => {
    if (!movements.length) return;

    let filtered = movements.filter(movement => {
      const matchesSearch = !searchTerm || (
        movement.products.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.products.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.memo.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesType = movementTypeFilter === 'all' || movement.movement_type === movementTypeFilter;

      return matchesSearch && matchesType;
    });

    setFilteredMovements(filtered);
  }, [movements, searchTerm, movementTypeFilter]);

  const fetchData = async () => {
    try {
      const [productsResult, movementsResult] = await Promise.all([
        supabase.from('products').select('id, product_name, product_code, current_stock').order('product_name'),
        supabase
          .from('inventory_movements')
          .select(`
            *,
            products (id, product_name, product_code, current_stock)
          `)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      setProducts(productsResult.data || []);
      setMovements(movementsResult.data || []);
      setFilteredMovements(movementsResult.data || []);
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
      const _totalAmount = quantity * unitPrice;

      const { error } = await supabase.from('inventory_movements').insert([{
        product_id: quickFormData.product_id,
        movement_type: quickFormData.movement_type,
        quantity,
        unit_price: unitPrice,
        total_amount: _totalAmount,
        memo: quickFormData.memo,
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

  const clearFilters = () => {
    setSearchTerm('');
    setMovementTypeFilter('all');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">在庫データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">在庫管理システム</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuickForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <Package className="w-4 h-4 mr-2" />
              Quick入出庫
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* 検索・フィルター機能 */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* 検索バー */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="商品名・商品コード・メモで検索..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 移動種別フィルター */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">種別:</label>
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value as 'all' | 'in' | 'out')}
              >
                <option value="all">すべて</option>
                <option value="in">入庫</option>
                <option value="out">出庫</option>
              </select>
            </div>

            {/* クリアボタン */}
            {(searchTerm || movementTypeFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4 mr-1" />
                クリア
              </button>
            )}
          </div>

          {/* 検索結果数表示 */}
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {searchTerm || movementTypeFilter !== 'all' ? (
              <span>
                {filteredMovements.length}件の結果 (全{movements.length}件中)
              </span>
            ) : (
              <span>全{movements.length}件の入出庫履歴</span>
            )}
          </div>
        </div>

      {showQuickForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Quick入出庫</h2>
          <form onSubmit={handleQuickMovement} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">商品</label>
              <select
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.product_id}
                onChange={(e) => setQuickFormData({ ...quickFormData, product_id: e.target.value })}
              >
                <option value="">商品を選択</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name} ({product.product_code}) - 在庫: {product.current_stock}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">入出庫種別</label>
              <select
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.movement_type}
                onChange={(e) => setQuickFormData({ ...quickFormData, movement_type: e.target.value as 'in' | 'out' })}
              >
                <option value="in">入庫</option>
                <option value="out">出庫</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">数量</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.quantity}
                onChange={(e) => setQuickFormData({ ...quickFormData, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">単価</label>
              <input
                type="number"
                step="0.01"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.unit_price}
                onChange={(e) => setQuickFormData({ ...quickFormData, unit_price: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">メモ</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={quickFormData.memo}
                onChange={(e) => setQuickFormData({ ...quickFormData, memo: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetQuickForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
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
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  商品
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  種別
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  単価
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  メモ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">該当する履歴が見つかりません</p>
                      <p className="text-sm">
                        {searchTerm || movementTypeFilter !== 'all' 
                          ? '検索条件を変更してお試しください' 
                          : '入出庫履歴がまだありません'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div>{new Date(movement.created_at).toLocaleDateString('ja-JP')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(movement.created_at).toLocaleTimeString('ja-JP')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{movement.products.product_name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{movement.products.product_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {movement.movement_type === 'in' ? (
                        <Plus className="h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-600 dark:text-red-400 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        movement.movement_type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {movement.movement_type === 'in' ? '入庫' : '出庫'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {movement.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ¥{movement.unit_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ¥{movement.total_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {movement.memo}
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
