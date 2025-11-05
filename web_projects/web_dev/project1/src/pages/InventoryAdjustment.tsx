import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Edit2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  current_stock: number;
  min_stock_level: number;
}

export default function InventoryAdjustment() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [adjustFormData, setAdjustFormData] = useState({
    quantity: '',
    reason: '',
  });

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, current_stock, min_stock_level')
        .eq('id', productId)
        .single();

      if (error) throw error;

      setProduct(data);
    } catch (error) {
      console.error('Product fetch error:', error);
      toast.error('商品情報の取得に失敗しました');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) return;

    try {
      const quantity = parseInt(adjustFormData.quantity);

      // quantityが有効な数値かチェック
      if (isNaN(quantity) || quantity === 0) {
        toast.error('有効な調整数量を入力してください');
        return;
      }

      const isPositive = quantity > 0;
      const absQuantity = Math.abs(quantity);

      // 出庫時に在庫不足チェック
      if (!isPositive && absQuantity > product.current_stock) {
        toast.error(
          `在庫不足：現在在庫${product.current_stock}個に対して${absQuantity}個の出庫はできません`,
          { duration: 5000 }
        );
        return;
      }

      // 在庫調整は単価0で記録
      const { error } = await supabase.from('inventory_movements').insert([{
        product_id: product.id,
        movement_type: isPositive ? 'in' : 'out',
        quantity: absQuantity,
        unit_price: 0,
        total_amount: 0,
        memo: adjustFormData.reason,
      }]);

      if (error) throw error;

      const newStock = isPositive ? product.current_stock + absQuantity : product.current_stock - absQuantity;
      toast.success(
        `${product.product_name}の在庫を${quantity > 0 ? '+' : ''}${quantity}調整しました（${product.current_stock} → ${newStock}）`,
        { duration: 4000 }
      );

      // 在庫管理ページに戻る
      navigate('/inventory');
    } catch (error) {
      console.error('Inventory adjustment error:', error);
      toast.error('在庫調整の記録に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600">商品が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/inventory')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            在庫調整
          </h1>
          <p className="mt-2 text-gray-600">商品の在庫数量を調整します</p>
        </div>
      </div>

      {/* Adjustment Form */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">調整対象商品</h2>
              <p className="text-sm text-gray-500 mt-1">
                {product.product_name} ({product.product_code})
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">現在在庫</p>
              <p className="text-3xl font-mono font-bold text-blue-600">
                {product.current_stock}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAdjustment} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              調整数量 <span className="text-gray-500 font-normal">(+50で入庫、-10で出庫)</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={adjustFormData.quantity}
              onChange={(e) => setAdjustFormData({ ...adjustFormData, quantity: e.target.value })}
              placeholder="例: +50 または -10"
            />

            {/* クイックアクションボタン */}
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">クイックアクション:</p>
              <div className="flex flex-wrap gap-2">
                {[100, 50, 10].map((value) => (
                  <button
                    key={`plus-${value}`}
                    type="button"
                    onClick={() => setAdjustFormData({ ...adjustFormData, quantity: `+${value}` })}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-all"
                  >
                    +{value}
                  </button>
                ))}
                {[10, 50, 100].map((value) => (
                  <button
                    key={`minus-${value}`}
                    type="button"
                    onClick={() => setAdjustFormData({ ...adjustFormData, quantity: `-${value}` })}
                    className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-all"
                  >
                    -{value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">理由</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={adjustFormData.reason}
              onChange={(e) => setAdjustFormData({ ...adjustFormData, reason: e.target.value })}
              placeholder="例: 初期在庫登録"
            />

            {/* 理由サジェスト */}
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">よく使う理由:</p>
              <div className="flex flex-wrap gap-2">
                {['初期在庫登録', '棚卸調整', '破損', '返品', '入荷', '出荷'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setAdjustFormData({ ...adjustFormData, reason })}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-all"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <Edit2 className="w-4 h-4 inline mr-2" />
              調整を記録
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
