import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useOrderDetail } from '../../hooks/useOrderDetail';

interface QuantitySummaryDisplayProps {
      orderId: string; totalAmount: number; }

export const QuantitySummaryDisplay: React.FC<QuantitySummaryDisplayProps> = ({
  orderId,
  totalAmount,
}) => {
  const { isDark } = useDarkMode();
  const { data: orderDetail, isLoading, error } = useOrderDetail(orderId);

  if (isLoading) {
    return (
      <div className="text-right">
        <div className="font-medium">
      <div className="animate-pulse bg-gray-200 dark: bg-gray-700 h-4 w-16 rounded"></div> </div>
        <div className={`text-xs ${
      isDark ? 'text-gray-400' : 'text-gray-500' }`}>
          発注額: ¥{totalAmount.toLocaleString()}
        </div>
      </div>
    );
  }

  // データベースエラーの場合はフォールバック表示
  if (error) {
    console.warn('⚠️ Order detail fetch error, showing fallback:', error);
    return (
      <div className="text-right">
        <div className="font-medium">
          詳細準備中
        </div>
        <div className={`text-xs ${
      isDark ? 'text-gray-400' : 'text-gray-500' }`}>
          発注額: ¥{totalAmount.toLocaleString()}
        </div>
      </div>
    );
  }

  if (!orderDetail?.items || orderDetail.items.length === 0) {
    return (
      <div className="text-right">
        <div className="font-medium">
          明細なし
        </div>
        <div className={`text-xs ${
      isDark ? 'text-gray-400' : 'text-gray-500' }`}>
          発注額: ¥{totalAmount.toLocaleString()}
        </div>
      </div>
    );
  }

  // 商品種類数と総数量を計算
  const itemCount = orderDetail.items.length;
  const totalQuantity = orderDetail.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="text-right">
      <div className="font-medium">
        {itemCount === 1
          ? `${totalQuantity}個`
          : `${itemCount}種類 (${totalQuantity}個)`
        }
      </div>
      <div className={`text-xs ${
      isDark ? 'text-gray-400' : 'text-gray-500' }`}>
        発注額: ¥{totalAmount.toLocaleString()}
      </div>
    </div>
  );
};