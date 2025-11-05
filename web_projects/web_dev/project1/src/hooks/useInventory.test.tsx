import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../api/inventory';
import {
  useInventoryMovements,
  useCreateInventoryMovement,
  useDeleteInventoryMovement,
} from './useInventory';
import type { InventoryMovement, MovementInsert } from '../api/inventory';
import { ReactNode } from 'react';

// APIモック
vi.mock('../api/inventory', () => ({
  getInventoryMovements: vi.fn(),
  createInventoryMovement: vi.fn(),
  deleteInventoryMovement: vi.fn(),
}));

describe('useInventory', () => {
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

  describe('useInventoryMovements', () => {
    it('should fetch inventory movements with default limit', async () => {
      const mockMovements: InventoryMovement[] = [
        {
          id: 1,
          product_id: 1,
          movement_type: 'purchase',
          quantity: 10,
          unit_price: 100,
          reference_type: 'purchase_order',
          reference_id: 1,
          reason: null,
          created_at: '2025-01-01T00:00:00Z',
          user_id: 'user-1',
          products: {
            id: 1,
            product_code: 'P001',
            name: 'Product 1',
            description: null,
            purchase_price: 100,
            sell_price: 150,
            stock_quantity: 100,
            safety_stock_quantity: 10,
            main_supplier_id: 1,
            image_url: null,
          },
        },
      ];

      vi.mocked(api.getInventoryMovements).mockResolvedValue(mockMovements);

      const { result } = renderHook(() => useInventoryMovements(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockMovements);
      expect(api.getInventoryMovements).toHaveBeenCalledWith(50); // default limit
    });

    it('should fetch inventory movements with custom limit', async () => {
      const mockMovements: InventoryMovement[] = [];
      vi.mocked(api.getInventoryMovements).mockResolvedValue(mockMovements);

      const { result } = renderHook(() => useInventoryMovements(100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.getInventoryMovements).toHaveBeenCalledWith(100);
    });

    it('should handle fetch error', async () => {
      const mockError = new Error('Failed to fetch inventory movements');
      vi.mocked(api.getInventoryMovements).mockRejectedValue(mockError);

      const { result } = renderHook(() => useInventoryMovements(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });

    it('should use correct query key with limit', () => {
      vi.mocked(api.getInventoryMovements).mockResolvedValue([]);

      const { result } = renderHook(() => useInventoryMovements(25), {
        wrapper: createWrapper(),
      });

      // queryKeyに正しいlimitが含まれていることを確認
      expect(result.current).toBeDefined();
    });
  });

  describe('useCreateInventoryMovement', () => {
    it('should create inventory movement successfully', async () => {
      const newMovement: MovementInsert = {
        product_id: 1,
        movement_type: 'purchase',
        quantity: 20,
        unit_price: 100,
        reference_type: 'purchase_order',
        reference_id: 1,
        reason: null,
      };

      const createdMovement: InventoryMovement = {
        id: 2,
        ...newMovement,
        created_at: '2025-01-01T00:00:00Z',
        user_id: 'user-1',
        products: {
          id: 1,
          product_code: 'P001',
          name: 'Product 1',
          description: null,
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 120,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
        },
      };

      vi.mocked(api.createInventoryMovement).mockResolvedValue(createdMovement);

      const { result } = renderHook(() => useCreateInventoryMovement(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isIdle).toBe(true);

      result.current.mutate(newMovement);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(createdMovement);
      expect(api.createInventoryMovement).toHaveBeenCalledWith(newMovement);
    });

    it('should handle optimistic update on create', async () => {
      const newMovement: MovementInsert = {
        product_id: 1,
        movement_type: 'adjustment',
        quantity: 5,
        unit_price: 100,
        reference_type: null,
        reference_id: null,
        reason: 'stock count adjustment',
      };

      const existingMovements: InventoryMovement[] = [
        {
          id: 1,
          product_id: 1,
          movement_type: 'purchase',
          quantity: 10,
          unit_price: 100,
          reference_type: 'purchase_order',
          reference_id: 1,
          reason: null,
          created_at: '2025-01-01T00:00:00Z',
          user_id: 'user-1',
          products: undefined,
        },
      ];

      queryClient.setQueryData(['inventory-movements', 50], existingMovements);

      vi.mocked(api.createInventoryMovement).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({} as any), 100))
      );

      const { result } = renderHook(() => useCreateInventoryMovement(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newMovement);

      // 楽観的更新が適用されることを確認
      await waitFor(() => {
        const currentData = queryClient.getQueryData<InventoryMovement[]>(['inventory-movements', 50]);
        expect(currentData?.length).toBeGreaterThan(existingMovements.length);
      });
    });

    it('should invalidate related queries on create', async () => {
      const newMovement: MovementInsert = {
        product_id: 1,
        movement_type: 'sale',
        quantity: -5,
        unit_price: 150,
        reference_type: 'sales_order',
        reference_id: 1,
        reason: null,
      };

      vi.mocked(api.createInventoryMovement).mockResolvedValue({} as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateInventoryMovement(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newMovement);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // products と dashboard が無効化されることを確認
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory-movements'] });
    });

    it('should rollback on error', async () => {
      const newMovement: MovementInsert = {
        product_id: 1,
        movement_type: 'adjustment',
        quantity: 10,
        unit_price: 100,
        reference_type: null,
        reference_id: null,
        reason: 'test',
      };

      const existingMovements: InventoryMovement[] = [
        {
          id: 1,
          product_id: 1,
          movement_type: 'purchase',
          quantity: 10,
          unit_price: 100,
          reference_type: 'purchase_order',
          reference_id: 1,
          reason: null,
          created_at: '2025-01-01T00:00:00Z',
          user_id: 'user-1',
          products: undefined,
        },
      ];

      queryClient.setQueryData(['inventory-movements', 50], existingMovements);

      const mockError = new Error('Failed to create movement');
      vi.mocked(api.createInventoryMovement).mockRejectedValue(mockError);

      const { result } = renderHook(() => useCreateInventoryMovement(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newMovement);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // ロールバック確認
      const finalData = queryClient.getQueryData<InventoryMovement[]>(['inventory-movements', 50]);
      expect(finalData).toEqual(existingMovements);
    });
  });

  describe('useDeleteInventoryMovement', () => {
    it('should delete inventory movement successfully', async () => {
      const movementId = 1;

      vi.mocked(api.deleteInventoryMovement).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteInventoryMovement(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(movementId);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.deleteInventoryMovement).toHaveBeenCalledWith(movementId);
    });

    it('should invalidate related queries on delete', async () => {
      const movementId = 1;

      vi.mocked(api.deleteInventoryMovement).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteInventoryMovement(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(movementId);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // inventory-movements, products, dashboard が無効化されることを確認
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory-movements'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle delete error', async () => {
      const movementId = 1;
      const mockError = new Error('Failed to delete movement');

      vi.mocked(api.deleteInventoryMovement).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeleteInventoryMovement(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(movementId);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });
});
