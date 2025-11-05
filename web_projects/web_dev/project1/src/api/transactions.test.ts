import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateTransactionNo,
  getPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrderById,
  updateTransactionStatus,
  deleteTransaction,
  type Transaction,
  type TransactionInsert,
} from './transactions';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('transactions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTransactionNo', () => {
    it('should generate transaction number for purchase type', async () => {
      const mockTransactionNo = 'PO-20240115-001';

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockTransactionNo,
        error: null,
      } as any);

      const result = await generateTransactionNo('purchase');

      expect(supabase.rpc).toHaveBeenCalledWith('generate_transaction_no', {
        trans_type: 'purchase',
      });
      expect(result).toBe(mockTransactionNo);
    });

    it('should generate transaction number for sale type', async () => {
      const mockTransactionNo = 'SO-20240115-001';

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockTransactionNo,
        error: null,
      } as any);

      const result = await generateTransactionNo('sale');

      expect(supabase.rpc).toHaveBeenCalledWith('generate_transaction_no', {
        trans_type: 'sale',
      });
      expect(result).toBe(mockTransactionNo);
    });

    it('should generate transaction number for adjustment type', async () => {
      const mockTransactionNo = 'ADJ-20240115-001';

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockTransactionNo,
        error: null,
      } as any);

      const result = await generateTransactionNo('adjustment');

      expect(result).toBe(mockTransactionNo);
    });

    it('should throw error when RPC fails', async () => {
      const mockError = { message: 'RPC function not found', code: 'PGRST202' };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: mockError,
      } as any);

      await expect(generateTransactionNo('purchase')).rejects.toEqual(mockError);
    });
  });

  describe('getPurchaseOrders', () => {
    it('should fetch purchase orders with default limit', async () => {
      const mockOrders: Transaction[] = [
        {
          id: 1,
          transaction_no: 'PO-20240115-001',
          transaction_type: 'purchase',
          partner_id: 10,
          transaction_date: '2024-01-15',
          due_date: '2024-02-15',
          status: 'draft',
          subtotal: 10000,
          tax_amount: 1000,
          total_amount: 11000,
          notes: null,
          created_by: 'user-1',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
          partners: {
            id: 10,
            name: 'Supplier A',
            partner_code: 'SUP001',
          },
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockOrders,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPurchaseOrders();

      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('partners:partner_id'));
      expect(mockEq).toHaveBeenCalledWith('transaction_type', 'purchase');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(50);

      expect(result).toEqual(mockOrders);
    });

    it('should fetch purchase orders with custom limit', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await getPurchaseOrders(100);

      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Database error', code: 'PGRST000' };

      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getPurchaseOrders()).rejects.toEqual(mockError);
    });
  });

  describe('createPurchaseOrder', () => {
    it('should create purchase order with items', async () => {
      const payload: TransactionInsert = {
        transaction_type: 'purchase',
        partner_id: 10,
        transaction_date: '2024-01-15',
        due_date: '2024-02-15',
        notes: 'Test order',
        items: [
          {
            product_id: 1,
            quantity: 10,
            unit_price: 1000,
            notes: 'Item 1',
          },
          {
            product_id: 2,
            quantity: 5,
            unit_price: 500,
            notes: null,
          },
        ],
      };

      const mockGeneratedNo = 'PO-20240115-001';
      const mockCreatedTransaction = {
        id: 1,
        transaction_no: mockGeneratedNo,
        transaction_type: 'purchase',
        partner_id: 10,
        transaction_date: '2024-01-15',
        due_date: '2024-02-15',
        status: 'draft',
        notes: 'Test order',
        subtotal: 0,
        tax_amount: 0,
        total_amount: 0,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      const mockFullTransaction: Transaction = {
        ...mockCreatedTransaction,
        partners: {
          id: 10,
          name: 'Supplier A',
          partner_code: 'SUP001',
        },
        transaction_items: [
          {
            id: 1,
            transaction_id: 1,
            product_id: 1,
            quantity: 10,
            unit_price: 1000,
            line_total: 10000,
            notes: 'Item 1',
          },
        ],
      };

      // Mock generateTransactionNo
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockGeneratedNo,
        error: null,
      } as any);

      // Mock transaction insert
      const mockSingleTx = vi.fn().mockResolvedValue({
        data: mockCreatedTransaction,
        error: null,
      });

      const mockSelectTx = vi.fn().mockReturnValue({
        single: mockSingleTx,
      });

      const mockInsertTx = vi.fn().mockReturnValue({
        select: mockSelectTx,
      });

      // Mock items insert
      const mockInsertItems = vi.fn().mockResolvedValue({
        error: null,
      });

      // Mock getPurchaseOrderById (final return)
      const mockSingleFinal = vi.fn().mockResolvedValue({
        data: mockFullTransaction,
        error: null,
      });

      const mockEqFinal = vi.fn().mockReturnValue({
        single: mockSingleFinal,
      });

      const mockSelectFinal = vi.fn().mockReturnValue({
        eq: mockEqFinal,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(((table: string) => {
        callCount++;
        if (callCount === 1) {
          // First call: transaction insert
          return { insert: mockInsertTx } as any;
        } else if (callCount === 2) {
          // Second call: items insert
          return { insert: mockInsertItems } as any;
        } else {
          // Third call: getPurchaseOrderById
          return { select: mockSelectFinal } as any;
        }
      }) as any);

      const result = await createPurchaseOrder(payload);

      expect(supabase.rpc).toHaveBeenCalledWith('generate_transaction_no', {
        trans_type: 'purchase',
      });
      expect(mockInsertTx).toHaveBeenCalledWith({
        transaction_no: mockGeneratedNo,
        transaction_type: 'purchase',
        partner_id: 10,
        transaction_date: '2024-01-15',
        due_date: '2024-02-15',
        notes: 'Test order',
        status: 'draft',
      });
      expect(mockInsertItems).toHaveBeenCalled();
      expect(result).toEqual(mockFullTransaction);
    });

    it('should use current date when transaction_date not provided', async () => {
      const payload: TransactionInsert = {
        transaction_type: 'purchase',
        partner_id: 10,
        items: [],
      };

      const mockGeneratedNo = 'PO-20240115-001';
      const mockCreatedTransaction = {
        id: 1,
        transaction_no: mockGeneratedNo,
        transaction_type: 'purchase',
        status: 'draft',
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockGeneratedNo,
        error: null,
      } as any);

      const mockSingleTx = vi.fn().mockResolvedValue({
        data: mockCreatedTransaction,
        error: null,
      });

      const mockSelectTx = vi.fn().mockReturnValue({
        single: mockSingleTx,
      });

      const mockInsertTx = vi.fn().mockReturnValue({
        select: mockSelectTx,
      });

      const mockSingleFinal = vi.fn().mockResolvedValue({
        data: mockCreatedTransaction,
        error: null,
      });

      const mockEqFinal = vi.fn().mockReturnValue({
        single: mockSingleFinal,
      });

      const mockSelectFinal = vi.fn().mockReturnValue({
        eq: mockEqFinal,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          return { insert: mockInsertTx } as any;
        } else {
          return { select: mockSelectFinal } as any;
        }
      }) as any);

      await createPurchaseOrder(payload);

      const insertCall = mockInsertTx.mock.calls[0][0];
      expect(insertCall.transaction_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should throw error when transaction insert fails', async () => {
      const payload: TransactionInsert = {
        transaction_type: 'purchase',
        items: [],
      };

      const mockError = { message: 'Insert failed', code: 'PGRST000' };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'PO-001',
        error: null,
      } as any);

      const mockSingleTx = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelectTx = vi.fn().mockReturnValue({
        single: mockSingleTx,
      });

      const mockInsertTx = vi.fn().mockReturnValue({
        select: mockSelectTx,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsertTx,
      } as any);

      await expect(createPurchaseOrder(payload)).rejects.toEqual(mockError);
    });

    it('should throw error when items insert fails', async () => {
      const payload: TransactionInsert = {
        transaction_type: 'purchase',
        items: [
          {
            product_id: 1,
            quantity: 10,
            unit_price: 1000,
          },
        ],
      };

      const mockGeneratedNo = 'PO-001';
      const mockCreatedTransaction = { id: 1 };
      const mockItemsError = { message: 'Items insert failed', code: 'PGRST000' };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockGeneratedNo,
        error: null,
      } as any);

      const mockSingleTx = vi.fn().mockResolvedValue({
        data: mockCreatedTransaction,
        error: null,
      });

      const mockSelectTx = vi.fn().mockReturnValue({
        single: mockSingleTx,
      });

      const mockInsertTx = vi.fn().mockReturnValue({
        select: mockSelectTx,
      });

      const mockInsertItems = vi.fn().mockResolvedValue({
        error: mockItemsError,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          return { insert: mockInsertTx } as any;
        } else {
          return { insert: mockInsertItems } as any;
        }
      }) as any);

      await expect(createPurchaseOrder(payload)).rejects.toEqual(mockItemsError);
    });
  });

  describe('getPurchaseOrderById', () => {
    it('should fetch purchase order by id', async () => {
      const mockOrder: Transaction = {
        id: 1,
        transaction_no: 'PO-20240115-001',
        transaction_type: 'purchase',
        partner_id: 10,
        transaction_date: '2024-01-15',
        due_date: '2024-02-15',
        status: 'draft',
        subtotal: 10000,
        tax_amount: 1000,
        total_amount: 11000,
        notes: null,
        created_by: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        partners: {
          id: 10,
          name: 'Supplier A',
          partner_code: 'SUP001',
        },
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockOrder,
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPurchaseOrderById(1);

      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual(mockOrder);
    });

    it('should throw error when order not found', async () => {
      const mockError = { message: 'Record not found', code: 'PGRST116' };

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getPurchaseOrderById(999)).rejects.toEqual(mockError);
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status', async () => {
      const mockUpdated = {
        id: 1,
        status: 'confirmed',
      };

      const mockFinalTransaction: Transaction = {
        id: 1,
        transaction_no: 'PO-001',
        transaction_type: 'purchase',
        transaction_date: '2024-01-15',
        status: 'confirmed',
        subtotal: 10000,
        tax_amount: 1000,
        total_amount: 11000,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
      };

      // Mock update
      const mockSingleUpdate = vi.fn().mockResolvedValue({
        data: mockUpdated,
        error: null,
      });

      const mockSelectUpdate = vi.fn().mockReturnValue({
        single: mockSingleUpdate,
      });

      const mockEqUpdate = vi.fn().mockReturnValue({
        select: mockSelectUpdate,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockEqUpdate,
      });

      // Mock getPurchaseOrderById
      const mockSingleFinal = vi.fn().mockResolvedValue({
        data: mockFinalTransaction,
        error: null,
      });

      const mockEqFinal = vi.fn().mockReturnValue({
        single: mockSingleFinal,
      });

      const mockSelectFinal = vi.fn().mockReturnValue({
        eq: mockEqFinal,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          return { update: mockUpdate } as any;
        } else {
          return { select: mockSelectFinal } as any;
        }
      }) as any);

      const result = await updateTransactionStatus(1, 'confirmed');

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'confirmed' });
      expect(mockEqUpdate).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual(mockFinalTransaction);
    });

    it('should throw error when update fails', async () => {
      const mockError = { message: 'Update failed', code: 'PGRST000' };

      const mockSingleUpdate = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelectUpdate = vi.fn().mockReturnValue({
        single: mockSingleUpdate,
      });

      const mockEqUpdate = vi.fn().mockReturnValue({
        select: mockSelectUpdate,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockEqUpdate,
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(updateTransactionStatus(1, 'confirmed')).rejects.toEqual(mockError);
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction by id', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await deleteTransaction(5);

      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 5);
    });

    it('should throw error when delete fails', async () => {
      const mockError = { message: 'Delete failed', code: 'PGRST000' };

      const mockEq = vi.fn().mockResolvedValue({
        error: mockError,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any);

      await expect(deleteTransaction(999)).rejects.toEqual(mockError);
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

      await expect(deleteTransaction(10)).resolves.toBeUndefined();
    });
  });
});
