import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  totalValue: number;
}

export default function Dashboard() {
  console.log('[Dashboard] Component rendering');

  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalStock: 0,
    lowStockItems: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Dashboard] useEffect called, fetching stats...');
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    console.log('[Dashboard] fetchDashboardStats starting...');
    try {
      console.log('[Dashboard] Fetching products via direct fetch...');

      // Workaround: Use direct fetch instead of Supabase client due to hanging issue
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/products?select=id,current_stock,selling_price,min_stock_level`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const products = await response.json();
      console.log('[Dashboard] Fetch response:', { productsCount: products?.length });

      if (!Array.isArray(products)) {
        throw new Error('Invalid response format');
      }

      const totalProducts = products?.length || 0;
      const totalStock = products?.reduce((sum, product) => sum + (product.current_stock || 0), 0) || 0;
      const lowStockItems = products?.filter(product =>
        (product.current_stock || 0) <= (product.min_stock_level || 0)
      ).length || 0;
      const totalValue = products?.reduce((sum, product) =>
        sum + ((product.current_stock || 0) * (product.selling_price || 0)), 0
      ) || 0;

      console.log('[Dashboard] Stats calculated:', { totalProducts, totalStock, lowStockItems, totalValue });

      setStats({
        totalProducts,
        totalStock,
        lowStockItems,
        totalValue,
      });
      console.log('[Dashboard] Stats set successfully');
    } catch (error) {
      console.error('[Dashboard] Error caught:', error);
      toast.error('ダッシュボード情報の取得に失敗しました');
    } finally {
      console.log('[Dashboard] Setting loading to false');
      setLoading(false);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">ダッシュボード</h1>
          <p className="text-gray-600 mt-1 font-inter text-sm">リアルタイムの在庫状況と統計情報</p>
        </div>
        <button
          onClick={fetchDashboardStats}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-inter font-medium transition-colors"
        >
          更新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-inter font-medium text-gray-600">総商品数</p>
              <p className="text-2xl font-display font-semibold text-gray-900 tabular-nums">{stats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-inter font-medium text-gray-600">総在庫数</p>
              <p className="text-2xl font-display font-semibold text-gray-900 tabular-nums">{stats.totalStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-inter font-medium text-gray-600">在庫不足</p>
              <p className="text-2xl font-display font-semibold text-gray-900 tabular-nums">{stats.lowStockItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-inter font-medium text-gray-600">在庫評価額</p>
              <p className="text-2xl font-display font-semibold text-gray-900 tabular-nums">
                ¥{stats.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">システム概要</h2>
        <div className="prose text-gray-600">
          <p>在庫管理システムへようこそ。このダッシュボードでは、商品在庫の概要を確認できます。</p>
          <ul className="mt-4 space-y-2">
            <li>• <strong>商品管理</strong>: 商品マスターの登録・編集</li>
            <li>• <strong>在庫管理</strong>: 入出庫履歴の確認・Quick操作</li>
            <li>• <strong>取引先管理</strong>: 仕入先・販売先の管理</li>
            <li>• <strong>仕入伝票</strong>: 仕入取引の伝票管理</li>
          </ul>
        </div>
      </div>
    </div>
  );
}