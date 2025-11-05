import { describe, it, expect } from 'vitest';
import type { UserRole } from '../types';
import {
  // マスタデータ管理権限
  canEditProducts,
  canViewProducts,
  canEditAllPartners,
  canEditSuppliers,
  canEditCustomers,
  // 在庫管理権限
  canEditInventory,
  canViewInventory,
  canAdjustInventory,
  // 発注・仕入管理権限
  canCreatePurchaseOrder,
  canEditPurchaseOrder,
  canDeletePurchaseOrder,
  canManagePurchaseTransaction,
  // 受注・売上管理権限
  canManageSalesOrder,
  canManageSalesTransaction,
  // 買掛金・支払管理権限
  canViewAccountsPayable,
  canEditAccountsPayable,
  canProcessPayment,
  canEditPaymentSchedule,
  // 売掛金・入金管理権限
  canViewAccountsReceivable,
  canEditAccountsReceivable,
  canProcessReceipt,
  // レポート・分析権限
  canViewFinancialReports,
  canViewInventoryReports,
  canViewPurchaseReports,
  canViewSalesReports,
  // システム管理権限
  canManageUsers,
  canEditSystemSettings,
  canViewAuditLogs,
  // ダッシュボード権限
  canViewDashboard,
  // 複合権限チェック
  canApproveHighValueTransaction,
  canDeleteData,
  canExportData,
  // ヘルパー関数
  isAdmin,
  isManagement,
  canEdit,
  isSpecialist,
} from './permissions';

describe('permissions', () => {
  const allRoles: UserRole[] = [
    'admin',
    'manager',
    'purchasing_staff',
    'inventory_staff',
    'sales_staff',
    'accounting_staff',
    'staff',
    'readonly',
  ];

  describe('マスタデータ管理権限', () => {
    describe('canEditProducts', () => {
      it('should allow admin and purchasing_staff', () => {
        expect(canEditProducts('admin')).toBe(true);
        expect(canEditProducts('purchasing_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditProducts('manager')).toBe(false);
        expect(canEditProducts('inventory_staff')).toBe(false);
        expect(canEditProducts('sales_staff')).toBe(false);
        expect(canEditProducts('accounting_staff')).toBe(false);
        expect(canEditProducts('staff')).toBe(false);
        expect(canEditProducts('readonly')).toBe(false);
      });
    });

    describe('canViewProducts', () => {
      it('should allow all roles', () => {
        allRoles.forEach((role) => {
          expect(canViewProducts(role)).toBe(true);
        });
      });
    });

    describe('canEditAllPartners', () => {
      it('should allow only admin', () => {
        expect(canEditAllPartners('admin')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditAllPartners('manager')).toBe(false);
        expect(canEditAllPartners('purchasing_staff')).toBe(false);
      });
    });

    describe('canEditSuppliers', () => {
      it('should allow admin and purchasing_staff', () => {
        expect(canEditSuppliers('admin')).toBe(true);
        expect(canEditSuppliers('purchasing_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditSuppliers('sales_staff')).toBe(false);
        expect(canEditSuppliers('readonly')).toBe(false);
      });
    });

    describe('canEditCustomers', () => {
      it('should allow admin and sales_staff', () => {
        expect(canEditCustomers('admin')).toBe(true);
        expect(canEditCustomers('sales_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditCustomers('purchasing_staff')).toBe(false);
        expect(canEditCustomers('readonly')).toBe(false);
      });
    });
  });

  describe('在庫管理権限', () => {
    describe('canEditInventory', () => {
      it('should allow admin and inventory_staff', () => {
        expect(canEditInventory('admin')).toBe(true);
        expect(canEditInventory('inventory_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditInventory('purchasing_staff')).toBe(false);
        expect(canEditInventory('readonly')).toBe(false);
      });
    });

    describe('canViewInventory', () => {
      it('should allow all roles', () => {
        allRoles.forEach((role) => {
          expect(canViewInventory(role)).toBe(true);
        });
      });
    });

    describe('canAdjustInventory', () => {
      it('should allow admin and inventory_staff', () => {
        expect(canAdjustInventory('admin')).toBe(true);
        expect(canAdjustInventory('inventory_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canAdjustInventory('manager')).toBe(false);
        expect(canAdjustInventory('readonly')).toBe(false);
      });
    });
  });

  describe('発注・仕入管理権限', () => {
    describe('canCreatePurchaseOrder', () => {
      it('should allow admin, manager, and purchasing_staff', () => {
        expect(canCreatePurchaseOrder('admin')).toBe(true);
        expect(canCreatePurchaseOrder('manager')).toBe(true);
        expect(canCreatePurchaseOrder('purchasing_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canCreatePurchaseOrder('sales_staff')).toBe(false);
        expect(canCreatePurchaseOrder('readonly')).toBe(false);
      });
    });

    describe('canEditPurchaseOrder', () => {
      it('should allow admin and purchasing_staff', () => {
        expect(canEditPurchaseOrder('admin')).toBe(true);
        expect(canEditPurchaseOrder('purchasing_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditPurchaseOrder('manager')).toBe(false);
        expect(canEditPurchaseOrder('readonly')).toBe(false);
      });
    });

    describe('canDeletePurchaseOrder', () => {
      it('should allow admin and manager', () => {
        expect(canDeletePurchaseOrder('admin')).toBe(true);
        expect(canDeletePurchaseOrder('manager')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canDeletePurchaseOrder('purchasing_staff')).toBe(false);
        expect(canDeletePurchaseOrder('readonly')).toBe(false);
      });
    });

    describe('canManagePurchaseTransaction', () => {
      it('should allow admin and purchasing_staff', () => {
        expect(canManagePurchaseTransaction('admin')).toBe(true);
        expect(canManagePurchaseTransaction('purchasing_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canManagePurchaseTransaction('sales_staff')).toBe(false);
      });
    });
  });

  describe('受注・売上管理権限', () => {
    describe('canManageSalesOrder', () => {
      it('should allow admin, manager, and sales_staff', () => {
        expect(canManageSalesOrder('admin')).toBe(true);
        expect(canManageSalesOrder('manager')).toBe(true);
        expect(canManageSalesOrder('sales_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canManageSalesOrder('purchasing_staff')).toBe(false);
        expect(canManageSalesOrder('readonly')).toBe(false);
      });
    });

    describe('canManageSalesTransaction', () => {
      it('should allow admin and sales_staff', () => {
        expect(canManageSalesTransaction('admin')).toBe(true);
        expect(canManageSalesTransaction('sales_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canManageSalesTransaction('manager')).toBe(false);
      });
    });
  });

  describe('買掛金・支払管理権限', () => {
    describe('canViewAccountsPayable', () => {
      it('should allow admin, manager, purchasing_staff, accounting_staff', () => {
        expect(canViewAccountsPayable('admin')).toBe(true);
        expect(canViewAccountsPayable('manager')).toBe(true);
        expect(canViewAccountsPayable('purchasing_staff')).toBe(true);
        expect(canViewAccountsPayable('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewAccountsPayable('sales_staff')).toBe(false);
        expect(canViewAccountsPayable('readonly')).toBe(false);
      });
    });

    describe('canEditAccountsPayable', () => {
      it('should allow admin and accounting_staff', () => {
        expect(canEditAccountsPayable('admin')).toBe(true);
        expect(canEditAccountsPayable('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditAccountsPayable('manager')).toBe(false);
        expect(canEditAccountsPayable('purchasing_staff')).toBe(false);
      });
    });

    describe('canProcessPayment', () => {
      it('should allow admin and accounting_staff', () => {
        expect(canProcessPayment('admin')).toBe(true);
        expect(canProcessPayment('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canProcessPayment('manager')).toBe(false);
      });
    });

    describe('canEditPaymentSchedule', () => {
      it('should allow admin and accounting_staff', () => {
        expect(canEditPaymentSchedule('admin')).toBe(true);
        expect(canEditPaymentSchedule('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditPaymentSchedule('manager')).toBe(false);
      });
    });
  });

  describe('売掛金・入金管理権限', () => {
    describe('canViewAccountsReceivable', () => {
      it('should allow admin, manager, sales_staff, accounting_staff', () => {
        expect(canViewAccountsReceivable('admin')).toBe(true);
        expect(canViewAccountsReceivable('manager')).toBe(true);
        expect(canViewAccountsReceivable('sales_staff')).toBe(true);
        expect(canViewAccountsReceivable('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewAccountsReceivable('purchasing_staff')).toBe(false);
        expect(canViewAccountsReceivable('readonly')).toBe(false);
      });
    });

    describe('canEditAccountsReceivable', () => {
      it('should allow admin and accounting_staff', () => {
        expect(canEditAccountsReceivable('admin')).toBe(true);
        expect(canEditAccountsReceivable('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditAccountsReceivable('manager')).toBe(false);
        expect(canEditAccountsReceivable('sales_staff')).toBe(false);
      });
    });

    describe('canProcessReceipt', () => {
      it('should allow admin and accounting_staff', () => {
        expect(canProcessReceipt('admin')).toBe(true);
        expect(canProcessReceipt('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canProcessReceipt('sales_staff')).toBe(false);
      });
    });
  });

  describe('レポート・分析権限', () => {
    describe('canViewFinancialReports', () => {
      it('should allow admin, manager, accounting_staff', () => {
        expect(canViewFinancialReports('admin')).toBe(true);
        expect(canViewFinancialReports('manager')).toBe(true);
        expect(canViewFinancialReports('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewFinancialReports('sales_staff')).toBe(false);
        expect(canViewFinancialReports('readonly')).toBe(false);
      });
    });

    describe('canViewInventoryReports', () => {
      it('should allow admin, manager, purchasing_staff, inventory_staff, sales_staff', () => {
        expect(canViewInventoryReports('admin')).toBe(true);
        expect(canViewInventoryReports('manager')).toBe(true);
        expect(canViewInventoryReports('purchasing_staff')).toBe(true);
        expect(canViewInventoryReports('inventory_staff')).toBe(true);
        expect(canViewInventoryReports('sales_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewInventoryReports('accounting_staff')).toBe(false);
        expect(canViewInventoryReports('readonly')).toBe(false);
      });
    });

    describe('canViewPurchaseReports', () => {
      it('should allow admin, manager, purchasing_staff, accounting_staff', () => {
        expect(canViewPurchaseReports('admin')).toBe(true);
        expect(canViewPurchaseReports('manager')).toBe(true);
        expect(canViewPurchaseReports('purchasing_staff')).toBe(true);
        expect(canViewPurchaseReports('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewPurchaseReports('sales_staff')).toBe(false);
        expect(canViewPurchaseReports('readonly')).toBe(false);
      });
    });

    describe('canViewSalesReports', () => {
      it('should allow admin, manager, sales_staff, accounting_staff', () => {
        expect(canViewSalesReports('admin')).toBe(true);
        expect(canViewSalesReports('manager')).toBe(true);
        expect(canViewSalesReports('sales_staff')).toBe(true);
        expect(canViewSalesReports('accounting_staff')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewSalesReports('purchasing_staff')).toBe(false);
        expect(canViewSalesReports('readonly')).toBe(false);
      });
    });
  });

  describe('システム管理権限', () => {
    describe('canManageUsers', () => {
      it('should allow only admin', () => {
        expect(canManageUsers('admin')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canManageUsers('manager')).toBe(false);
        expect(canManageUsers('staff')).toBe(false);
      });
    });

    describe('canEditSystemSettings', () => {
      it('should allow only admin', () => {
        expect(canEditSystemSettings('admin')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canEditSystemSettings('manager')).toBe(false);
      });
    });

    describe('canViewAuditLogs', () => {
      it('should allow admin and manager', () => {
        expect(canViewAuditLogs('admin')).toBe(true);
        expect(canViewAuditLogs('manager')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canViewAuditLogs('staff')).toBe(false);
      });
    });
  });

  describe('ダッシュボード権限', () => {
    describe('canViewDashboard', () => {
      it('should allow all roles', () => {
        allRoles.forEach((role) => {
          expect(canViewDashboard(role)).toBe(true);
        });
      });
    });
  });

  describe('複合権限チェック', () => {
    describe('canApproveHighValueTransaction', () => {
      it('should allow low-value transactions for all roles', () => {
        allRoles.forEach((role) => {
          expect(canApproveHighValueTransaction(role, 500000)).toBe(true);
        });
      });

      it('should require admin or manager for high-value transactions', () => {
        expect(canApproveHighValueTransaction('admin', 2000000)).toBe(true);
        expect(canApproveHighValueTransaction('manager', 2000000)).toBe(true);
        expect(canApproveHighValueTransaction('staff', 2000000)).toBe(false);
        expect(canApproveHighValueTransaction('readonly', 2000000)).toBe(false);
      });

      it('should handle threshold boundary correctly', () => {
        expect(canApproveHighValueTransaction('staff', 999999)).toBe(true);
        expect(canApproveHighValueTransaction('staff', 1000000)).toBe(false);
      });
    });

    describe('canDeleteData', () => {
      it('should allow admin and manager', () => {
        expect(canDeleteData('admin')).toBe(true);
        expect(canDeleteData('manager')).toBe(true);
      });

      it('should deny other roles', () => {
        expect(canDeleteData('staff')).toBe(false);
        expect(canDeleteData('readonly')).toBe(false);
      });
    });

    describe('canExportData', () => {
      it('should allow all roles except readonly', () => {
        expect(canExportData('admin')).toBe(true);
        expect(canExportData('manager')).toBe(true);
        expect(canExportData('staff')).toBe(true);
        expect(canExportData('purchasing_staff')).toBe(true);
      });

      it('should deny readonly role', () => {
        expect(canExportData('readonly')).toBe(false);
      });
    });
  });

  describe('ヘルパー関数', () => {
    describe('isAdmin', () => {
      it('should return true only for admin', () => {
        expect(isAdmin('admin')).toBe(true);
        expect(isAdmin('manager')).toBe(false);
        expect(isAdmin('staff')).toBe(false);
      });
    });

    describe('isManagement', () => {
      it('should return true for admin and manager', () => {
        expect(isManagement('admin')).toBe(true);
        expect(isManagement('manager')).toBe(true);
      });

      it('should return false for other roles', () => {
        expect(isManagement('staff')).toBe(false);
        expect(isManagement('readonly')).toBe(false);
      });
    });

    describe('canEdit', () => {
      it('should allow all roles except readonly', () => {
        expect(canEdit('admin')).toBe(true);
        expect(canEdit('manager')).toBe(true);
        expect(canEdit('staff')).toBe(true);
      });

      it('should deny readonly role', () => {
        expect(canEdit('readonly')).toBe(false);
      });
    });

    describe('isSpecialist', () => {
      it('should return true for specialist roles', () => {
        expect(isSpecialist('purchasing_staff')).toBe(true);
        expect(isSpecialist('inventory_staff')).toBe(true);
        expect(isSpecialist('sales_staff')).toBe(true);
        expect(isSpecialist('accounting_staff')).toBe(true);
      });

      it('should return false for non-specialist roles', () => {
        expect(isSpecialist('admin')).toBe(false);
        expect(isSpecialist('manager')).toBe(false);
        expect(isSpecialist('staff')).toBe(false);
        expect(isSpecialist('readonly')).toBe(false);
      });
    });
  });
});
