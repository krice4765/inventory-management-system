/**
 * 発注書の納品ステータス判定ユーティリティ
 * 各画面で一貫した全納完了判定を行うための共通ロジック
 */

export interface DeliveryStatusData {
  orderTotalAmount: number;
  confirmedAmount: number;
  draftAmount: number;
  orderItems: Array<{
    product_id: string;
    quantity: number;
  }>;
  transactions: Array<{
    status: string;
    transaction_items?: Array<{
      product_id: string;
      quantity: number;
    }>;
  }>;
}

export interface DeliveryStatus {
  isFullyDelivered: boolean;
  isAllItemsDelivered: boolean;
  statusLabel: '進行中' | '金額完了' | '全納完了';
  statusColor: 'blue' | 'orange' | 'green';
  remainingAmount: number;
  completionPercentage: number;
}

/**
 * 納品ステータスを判定
 */
export function calculateDeliveryStatus(data: DeliveryStatusData): DeliveryStatus {
  const remainingAmount = data.orderTotalAmount - data.confirmedAmount - data.draftAmount;
  const completionPercentage = data.orderTotalAmount > 0
    ? Math.round((data.confirmedAmount / data.orderTotalAmount) * 100)
    : 0;

  // 金額完了判定
  const isFullyDelivered = remainingAmount === 0 && data.confirmedAmount > 0;

  let isAllItemsDelivered = false;
  if (isFullyDelivered && data.orderItems.length > 0) {
    // すべての確定済み分納の商品数量を集計
    const deliveredQuantities = new Map<string, number>();
    data.transactions
      .filter(tx => tx.status === 'confirmed')
      .forEach(tx => {
        if (tx.transaction_items) {
          tx.transaction_items.forEach(item => {
            const currentQty = deliveredQuantities.get(item.product_id) || 0;
            deliveredQuantities.set(item.product_id, currentQty + (item.quantity || 0));
          });
        }
      });

    // 発注数量と納品数量を比較
    isAllItemsDelivered = data.orderItems.every(orderItem => {
      const deliveredQty = deliveredQuantities.get(orderItem.product_id) || 0;
      return deliveredQty >= orderItem.quantity;
    });
  }

  // ステータス判定
  let statusLabel: '進行中' | '金額完了' | '全納完了';
  let statusColor: 'blue' | 'orange' | 'green';

  if (!isFullyDelivered) {
    statusLabel = '進行中';
    statusColor = 'blue';
  } else if (isAllItemsDelivered) {
    statusLabel = '全納完了';
    statusColor = 'green';
  } else {
    statusLabel = '金額完了';
    statusColor = 'orange';
  }

  return {
    isFullyDelivered,
    isAllItemsDelivered,
    statusLabel,
    statusColor,
    remainingAmount,
    completionPercentage
  };
}

/**
 * ステータス色に対応するTailwind CSSクラス
 */
export function getStatusColorClasses(color: 'blue' | 'orange' | 'green', isDark: boolean = false) {
  const colorMap = {
    blue: isDark
      ? 'bg-blue-900/20 text-blue-400 border-blue-400/20'
      : 'bg-blue-100 text-blue-800 border-blue-200',
    orange: isDark
      ? 'bg-orange-900/20 text-orange-400 border-orange-400/20'
      : 'bg-orange-100 text-orange-800 border-orange-200',
    green: isDark
      ? 'bg-green-900/20 text-green-400 border-green-400/20'
      : 'bg-green-100 text-green-800 border-green-200'
  };

  return colorMap[color];
}

/**
 * 進捗バー用の色クラス
 */
export function getProgressBarClasses(status: DeliveryStatus, isDark: boolean = false) {
  if (status.statusLabel === '全納完了') {
    return isDark ? 'bg-green-600' : 'bg-green-500';
  } else if (status.statusLabel === '金額完了') {
    return isDark ? 'bg-orange-600' : 'bg-orange-500';
  } else {
    return isDark ? 'bg-blue-600' : 'bg-blue-500';
  }
}