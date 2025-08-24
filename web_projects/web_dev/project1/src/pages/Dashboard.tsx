import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  DollarSign,
} from 'lucide-react';
import { StatsCard } from '../components/Dashboard/StatsCard';
import { RecentActivity } from '../components/Dashboard/RecentActivity';
import { supabase } from '../lib/supabase';

export const Dashboard: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => supabase.dashboard.getStats(),
  });

  const { data: recentMovements } = useQuery({
    queryKey: ['recent-movements'],
    queryFn: () => supabase.stockMovements.getRecent(10),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600">
          在庫管理システムの概要と最新の活動状況
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="総商品数"
          value={stats?.data?.total_products || 0}
          icon={Package}
          color="blue"
        />
        <StatsCard
          title="在庫不足商品"
          value={stats?.data?.low_stock_products || 0}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="本日の売上"
          value={`¥${(stats?.data?.total_sales_today || 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatsCard
          title="今月の売上"
          value={`¥${(stats?.data?.total_sales_month || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* 最近の活動 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity movements={recentMovements?.data || []} />
        
        {/* 在庫不足警告 */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">在庫不足警告</h3>
          </div>
          <div className="p-6">
            <div className="text-center text-gray-500">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                在庫不足商品なし
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                すべての商品が適切な在庫レベルを維持しています
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">クイックアクション</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <div>
                <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-600 ring-4 ring-white">
                  <Package className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  新規商品登録
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  新しい商品を在庫に追加
                </p>
              </div>
            </button>

            <button className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-600 ring-4 ring-white">
                  <ShoppingCart className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  売上記録
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  新しい売上を記録
                </p>
              </div>
            </button>

            <button className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <div>
                <span className="rounded-lg inline-flex p-3 bg-yellow-50 text-yellow-600 ring-4 ring-white">
                  <TrendingUp className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  仕入記録
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  新しい仕入を記録
                </p>
              </div>
            </button>

            <button className="relative group bg-gray-50 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-600 ring-4 ring-white">
                  <AlertTriangle className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  在庫調整
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  在庫数量を調整
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};