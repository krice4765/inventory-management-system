import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MonthlyTrend {
  month: string;
  amount: number;
}

interface PaymentTrendChartProps {
  data: MonthlyTrend[];
}

export default function PaymentTrendChart({ data }: PaymentTrendChartProps) {
  // Custom tooltip to format currency
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-900">{payload[0].payload.month}</p>
          <p className="text-sm text-blue-600 font-bold mt-1">
            ¥{payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // Format Y-axis to show currency
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `¥${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `¥${(value / 1000).toFixed(0)}K`;
    }
    return `¥${value}`;
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#2563eb' }}
          name="支払金額"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
