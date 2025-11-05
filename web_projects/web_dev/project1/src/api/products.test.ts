import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getSuppliers,
  type ProductWithSupplier,
  type Product,
  type ProductInsert,
  type ProductUpdate,
} from './products';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('products API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProducts', () => {
    it('should fetch all products with supplier information', async () => {
      const mockProducts: ProductWithSupplier[] = [
        {
          id: 1,
          product_code: 'P001',
          name: 'Product A',
          category: 'Electronics',
          purchase_price: '100',
          sell_price: '150',
          stock_quantity: 50,
          safety_stock_quantity: 10,
          main_supplier_id: 1,
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
          suppliers: {
            id: 1,
            name: 'Supplier A',
          },
        },
        {
          id: 2,
          product_code: 'P002',
          name: 'Product B',
          category: 'Furniture',
          purchase_price: '200',
          sell_price: '300',
          stock_quantity: 30,
          safety_stock_quantity: 5,
          main_supplier_id: 2,
          created_at: '2024-01-14T00:00:00Z',
          updated_at: '2024-01-14T00:00:00Z',
          suppliers: {
            id: 2,
            name: 'Supplier B',
          },
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getProducts();

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('suppliers:main_supplier_id'));
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });

      expect(result).toEqual(mockProducts);
    });

    it('should return empty array when no products exist', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getProducts();

      expect(result).toEqual([]);
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Database connection failed', code: 'PGRST000' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getProducts()).rejects.toThrow(
        '商品データの取得に失敗しました: Database connection failed'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('商品データ取得エラー:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should handle products without supplier', async () => {
      const mockProducts: ProductWithSupplier[] = [
        {
          id: 3,
          product_code: 'P003',
          name: 'Product C',
          category: 'Office',
          purchase_price: '50',
          sell_price: '75',
          stock_quantity: 100,
          safety_stock_quantity: 20,
          main_supplier_id: null,
          created_at: '2024-01-13T00:00:00Z',
          updated_at: '2024-01-13T00:00:00Z',
          suppliers: null,
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getProducts();

      expect(result[0].suppliers).toBeNull();
    });
  });

  describe('createProduct', () => {
    it('should create a new product', async () => {
      const productData: ProductInsert = {
        product_code: 'P004',
        name: 'New Product',
        category: 'Electronics',
        purchase_price: '120',
        sell_price: '180',
        stock_quantity: 0,
        safety_stock_quantity: 5,
        main_supplier_id: 1,
      };

      const mockCreatedProduct: Product = {
        id: 4,
        ...productData,
        created_at: '2024-01-16T00:00:00Z',
        updated_at: '2024-01-16T00:00:00Z',
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreatedProduct,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await createProduct(productData);

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockInsert).toHaveBeenCalledWith([productData]);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockSingle).toHaveBeenCalled();

      expect(result).toEqual(mockCreatedProduct);
    });

    it('should throw specific error for duplicate product code', async () => {
      const productData: ProductInsert = {
        product_code: 'P001', // Duplicate
        name: 'Duplicate Product',
        category: 'Electronics',
        purchase_price: '100',
        sell_price: '150',
        stock_quantity: 0,
        safety_stock_quantity: 5,
        main_supplier_id: 1,
      };

      const mockError = { message: 'duplicate key value', code: '23505' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      await expect(createProduct(productData)).rejects.toThrow(
        '商品コードが重複しています。別のコードを使用してください。'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('商品作成エラー:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should throw generic error for other database errors', async () => {
      const productData: ProductInsert = {
        product_code: 'P005',
        name: 'Test Product',
        category: 'Electronics',
        purchase_price: '100',
        sell_price: '150',
        stock_quantity: 0,
        safety_stock_quantity: 5,
        main_supplier_id: 999, // Non-existent supplier
      };

      const mockError = { message: 'Foreign key violation', code: '23503' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      await expect(createProduct(productData)).rejects.toThrow(
        '商品の登録に失敗しました: Foreign key violation'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateProduct', () => {
    it('should update an existing product', async () => {
      const productData: ProductUpdate = {
        name: 'Updated Product',
        sell_price: '200',
      };

      const mockUpdatedProduct: Product = {
        id: 1,
        product_code: 'P001',
        name: 'Updated Product',
        category: 'Electronics',
        purchase_price: '100',
        sell_price: '200',
        stock_quantity: 50,
        safety_stock_quantity: 10,
        main_supplier_id: 1,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-16T10:00:00Z',
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedProduct,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      const result = await updateProduct(1, productData);

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockUpdate).toHaveBeenCalledWith(productData);
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockSingle).toHaveBeenCalled();

      expect(result).toEqual(mockUpdatedProduct);
    });

    it('should throw specific error for duplicate product code on update', async () => {
      const productData: ProductUpdate = {
        product_code: 'P002', // Existing code
      };

      const mockError = { message: 'duplicate key value', code: '23505' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(updateProduct(1, productData)).rejects.toThrow(
        '商品コードが重複しています。別のコードを使用してください。'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('商品更新エラー:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should throw generic error for other update errors', async () => {
      const productData: ProductUpdate = {
        name: 'Test Product',
      };

      const mockError = { message: 'Permission denied', code: 'PGRST000' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(updateProduct(1, productData)).rejects.toThrow(
        '商品の更新に失敗しました: Permission denied'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteProduct', () => {
    it('should delete a product by id', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await deleteProduct(5);

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 5);
    });

    it('should throw error when delete fails', async () => {
      const mockError = { message: 'Product not found', code: 'PGRST116' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockEq = vi.fn().mockResolvedValue({
        error: mockError,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await expect(deleteProduct(999)).rejects.toThrow(
        '商品の削除に失敗しました: Product not found'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('商品削除エラー:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should handle successful deletion without throwing', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await expect(deleteProduct(10)).resolves.toBeUndefined();
    });
  });

  describe('getSuppliers', () => {
    it('should fetch all suppliers ordered by name', async () => {
      const mockSuppliers = [
        { id: 1, name: 'Supplier A' },
        { id: 2, name: 'Supplier B' },
        { id: 3, name: 'Supplier C' },
      ];

      const mockOrder = vi.fn().mockResolvedValue({
        data: mockSuppliers,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getSuppliers();

      expect(supabase.from).toHaveBeenCalledWith('suppliers');
      expect(mockSelect).toHaveBeenCalledWith('id, name');
      expect(mockOrder).toHaveBeenCalledWith('name');

      expect(result).toEqual(mockSuppliers);
    });

    it('should return empty array when no suppliers exist', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getSuppliers();

      expect(result).toEqual([]);
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Permission denied', code: 'PGRST000' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getSuppliers()).rejects.toThrow(
        '仕入先データの取得に失敗しました: Permission denied'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('仕入先データ取得エラー:', mockError);
      consoleErrorSpy.mockRestore();
    });
  });
});
