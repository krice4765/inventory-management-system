import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getInventoryMovements,
  createInventoryMovement,
  deleteInventoryMovement,
  type MovementInsert,
  type InventoryMovement,
} from './inventory';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('inventory API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInventoryMovements', () => {
    it('should fetch inventory movements with default limit', async () => {
      const mockMovements: InventoryMovement[] = [
        {
          id: 1,
          product_id: 10,
          movement_type: 'purchase',
          quantity_delta: 50,
          unit_price: 100,
          note: 'Purchase order #123',
          created_at: '2024-01-15T10:00:00Z',
          user_id: 'user-1',
          products: {
            id: 10,
            name: 'Product A',
            product_code: 'P001',
            stock_quantity: 150,
          },
        },
        {
          id: 2,
          product_id: 20,
          movement_type: 'sale',
          quantity_delta: -10,
          unit_price: 200,
          note: null,
          created_at: '2024-01-14T10:00:00Z',
          user_id: 'user-2',
          products: {
            id: 20,
            name: 'Product B',
            product_code: 'P002',
            stock_quantity: 90,
          },
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockMovements,
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

      const result = await getInventoryMovements();

      expect(supabase.from).toHaveBeenCalledWith('inventory_movements');
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('id'));
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('products:product_id'));
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(50); // default limit

      expect(result).toEqual(mockMovements);
    });

    it('should fetch inventory movements with custom limit', async () => {
      const mockMovements: InventoryMovement[] = [
        {
          id: 1,
          product_id: 10,
          movement_type: 'adjustment_in',
          quantity_delta: 5,
          unit_price: 0,
          note: 'Manual adjustment',
          created_at: '2024-01-15T10:00:00Z',
          user_id: 'user-1',
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockMovements,
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

      const result = await getInventoryMovements(100);

      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockMovements);
    });

    it('should return empty array when no movements exist', async () => {
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

      const result = await getInventoryMovements();

      expect(result).toEqual([]);
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Database error', code: 'PGRST116' };
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

      await expect(getInventoryMovements()).rejects.toEqual(mockError);
    });

    it('should handle all movement types', async () => {
      const mockMovements: InventoryMovement[] = [
        {
          id: 1,
          product_id: 10,
          movement_type: 'purchase',
          quantity_delta: 50,
          unit_price: 100,
          note: null,
          created_at: '2024-01-15T10:00:00Z',
          user_id: 'user-1',
        },
        {
          id: 2,
          product_id: 20,
          movement_type: 'sale',
          quantity_delta: -10,
          unit_price: 200,
          note: null,
          created_at: '2024-01-14T10:00:00Z',
          user_id: 'user-2',
        },
        {
          id: 3,
          product_id: 30,
          movement_type: 'adjustment_in',
          quantity_delta: 5,
          unit_price: 0,
          note: 'Stock count adjustment',
          created_at: '2024-01-13T10:00:00Z',
          user_id: 'user-3',
        },
        {
          id: 4,
          product_id: 40,
          movement_type: 'adjustment_out',
          quantity_delta: -3,
          unit_price: 0,
          note: 'Damaged items',
          created_at: '2024-01-12T10:00:00Z',
          user_id: 'user-4',
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockMovements,
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

      const result = await getInventoryMovements();

      expect(result).toHaveLength(4);
      expect(result[0].movement_type).toBe('purchase');
      expect(result[1].movement_type).toBe('sale');
      expect(result[2].movement_type).toBe('adjustment_in');
      expect(result[3].movement_type).toBe('adjustment_out');
    });
  });

  describe('createInventoryMovement', () => {
    it('should create inventory movement with purchase type', async () => {
      const payload: MovementInsert = {
        product_id: 10,
        movement_type: 'purchase',
        quantity_delta: 100,
        unit_price: 50,
        note: 'Bulk purchase',
      };

      const mockCreatedMovement: InventoryMovement = {
        id: 5,
        ...payload,
        note: 'Bulk purchase',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user-1',
        products: {
          id: 10,
          name: 'Product A',
          product_code: 'P001',
          stock_quantity: 200,
        },
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreatedMovement,
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

      const result = await createInventoryMovement(payload);

      expect(supabase.from).toHaveBeenCalledWith('inventory_movements');
      expect(mockInsert).toHaveBeenCalledWith(payload);
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('id'));
      expect(mockSingle).toHaveBeenCalled();

      expect(result).toEqual(mockCreatedMovement);
    });

    it('should create inventory movement with sale type (negative quantity)', async () => {
      const payload: MovementInsert = {
        product_id: 20,
        movement_type: 'sale',
        quantity_delta: -50,
        unit_price: 150,
      };

      const mockCreatedMovement: InventoryMovement = {
        id: 6,
        ...payload,
        note: null,
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user-2',
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreatedMovement,
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

      const result = await createInventoryMovement(payload);

      expect(result.quantity_delta).toBe(-50);
      expect(result.movement_type).toBe('sale');
    });

    it('should create inventory movement with adjustment_in type', async () => {
      const payload: MovementInsert = {
        product_id: 30,
        movement_type: 'adjustment_in',
        quantity_delta: 10,
        unit_price: 0,
        note: 'Found extra stock during audit',
      };

      const mockCreatedMovement: InventoryMovement = {
        id: 7,
        ...payload,
        note: 'Found extra stock during audit',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user-3',
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreatedMovement,
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

      const result = await createInventoryMovement(payload);

      expect(result.movement_type).toBe('adjustment_in');
      expect(result.unit_price).toBe(0);
    });

    it('should create inventory movement with adjustment_out type', async () => {
      const payload: MovementInsert = {
        product_id: 40,
        movement_type: 'adjustment_out',
        quantity_delta: -5,
        unit_price: 0,
        note: 'Damaged during inspection',
      };

      const mockCreatedMovement: InventoryMovement = {
        id: 8,
        ...payload,
        note: 'Damaged during inspection',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user-4',
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreatedMovement,
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

      const result = await createInventoryMovement(payload);

      expect(result.movement_type).toBe('adjustment_out');
      expect(result.quantity_delta).toBe(-5);
    });

    it('should handle movement without note', async () => {
      const payload: MovementInsert = {
        product_id: 50,
        movement_type: 'purchase',
        quantity_delta: 25,
        unit_price: 75,
      };

      const mockCreatedMovement: InventoryMovement = {
        id: 9,
        ...payload,
        note: null,
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user-5',
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockCreatedMovement,
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

      const result = await createInventoryMovement(payload);

      expect(result.note).toBeNull();
    });

    it('should throw error when Supabase returns error', async () => {
      const payload: MovementInsert = {
        product_id: 10,
        movement_type: 'purchase',
        quantity_delta: 100,
        unit_price: 50,
      };

      const mockError = { message: 'Foreign key violation', code: '23503' };
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

      await expect(createInventoryMovement(payload)).rejects.toEqual(mockError);
    });
  });

  describe('deleteInventoryMovement', () => {
    it('should delete inventory movement by id', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await deleteInventoryMovement(5);

      expect(supabase.from).toHaveBeenCalledWith('inventory_movements');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 5);
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Record not found', code: 'PGRST116' };
      const mockEq = vi.fn().mockResolvedValue({
        error: mockError,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await expect(deleteInventoryMovement(999)).rejects.toEqual(mockError);
    });

    it('should handle deletion of first record', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await deleteInventoryMovement(1);

      expect(mockEq).toHaveBeenCalledWith('id', 1);
    });

    it('should handle deletion of large id numbers', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await deleteInventoryMovement(999999);

      expect(mockEq).toHaveBeenCalledWith('id', 999999);
    });

    it('should handle deletion without throwing when successful', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      // Should not throw
      await expect(deleteInventoryMovement(10)).resolves.toBeUndefined();
    });
  });
});
