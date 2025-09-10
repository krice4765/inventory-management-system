import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { UniversalFilters } from '../components/shared/UniversalFilters';
import { safeYenFormat } from '../utils/safeFormatters';
import { useDarkMode } from '../hooks/useDarkMode';

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  category: string;
  standard_price: number;  // 🚨 修正: purchase_price → standard_price
  selling_price: number;
  current_stock: number;
  min_stock_level: number;
  created_at: string;
}

export default function Products() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState({
    searchKeyword: '',
    status: 'all',
    startDate: '',
    endDate: ''
  });

  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    category: '',
    standard_price: '',  // 🚨 修正: purchase_price → standard_price
    selling_price: '',
    current_stock: '',
    min_stock_level: '',
  });

  useEffect(() => {
    fetchProducts();
    
    // 在庫データの定期的な自動更新（30秒間隔）
    const interval = setInterval(fetchProducts, 30000);
    
    // ウィンドウフォーカス時の自動更新
    const handleFocus = () => fetchProducts();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // フィルター適用された商品リスト
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // 検索キーワードフィルター
      if (filters.searchKeyword) {
        const keyword = filters.searchKeyword.toLowerCase();
        const searchFields = [
          product.product_name,
          product.product_code,
          product.category
        ].join(' ').toLowerCase();
        
        if (!searchFields.includes(keyword)) return false;
      }

      // ステータスフィルター
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'low-stock' && product.current_stock >= product.min_stock_level) return false;
        if (filters.status === 'out-of-stock' && product.current_stock > 0) return false;
      }

      // 日付フィルター
      if (filters.startDate) {
        const productDate = new Date(product.created_at).toISOString().split('T')[0];
        if (productDate < filters.startDate) return false;
      }
      if (filters.endDate) {
        const productDate = new Date(product.created_at).toISOString().split('T')[0];
        if (productDate > filters.endDate) return false;
      }

      return true;
    });
  }, [products, filters]);

  const handleFiltersReset = () => {
    setFilters({
      searchKeyword: '',
      status: 'all', 
      startDate: '',
      endDate: ''
    });
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Products fetch error:', error);
      toast.error('商品データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const productData = {
        product_name: formData.product_name,  // 🚨 修正: name → product_name
        product_code: formData.product_code,
        category: formData.category,
        standard_price: parseFloat(formData.standard_price),  // 🚨 修正: purchase_price → standard_price
        selling_price: parseFloat(formData.selling_price),
        current_stock: parseInt(formData.current_stock),
        min_stock_level: parseInt(formData.min_stock_level),
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('商品を更新しました');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        toast.success('商品を作成しました');
      }

      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Product save error:', error);
      toast.error('商品の保存に失敗しました');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      product_name: product.product_name,
      product_code: product.product_code,
      category: product.category,
      standard_price: product.standard_price.toString(),  // 🚨 修正: purchase_price → standard_price
      selling_price: product.selling_price.toString(),
      current_stock: product.current_stock.toString(),
      min_stock_level: product.min_stock_level.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この商品を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('商品を削除しました');
      fetchProducts();
    } catch (error) {
      console.error('Product delete error:', error);
      toast.error('商品の削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      product_name: '',
      product_code: '',
      category: '',
      standard_price: '',  // 🚨 修正: purchase_price → standard_price
      selling_price: '',
      current_stock: '',
      min_stock_level: '',
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">商品データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">商品管理</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              新規商品
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

      {/* フィルターコンポーネント追加 */}
      <UniversalFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleFiltersReset}
        filterType="products"
      />

      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {editingProduct ? '商品編集' : '新規商品作成'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">商品名</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">商品コード</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">カテゴリ</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">標準単価</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.standard_price}
                onChange={(e) => setFormData({ ...formData, standard_price: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">販売単価</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">現在在庫</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">最小在庫レベル</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {editingProduct ? '更新' : '作成'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                商品情報
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                価格
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                在庫
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{product.product_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{product.product_code}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{product.category}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">標準: {safeYenFormat(product.standard_price)}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">販売: {safeYenFormat(product.selling_price)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">現在: {product.current_stock}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">最小: {product.min_stock_level}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(product)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-2 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
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
