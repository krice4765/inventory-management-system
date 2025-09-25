import { lazy } from 'react';

// 高優先度コンポーネント（初期表示に必要）
// Dashboard と Login は同期インポートを維持

// 中優先度コンポーネント（日常的に使用）
export const Products = lazy(() =>
  import('../pages/Products').then(module => ({ default: module.default }))
);

export const Inventory = lazy(() =>
  import('../pages/Inventory').then(module => ({ default: module.default }))
);

export const Orders = lazy(() =>
  import('../pages/Orders').then(module => ({ default: module.default }))
);

export const OutboundOrders = lazy(() =>
  import('../pages/OutboundOrders').then(module => ({ default: module.default }))
);

export const OutboundOrderNew = lazy(() =>
  import('../pages/OutboundOrderNew').then(module => ({ default: module.default }))
);

// 低優先度コンポーネント（管理画面・詳細画面）
export const Partners = lazy(() =>
  import('../pages/Partners').then(module => ({ default: module.default }))
);

export const PurchaseOrders = lazy(() =>
  import('../pages/PurchaseOrders').then(module => ({ default: module.default }))
);

export const OrderNew = lazy(() =>
  import('../pages/OrderNew').then(module => ({ default: module.default }))
);

export const OrderDetail = lazy(() =>
  import('../pages/OrderDetail').then(module => ({ default: module.default }))
);

export const PurchaseOrderDetail = lazy(() =>
  import('../pages/PurchaseOrderDetail').then(module => ({ default: module.default }))
);

// 重要な大型コンポーネント（1168行のDeliveryModal）
export const DeliveryModal = lazy(() =>
  import('../components/DeliveryModal').then(module => ({ default: module.DeliveryModal }))
);

// 管理・監視コンポーネント
export const PerformanceDashboard = lazy(() =>
  import('../components/PerformanceDashboard')
);

export const IntegrityDashboard = lazy(() =>
  import('../components/IntegrityDashboard')
);

// 整合性管理統合画面
export const IntegrityManagement = lazy(() =>
  import('../pages/IntegrityManagement').then(module => ({ default: module.default }))
);

// ユーザー管理システム
export const UserManagement = lazy(() =>
  import('../pages/UserManagement').then(module => ({ default: module.default }))
);

export const UserApplication = lazy(() =>
  import('../pages/UserApplication').then(module => ({ default: module.default }))
);

// モーダルコンポーネント
export const ModernOutboundOrderDetailModal = lazy(() =>
  import('../components/modals/ModernOutboundOrderDetailModal').then(module => ({ default: module.default }))
);

export const InventoryAllocationModal = lazy(() =>
  import('../components/modals/InventoryAllocationModal').then(module => ({ default: module.default }))
);

export const OutboundOrderEditModal = lazy(() =>
  import('../components/modals/OutboundOrderEditModal').then(module => ({ default: module.default }))
);

export const ModernShippingProcessModal = lazy(() =>
  import('../components/modals/ModernShippingProcessModal').then(module => ({ default: module.default }))
);

export const ModernDeleteConfirmationModal = lazy(() =>
  import('../components/modals/ModernDeleteConfirmationModal').then(module => ({ default: module.default }))
);

export const CreateOutboundOrderModal = lazy(() =>
  import('../components/modals/CreateOutboundOrderModal').then(module => ({ default: module.default }))
);