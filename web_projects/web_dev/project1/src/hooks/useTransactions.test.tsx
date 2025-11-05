import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../api/transactions';
import {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePurchaseOrder,
  useUpdateTransactionStatus,
  useDeleteTransaction,
} from './useTransactions';
import type { Transaction, TransactionInsert } from '../api/transactions';
import toast from 'react-hot-toast';
import { ReactNode } from 'react';

// APIモック
vi.mock('../api/transactions', () => ({
  getPurchaseOrders: vi.fn(),
  getPurchaseOrderById: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updateTransactionStatus: vi.fn(),
  deleteTransaction: vi.fn(),
}));

// react-hot-toastモック
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useTransactions', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  describe('usePurchaseOrders', () => {
    it('should fetch purchase orders with default limit', async () => {
      const mockOrders: Transaction[] = [
        {
          id: 1,
          transaction_no: 'PO-001',
          transaction_type: 'purchase',
          partner_id: 1,
          transaction_date: '2025-01-01',
          due_date: '2025-01-31',
          status: 'draft',
          subtotal: 1000,
          tax_amount: 100,
          total_amount: 1100,
          notes: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          created_by: 'user-1',
          items: [],
          partners: {
            id: 1,
            name: 'Partner 1',
            type: 'supplier',
            contact_name: null,
            email: null,
            phone: null,
            address: null,
          },
        },
      ];

      vi.mocked(api.getPurchaseOrders).mockResolvedValue(mockOrders);

      const { result } = renderHook(() => usePurchaseOrders(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockOrders);
      expect(api.getPurchaseOrders).toHaveBeenCalledWith(50);
    });

    it('should fetch purchase orders with custom limit', async () => {
      const mockOrders: Transaction[] = [];
      vi.mocked(api.getPurchaseOrders).mockResolvedValue(mockOrders);

      const { result } = renderHook(() => usePurchaseOrders(100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.getPurchaseOrders).toHaveBeenCalledWith(100);
    });

    it('should handle fetch error', async () => {
      const mockError = new Error('Failed to fetch orders');
      vi.mocked(api.getPurchaseOrders).mockRejectedValue(mockError);

      const { result } = renderHook(() => usePurchaseOrders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('usePurchaseOrder', () => {
    it('should fetch purchase order by id', async () => {
      const mockOrder: Transaction = {
        id: 1,
        transaction_no: 'PO-001',
        transaction_type: 'purchase',
        partner_id: 1,
        transaction_date: '2025-01-01',
        due_date: '2025-01-31',
        status: 'draft',
        subtotal: 1000,
        tax_amount: 100,
        total_amount: 1100,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        created_by: 'user-1',
        items: [],
        partners: {
          id: 1,
          name: 'Partner 1',
          type: 'supplier',
          contact_name: null,
          email: null,
          phone: null,
          address: null,
        },
      };

      vi.mocked(api.getPurchaseOrderById).mockResolvedValue(mockOrder);

      const { result } = renderHook(() => usePurchaseOrder(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockOrder);
      expect(api.getPurchaseOrderById).toHaveBeenCalledWith(1);
    });

    it('should not fetch when id is null', () => {
      const { result } = renderHook(() => usePurchaseOrder(null), {
        wrapper: createWrapper(),
      });

      // enabledがfalseなのでfetchされない
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
      expect(api.getPurchaseOrderById).not.toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      const mockError = new Error('Order not found');
      vi.mocked(api.getPurchaseOrderById).mockRejectedValue(mockError);

      const { result } = renderHook(() => usePurchaseOrder(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useCreatePurchaseOrder', () => {
    it('should create purchase order successfully', async () => {
      const newOrder: TransactionInsert = {
        transaction_type: 'purchase',
        partner_id: 1,
        transaction_date: '2025-01-01',
        due_date: '2025-01-31',
        status: 'draft',
        subtotal: 1000,
        tax_amount: 100,
        total_amount: 1100,
        notes: null,
        items: [],
      };

      const createdOrder: Transaction = {
        id: 1,
        transaction_no: 'PO-001',
        ...newOrder,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        created_by: 'user-1',
        partners: {
          id: 1,
          name: 'Partner 1',
          type: 'supplier',
          contact_name: null,
          email: null,
          phone: null,
          address: null,
        },
      };

      vi.mocked(api.createPurchaseOrder).mockResolvedValue(createdOrder);

      const { result } = renderHook(() => useCreatePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newOrder);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(createdOrder);
      expect(toast.success).toHaveBeenCalledWith('仕入伝票「PO-001」を作成しました');
    });

    it('should invalidate related queries on success', async () => {
      const newOrder: TransactionInsert = {
        transaction_type: 'purchase',
        partner_id: 1,
        transaction_date: '2025-01-01',
        due_date: '2025-01-31',
        status: 'draft',
        subtotal: 1000,
        tax_amount: 100,
        total_amount: 1100,
        notes: null,
        items: [],
      };

      vi.mocked(api.createPurchaseOrder).mockResolvedValue({
        id: 1,
        transaction_no: 'PO-001',
      } as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreatePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newOrder);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['purchase-orders'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory-movements'] });
    });

    it('should show error toast on failure', async () => {
      const newOrder: TransactionInsert = {
        transaction_type: 'purchase',
        partner_id: 1,
        transaction_date: '2025-01-01',
        due_date: '2025-01-31',
        status: 'draft',
        subtotal: 1000,
        tax_amount: 100,
        total_amount: 1100,
        notes: null,
        items: [],
      };

      const mockError = new Error('Database error');
      vi.mocked(api.createPurchaseOrder).mockRejectedValue(mockError);

      const { result } = renderHook(() => useCreatePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newOrder);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('作成に失敗しました: Database error');
    });
  });

  describe('useUpdateTransactionStatus', () => {
    it('should update status to confirmed', async () => {
      const updatedTransaction: Transaction = {
        id: 1,
        transaction_no: 'PO-001',
        transaction_type: 'purchase',
        partner_id: 1,
        transaction_date: '2025-01-01',
        due_date: '2025-01-31',
        status: 'confirmed',
        subtotal: 1000,
        tax_amount: 100,
        total_amount: 1100,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        created_by: 'user-1',
        items: [],
        partners: {
          id: 1,
          name: 'Partner 1',
          type: 'supplier',
          contact_name: null,
          email: null,
          phone: null,
          address: null,
        },
      };

      vi.mocked(api.updateTransactionStatus).mockResolvedValue(updatedTransaction);

      const { result } = renderHook(() => useUpdateTransactionStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, status: 'confirmed' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(toast.success).toHaveBeenCalledWith('伝票を確定しました');
    });

    it('should update status to cancelled', async () => {
      const updatedTransaction: Transaction = {
        id: 1,
        transaction_no: 'PO-001',
        status: 'cancelled',
      } as any;

      vi.mocked(api.updateTransactionStatus).mockResolvedValue(updatedTransaction);

      const { result } = renderHook(() => useUpdateTransactionStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, status: 'cancelled' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(toast.success).toHaveBeenCalledWith('伝票をキャンセルしました');
    });

    it('should update status to draft', async () => {
      const updatedTransaction: Transaction = {
        id: 1,
        transaction_no: 'PO-001',
        status: 'draft',
      } as any;

      vi.mocked(api.updateTransactionStatus).mockResolvedValue(updatedTransaction);

      const { result } = renderHook(() => useUpdateTransactionStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, status: 'draft' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(toast.success).toHaveBeenCalledWith('伝票を下書きに戻しました');
    });

    it('should invalidate related queries on success', async () => {
      vi.mocked(api.updateTransactionStatus).mockResolvedValue({
        id: 1,
        status: 'confirmed',
      } as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateTransactionStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, status: 'confirmed' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['purchase-orders'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['purchase-order', 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory-movements'] });
    });

    it('should show error toast on failure', async () => {
      const mockError = new Error('Permission denied');
      vi.mocked(api.updateTransactionStatus).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUpdateTransactionStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: 1, status: 'confirmed' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('ステータス更新に失敗しました: Permission denied');
    });
  });

  describe('useDeleteTransaction', () => {
    it('should delete transaction successfully', async () => {
      const transactionId = 1;

      vi.mocked(api.deleteTransaction).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteTransaction(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(transactionId);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.deleteTransaction).toHaveBeenCalledWith(transactionId);
      expect(toast.success).toHaveBeenCalledWith('伝票を削除しました');
    });

    it('should invalidate related queries on success', async () => {
      vi.mocked(api.deleteTransaction).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteTransaction(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['purchase-orders'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should show error toast on failure', async () => {
      const mockError = new Error('Cannot delete confirmed transaction');
      vi.mocked(api.deleteTransaction).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeleteTransaction(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('削除に失敗しました: Cannot delete confirmed transaction');
    });
  });
});
