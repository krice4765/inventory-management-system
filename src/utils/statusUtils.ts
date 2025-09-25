// 統一ステータス管理システム
// 4種類のステータス：未納品/一部納品/納品完了/キャンセル

// 統一ステータスの型定義
export type UnifiedOrderStatus = 'undelivered' | 'partial' | 'completed' | 'cancelled' | 'pending' | 'processing';

// 従来のステータス形式（レガシー対応）
export type LegacyOrderStatus = 'draft' | 'confirmed' | 'pending' | 'shipped' | 'delivered' | 'cancelled';

// ステータス情報の型
export interface StatusInfo {
  value: UnifiedOrderStatus;
  label: string;
  color: string;
  bgColor: string;
  description: string;
  icon: string;
}

// 統一ステータス定義
export const UNIFIED_ORDER_STATUSES: Record<UnifiedOrderStatus, StatusInfo> = {
  undelivered: {
    value: 'undelivered',
    label: '未納品',
    color: 'text-orange-800 dark:text-orange-200',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    description: '注文済みで納品待ちの状態',
    icon: '📦',
  },
  partial: {
    value: 'partial',
    label: '一部納品',
    color: 'text-blue-800 dark:text-blue-200',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    description: '一部商品が納品済みの状態',
    icon: '📬',
  },
  completed: {
    value: 'completed',
    label: '納品完了',
    color: 'text-green-800 dark:text-green-200',
    bgColor: 'bg-green-100 dark:bg-green-900',
    description: '全商品の納品が完了した状態',
    icon: '✅',
  },
  cancelled: {
    value: 'cancelled',
    label: 'キャンセル',
    color: 'text-red-800 dark:text-red-200',
    bgColor: 'bg-red-100 dark:bg-red-900',
    description: 'キャンセルされた注文',
    icon: '❌',
  },
  pending: {
    value: 'pending',
    label: '出庫待ち',
    color: 'text-yellow-800 dark:text-yellow-200',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    description: '出庫指示待ちの状態',
    icon: '⏳',
  },
  processing: {
    value: 'processing',
    label: '処理中',
    color: 'text-purple-800 dark:text-purple-200',
    bgColor: 'bg-purple-100 dark:bg-purple-900',
    description: 'キャンセルされた注文',
    icon: '❌',
  },
};

// ステータス計算ロジック
export class OrderStatusCalculator {
  // 注文の統一ステータスを計算
  static calculateUnifiedStatus(orderData: {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }): UnifiedOrderStatus {
    // キャンセル判定
    if (orderData.is_cancelled || orderData.status === 'cancelled') {
      return 'cancelled';
    }

    // 進捗率ベースの判定
    const progress = orderData.delivery_progress ?? 0;

    if (progress >= 100) {
      return 'completed';
    } else if (progress > 0) {
      return 'partial';
    } else {
      return 'undelivered';
    }
  }

  // 納品進捗から統一ステータスを計算
  static calculateStatusFromProgress(progress: number, isCancelled: boolean = false): UnifiedOrderStatus {
    if (isCancelled) return 'cancelled';

    if (progress >= 100) return 'completed';
    if (progress > 0) return 'partial';
    return 'undelivered';
  }

  // 金額ベースでのステータス計算
  static calculateStatusFromAmount(
    orderedAmount: number,
    deliveredAmount: number,
    isCancelled: boolean = false,
    tolerance: number = 100 // 許容誤差（円）
  ): UnifiedOrderStatus {
    if (isCancelled) return 'cancelled';

    if (deliveredAmount >= orderedAmount - tolerance) return 'completed';
    if (deliveredAmount > 0) return 'partial';
    return 'undelivered';
  }

  // レガシーステータスから統一ステータスへの変換
  static convertLegacyStatus(
    legacyStatus: string,
    deliveryProgress?: number,
    orderedAmount?: number,
    deliveredAmount?: number
  ): UnifiedOrderStatus {
    // キャンセル判定
    if (legacyStatus === 'cancelled') {
      return 'cancelled';
    }

    // 進捗率が利用できる場合はそれを優先
    if (typeof deliveryProgress === 'number') {
      return this.calculateStatusFromProgress(deliveryProgress);
    }

    // 金額情報が利用できる場合
    if (typeof orderedAmount === 'number' && typeof deliveredAmount === 'number') {
      return this.calculateStatusFromAmount(orderedAmount, deliveredAmount);
    }

    // レガシーステータスベースの変換
    switch (legacyStatus) {
      case 'draft':
      case 'pending':
      case 'confirmed':
        return 'undelivered';
      case 'shipped':
        return 'partial';
      case 'delivered':
        return 'completed';
      default:
        return 'undelivered';
    }
  }
}

// ステータス表示ユーティリティ
export class StatusDisplayUtils {
  // ステータス情報を取得（安全性チェック付き）
  static getStatusInfo(status: UnifiedOrderStatus): StatusInfo | null {
    if (!status || typeof status !== 'string') {
      console.warn('Invalid status provided:', status);
      return null;
    }

    const statusInfo = UNIFIED_ORDER_STATUSES[status];
    if (!statusInfo) {
      console.warn('Status info not found for:', status);
      return null;
    }

    return statusInfo;
  }

  // 安全なステータス情報取得（フォールバック付き）
  static getSafeStatusInfo(status: UnifiedOrderStatus): StatusInfo {
    const statusInfo = this.getStatusInfo(status);
    if (statusInfo) {
      return statusInfo;
    }

    // フォールバック情報を返す
    return {
      label: '不明',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      icon: '❓',
      description: 'ステータス不明'
    };
  }

  // ステータスラベルを取得
  static getStatusLabel(status: UnifiedOrderStatus): string {
    const statusInfo = this.getSafeStatusInfo(status);
    return statusInfo.label;
  }

  // ステータス色を取得
  static getStatusColor(status: UnifiedOrderStatus): string {
    const statusInfo = this.getSafeStatusInfo(status);
    return statusInfo.color;
  }

  // ステータス背景色を取得
  static getStatusBgColor(status: UnifiedOrderStatus): string {
    const statusInfo = this.getSafeStatusInfo(status);
    return statusInfo.bgColor;
  }

  // ステータスアイコンを取得
  static getStatusIcon(status: UnifiedOrderStatus): string {
    const statusInfo = this.getSafeStatusInfo(status);
    return statusInfo.icon;
  }

  // ステータス説明を取得
  static getStatusDescription(status: UnifiedOrderStatus): string {
    const statusInfo = this.getSafeStatusInfo(status);
    return statusInfo.description;
  }

  // 完全なステータス表示用クラス名を生成
  static getStatusClassName(status: UnifiedOrderStatus): string {
    const info = this.getSafeStatusInfo(status);
    return `${info.color} ${info.bgColor}`;
  }

  // 進捗バーの色を取得
  static getProgressBarColor(status: UnifiedOrderStatus): string {
    switch (status) {
      case 'undelivered': return 'bg-orange-500';
      case 'partial': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }
}

// ステータス統計ユーティリティ
export class StatusStatsUtils {
  // 注文配列からステータス別の統計を計算
  static calculateStatusStats<T extends {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }>(orders: T[]): Record<UnifiedOrderStatus, number> {
    const stats: Record<UnifiedOrderStatus, number> = {
      undelivered: 0,
      partial: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach(order => {
      const unifiedStatus = OrderStatusCalculator.calculateUnifiedStatus(order);
      stats[unifiedStatus]++;
    });

    return stats;
  }

  // ステータス別の金額統計を計算
  static calculateAmountStats<T extends {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }>(orders: T[]): Record<UnifiedOrderStatus, number> {
    const stats: Record<UnifiedOrderStatus, number> = {
      undelivered: 0,
      partial: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach(order => {
      const unifiedStatus = OrderStatusCalculator.calculateUnifiedStatus(order);
      stats[unifiedStatus] += order.ordered_amount || 0;
    });

    return stats;
  }

  // 総合的な統計情報を計算
  static calculateComprehensiveStats<T extends {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }>(orders: T[]): {
    counts: Record<UnifiedOrderStatus, number>;
    amounts: Record<UnifiedOrderStatus, number>;
    totalOrders: number;
    totalAmount: number;
    completionRate: number;
    partialRate: number;
  } {
    const counts = this.calculateStatusStats(orders);
    const amounts = this.calculateAmountStats(orders);
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + (order.ordered_amount || 0), 0);
    const completionRate = totalOrders > 0 ? (counts.completed / totalOrders) * 100 : 0;
    const partialRate = totalOrders > 0 ? ((counts.partial + counts.completed) / totalOrders) * 100 : 0;

    return {
      counts,
      amounts,
      totalOrders,
      totalAmount,
      completionRate,
      partialRate,
    };
  }
}

// フィルタリングユーティリティ
export class StatusFilterUtils {
  // 統一ステータスでフィルタリング
  static filterByStatus<T extends {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }>(orders: T[], targetStatus: UnifiedOrderStatus | 'all'): T[] {
    if (targetStatus === 'all') return orders;

    return orders.filter(order => {
      const unifiedStatus = OrderStatusCalculator.calculateUnifiedStatus(order);
      return unifiedStatus === targetStatus;
    });
  }

  // 複数ステータスでフィルタリング
  static filterByMultipleStatuses<T extends {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }>(orders: T[], targetStatuses: UnifiedOrderStatus[]): T[] {
    if (targetStatuses.length === 0) return orders;

    return orders.filter(order => {
      const unifiedStatus = OrderStatusCalculator.calculateUnifiedStatus(order);
      return targetStatuses.includes(unifiedStatus);
    });
  }

  // ステータス別のソート
  static sortByStatus<T extends {
    status?: string;
    delivery_progress?: number;
    ordered_amount?: number;
    delivered_amount?: number;
    is_cancelled?: boolean;
  }>(orders: T[], ascending: boolean = true): T[] {
    const statusOrder: Record<UnifiedOrderStatus, number> = {
      undelivered: 1,
      partial: 2,
      completed: 3,
      cancelled: 4,
    };

    return [...orders].sort((a, b) => {
      const statusA = OrderStatusCalculator.calculateUnifiedStatus(a);
      const statusB = OrderStatusCalculator.calculateUnifiedStatus(b);
      const orderA = statusOrder[statusA];
      const orderB = statusOrder[statusB];

      return ascending ? orderA - orderB : orderB - orderA;
    });
  }
}

// バリデーションユーティリティ
export class StatusValidationUtils {
  // 有効な統一ステータスかチェック
  static isValidUnifiedStatus(status: string): status is UnifiedOrderStatus {
    return Object.keys(UNIFIED_ORDER_STATUSES).includes(status);
  }

  // ステータス遷移の妥当性をチェック
  static isValidStatusTransition(
    fromStatus: UnifiedOrderStatus,
    toStatus: UnifiedOrderStatus
  ): boolean {
    // キャンセルは常に可能
    if (toStatus === 'cancelled') return true;

    // キャンセルからの復帰は不可
    if (fromStatus === 'cancelled') return false;

    // 完了からの逆戻りは不可（一部のケースを除く）
    if (fromStatus === 'completed' && toStatus !== 'completed') return false;

    // その他の遷移は基本的に可能
    return true;
  }

  // 進捗率とステータスの整合性をチェック
  static validateProgressAndStatus(
    progress: number,
    status: UnifiedOrderStatus
  ): boolean {
    switch (status) {
      case 'undelivered':
        return progress === 0;
      case 'partial':
        return progress > 0 && progress < 100;
      case 'completed':
        return progress >= 100;
      case 'cancelled':
        return true; // キャンセルは進捗に関係なく有効
      default:
        return false;
    }
  }
}