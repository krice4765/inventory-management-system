import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPartners, getSuppliers, getCustomers, type Partner } from './partners';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('partners API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPartners', () => {
    it('should fetch all active partners without type filter', async () => {
      const mockPartners: Partner[] = [
        {
          id: 1,
          partner_code: 'P001',
          name: 'ABC Company',
          partner_type: 'supplier',
          postal_code: '100-0001',
          address: 'Tokyo',
          phone: '03-1234-5678',
          email: 'abc@example.com',
          contact_person: 'John Doe',
          payment_terms: 30,
          notes: 'Main supplier',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
        },
        {
          id: 2,
          partner_code: 'P002',
          name: 'DEF Corporation',
          partner_type: 'customer',
          postal_code: '200-0002',
          address: 'Osaka',
          phone: '06-1234-5678',
          email: 'def@example.com',
          contact_person: 'Jane Smith',
          payment_terms: 60,
          notes: null,
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-16T00:00:00Z',
        },
      ];

      const mockQuery = {
        data: mockPartners,
        error: null,
      };

      const mockOrder = vi.fn().mockResolvedValue(mockQuery);
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPartners();

      expect(supabase.from).toHaveBeenCalledWith('partners');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
      expect(mockOrder).toHaveBeenCalledWith('name');

      expect(result).toEqual(mockPartners);
    });

    it('should fetch suppliers when type is supplier', async () => {
      const mockPartners: Partner[] = [
        {
          id: 1,
          partner_code: 'P001',
          name: 'ABC Company',
          partner_type: 'supplier',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
        },
        {
          id: 3,
          partner_code: 'P003',
          name: 'GHI Ltd',
          partner_type: 'both',
          is_active: true,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-17T00:00:00Z',
        },
      ];

      const mockOr = vi.fn().mockResolvedValue({
        data: mockPartners,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPartners('supplier');

      expect(mockOr).toHaveBeenCalledWith('partner_type.eq.supplier,partner_type.eq.both');
      expect(result).toEqual(mockPartners);
    });

    it('should fetch customers when type is customer', async () => {
      const mockPartners: Partner[] = [
        {
          id: 2,
          partner_code: 'P002',
          name: 'DEF Corporation',
          partner_type: 'customer',
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-16T00:00:00Z',
        },
        {
          id: 3,
          partner_code: 'P003',
          name: 'GHI Ltd',
          partner_type: 'both',
          is_active: true,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-17T00:00:00Z',
        },
      ];

      const mockOr = vi.fn().mockResolvedValue({
        data: mockPartners,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPartners('customer');

      expect(mockOr).toHaveBeenCalledWith('partner_type.eq.customer,partner_type.eq.both');
      expect(result).toEqual(mockPartners);
    });

    it('should fetch both types when type is both', async () => {
      const mockPartners: Partner[] = [
        {
          id: 3,
          partner_code: 'P003',
          name: 'GHI Ltd',
          partner_type: 'both',
          is_active: true,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-17T00:00:00Z',
        },
      ];

      const mockOr = vi.fn().mockResolvedValue({
        data: mockPartners,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPartners('both');

      expect(mockOr).toHaveBeenCalledWith('partner_type.eq.both,partner_type.eq.both');
      expect(result).toEqual(mockPartners);
    });

    it('should return empty array when no partners exist', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPartners();

      expect(result).toEqual([]);
    });

    it('should only fetch active partners', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await getPartners();

      expect(mockEq).toHaveBeenCalledWith('is_active', true);
    });

    it('should order partners by name', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await getPartners();

      expect(mockOrder).toHaveBeenCalledWith('name');
    });

    it('should throw error when Supabase returns error', async () => {
      const mockError = { message: 'Database connection error', code: 'PGRST000' };
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getPartners()).rejects.toEqual(mockError);
    });

    it('should handle partners with minimal data', async () => {
      const mockPartners: Partner[] = [
        {
          id: 4,
          partner_code: 'P004',
          name: 'JKL Inc',
          partner_type: 'supplier',
          postal_code: null,
          address: null,
          phone: null,
          email: null,
          contact_person: null,
          payment_terms: undefined,
          notes: null,
          is_active: true,
          created_at: '2024-01-04T00:00:00Z',
          updated_at: '2024-01-18T00:00:00Z',
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({
        data: mockPartners,
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getPartners();

      expect(result[0].postal_code).toBeNull();
      expect(result[0].address).toBeNull();
      expect(result[0].phone).toBeNull();
    });
  });

  describe('getSuppliers', () => {
    it('should call getPartners with supplier type', async () => {
      const mockSuppliers: Partner[] = [
        {
          id: 1,
          partner_code: 'P001',
          name: 'ABC Company',
          partner_type: 'supplier',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
        },
      ];

      const mockOr = vi.fn().mockResolvedValue({
        data: mockSuppliers,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getSuppliers();

      expect(mockOr).toHaveBeenCalledWith('partner_type.eq.supplier,partner_type.eq.both');
      expect(result).toEqual(mockSuppliers);
    });

    it('should return empty array when no suppliers exist', async () => {
      const mockOr = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getSuppliers();

      expect(result).toEqual([]);
    });

    it('should throw error when getPartners throws', async () => {
      const mockError = { message: 'Network error', code: 'NETWORK' };
      const mockOr = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getSuppliers()).rejects.toEqual(mockError);
    });
  });

  describe('getCustomers', () => {
    it('should call getPartners with customer type', async () => {
      const mockCustomers: Partner[] = [
        {
          id: 2,
          partner_code: 'P002',
          name: 'DEF Corporation',
          partner_type: 'customer',
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-16T00:00:00Z',
        },
      ];

      const mockOr = vi.fn().mockResolvedValue({
        data: mockCustomers,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getCustomers();

      expect(mockOr).toHaveBeenCalledWith('partner_type.eq.customer,partner_type.eq.both');
      expect(result).toEqual(mockCustomers);
    });

    it('should return empty array when no customers exist', async () => {
      const mockOr = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getCustomers();

      expect(result).toEqual([]);
    });

    it('should throw error when getPartners throws', async () => {
      const mockError = { message: 'Permission denied', code: 'PGRST000' };
      const mockOr = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockOrder = vi.fn().mockReturnValue({ or: mockOr });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getCustomers()).rejects.toEqual(mockError);
    });
  });
});
