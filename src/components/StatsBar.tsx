import React, { useMemo } from 'react';
import { TransactionStatus, formatNumber } from '../utils/format';

interface Transaction {
  status?: TransactionStatus;
  total_amount?: number | string;
}

interface StatsBarProps {
  items: Transaction[];
}

export function StatsBar({ items }: StatsBarProps) {
  const stats = useMemo(() => {
    const confirmedCount = items.filter(t => t.status === 'confirmed').length;
    const unconfirmedCount = items.filter(t => t.status !== 'confirmed').length;
    const totalAmount = items.reduce((sum, t) => 
      sum + (Number(t.total_amount ?? 0) || 0), 0
    );
    
    return { confirmedCount, unconfirmedCount, totalAmount };
  }, [items]);
  
  return (
    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="text-gray-700">
          <span className="font-medium">表示項目数:</span> {items.length}
        </div>
        <div className="text-gray-700">
          <span className="font-medium">総合計金額:</span> ¥{formatNumber(stats.totalAmount)}
        </div>
        <div className="text-green-700">
          <span className="font-medium">確定:</span> {stats.confirmedCount}
        </div>
        <div className="text-yellow-700">
          <span className="font-medium">未確定:</span> {stats.unconfirmedCount}
        </div>
      </div>
    </div>
  );
}