import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  Clock, 
  DollarSign,
  BarChart3,
  Calendar
} from 'lucide-react';
import { ModernCard } from './ui/ModernCard';
import { formatNumber } from '../utils/format';

interface Transaction {
  status?: string;
  total_amount?: number | string;
  created_at?: string;
}

interface ModernStatsBarProps {
  items: Transaction[];
}

export function ModernStatsBar({ items }: ModernStatsBarProps) {
  const stats = React.useMemo(() => {
    const confirmedCount = items.filter(t => t.status === 'confirmed').length;
    const unconfirmedCount = items.filter(t => t.status !== 'confirmed').length;
    const totalAmount = items.reduce((sum, t) => sum + (Number(t.total_amount ?? 0) || 0), 0);
    
    const today = new Date().toDateString();
    const todayCount = items.filter(t => 
      t.created_at && new Date(t.created_at).toDateString() === today
    ).length;

    return { confirmedCount, unconfirmedCount, totalAmount, todayCount };
  }, [items]);

  const statCards = [
    {
      icon: BarChart3,
      label: '総項目数',
      value: items.length,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      icon: DollarSign,
      label: '総合計金額',
      value: `¥${formatNumber(stats.totalAmount)}`,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      icon: CheckCircle,
      label: '確定済み',
      value: stats.confirmedCount,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    {
      icon: Clock,
      label: '未確定',
      value: stats.unconfirmedCount,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    },
    {
      icon: Calendar,
      label: '今日の取引',
      value: stats.todayCount,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <ModernCard className="p-4 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {stat.value}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
          </ModernCard>
        </motion.div>
      ))}
    </div>
  );
}