/**
 * React Query Configuration Utilities
 * Phase 16B: Optimized query configurations for different data types
 */

import { UseQueryOptions } from '@tanstack/react-query';

/**
 * Query configuration for report data
 * Reports change infrequently and can be cached longer
 */
export const REPORT_QUERY_CONFIG = {
  staleTime: 10 * 60 * 1000,      // 10 minutes - reports don't change frequently
  gcTime: 30 * 60 * 1000,         // 30 minutes cache
  refetchOnWindowFocus: false,    // Don't refetch reports on window focus
  refetchOnMount: false,          // Don't refetch on component remount if data is fresh
  refetchOnReconnect: true,       // Refetch on network reconnect
} satisfies Partial<UseQueryOptions>;

/**
 * Query configuration for transactional data
 * Transactions change more frequently and need fresher data
 */
export const TRANSACTION_QUERY_CONFIG = {
  staleTime: 1 * 60 * 1000,       // 1 minute
  gcTime: 10 * 60 * 1000,         // 10 minutes cache
  refetchOnWindowFocus: true,     // Refetch on window focus if stale
  refetchOnMount: true,           // Refetch on component remount if stale
  refetchOnReconnect: true,       // Refetch on network reconnect
} satisfies Partial<UseQueryOptions>;

/**
 * Query configuration for master data (partners, products)
 * Master data changes rarely and can be cached longest
 */
export const MASTER_DATA_QUERY_CONFIG = {
  staleTime: 30 * 60 * 1000,      // 30 minutes
  gcTime: 60 * 60 * 1000,         // 1 hour cache
  refetchOnWindowFocus: false,    // Don't refetch on window focus
  refetchOnMount: false,          // Don't refetch on component remount
  refetchOnReconnect: false,      // Don't refetch on network reconnect
} satisfies Partial<UseQueryOptions>;

/**
 * Query configuration for real-time data (inventory, balances)
 * Real-time data needs to be fresh and updated frequently
 */
export const REALTIME_QUERY_CONFIG = {
  staleTime: 30 * 1000,           // 30 seconds
  gcTime: 5 * 60 * 1000,          // 5 minutes cache
  refetchOnWindowFocus: true,     // Refetch on window focus
  refetchOnMount: true,           // Refetch on component remount
  refetchOnReconnect: true,       // Refetch on network reconnect
  refetchInterval: 60 * 1000,     // Automatic refetch every 60 seconds
} satisfies Partial<UseQueryOptions>;

/**
 * Query configuration for aggregated data
 * Aggregated data is expensive to compute and can be cached longer
 */
export const AGGREGATED_QUERY_CONFIG = {
  staleTime: 15 * 60 * 1000,      // 15 minutes
  gcTime: 45 * 60 * 1000,         // 45 minutes cache
  refetchOnWindowFocus: false,    // Don't refetch on window focus
  refetchOnMount: false,          // Don't refetch on component remount
  refetchOnReconnect: true,       // Refetch on network reconnect
} satisfies Partial<UseQueryOptions>;

/**
 * Query keys for consistent cache management
 */
export const QUERY_KEYS = {
  // Reports
  payableReport: (startDate: string, endDate: string, supplierId?: string) =>
    ['payableReport', startDate, endDate, supplierId] as const,
  payableTrends: (startDate: string, endDate: string, supplierId?: string) =>
    ['payableTrends', startDate, endDate, supplierId] as const,

  receivableReport: (startDate?: string, endDate?: string, customerId?: string) =>
    ['receivableReport', startDate, endDate, customerId] as const,
  receivableTrends: (startDate?: string, endDate?: string, customerId?: string) =>
    ['receivableTrends', startDate, endDate, customerId] as const,

  paymentHistory: (startDate: string, endDate: string, partnerId?: string) =>
    ['paymentHistory', startDate, endDate, partnerId] as const,
  paymentSummary: (startDate: string, endDate: string, partnerId?: string) =>
    ['paymentSummary', startDate, endDate, partnerId] as const,

  receiptHistory: (startDate: string, endDate: string, customerId?: string) =>
    ['receiptHistory', startDate, endDate, customerId] as const,
  receiptSummary: (startDate: string, endDate: string, customerId?: string) =>
    ['receiptSummary', startDate, endDate, customerId] as const,

  inventoryReport: (category?: string) =>
    ['inventoryReport', category] as const,

  inventoryMovement: (startDate: string, endDate: string, productId?: string, type?: string) =>
    ['inventoryMovement', startDate, endDate, productId, type] as const,
  inventoryMovementSummary: (startDate: string, endDate: string, productId?: string) =>
    ['inventoryMovementSummary', startDate, endDate, productId] as const,

  // Master data
  partners: (type?: string) =>
    ['partners', type] as const,
  products: (category?: string) =>
    ['products', category] as const,

  // Transactional data
  accountsPayable: () =>
    ['accountsPayable'] as const,
  accountsReceivable: () =>
    ['accountsReceivable'] as const,
  payments: () =>
    ['payments'] as const,
  receipts: () =>
    ['receipts'] as const,
} as const;

/**
 * Helper to prefetch data
 */
export function getPrefetchConfig(queryKey: unknown[]): { queryKey: unknown[]; staleTime: number } {
  // Determine stale time based on query type
  const key = String(queryKey[0]);

  if (key.endsWith('Report') || key.endsWith('Trends') || key.endsWith('Summary')) {
    return { queryKey, staleTime: REPORT_QUERY_CONFIG.staleTime };
  }

  if (key === 'partners' || key === 'products') {
    return { queryKey, staleTime: MASTER_DATA_QUERY_CONFIG.staleTime };
  }

  return { queryKey, staleTime: TRANSACTION_QUERY_CONFIG.staleTime };
}
