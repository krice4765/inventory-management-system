import type { UserRole } from '../types';

/**
 * ロールベースのアクセス制御 (RBAC) 権限チェック関数
 * 各機能に対するロール別のアクセス権限を定義
 */

// ============================================================
// マスタデータ管理権限
// ============================================================

/**
 * 商品マスタの編集権限
 * - 発注担当者: 仕入価格や商品情報の更新が必要
 */
export const canEditProducts = (role: UserRole): boolean => {
  return ['admin', 'purchasing_staff'].includes(role);
};

/**
 * 商品マスタの閲覧権限
 */
export const canViewProducts = (role: UserRole): boolean => {
  return role !== 'readonly' || role === 'readonly'; // 全員閲覧可
};

/**
 * 取引先マスタの編集権限（全取引先）
 */
export const canEditAllPartners = (role: UserRole): boolean => {
  return role === 'admin';
};

/**
 * 仕入先マスタの編集権限
 */
export const canEditSuppliers = (role: UserRole): boolean => {
  return ['admin', 'purchasing_staff'].includes(role);
};

/**
 * 顧客マスタの編集権限
 */
export const canEditCustomers = (role: UserRole): boolean => {
  return ['admin', 'sales_staff'].includes(role);
};

// ============================================================
// 在庫管理権限
// ============================================================

/**
 * 在庫数の編集権限（在庫調整）
 * - 在庫担当者のみが直接在庫数を調整可能
 */
export const canEditInventory = (role: UserRole): boolean => {
  return ['admin', 'inventory_staff'].includes(role);
};

/**
 * 在庫状況の閲覧権限
 */
export const canViewInventory = (role: UserRole): boolean => {
  // 閲覧専用以外は全員閲覧可
  return role !== 'readonly' || role === 'readonly';
};

/**
 * 在庫調整の実行権限
 */
export const canAdjustInventory = (role: UserRole): boolean => {
  return ['admin', 'inventory_staff'].includes(role);
};

// ============================================================
// 発注・仕入管理権限
// ============================================================

/**
 * 発注書の作成権限
 */
export const canCreatePurchaseOrder = (role: UserRole): boolean => {
  return ['admin', 'manager', 'purchasing_staff'].includes(role);
};

/**
 * 発注書の編集権限
 */
export const canEditPurchaseOrder = (role: UserRole): boolean => {
  return ['admin', 'purchasing_staff'].includes(role);
};

/**
 * 発注書の削除権限
 */
export const canDeletePurchaseOrder = (role: UserRole): boolean => {
  return ['admin', 'manager'].includes(role);
};

/**
 * 仕入伝票の作成・編集権限
 */
export const canManagePurchaseTransaction = (role: UserRole): boolean => {
  return ['admin', 'purchasing_staff'].includes(role);
};

// ============================================================
// 受注・売上管理権限
// ============================================================

/**
 * 受注の作成・編集権限
 */
export const canManageSalesOrder = (role: UserRole): boolean => {
  return ['admin', 'manager', 'sales_staff'].includes(role);
};

/**
 * 売上伝票の作成・編集権限
 */
export const canManageSalesTransaction = (role: UserRole): boolean => {
  return ['admin', 'sales_staff'].includes(role);
};

// ============================================================
// 買掛金・支払管理権限
// ============================================================

/**
 * 買掛金データの閲覧権限
 */
export const canViewAccountsPayable = (role: UserRole): boolean => {
  return ['admin', 'manager', 'purchasing_staff', 'accounting_staff'].includes(role);
};

/**
 * 買掛金データの編集権限
 */
export const canEditAccountsPayable = (role: UserRole): boolean => {
  return ['admin', 'accounting_staff'].includes(role);
};

/**
 * 支払処理の実行権限
 */
export const canProcessPayment = (role: UserRole): boolean => {
  return ['admin', 'accounting_staff'].includes(role);
};

/**
 * 支払予定の編集権限
 */
export const canEditPaymentSchedule = (role: UserRole): boolean => {
  return ['admin', 'accounting_staff'].includes(role);
};

// ============================================================
// 売掛金・入金管理権限
// ============================================================

/**
 * 売掛金データの閲覧権限
 */
export const canViewAccountsReceivable = (role: UserRole): boolean => {
  return ['admin', 'manager', 'sales_staff', 'accounting_staff'].includes(role);
};

/**
 * 売掛金データの編集権限
 */
export const canEditAccountsReceivable = (role: UserRole): boolean => {
  return ['admin', 'accounting_staff'].includes(role);
};

/**
 * 入金処理の実行権限
 */
export const canProcessReceipt = (role: UserRole): boolean => {
  return ['admin', 'accounting_staff'].includes(role);
};

// ============================================================
// レポート・分析権限
// ============================================================

/**
 * 財務レポートの閲覧権限
 */
export const canViewFinancialReports = (role: UserRole): boolean => {
  return ['admin', 'manager', 'accounting_staff'].includes(role);
};

/**
 * 在庫レポートの閲覧権限
 */
export const canViewInventoryReports = (role: UserRole): boolean => {
  // 在庫関連ロールと管理職
  return ['admin', 'manager', 'purchasing_staff', 'inventory_staff', 'sales_staff'].includes(role);
};

/**
 * 発注・仕入レポートの閲覧権限
 */
export const canViewPurchaseReports = (role: UserRole): boolean => {
  return ['admin', 'manager', 'purchasing_staff', 'accounting_staff'].includes(role);
};

/**
 * 売上レポートの閲覧権限
 */
export const canViewSalesReports = (role: UserRole): boolean => {
  return ['admin', 'manager', 'sales_staff', 'accounting_staff'].includes(role);
};

// ============================================================
// システム管理権限
// ============================================================

/**
 * ユーザー管理権限
 */
export const canManageUsers = (role: UserRole): boolean => {
  return role === 'admin';
};

/**
 * システム設定の変更権限
 */
export const canEditSystemSettings = (role: UserRole): boolean => {
  return role === 'admin';
};

/**
 * 監査ログの閲覧権限
 */
export const canViewAuditLogs = (role: UserRole): boolean => {
  return ['admin', 'manager'].includes(role);
};

// ============================================================
// ダッシュボード権限
// ============================================================

/**
 * ダッシュボードの閲覧権限
 */
export const canViewDashboard = (role: UserRole): boolean => {
  // 全ユーザーがダッシュボードを閲覧可能（ただし表示内容はロール別に調整）
  return true;
};

// ============================================================
// 複合権限チェック
// ============================================================

/**
 * 特定の金額以上の取引の承認権限
 */
export const canApproveHighValueTransaction = (role: UserRole, amount: number): boolean => {
  const HIGH_VALUE_THRESHOLD = 1000000; // 100万円以上

  if (amount < HIGH_VALUE_THRESHOLD) {
    return true; // 少額取引は承認不要
  }

  return ['admin', 'manager'].includes(role);
};

/**
 * データの削除権限（一般）
 */
export const canDeleteData = (role: UserRole): boolean => {
  return ['admin', 'manager'].includes(role);
};

/**
 * データのエクスポート権限
 */
export const canExportData = (role: UserRole): boolean => {
  // 閲覧専用以外は全員エクスポート可能
  return role !== 'readonly';
};

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 管理者権限チェック
 */
export const isAdmin = (role: UserRole): boolean => {
  return role === 'admin';
};

/**
 * 管理職権限チェック（admin + manager）
 */
export const isManagement = (role: UserRole): boolean => {
  return ['admin', 'manager'].includes(role);
};

/**
 * 編集権限チェック（読み取り専用でない）
 */
export const canEdit = (role: UserRole): boolean => {
  return role !== 'readonly';
};

/**
 * 特定業務の専門担当者チェック
 */
export const isSpecialist = (role: UserRole): boolean => {
  return ['purchasing_staff', 'inventory_staff', 'sales_staff', 'accounting_staff'].includes(role);
};
