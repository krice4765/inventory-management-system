import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, Package, Search, Filter, X, TrendingUp, TrendingDown, AlertTriangle, ShoppingCart, DollarSign, Layers, LayoutGrid, Table } from 'lucide-react';
import toast from 'react-hot-toast';
import { Product } from '../types';
import DrawingInfoSection from '../components/DrawingInfoSection';
import { productFormSchema, ProductFormData } from '../lib/validations';
import { FormField, FormInput } from '../components/FormField';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // フィルター用のstate
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at_desc');

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      product_name: '',
      product_code: '',
      category: '',
      unit: '',
      tax_category: 'standard_10',
      standard_cost: 0,
      selling_price: 0,
      current_stock: 0,
      min_stock_level: 0,
      drawing_number: '',
      drawing_revision: '',
      drawing_name: '',
      drawing_notes: '',
      drawing_file_path: '',
      drawing_file_name: '',
    },
  });

  // Phase F2: 図面情報 - useFormで管理するため、watchで取得
  const drawingInfo = {
    drawing_number: watch('drawing_number') || null,
    drawing_revision: watch('drawing_revision') || null,
    drawing_name: watch('drawing_name') || null,
    drawing_notes: watch('drawing_notes') || null,
    drawing_file_path: watch('drawing_file_path') || null,
    drawing_file_name: watch('drawing_file_name') || null,
  };

  // localStorageから表示モードを読み込み
  useEffect(() => {
    const savedViewMode = localStorage.getItem('productViewMode');
    if (savedViewMode === 'card' || savedViewMode === 'table') {
      setViewMode(savedViewMode);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  // クエリパラメータ処理: edit=productId がある場合、該当商品の編集モーダルを開く
  useEffect(() => {
    const editProductId = searchParams.get('edit');
    if (editProductId && products.length > 0) {
      const productToEdit = products.find(p => p.id === editProductId);
      if (productToEdit) {
        handleEdit(productToEdit);
        // クエリパラメータをクリア
        setSearchParams({});
      }
    }
  }, [searchParams, products]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Products fetch error:', error);

      if (error?.code === '42501') {
        toast.error('商品データを閲覧する権限がありません。');
      } else if (error?.message) {
        toast.error(`商品データの取得に失敗しました: ${error.message}`);
      } else {
        toast.error('商品データの取得に失敗しました。ページを再読み込みしてください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: ProductFormData) => {
    try {
      const productData = {
        product_name: formData.product_name,
        product_code: formData.product_code,
        category: formData.category,
        unit: formData.unit || null,
        tax_category: formData.tax_category,
        standard_cost: formData.standard_cost,
        selling_price: formData.selling_price,
        current_stock: formData.current_stock,
        min_stock_level: formData.min_stock_level,
        // Phase F2: 図面情報を含める
        drawing_number: formData.drawing_number || null,
        drawing_revision: formData.drawing_revision || null,
        drawing_name: formData.drawing_name || null,
        drawing_notes: formData.drawing_notes || null,
        drawing_file_path: formData.drawing_file_path || null,
        drawing_file_name: formData.drawing_file_name || null,
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
    } catch (error: any) {
      console.error('Product save error:', error);

      // Supabaseエラーの詳細な処理
      if (error?.code) {
        switch (error.code) {
          case '23505': // unique_violation
            // エラーメッセージから制約名を抽出
            if (error.message?.includes('product_code')) {
              toast.error(`商品コード「${formData.product_code}」は既に登録されています。別の商品コードを使用してください。`);
            } else if (error.message?.includes('product_name')) {
              toast.error(`商品名「${formData.product_name}」は既に登録されています。`);
            } else {
              toast.error('この商品情報は既に登録されています。重複する項目を確認してください。');
            }
            break;

          case '23503': // foreign_key_violation
            toast.error('関連データが存在しないため、保存できませんでした。');
            break;

          case '23514': // check_violation
            toast.error('入力値が制約に違反しています。数値や形式を確認してください。');
            break;

          case '42P01': // undefined_table
            toast.error('システムエラー: テーブルが見つかりません。管理者に連絡してください。');
            break;

          case '42501': // insufficient_privilege
            toast.error('この操作を実行する権限がありません。');
            break;

          default:
            // その他のデータベースエラー
            if (error.message) {
              toast.error(`保存に失敗しました: ${error.message}`);
            } else {
              toast.error('商品の保存に失敗しました。入力内容を確認してください。');
            }
        }
      } else if (error?.message) {
        // Supabase以外のエラー
        toast.error(`エラー: ${error.message}`);
      } else {
        // 不明なエラー
        toast.error('商品の保存に失敗しました。しばらく時間をおいてから再度お試しください。');
      }
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    reset({
      product_name: product.product_name,
      product_code: product.product_code,
      category: product.category,
      unit: product.unit || '',
      tax_category: product.tax_category || 'standard_10',
      standard_cost: product.standard_cost,
      selling_price: product.selling_price,
      current_stock: product.current_stock,
      min_stock_level: product.min_stock_level,
      // Phase F2: 図面情報の読み込み
      drawing_number: product.drawing_number || '',
      drawing_revision: product.drawing_revision || '',
      drawing_name: product.drawing_name || '',
      drawing_notes: product.drawing_notes || '',
      drawing_file_path: product.drawing_file_path || '',
      drawing_file_name: product.drawing_file_name || '',
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
    } catch (error: any) {
      console.error('Product delete error:', error);

      if (error?.code) {
        switch (error.code) {
          case '23503': // foreign_key_violation
            toast.error('この商品は発注や在庫などで使用されているため削除できません。');
            break;

          case '42501': // insufficient_privilege
            toast.error('商品を削除する権限がありません。');
            break;

          default:
            if (error.message) {
              toast.error(`削除に失敗しました: ${error.message}`);
            } else {
              toast.error('商品の削除に失敗しました。');
            }
        }
      } else if (error?.message) {
        toast.error(`エラー: ${error.message}`);
      } else {
        toast.error('商品の削除に失敗しました。しばらく時間をおいてから再度お試しください。');
      }
    }
  };

  // カテゴリ一覧を取得（重複なし）
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  // 検索・フィルタリング・並び替え
  const filteredProducts = products
    .filter((product) => {
      // 検索クエリフィルター
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          (product.product_name && product.product_name.toLowerCase().includes(query)) ||
          (product.product_code && product.product_code.toLowerCase().includes(query)) ||
          (product.category && product.category.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // カテゴリフィルター
      if (categoryFilter !== 'all' && product.category !== categoryFilter) {
        return false;
      }

      // 在庫状況フィルター
      if (stockFilter === 'in_stock' && product.current_stock <= 0) {
        return false;
      }
      if (stockFilter === 'out_of_stock' && product.current_stock > 0) {
        return false;
      }
      if (stockFilter === 'low_stock' && product.current_stock > product.min_stock_level) {
        return false;
      }

      // 価格帯フィルター
      const min = minPrice ? parseFloat(minPrice) : 0;
      const max = maxPrice ? parseFloat(maxPrice) : Infinity;
      if (product.selling_price < min || product.selling_price > max) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // 並び替え
      switch (sortBy) {
        case 'name_asc':
          return a.product_name.localeCompare(b.product_name, 'ja');
        case 'name_desc':
          return b.product_name.localeCompare(a.product_name, 'ja');
        case 'price_asc':
          return a.selling_price - b.selling_price;
        case 'price_desc':
          return b.selling_price - a.selling_price;
        case 'stock_asc':
          return a.current_stock - b.current_stock;
        case 'stock_desc':
          return b.current_stock - a.current_stock;
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_at_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('productViewMode', mode);
  };

  const resetForm = () => {
    reset({
      product_name: '',
      product_code: '',
      category: '',
      unit: '',
      standard_cost: 0,
      selling_price: 0,
      current_stock: 0,
      min_stock_level: 0,
      // Phase F2: 図面情報もリセット
      drawing_number: '',
      drawing_revision: '',
      drawing_name: '',
      drawing_notes: '',
      drawing_file_path: '',
      drawing_file_name: '',
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 統計情報の計算
  const totalProducts = products.length;
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.current_stock * p.standard_cost), 0);
  const lowStockProducts = products.filter(p => p.current_stock <= p.min_stock_level).length;
  const outOfStockProducts = products.filter(p => p.current_stock === 0).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">商品管理</h1>
            <p className="text-blue-100 mt-1 font-inter text-sm">在庫状況と商品情報を管理</p>
          </div>
          <div className="flex items-center gap-3">
            <PageManual {...manuals.products} />
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-5 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-xl font-jakarta font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              新規商品登録
            </button>
          </div>
        </div>
      </div>

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総商品数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
              <p className="text-xs text-gray-500 mt-1">登録済み商品</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">在庫評価額</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">¥{totalInventoryValue.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">総在庫価値</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">発注必要</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{lowStockProducts}</p>
              <p className="text-xs text-gray-500 mt-1">発注点以下</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">在庫切れ</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{outOfStockProducts}</p>
              <p className="text-xs text-gray-500 mt-1">在庫なし商品</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <ShoppingCart className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 検索・フィルターセクション */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* フィルターヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-inter font-semibold text-gray-800 text-lg">フィルター</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showFilters ? '閉じる' : '開く'}
          </button>
        </div>

        {/* 検索ボックスと表示切り替え */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="商品名、商品コード、カテゴリで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-gray-600"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>

          {/* 表示切り替えボタン */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => handleViewModeChange('card')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="カード表示"
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-sm font-medium">カード</span>
            </button>
            <button
              onClick={() => handleViewModeChange('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="リスト表示"
            >
              <Table className="w-5 h-5" />
              <span className="text-sm font-medium">リスト</span>
            </button>
          </div>
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* 第1行: カテゴリと在庫状況 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">カテゴリ</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">在庫状況</label>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  <option value="in_stock">在庫あり</option>
                  <option value="out_of_stock">在庫切れ</option>
                  <option value="low_stock">発注点以下</option>
                </select>
              </div>
            </div>

            {/* 第2行: 価格帯と並び替え */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">最小価格</label>
                <input
                  type="number"
                  placeholder="¥0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">最大価格</label>
                <input
                  type="number"
                  placeholder="¥999999"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">並び替え</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="created_at_desc">登録日（新しい順）</option>
                  <option value="created_at_asc">登録日（古い順）</option>
                  <option value="name_asc">商品名（昇順）</option>
                  <option value="name_desc">商品名（降順）</option>
                  <option value="price_asc">価格（安い順）</option>
                  <option value="price_desc">価格（高い順）</option>
                  <option value="stock_asc">在庫数（少ない順）</option>
                  <option value="stock_desc">在庫数（多い順）</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* フィルター結果の表示 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            <span className="text-blue-600 font-semibold">{filteredProducts.length}</span>件の商品が見つかりました
          </div>
          {(categoryFilter !== 'all' || stockFilter !== 'all' || minPrice || maxPrice || sortBy !== 'created_at_desc') && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setStockFilter('all');
                setMinPrice('');
                setMaxPrice('');
                setSortBy('created_at_desc');
              }}
              className="text-sm px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <X className="w-4 h-4" />
              フィルターをクリア
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingProduct ? '商品情報を編集' : '新規商品登録'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {editingProduct ? '既存の商品情報を更新します' : '新しい商品を追加します'}
            </p>
          </div>
          <form onSubmit={handleFormSubmit(handleSubmit)} className="grid grid-cols-2 gap-4">
            <FormField label="商品名" required error={errors.product_name}>
              <FormInput
                type="text"
                error={errors.product_name}
                placeholder="例: マグロ刺身用"
                {...register('product_name')}
              />
            </FormField>

            <FormField label="商品コード" required error={errors.product_code}>
              <FormInput
                type="text"
                error={errors.product_code}
                placeholder="例: FISH-001"
                {...register('product_code')}
              />
            </FormField>

            <FormField label="カテゴリ" required error={errors.category}>
              <FormInput
                type="text"
                error={errors.category}
                placeholder="例: 鮮魚"
                {...register('category')}
              />
            </FormField>

            <FormField label="消費税区分" required error={errors.tax_category}>
              <select
                {...register('tax_category')}
                className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  errors.tax_category ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <option value="standard_10">標準税率 10%</option>
                <option value="reduced_8">軽減税率 8%</option>
              </select>
            </FormField>

            <FormField label="単位" error={errors.unit}>
              <FormInput
                type="text"
                error={errors.unit}
                placeholder="例: 個、kg、L"
                {...register('unit')}
              />
            </FormField>

            <FormField label="標準原価" required error={errors.standard_cost}>
              <FormInput
                type="number"
                min="0"
                step="0.01"
                error={errors.standard_cost}
                placeholder="0"
                {...register('standard_cost', { valueAsNumber: true })}
              />
            </FormField>

            <FormField label="販売単価" required error={errors.selling_price}>
              <FormInput
                type="number"
                min="0"
                step="0.01"
                error={errors.selling_price}
                placeholder="0"
                {...register('selling_price', { valueAsNumber: true })}
              />
            </FormField>

            <FormField label="現在在庫" required error={errors.current_stock}>
              <FormInput
                type="number"
                min="0"
                error={errors.current_stock}
                placeholder="0"
                {...register('current_stock', { valueAsNumber: true })}
              />
            </FormField>

            <FormField label="最小在庫レベル" required error={errors.min_stock_level}>
              <FormInput
                type="number"
                min="0"
                error={errors.min_stock_level}
                placeholder="0"
                {...register('min_stock_level', { valueAsNumber: true })}
              />
            </FormField>

            {/* Phase F2: 図面情報セクション */}
            <div className="col-span-2 mt-4">
              <DrawingInfoSection
                drawingInfo={drawingInfo}
                onDrawingInfoChange={(info) => {
                  // React Hook FormのsetValueを使用して各フィールドを更新
                  setValue('drawing_number', info.drawing_number || '');
                  setValue('drawing_revision', info.drawing_revision || '');
                  setValue('drawing_name', info.drawing_name || '');
                  setValue('drawing_notes', info.drawing_notes || '');
                  setValue('drawing_file_path', info.drawing_file_path || '');
                  setValue('drawing_file_name', info.drawing_file_name || '');
                }}
                targetId={editingProduct?.id}
                uploadType="product"
                title="標準図面情報"
              />
            </div>

            <div className="col-span-2 flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    処理中...
                  </span>
                ) : (
                  editingProduct ? '変更を保存' : '商品を登録'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 商品表示（カード/テーブル切り替え） */}
      {viewMode === 'table' ? (
        /* テーブル表示 */
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <table className="w-full border-collapse">
              <thead className="bg-gradient-to-b from-slate-50 to-slate-100 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">商品名</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">商品コード</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">カテゴリ</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">税率</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">単位</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">標準原価</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">販売単価</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">粗利率</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">現在庫</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">発注点</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">在庫状況</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredProducts.map((product, index) => {
                  const isLowStock = product.current_stock <= product.min_stock_level;
                  const isOutOfStock = product.current_stock === 0;
                  const profitRate = product.standard_cost > 0
                    ? Math.round(((product.selling_price - product.standard_cost) / product.selling_price) * 100)
                    : 0;

                  return (
                    <tr key={product.id} className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-3 py-2 text-xs text-slate-900 font-medium border-r border-slate-200 whitespace-nowrap">{product.product_name}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 font-mono border-r border-slate-200 whitespace-nowrap">{product.product_code}</td>
                      <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                          product.tax_category === 'reduced_8'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {product.tax_category === 'reduced_8' ? '8%' : '10%'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">{product.unit || '-'}</td>
                      <td className="px-3 py-2 text-xs text-right text-slate-900 font-medium border-r border-slate-200 whitespace-nowrap">
                        ¥{(product.standard_cost ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-emerald-700 font-medium border-r border-slate-200 whitespace-nowrap">
                        ¥{(product.selling_price ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-blue-600 font-medium border-r border-slate-200 whitespace-nowrap">
                        {profitRate > 0 ? `${profitRate}%` : '-'}
                      </td>
                      <td className={`px-3 py-2 text-xs text-right font-semibold border-r border-slate-200 whitespace-nowrap ${
                        isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-slate-900'
                      }`}>
                        {product.current_stock}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-slate-700 border-r border-slate-200 whitespace-nowrap">{product.min_stock_level}</td>
                      <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                        {isOutOfStock ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-md">
                            在庫切れ
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold text-orange-700 bg-orange-100 rounded-md">
                            発注必要
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-md">
                            在庫十分
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* カード表示 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
          const stockPercentage = (product.current_stock / Math.max(product.min_stock_level * 2, 1)) * 100;
          const isLowStock = product.current_stock <= product.min_stock_level;
          const isOutOfStock = product.current_stock === 0;

          return (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
            >
              {/* カードヘッダー */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate" title={product.product_name}>
                        {product.product_name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{product.product_code}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="編集"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* カードボディ */}
              <div className="p-4">
                {/* カテゴリバッジ */}
                <div className="mb-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Layers className="w-3 h-3 mr-1" />
                    {product.category}
                  </span>
                  {product.unit && (
                    <span className="ml-2 text-xs text-gray-500">単位: {product.unit}</span>
                  )}
                </div>

                {/* 価格情報 */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">標準原価</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ¥{(product.standard_cost ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">販売単価</span>
                    <span className="text-sm font-semibold text-green-600">
                      ¥{(product.selling_price ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">粗利率</span>
                    <span className="text-sm font-semibold text-blue-600">
                      {product.standard_cost > 0
                        ? `${Math.round(((product.selling_price - product.standard_cost) / product.selling_price) * 100)}%`
                        : '-'}
                    </span>
                  </div>
                </div>

                {/* 在庫情報 */}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">在庫状況</span>
                    {isOutOfStock ? (
                      <span className="px-2 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-full">
                        在庫切れ
                      </span>
                    ) : isLowStock ? (
                      <span className="px-2 py-1 text-xs font-bold text-orange-700 bg-orange-100 rounded-full">
                        発注必要
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full">
                        在庫十分
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">現在庫 / 発注点</span>
                    <span className="text-sm font-semibold">
                      <span className={isLowStock || isOutOfStock ? 'text-red-600' : 'text-gray-900'}>
                        {product.current_stock}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-gray-600">{product.min_stock_level}</span>
                    </span>
                  </div>

                  {/* 在庫バー */}
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isOutOfStock
                          ? 'bg-red-500'
                          : isLowStock
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* 商品が見つからない場合 */}
      {filteredProducts.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">商品が見つかりません</h3>
          <p className="text-gray-500">
            フィルター条件を変更するか、新しい商品を登録してください。
          </p>
        </div>
      )}
    </div>
  );
}
