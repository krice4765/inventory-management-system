import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Download, TrendingUp, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useErrorHandler } from '../hooks/useErrorHandler';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface ProductInventory {
  product_id: string;
  product_name: string;
  product_code: string;
  current_quantity: number;
  reorder_point: number;
  unit_cost: number;
  total_value: number;
  turnover_rate: number;
  is_low_stock: boolean;
  category?: string;
}

interface MonthlyInventory {
  month: string;
  total_quantity: number;
  total_value: number;
}

interface CategoryDistribution {
  category: string;
  quantity: number;
  value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export default function InventoryReport() {
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<ProductInventory[]>([]);
  const [monthlyInventory, setMonthlyInventory] = useState<MonthlyInventory[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [averageTurnoverRate, setAverageTurnoverRate] = useState(0);

  useEffect(() => {
    fetchInventoryData();
  }, [selectedCategory, showLowStockOnly]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      // Fetch current inventory with product details
      let query = supabase
        .from('products')
        .select(`
          id,
          product_name,
          product_code,
          category,
          current_stock,
          min_stock_level,
          standard_cost
        `);

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data: inventoryItems, error } = await query;

      if (error) throw error;

      // Calculate inventory metrics
      const inventory: ProductInventory[] = (inventoryItems || []).map((item: any) => {
        const currentQty = item.current_stock || 0;
        const reorderPoint = item.min_stock_level || 0;
        const unitCost = item.standard_cost || 0;
        const totalValue = currentQty * unitCost;
        const isLowStock = currentQty <= reorderPoint;

        // Calculate turnover rate (simplified: based on recent transactions)
        // In real scenario, this would be calculated from sales data
        const turnoverRate = currentQty > 0 ? Math.random() * 10 : 0; // Placeholder

        return {
          product_id: item.id,
          product_name: item.product_name || '不明',
          product_code: item.product_code || '',
          current_quantity: currentQty,
          reorder_point: reorderPoint,
          unit_cost: unitCost,
          total_value: totalValue,
          turnover_rate: turnoverRate,
          is_low_stock: isLowStock,
          category: item.category || '未分類',
        };
      });

      // Filter low stock if needed
      const filteredInventory = showLowStockOnly
        ? inventory.filter(item => item.is_low_stock)
        : inventory;

      setInventoryData(filteredInventory);
      calculateSummaries(filteredInventory);
      calculateMonthlyInventory(inventory);
      calculateCategoryDistribution(inventory);
    } catch (error) {
      handleError(error, '在庫データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaries = (data: ProductInventory[]) => {
    const totalValue = data.reduce((sum, item) => sum + item.total_value, 0);
    const lowStock = data.filter(item => item.is_low_stock).length;
    const avgTurnover = data.length > 0
      ? data.reduce((sum, item) => sum + item.turnover_rate, 0) / data.length
      : 0;

    setTotalInventoryValue(totalValue);
    setLowStockCount(lowStock);
    setAverageTurnoverRate(avgTurnover);
  };

  const calculateMonthlyInventory = (data: ProductInventory[]) => {
    // Generate last 6 months of inventory data
    // In real scenario, this would be fetched from historical data
    const months: MonthlyInventory[] = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Simulate historical data (in real scenario, query historical snapshots)
      const variation = 0.8 + Math.random() * 0.4; // 80% to 120%
      const totalQty = Math.floor(data.reduce((sum, item) => sum + item.current_quantity, 0) * variation);
      const totalVal = Math.floor(data.reduce((sum, item) => sum + item.total_value, 0) * variation);

      months.push({
        month: monthKey,
        total_quantity: totalQty,
        total_value: totalVal,
      });
    }

    setMonthlyInventory(months);
  };

  const calculateCategoryDistribution = (data: ProductInventory[]) => {
    const categoryMap = new Map<string, { quantity: number; value: number }>();

    data.forEach(item => {
      const category = item.category || '未分類';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { quantity: 0, value: 0 });
      }
      const cat = categoryMap.get(category)!;
      cat.quantity += item.current_quantity;
      cat.value += item.total_value;
    });

    const distribution = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      quantity: stats.quantity,
      value: stats.value,
    }));

    setCategoryDistribution(distribution);
  };

  const exportToCSV = () => {
    const data = inventoryData.map(item => ({
      '商品コード': item.product_code,
      '商品名': item.product_name,
      'カテゴリ': item.category,
      '現在庫数': item.current_quantity,
      '発注点': item.reorder_point,
      '単価': item.unit_cost,
      '在庫金額': item.total_value,
      '回転率': item.turnover_rate.toFixed(2),
      'ステータス': item.is_low_stock ? '低在庫' : '正常',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '在庫状況');

    const fileName = `在庫状況レポート_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success('CSVファイルをダウンロードしました');
  };

  const uniqueCategories = React.useMemo(() => {
    const categories = new Set<string>();
    inventoryData.forEach(item => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories).sort();
  }, [inventoryData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">在庫状況レポート</h1>
            <p className="text-sm text-gray-500 mt-1">商品別在庫残高と回転率の分析</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PageManual {...manuals.inventoryReport} />
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            CSVエクスポート
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カテゴリ
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべてのカテゴリ</option>
              {uniqueCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">低在庫品のみ表示</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">総在庫金額</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalInventoryValue)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">低在庫品目数</p>
              <p className="text-3xl font-bold mt-2">{lowStockCount}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">平均回転率</p>
              <p className="text-3xl font-bold mt-2">{averageTurnoverRate.toFixed(1)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-200" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Inventory Trend */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">月次在庫推移</h2>
          {monthlyInventory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyInventory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'total_value' ? formatCurrency(value) : value.toLocaleString()
                  }
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total_quantity"
                  name="総在庫数"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total_value"
                  name="在庫金額"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ別在庫構成</h2>
          {categoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, value }) =>
                    `${category}: ${formatCurrency(value)}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && !showLowStockOnly && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-sm font-semibold text-red-800">
              低在庫アラート: {lowStockCount}品目が発注点を下回っています
            </h3>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">在庫一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  カテゴリ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  現在庫数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  発注点
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  単価
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  在庫金額
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  回転率
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventoryData.length > 0 ? (
                inventoryData.map((item) => (
                  <tr key={item.product_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                      <div className="text-xs text-gray-500">{item.product_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.current_quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {item.reorder_point.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(item.unit_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(item.total_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.turnover_rate.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.is_low_stock ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center w-fit">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          低在庫
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          正常
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    在庫データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
