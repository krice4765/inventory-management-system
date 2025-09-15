// 権限管理システム
export interface UserPermissions {
  canOverrideInventoryLimits: boolean;
  canViewSensitiveData: boolean;
  canModifyMasterData: boolean;
  canApproveTransactions: boolean;
  maxTransactionAmount: number;
}

export interface InventoryOverrideRequest {
  orderId: string;
  productId: string;
  requestedQuantity: number;
  currentStock: number;
  shortage: number;
  reason: string;
  requestedBy: string;
  timestamp: Date;
}

// デフォルト権限設定
export const DEFAULT_PERMISSIONS: UserPermissions = {
  canOverrideInventoryLimits: false,
  canViewSensitiveData: false,
  canModifyMasterData: false,
  canApproveTransactions: false,
  maxTransactionAmount: 1000000, // 100万円
};

// 権限レベル定義
export const PERMISSION_LEVELS = {
  OPERATOR: {
    ...DEFAULT_PERMISSIONS,
    maxTransactionAmount: 1000000,
  },
  MANAGER: {
    ...DEFAULT_PERMISSIONS,
    canViewSensitiveData: true,
    canApproveTransactions: true,
    maxTransactionAmount: 10000000, // 1000万円
  },
  ADMIN: {
    canOverrideInventoryLimits: true,
    canViewSensitiveData: true,
    canModifyMasterData: true,
    canApproveTransactions: true,
    maxTransactionAmount: 100000000, // 1億円
  },
} as const;