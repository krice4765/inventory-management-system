import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { fetchDashboardStats, fetchRecentUpdates } from '../api/dashboard';

export const Dashboard: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  });

  const { data: recent = [], isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recent-updates'],
    queryFn: () => fetchRecentUpdates(10),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">ダッシュボードを読み込み中...</span>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="p-6 text-center text-red-600">
        ダッシュボードの取得に失敗しました。
        {error instanceof Error ? ` ${error.message}` : ''}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">登録商品数</div>
          <div className="mt-2 text-2xl font-semibold text-blue-600">
            {stats.totalProducts.toLocaleString()}
          </div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">安全在庫以下</div>
          <div className="mt-2 text-2xl font-semibold text-red-600">
            {stats.lowStockCount.toLocaleString()}
          </div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">在庫評価額</div>
          <div className="mt-2 text-2xl font-semibold text-green-600">
            ¥{stats.totalStockValue.toLocaleString()}
          </div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">潜在売上額</div>
          <div className="mt-2 text-2xl font-semibold text-purple-600">
            ¥{stats.totalPotentialRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 最近の更新 */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">最近の更新</h2>
        </div>
        
        {isLoadingRecent ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recent.map((item) => (
              <li key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">
                    コード: {item.product_code} | 
                    在庫: {item.stock_quantity} / 安全在庫: {item.safety_stock_quantity}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {new Date(item.updated_at).toLocaleString('ja-JP')}
                </div>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="px-6 py-8 text-center text-gray-500">
                最近の更新はありません
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};
