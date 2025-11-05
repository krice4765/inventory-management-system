import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Download, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
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
} from 'recharts';

interface InventoryMovement {
  id: string;
  transaction_date: string;
  product_id: string;
  product_name: string;
  product_code: string;
  transaction_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

interface DailyMovement {
  date: string;
  in_quantity: number;
  out_quantity: number;
  net_quantity: number;
}

interface TransactionTypeSummary {
  type: string;
  quantity: number;
  percentage: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const TRANSACTION_TYPES = {
  in: { label: '入庫', color: '#10b981', icon: TrendingUp },
  out: { label: '出庫', color: '#ef4444', icon: TrendingDown },
  adjustment: { label: '調整', color: '#f59e0b', icon: RefreshCw },
};

export default function InventoryMovementReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [dailyMovements, setDailyMovements] = useState<DailyMovement[]>([]);
  const [transactionTypeSummary, setTransactionTypeSummary] = useState<TransactionTypeSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [totalInbound, setTotalInbound] = useState(0);
  const [totalOutbound, setTotalOutbound] = useState(0);
  const [totalAdjustment, setTotalAdjustment] = useState(0);

  useEffect(() => {
    fetchMovements();
  }, [selectedProduct, selectedType, startDate, endDate]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_transactions')
        .select(`
          id,
          transaction_date,
          product_id,
          transaction_type,
          quantity,
          reference_type,
          reference_id,
          notes,
          products (
            id,
            name,
            product_code
          )
        `);

      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }
      if (selectedProduct) {
        query = query.eq('product_id', selectedProduct);
      }
      if (selectedType) {
        query = query.eq('transaction_type', selectedType);
      }

      const { data, error } = await query.order('transaction_date', { ascending: false });

      if (error) throw error;

      const movementData: InventoryMovement[] = (data || []).map((item: any) => ({
        id: item.id,
        transaction_date: item.transaction_date,
        product_id: item.product_id,
        product_name: item.products?.name || '不明',
        product_code: item.products?.product_code || '',
        transaction_type: item.transaction_type,
        quantity: Math.abs(item.quantity || 0),
        reference_type: item.reference_type,
        reference_id: item.reference_id,
        notes: item.notes,
      }));

      setMovements(movementData);
      calculateSummaries(movementData);
      calculateDailyMovements(movementData);
      calculateTransactionTypeSummary(movementData);
    } catch (error: any) {
      console.error('Error fetching movements:', error);
      toast.error('在庫移動データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaries = (data: InventoryMovement[]) => {
    let inbound = 0;
    let outbound = 0;
    let adjustment = 0;

    data.forEach(movement => {
      switch (movement.transaction_type) {
        case 'in':
          inbound += movement.quantity;
          break;
        case 'out':
          outbound += movement.quantity;
          break;
        case 'adjustment':
          adjustment += movement.quantity;
          break;
      }
    });

    setTotalInbound(inbound);
    setTotalOutbound(outbound);
    setTotalAdjustment(adjustment);
  };

  const calculateDailyMovements = (data: InventoryMovement[]) => {
    const dailyMap = new Map<string, { in: number; out: number }>();

    // Get last 30 days
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, { in: 0, out: 0 });
    }

    data.forEach(movement => {
      const date = movement.transaction_date.split('T')[0];
      if (dailyMap.has(date)) {
        const daily = dailyMap.get(date)!;
        if (movement.transaction_type === 'in') {
          daily.in += movement.quantity;
        } else if (movement.transaction_type === 'out') {
          daily.out += movement.quantity;
        }
      }
    });

    const movements = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      in_quantity: stats.in,
      out_quantity: stats.out,
      net_quantity: stats.in - stats.out,
    }));

    setDailyMovements(movements);
  };

  const calculateTransactionTypeSummary = (data: InventoryMovement[]) => {
    const typeMap = new Map<string, number>();
    let total = 0;

    data.forEach(movement => {
      const type = TRANSACTION_TYPES[movement.transaction_type]?.label || movement.transaction_type;
      typeMap.set(type, (typeMap.get(type) || 0) + movement.quantity);
      total += movement.quantity;
    });

    const summary = Array.from(typeMap.entries()).map(([type, quantity]) => ({
      type,
      quantity,
      percentage: total > 0 ? (quantity / total) * 100 : 0,
    }));

    setTransactionTypeSummary(summary);
  };

  const exportToCSV = () => {
    const data = movements.map(movement => ({
      '取引日': formatDate(movement.transaction_date),
      '商品コード': movement.product_code,
      '商品名': movement.product_name,
      '取引区分': TRANSACTION_TYPES[movement.transaction_type]?.label || movement.transaction_type,
      '数量': movement.quantity,
      '参照': movement.reference_type || '',
      '備考': movement.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '在庫移動履歴');

    const fileName = `在庫移動履歴レポート_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success('CSVファイルをダウンロードしました');
  };

  const uniqueProducts = React.useMemo(() => {
    const productMap = new Map();
    movements.forEach(m => {
      if (!productMap.has(m.product_id)) {
        productMap.set(m.product_id, {
          id: m.product_id,
          code: m.product_code,
          name: m.product_name,
        });
      }
    });
    return Array.from(productMap.values());
  }, [movements]);

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
            <h1 className="text-2xl font-bold text-gray-900">在庫移動履歴レポート</h1>
            <p className="text-sm text-gray-500 mt-1">入出庫履歴と商品別移動の分析</p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="h-5 w-5 mr-2" />
          CSVエクスポート
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              商品
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべての商品</option>
              {uniqueProducts.map((product: any) => (
                <option key={product.id} value={product.id}>
                  {product.code} - {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              取引区分
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべての区分</option>
              <option value="in">入庫</option>
              <option value="out">出庫</option>
              <option value="adjustment">調整</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">総入庫数</p>
              <p className="text-3xl font-bold mt-2">{totalInbound.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">総出庫数</p>
              <p className="text-3xl font-bold mt-2">{totalOutbound.toLocaleString()}</p>
            </div>
            <TrendingDown className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">調整数</p>
              <p className="text-3xl font-bold mt-2">{totalAdjustment.toLocaleString()}</p>
            </div>
            <RefreshCw className="h-12 w-12 text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Movement Trend */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">日次入出庫推移（直近30日）</h2>
          {dailyMovements.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyMovements}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend />
                <Bar dataKey="in_quantity" name="入庫" fill="#10b981" />
                <Bar dataKey="out_quantity" name="出庫" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>

        {/* Transaction Type Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">取引区分別構成比</h2>
          {transactionTypeSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={transactionTypeSummary}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, quantity }) =>
                    `${type}: ${quantity.toLocaleString()}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="quantity"
                >
                  {transactionTypeSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              データがありません
            </div>
          )}
        </div>
      </div>

      {/* Transaction Type Summary Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">取引区分別集計</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  取引区分
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  構成比
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactionTypeSummary.length > 0 ? (
                transactionTypeSummary.map((item) => (
                  <tr key={item.type} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {item.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement History Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">在庫移動履歴</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  取引日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  取引区分
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  参照
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  備考
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movements.length > 0 ? (
                movements.map((movement) => {
                  const typeInfo = TRANSACTION_TYPES[movement.transaction_type];
                  const Icon = typeInfo?.icon || RefreshCw;

                  return (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(movement.transaction_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{movement.product_name}</div>
                        <div className="text-xs text-gray-500">{movement.product_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center text-sm text-gray-900">
                          <Icon className="h-4 w-4 mr-1" style={{ color: typeInfo?.color }} />
                          {typeInfo?.label || movement.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {movement.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {movement.reference_type || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {movement.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    在庫移動データがありません
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
