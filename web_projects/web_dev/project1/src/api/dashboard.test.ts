import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDashboardStats, fetchRecentUpdates } from './dashboard';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchDashboardStats', () => {
    it('should fetch and calculate dashboard statistics', async () => {
      const mockProducts = [
        {
          stock_quantity: 100,
          safety_stock_quantity: 20,
          purchase_price: '50',
          sell_price: '80',
        },
        {
          stock_quantity: 10,
          safety_stock_quantity: 15,
          purchase_price: '30',
          sell_price: '50',
        },
        {
          stock_quantity: 50,
          safety_stock_quantity: 30,
          purchase_price: '20',
          sell_price: '40',
        },
      ];

      const mockSelect = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchDashboardStats();

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockSelect).toHaveBeenCalledWith(
        'stock_quantity, safety_stock_quantity, purchase_price, sell_price'
      );

      // Calculations:
      // Product 1: stock=100, safety=20 -> NOT low stock, value=100*50=5000, revenue=100*80=8000
      // Product 2: stock=10, safety=15 -> IS low stock, value=10*30=300, revenue=10*50=500
      // Product 3: stock=50, safety=30 -> NOT low stock, value=50*20=1000, revenue=50*40=2000
      expect(result).toEqual({
        totalProducts: 3,
        lowStockCount: 1, // Only Product 2
        totalStockValue: 6300, // 5000 + 300 + 1000
        totalPotentialRevenue: 10500, // 8000 + 500 + 2000
      });
    });

    it('should handle empty products array', async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchDashboardStats();

      expect(result).toEqual({
        totalProducts: 0,
        lowStockCount: 0,
        totalStockValue: 0,
        totalPotentialRevenue: 0,
      });
    });

    it('should handle null data from Supabase', async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchDashboardStats();

      expect(result).toEqual({
        totalProducts: 0,
        lowStockCount: 0,
        totalStockValue: 0,
        totalPotentialRevenue: 0,
      });
    });

    it('should handle products with null values', async () => {
      const mockProducts = [
        {
          stock_quantity: null,
          safety_stock_quantity: null,
          purchase_price: null,
          sell_price: null,
        },
        {
          stock_quantity: 50,
          safety_stock_quantity: null,
          purchase_price: '25',
          sell_price: null,
        },
      ];

      const mockSelect = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchDashboardStats();

      // Product 1: all null -> 0 <= 0 (low stock), value=0, revenue=0
      // Product 2: stock=50, safety=0, purchase=25, sell=0 -> NOT low stock, value=50*25=1250, revenue=0
      expect(result).toEqual({
        totalProducts: 2,
        lowStockCount: 1, // Product 1 (0 <= 0)
        totalStockValue: 1250,
        totalPotentialRevenue: 0,
      });
    });

    it('should count low stock when quantity equals safety stock', async () => {
      const mockProducts = [
        {
          stock_quantity: 20,
          safety_stock_quantity: 20,
          purchase_price: '10',
          sell_price: '15',
        },
      ];

      const mockSelect = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchDashboardStats();

      expect(result.lowStockCount).toBe(1); // 20 <= 20 is true
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Database connection failed' };
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(fetchDashboardStats()).rejects.toThrow(
        'Dashboard統計の取得に失敗: Database connection failed'
      );
    });

    it('should handle large numbers correctly', async () => {
      const mockProducts = [
        {
          stock_quantity: 10000,
          safety_stock_quantity: 1000,
          purchase_price: '9999.99',
          sell_price: '15000.50',
        },
      ];

      const mockSelect = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchDashboardStats();

      expect(result.totalStockValue).toBe(99999900); // 10000 * 9999.99
      expect(result.totalPotentialRevenue).toBe(150005000); // 10000 * 15000.50
    });
  });

  describe('fetchRecentUpdates', () => {
    it('should fetch recent updates with default limit', async () => {
      const mockUpdates = [
        {
          id: 1,
          name: 'Product A',
          product_code: 'P001',
          updated_at: '2024-01-15T10:00:00Z',
          stock_quantity: 100,
          safety_stock_quantity: 20,
        },
        {
          id: 2,
          name: 'Product B',
          product_code: 'P002',
          updated_at: '2024-01-14T10:00:00Z',
          stock_quantity: 50,
          safety_stock_quantity: 10,
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockUpdates,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchRecentUpdates();

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, name, product_code, updated_at, stock_quantity, safety_stock_quantity'
      );
      expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(10); // default limit

      expect(result).toEqual(mockUpdates);
    });

    it('should fetch recent updates with custom limit', async () => {
      const mockUpdates = [
        {
          id: 1,
          name: 'Product A',
          product_code: 'P001',
          updated_at: '2024-01-15T10:00:00Z',
          stock_quantity: 100,
          safety_stock_quantity: 20,
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockUpdates,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchRecentUpdates(5);

      expect(mockLimit).toHaveBeenCalledWith(5); // custom limit
      expect(result).toEqual(mockUpdates);
    });

    it('should return empty array when no updates available', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchRecentUpdates();

      expect(result).toEqual([]);
    });

    it('should handle null data from Supabase', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchRecentUpdates();

      expect(result).toEqual([]);
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Permission denied' };
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(fetchRecentUpdates()).rejects.toThrow(
        '最近更新の取得に失敗: Permission denied'
      );
    });

    it('should handle limit of 0', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchRecentUpdates(0);

      expect(mockLimit).toHaveBeenCalledWith(0);
      expect(result).toEqual([]);
    });

    it('should handle large limit values', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await fetchRecentUpdates(1000);

      expect(mockLimit).toHaveBeenCalledWith(1000);
    });
  });
});
