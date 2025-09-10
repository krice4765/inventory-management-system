import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, Package, Sparkles, RefreshCw, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { UniversalFilters } from '../components/shared/UniversalFilters';
import { safeYenFormat } from '../utils/safeFormatters';
import { useDarkMode } from '../hooks/useDarkMode';
import { motion } from 'framer-motion';
import { ModernCard } from '../components/ui/ModernCard';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"
          />
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-4 text-lg font-medium text-gray-700 dark:text-gray-300"
          >
            商品データを読み込み中...
          </motion.span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-6 space-y-8"
      >
        {/* ヘッダー */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15 }}
              className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg"
            >
              <Package className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                商品管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">商品マスターの登録・管理</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={fetchProducts}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RefreshCw className="w-4 h-4" />
              更新
            </motion.button>
            <motion.button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-4 h-4" />
              新規商品
            </motion.button>
            <motion.button
              onClick={toggleDarkMode}
              className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? '☀️' : '🌙'}
            </motion.button>
          </div>
        </motion.div>

        {/* フィルターセクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ModernCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Filter className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">フィルター設定</h3>
            </div>
            <UniversalFilters
              filters={filters}
              onFiltersChange={setFilters}
              onReset={handleFiltersReset}
              filterType="products"
            />
          </ModernCard>
        </motion.div>

        {/* 商品作成・編集フォーム */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <ModernCard className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  whileHover={{ rotate: 15 }}
                  className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg"
                >
                  <Sparkles className="w-6 h-6 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {editingProduct ? '商品編集' : '新規商品作成'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">商品名</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">商品コード</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">カテゴリ</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">標準単価</label>
                  <input
                    type="number"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.standard_price}
                    onChange={(e) => setFormData({ ...formData, standard_price: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">販売単価</label>
                  <input
                    type="number"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">現在在庫</label>
                  <input
                    type="number"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="lg:col-span-1"
                >
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">最小在庫レベル</label>
                  <input
                    type="number"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm hover:shadow-md"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.45 }}
                  className="lg:col-span-2 flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
                >
                  <motion.button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold transition-all shadow-sm hover:shadow-md"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    キャンセル
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-semibold shadow-lg hover:shadow-xl transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {editingProduct ? '更新' : '作成'}
                  </motion.button>
                </motion.div>
              </form>
            </ModernCard>
          </motion.div>
        )}

        {/* 商品一覧テーブル */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ModernCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      商品情報
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      価格
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      在庫
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {filteredProducts.map((product, index) => (
                    <motion.tr 
                      key={product.id} 
                      className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ scale: 1.005 }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <motion.div
                            whileHover={{ rotate: 10 }}
                            className="p-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg shadow-md"
                          >
                            <Package className="h-6 w-6 text-white" />
                          </motion.div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">{product.product_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{product.product_code}</div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md mt-1 inline-block">{product.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">標準: <span className="text-green-600 dark:text-green-400">{safeYenFormat(product.standard_price)}</span></div>
                          <div className="text-sm font-medium text-purple-600 dark:text-purple-400">販売: {safeYenFormat(product.selling_price)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">現在:</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded-lg ${
                              product.current_stock <= product.min_stock_level
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            }`}>
                              {product.current_stock}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            最小: {product.min_stock_level}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Edit className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                  商品が見つかりませんでした
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  フィルター条件を変更するか、新しい商品を追加してください
                </p>
              </motion.div>
            )}
          </ModernCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
