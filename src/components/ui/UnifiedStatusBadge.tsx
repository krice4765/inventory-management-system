import React from 'react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  UnifiedOrderStatus,
  StatusDisplayUtils,
  OrderStatusCalculator
} from '../../utils/statusUtils';

interface UnifiedStatusBadgeProps {
  // 統一ステータスを直接指定する場合
  status?: UnifiedOrderStatus;

  // 注文データから自動計算する場合
  orderData?: {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  };

  // 表示オプション
  variant?: 'badge' | 'text' | 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDescription?: boolean;
  animated?: boolean;
  className?: string;
}

export const UnifiedStatusBadge: React.FC<UnifiedStatusBadgeProps> = ({
  status,
  orderData,
  variant = 'badge',
  size = 'md',
  showIcon = false,
  showDescription = false,
  animated = true,
  className = '',
}) => {
  const { isDark } = useDarkMode();

  // ステータスを決定
  const finalStatus: UnifiedOrderStatus = status ||
    (orderData ? OrderStatusCalculator.calculateUnifiedStatus(orderData) : 'undelivered');

  const statusInfo = StatusDisplayUtils.getSafeStatusInfo(finalStatus);

  // サイズ別のスタイル
  const sizeStyles = {
    sm: {
      badge: 'px-2 py-1 text-xs',
      text: 'text-xs',
      icon: 'text-sm',
    },
    md: {
      badge: 'px-3 py-1 text-sm',
      text: 'text-sm',
      icon: 'text-base',
    },
    lg: {
      badge: 'px-4 py-2 text-base',
      text: 'text-base',
      icon: 'text-lg',
    },
  };

  // バリアント別のレンダリング
  const renderContent = () => {
    switch (variant) {
      case 'icon':
        return (
          <span className={`${sizeStyles[size].icon} ${className}`} title={statusInfo.description}>
            {statusInfo.icon}
          </span>
        );

      case 'text':
        return (
          <span
            className={`font-medium ${statusInfo.color} ${sizeStyles[size].text} ${className}`}
            title={statusInfo.description}
          >
            {showIcon && <span className="mr-1">{statusInfo.icon}</span>}
            {statusInfo.label}
          </span>
        );

      case 'full':
        return (
          <div className={`flex flex-col space-y-1 ${className}`}>
            <div className={`flex items-center space-x-2 ${statusInfo.color}`}>
              {showIcon && <span className={sizeStyles[size].icon}>{statusInfo.icon}</span>}
              <span className={`font-medium ${sizeStyles[size].text}`}>
                {statusInfo.label}
              </span>
            </div>
            {showDescription && (
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {statusInfo.description}
              </div>
            )}
          </div>
        );

      case 'badge':
      default:
        return (
          <span
            className={`
              inline-flex items-center space-x-1 rounded-full font-medium
              ${statusInfo.color} ${statusInfo.bgColor}
              ${sizeStyles[size].badge}
              ${className}
            `}
            title={statusInfo.description}
          >
            {showIcon && <span>{statusInfo.icon}</span>}
            <span>{statusInfo.label}</span>
          </span>
        );
    }
  };

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {renderContent()}
      </motion.div>
    );
  }

  return <>{renderContent()}</>;
};

// 進捗付きステータス表示コンポーネント
interface StatusWithProgressProps {
  orderData: {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  };
  showProgressBar?: boolean;
  showPercentage?: boolean;
  className?: string;
}

export const StatusWithProgress: React.FC<StatusWithProgressProps> = ({
  orderData,
  showProgressBar = true,
  showPercentage = true,
  className = '',
}) => {
  const { isDark } = useDarkMode();

  const status = OrderStatusCalculator.calculateUnifiedStatus(orderData);
  const progress = orderData.delivery_progress ?? 0;
  const progressBarColor = StatusDisplayUtils.getProgressBarColor(status);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ステータスバッジ */}
      <UnifiedStatusBadge orderData={orderData} size="sm" showIcon={false} />

      {/* 進捗バー */}
      {showProgressBar && status !== 'cancelled' && (
        <div className="space-y-1">
          <div className={`w-full rounded-full h-2 ${
            isDark ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <motion.div
              className={`h-2 rounded-full ${progressBarColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {showPercentage && (
            <div className={`text-xs text-right ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {progress.toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ステータス変更選択コンポーネント
interface StatusSelectorProps {
  currentStatus: UnifiedOrderStatus;
  onChange: (newStatus: UnifiedOrderStatus) => void;
  disabled?: boolean;
  restrictTransitions?: boolean;
  className?: string;
}

export const StatusSelector: React.FC<StatusSelectorProps> = ({
  currentStatus,
  onChange,
  disabled = false,
  restrictTransitions = true,
  className = '',
}) => {
  const { isDark } = useDarkMode();

  const allStatuses: UnifiedOrderStatus[] = ['undelivered', 'partial', 'completed', 'cancelled'];

  const availableStatuses = restrictTransitions
    ? allStatuses // 遷移制限は親コンポーネントで実装
    : allStatuses;

  return (
    <select
      value={currentStatus}
      onChange={(e) => onChange(e.target.value as UnifiedOrderStatus)}
      disabled={disabled}
      className={`
        px-3 py-2 border rounded-lg
        ${disabled
          ? 'bg-gray-100 cursor-not-allowed'
          : isDark
            ? 'bg-gray-800 border-gray-700 text-white'
            : 'bg-white border-gray-300 text-gray-900'
        }
        focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
        ${className}
      `}
    >
      {availableStatuses.map((status) => {
        const statusInfo = StatusDisplayUtils.getSafeStatusInfo(status);
        return (
          <option key={status} value={status}>
            {statusInfo.icon} {statusInfo.label}
          </option>
        );
      })}
    </select>
  );
};

// ステータス統計表示コンポーネント
interface StatusStatsDisplayProps {
  stats: Record<UnifiedOrderStatus, number>;
  type?: 'count' | 'amount';
  layout?: 'horizontal' | 'grid';
  showIcons?: boolean;
  className?: string;
}

export const StatusStatsDisplay: React.FC<StatusStatsDisplayProps> = ({
  stats,
  type = 'count',
  layout = 'horizontal',
  showIcons = true,
  className = '',
}) => {
  const { isDark } = useDarkMode();

  const formatValue = (value: number) => {
    if (type === 'amount') {
      return `¥${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  const containerClass = layout === 'grid'
    ? 'grid grid-cols-2 lg:grid-cols-4 gap-4'
    : 'flex flex-wrap gap-4';

  return (
    <div className={`${containerClass} ${className}`}>
      {(Object.keys(stats) as UnifiedOrderStatus[])
        .filter((status): status is UnifiedOrderStatus => {
          // 有効なステータスのみをフィルタリング
          return ['undelivered', 'partial', 'completed', 'cancelled'].includes(status);
        })
        .map((status) => {
          const statusInfo = StatusDisplayUtils.getSafeStatusInfo(status);
          const value = stats[status] || 0;

        return (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            className={`
              relative group overflow-hidden rounded-xl p-6 cursor-pointer
              transition-all duration-300 ease-out
              ${isDark
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 hover:border-gray-600'
                : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
              }
              ${!showIcons ? 'backdrop-blur-sm' : ''}
            `}
          >
            {/* 背景の装飾エフェクト */}
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-r ${statusInfo.bgColor}`} />

            {/* アクセントライン */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${statusInfo.bgColor.replace('bg-', 'bg-').replace('-100', '-500').replace('-900', '-500')}`} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`text-sm font-medium tracking-wide uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {statusInfo.label}
                </div>
                {!showIcons && (
                  <div className={`w-3 h-3 rounded-full ${statusInfo.bgColor.replace('bg-', 'bg-').replace('-100', '-500').replace('-900', '-500')} shadow-sm`} />
                )}
              </div>

              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} group-hover:scale-105 transition-transform duration-200`}>
                {formatValue(value)}
              </div>

              {/* プログレスインジケーター（オプション） */}
              <div className="mt-4">
                <div className={`h-1 rounded-full overflow-hidden ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <motion.div
                    className={`h-full ${statusInfo.bgColor.replace('bg-', 'bg-').replace('-100', '-500').replace('-900', '-500')}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (value / Math.max(1, Math.max(...Object.values(stats)))) * 100)}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })
      .filter(Boolean) // null要素を除去
    }
    </div>
  );
};