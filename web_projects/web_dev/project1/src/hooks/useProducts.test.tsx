import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../api/products';
import {
  useProducts,
  useSuppliers,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from './useProducts';
import type { ProductWithSupplier, ProductInsert, ProductUpdate } from '../api/products';
import { ReactNode } from 'react';

// APIモック
vi.mock('../api/products', () => ({
  getProducts: vi.fn(),
  getSuppliers: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

describe('useProducts', () => {
  let queryClient: QueryClient;

  // QueryClientProviderラッパーを作成
  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    // 各テスト前にQueryClientを新規作成
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // テストでリトライしない
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  describe('useProducts', () => {
    it('should fetch products successfully', async () => {
      const mockProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'Product 1',
          description: 'Description 1',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      vi.mocked(api.getProducts).mockResolvedValue(mockProducts);

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      // 初期状態
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // データ取得完了を待つ
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockProducts);
      expect(api.getProducts).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch error', async () => {
      const mockError = new Error('Failed to fetch products');
      vi.mocked(api.getProducts).mockRejectedValue(mockError);

      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });

    it('should have correct staleTime', () => {
      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      // staleTimeが5分(300000ms)であることを確認
      expect(result.current).toBeDefined();
    });
  });

  describe('useSuppliers', () => {
    it('should fetch suppliers successfully', async () => {
      const mockSuppliers = [
        { id: 1, name: 'Supplier 1', contact_name: 'John', email: 'john@example.com', phone: '123-456', address: 'Address 1' },
        { id: 2, name: 'Supplier 2', contact_name: 'Jane', email: 'jane@example.com', phone: '789-012', address: 'Address 2' },
      ];

      vi.mocked(api.getSuppliers).mockResolvedValue(mockSuppliers);

      const { result } = renderHook(() => useSuppliers(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSuppliers);
      expect(api.getSuppliers).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch error', async () => {
      const mockError = new Error('Failed to fetch suppliers');
      vi.mocked(api.getSuppliers).mockRejectedValue(mockError);

      const { result } = renderHook(() => useSuppliers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useCreateProduct', () => {
    it('should create product successfully', async () => {
      const newProduct: ProductInsert = {
        product_code: 'P003',
        name: 'New Product',
        description: 'New Description',
        purchase_price: 200,
        sell_price: 300,
        stock_quantity: 100,
        safety_stock_quantity: 20,
        main_supplier_id: 1,
        image_url: null,
      };

      const createdProduct: ProductWithSupplier = {
        id: 3,
        ...newProduct,
        suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
      };

      vi.mocked(api.createProduct).mockResolvedValue(createdProduct);

      const { result } = renderHook(() => useCreateProduct(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isIdle).toBe(true);

      // mutateを実行
      result.current.mutate(newProduct);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(createdProduct);
      expect(api.createProduct).toHaveBeenCalledWith(newProduct);
    });

    it('should handle optimistic update on create', async () => {
      const newProduct: ProductInsert = {
        product_code: 'P004',
        name: 'Optimistic Product',
        description: 'Test',
        purchase_price: 100,
        sell_price: 150,
        stock_quantity: 50,
        safety_stock_quantity: 10,
        main_supplier_id: 1,
        image_url: null,
      };

      // 既存の商品データをセット
      const existingProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'Existing Product',
          description: '',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      queryClient.setQueryData(['products'], existingProducts);

      vi.mocked(api.createProduct).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({} as any), 100))
      );

      const { result } = renderHook(() => useCreateProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newProduct);

      // onMutateが実行され、楽観的更新が行われることを確認
      await waitFor(() => {
        const currentData = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
        expect(currentData?.length).toBeGreaterThan(existingProducts.length);
      });
    });

    it('should rollback on error', async () => {
      const newProduct: ProductInsert = {
        product_code: 'P005',
        name: 'Failed Product',
        description: '',
        purchase_price: 100,
        sell_price: 150,
        stock_quantity: 50,
        safety_stock_quantity: 10,
        main_supplier_id: 1,
        image_url: null,
      };

      const existingProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'Existing Product',
          description: '',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      queryClient.setQueryData(['products'], existingProducts);

      const mockError = new Error('Failed to create product');
      vi.mocked(api.createProduct).mockRejectedValue(mockError);

      const { result } = renderHook(() => useCreateProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newProduct);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // エラー時にデータがロールバックされることを確認
      const finalData = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
      expect(finalData).toEqual(existingProducts);
    });
  });

  describe('useUpdateProduct', () => {
    it('should update product successfully', async () => {
      const productId = 1;
      const updatePayload: ProductUpdate = {
        name: 'Updated Product',
        sell_price: 200,
      };

      const updatedProduct: ProductWithSupplier = {
        id: productId,
        product_code: 'P001',
        name: 'Updated Product',
        description: '',
        purchase_price: 100,
        sell_price: 200,
        stock_quantity: 50,
        safety_stock_quantity: 10,
        main_supplier_id: 1,
        image_url: null,
        suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
      };

      vi.mocked(api.updateProduct).mockResolvedValue(updatedProduct);

      const { result } = renderHook(() => useUpdateProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: productId, payload: updatePayload });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.updateProduct).toHaveBeenCalledWith(productId, updatePayload);
    });

    it('should handle optimistic update', async () => {
      const productId = 1;
      const updatePayload: ProductUpdate = {
        name: 'Optimistically Updated',
      };

      const existingProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'Original Name',
          description: '',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      queryClient.setQueryData(['products'], existingProducts);

      vi.mocked(api.updateProduct).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({} as any), 100))
      );

      const { result } = renderHook(() => useUpdateProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: productId, payload: updatePayload });

      // 楽観的更新が適用されることを確認
      await waitFor(() => {
        const currentData = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
        expect(currentData?.[0].name).toBe('Optimistically Updated');
      });
    });

    it('should rollback on error', async () => {
      const productId = 1;
      const updatePayload: ProductUpdate = {
        name: 'Failed Update',
      };

      const existingProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'Original Name',
          description: '',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      queryClient.setQueryData(['products'], existingProducts);

      const mockError = new Error('Failed to update product');
      vi.mocked(api.updateProduct).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUpdateProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ id: productId, payload: updatePayload });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // ロールバック確認
      const finalData = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
      expect(finalData?.[0].name).toBe('Original Name');
    });
  });

  describe('useDeleteProduct', () => {
    it('should delete product successfully', async () => {
      const productId = 1;

      vi.mocked(api.deleteProduct).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(productId);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.deleteProduct).toHaveBeenCalledWith(productId);
    });

    it('should handle optimistic delete', async () => {
      const productId = 1;

      const existingProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'To Delete',
          description: '',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
        {
          id: 2,
          product_code: 'P002',
          name: 'To Keep',
          description: '',
          purchase_price: 200,
          sell_price: 300,
          stock_quantity: 100,
          safety_stock_quantity: 20,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      queryClient.setQueryData(['products'], existingProducts);

      vi.mocked(api.deleteProduct).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      );

      const { result } = renderHook(() => useDeleteProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(productId);

      // 楽観的削除が適用されることを確認
      await waitFor(() => {
        const currentData = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
        expect(currentData?.length).toBe(1);
        expect(currentData?.[0].id).toBe(2);
      });
    });

    it('should rollback on error', async () => {
      const productId = 1;

      const existingProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'To Delete',
          description: '',
          purchase_price: 100,
          sell_price: 150,
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          image_url: null,
          suppliers: { id: 1, name: 'Supplier 1', contact_name: null, email: null, phone: null, address: null },
        },
      ];

      queryClient.setQueryData(['products'], existingProducts);

      const mockError = new Error('Failed to delete product');
      vi.mocked(api.deleteProduct).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeleteProduct(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(productId);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // ロールバック確認
      const finalData = queryClient.getQueryData<ProductWithSupplier[]>(['products']);
      expect(finalData?.length).toBe(1);
      expect(finalData?.[0].id).toBe(1);
    });
  });
});
