import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Minus, Package, Calendar, TrendingUp, TrendingDown, Filter, X, Search, AlertCircle, DollarSign, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import Select from 'react-select';
import { usePageState } from '../hooks/usePageState';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  current_stock: number;
  min_stock_level: number;
  standard_cost: number;
}

interface Transaction {
  id: string;
  transaction_no: string;
  parent_order_id: string | null;
}

interface PurchaseOrder {
  order_no: string;
}

interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment' | 'return';
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo: string;
  created_at: string;
  stock_after_transaction: number | null;
  reference_type: string | null;
  reference_id: string | null;
  products: Product;
  transaction: Transaction | null;
  purchase_order: PurchaseOrder | null;
}

const fetchMovements = async () => {
  // まずinventory_movementsを取得
  const { data: movements, error: movementsError } = await supabase
    .from('inventory_movements')
    .select(`
      id,
      product_id,
      movement_type,
      quantity,
      unit_price,
      total_amount,
      memo,
      created_at,
      stock_after_transaction,
      reference_type,
      reference_id,
      products (id, product_name, product_code, current_stock, min_stock_level, standard_cost)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (movementsError) throw movementsError;
  if (!movements) return [];

  // reference_idがあるものだけpurchase_ordersを取得
  const referenceIds = movements
    .filter(m => m.reference_id && m.reference_type === 'purchase_transaction')
    .map(m => m.reference_id);

  if (referenceIds.length === 0) {
    return movements.map(m => ({ ...m, transaction: null, purchase_order: null }));
  }

  // purchase_ordersを取得（reference_idが直接purchase_order_idを指している）
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('id, order_no')
    .in('id', referenceIds);

  // purchase_ordersに紐づくtransactionsを取得
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, transaction_no, parent_order_id')
    .in('parent_order_id', referenceIds);

  // データをマージ
  return movements.map(movement => {
    const purchaseOrder = purchaseOrders?.find(po => po.id === movement.reference_id) || null;
    const relatedTransactions = transactions?.filter(t => t.parent_order_id === movement.reference_id) || [];
    // 最新のtransactionを使用
    const transaction = relatedTransactions.length > 0 ? relatedTransactions[0] : null;

    return {
      ...movement,
      transaction,
      purchase_order: purchaseOrder,
    };
  });
};

const fetchProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('id, product_name, product_code, current_stock, min_stock_level, standard_cost')
    .order('product_name');

  if (error) throw error;
  return data || [];
};

export default function Inventory() {
  // ページ状態の保存・復元
  const { savePageState, restorePageState } = usePageState();

  // フィルター状態
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showQuickForm, setShowQuickForm] = useState(false);

  // ページ読み込み時に状態を復元
  useEffect(() => {
    const restored = restorePageState();
    if (restored && restored.filters) {
      const filters = restored.filters;
      if (filters.typeFilter) setTypeFilter(filters.typeFilter);
      if (filters.productFilter) setProductFilter(filters.productFilter);
      if (filters.searchText) setSearchText(filters.searchText);
      if (filters.dateFrom) setDateFrom(filters.dateFrom);
      if (filters.dateTo) setDateTo(filters.dateTo);
      if (filters.showFilters !== undefined) setShowFilters(filters.showFilters);
    }
  }, []);

  const [quickFormData, setQuickFormData] = useState({
    product_id: '',
    movement_type: 'in' as 'in' | 'out' | 'adjustment' | 'return',
    quantity: '',
    unit_price: '',
    memo: '',
  });

  const { data: movements, isLoading, isError, error, refetch, isFetching } = useQuery<InventoryMovement[], Error>({
    queryKey: ['inventory-movements'],
    queryFn: fetchMovements,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: products } = useQuery<Product[], Error>({
    queryKey: ['products-for-inventory'],
    queryFn: fetchProducts,
  });

  // 商品オプションをメモ化
  const productOptions = useMemo(() => {
    if (!products) return [];
    return products.map(product => ({
      value: product.id,
      label: `${product.product_name} (${product.product_code}) - 在庫: ${product.current_stock}`,
      current_stock: product.current_stock,
    }));
  }, [products]);

  // フィルター適用後のデータ
  const filteredMovements = useMemo(() => {
    if (!movements) return [];

    return movements.filter(movement => {
      // 種別フィルター
      if (typeFilter !== 'all' && movement.movement_type !== typeFilter) {
        return false;
      }

      // 商品フィルター
      if (productFilter && movement.product_id !== productFilter) {
        return false;
      }

      // テキスト検索（商品名、商品コード、メモ）
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const productName = movement.products.product_name.toLowerCase();
        const productCode = movement.products.product_code.toLowerCase();
        const memo = movement.memo?.toLowerCase() || '';

        if (!productName.includes(searchLower) &&
            !productCode.includes(searchLower) &&
            !memo.includes(searchLower)) {
          return false;
        }
      }

      // 日付範囲フィルター
      const movementDate = movement.created_at.split('T')[0];
      if (dateFrom && movementDate < dateFrom) {
        return false;
      }
      if (dateTo && movementDate > dateTo) {
        return false;
      }

      return true;
    });
  }, [movements, typeFilter, productFilter, searchText, dateFrom, dateTo]);

  // フィルタークリア
  const clearFilters = () => {
    setTypeFilter('all');
    setProductFilter('');
    setSearchText('');
    setDateFrom('');
    setDateTo('');
  };

  // アクティブなフィルター数
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (productFilter) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [typeFilter, productFilter, dateFrom, dateTo]);

  // 統計計算
  const stats = useMemo(() => {
    if (!filteredMovements) return { totalIn: 0, totalOut: 0, totalValue: 0, totalTransactions: 0 };

    const totalIn = filteredMovements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0);

    const totalOut = filteredMovements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0);

    const totalValue = filteredMovements
      .reduce((sum, m) => sum + m.total_amount, 0);

    return {
      totalIn,
      totalOut,
      totalValue,
      totalTransactions: filteredMovements.length,
    };
  }, [filteredMovements]);

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
        total_amount,
        memo: quickFormData.memo,
      }]);

      if (error) throw error;

      toast.success('在庫移動を記録しました');
      resetQuickForm();
      refetch();
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

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'in': return '入庫';
      case 'out': return '出庫';
      case 'adjustment': return '調整';
      case 'return': return '返品';
      default: return type;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'in': return 'bg-green-100 text-green-800';
      case 'out': return 'bg-red-100 text-red-800';
      case 'adjustment': return 'bg-yellow-100 text-yellow-800';
      case 'return': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded">
        エラーが発生しました: {error?.message ?? '不明なエラー'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-display font-bold text-white tracking-tight">在庫管理</h1>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                {isFetching ? '更新中…' : '最新表示に更新'}
              </button>
            </div>
            <p className="text-blue-100 mt-1 font-inter text-sm">商品の入出庫履歴を記録・管理</p>
          </div>
          <div className="flex items-center gap-3">
            <PageManual {...manuals.inventory} />
            <button
              onClick={() => setShowQuickForm(true)}
              className="flex items-center px-5 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-xl font-jakarta font-semibold"
            >
              <Package className="w-5 h-5 mr-2" />
              Quick入出庫
            </button>
          </div>
        </div>
      </div>

      {/* Quick Form Modal */}
      {showQuickForm && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Quick入出庫</h2>
            <p className="text-sm text-gray-500 mt-1">商品の入出庫を素早く記録</p>
          </div>

          <form onSubmit={handleQuickMovement} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">商品</label>
              <Select
                isClearable
                isSearchable
                required
                options={productOptions}
                value={productOptions.find(opt => opt.value === quickFormData.product_id) || null}
                onChange={(option) => setQuickFormData({ ...quickFormData, product_id: option?.value || '' })}
                placeholder="商品を選択..."
                noOptionsMessage={() => '該当する商品がありません'}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '0.75rem',
                    borderColor: '#d1d5db',
                    padding: '0.25rem',
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: '0.75rem',
                  }),
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">入出庫種別</label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={quickFormData.movement_type}
                onChange={(e) => setQuickFormData({ ...quickFormData, movement_type: e.target.value as 'in' | 'out' | 'adjustment' | 'return' })}
              >
                <option value="in">📥 入庫</option>
                <option value="out">📤 出庫</option>
                <option value="adjustment">⚙️ 調整</option>
                <option value="return">↩️ 返品</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">数量</label>
              <input
                type="number"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={quickFormData.quantity}
                onChange={(e) => setQuickFormData({ ...quickFormData, quantity: e.target.value })}
                placeholder="数量を入力"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">単価</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={quickFormData.unit_price}
                onChange={(e) => setQuickFormData({ ...quickFormData, unit_price: e.target.value })}
                placeholder="単価を入力"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">メモ</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={quickFormData.memo}
                onChange={(e) => setQuickFormData({ ...quickFormData, memo: e.target.value })}
                placeholder="メモを入力（任意）"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetQuickForm}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                記録する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総取引数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalTransactions}</p>
              {activeFilterCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">（全{movements?.length || 0}件中）</p>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Archive className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総入庫数</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalIn}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総出庫数</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{stats.totalOut}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingDown className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総取引金額</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                ¥{stats.totalValue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-8 h-8 text-purple-600" />
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

        {/* 検索ボックス */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="商品名、商品コード、メモで検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-gray-600"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
            </button>
          )}
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* 第1行: 種別と商品 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  移動種別
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  <option value="in">入庫</option>
                  <option value="out">出庫</option>
                  <option value="adjustment">調整</option>
                  <option value="return">返品</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  商品
                </label>
                <Select
                  isClearable
                  isSearchable
                  options={productOptions}
                  value={productOptions.find(opt => opt.value === productFilter) || null}
                  onChange={(option) => setProductFilter(option?.value || '')}
                  placeholder="商品を選択..."
                  noOptionsMessage={() => '該当する商品がありません'}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                      borderColor: '#e5e7eb',
                      borderWidth: '2px',
                      padding: '0.125rem',
                    }),
                    menu: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                    }),
                  }}
                />
              </div>
            </div>

            {/* 第2行: 日付範囲 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  開始日
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">
                  終了日
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* フィルタークリアボタン */}
            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4 mr-2" />
                  フィルターをクリア ({activeFilterCount})
                </button>
              </div>
            )}
          </div>
        )}

        {/* フィルター結果件数 */}
        <div className="mt-4 text-sm font-inter text-gray-600">
          {filteredMovements.length}件の在庫移動が見つかりました
        </div>
      </div>

      {/* 在庫移動履歴テーブル */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">入出庫履歴</h2>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-gradient-to-b from-slate-50 to-slate-100 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  移動日時
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  商品名
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  商品コード
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  種別
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  移動個数
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  移動後在庫数
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  単価
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  金額
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  関連伝票
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">
                  メモ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredMovements.map((movement, index) => (
                <tr key={movement.id} className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {new Date(movement.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
                    <div className="text-xxs text-gray-500">
                      {new Date(movement.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">
                    {movement.products.product_name}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {movement.products.product_code}
                  </td>
                  <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-md ${getMovementTypeColor(movement.movement_type)}`}>
                      {getMovementTypeLabel(movement.movement_type)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                    {movement.movement_type === 'out' ? '-' : '+'}{movement.quantity}
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold text-blue-700 border-r border-slate-200 whitespace-nowrap text-right">
                    {movement.products?.current_stock !== undefined ? Math.round(movement.products.current_stock) : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap text-right">
                    ¥{movement.unit_price.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                    ¥{movement.total_amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {movement.transaction && movement.reference_type === 'purchase_transaction' ? (
                      <div className="flex flex-col gap-0.5">
                        <Link
                          to={`/transactions/${movement.transaction.id}`}
                          state={savePageState({
                            filters: {
                              typeFilter,
                              productFilter,
                              searchText,
                              dateFrom,
                              dateTo,
                              showFilters,
                            },
                          })}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {movement.transaction.transaction_no}
                        </Link>
                        {movement.purchase_order && movement.reference_id && (
                          <Link
                            to={`/purchase-orders/${movement.reference_id}`}
                            state={savePageState({
                              filters: {
                                typeFilter,
                                productFilter,
                                searchText,
                                dateFrom,
                                dateTo,
                                showFilters,
                              },
                            })}
                            className="text-xxs text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            発注: {movement.purchase_order.order_no}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-xs truncate">
                    {movement.memo || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMovements.length === 0 && (
            <div className="text-center py-12">
              <Archive className="mx-auto h-12 w-12 text-gray-400" />
              {activeFilterCount > 0 ? (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">該当する在庫移動がありません</h3>
                  <p className="mt-1 text-sm text-gray-500">フィルター条件を変更してください</p>
                  <div className="mt-6">
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <X className="w-4 h-4 mr-2" />
                      フィルターをクリア
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">在庫移動履歴がありません</h3>
                  <p className="mt-1 text-sm text-gray-500">Quick入出庫から記録を開始してください</p>
                  <div className="mt-6">
                    <button
                      onClick={() => setShowQuickForm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Quick入出庫
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
