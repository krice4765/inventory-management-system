import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SalesOrderDetail from './SalesOrderDetail';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../lib/pdfGenerator', () => ({
  generateSalesOrderPDF: vi.fn(),
}));

// Mock data - matching SalesOrderDetail's nested structure from Supabase query
const mockOrder = {
  id: 'order-1',
  order_no: 'SO-001',
  order_date: '2025-01-01',
  delivery_date: '2025-01-31',
  delivery_address: 'Test Delivery Address',
  total_amount: 220000,
  tax_amount: 20000,
  notes: 'Test sales order notes',
  status: 'pending' as const,
  customer_id: 'customer-1',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  customer: {
    id: 'customer-1',
    name: 'Test Customer',
    partner_code: 'CUST001',
  },
  items: [
    {
      id: 'item-1',
      sales_order_id: 'order-1',
      product_id: 'product-1',
      quantity: 20,
      unit_price: 10000,
      tax_rate: 10,
      subtotal: 200000,
      tax_amount: 20000,
      total_amount: 220000,
      notes: null,
      product: {
        id: 'product-1',
        name: 'Test Sales Product',
        product_code: 'SPROD001',
      },
    },
  ],
};

const renderComponent = (orderId = 'order-1') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/sales-orders/${orderId}`]}>
        <Routes>
          <Route path="/sales-orders/:id" element={<SalesOrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('SalesOrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase query - SalesOrderDetail uses nested query with customer and items
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'sales_orders') {
        const single = vi.fn().mockResolvedValue({
          data: mockOrder,
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select } as any;
      }

      return {} as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('should display loading state initially', () => {
      renderComponent();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display order details after data loads', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('SO-001').length).toBeGreaterThan(0);
      });
    });

    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注一覧に戻る')).toBeInTheDocument();
      });
    });
  });

  describe('Order Information Display', () => {
    it('should display order number', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('SO-001').length).toBeGreaterThan(0);
      });
    });

    it('should display customer name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test Customer/)).toBeInTheDocument();
      });
    });

    it('should display order date', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/2025\/1\/1/).length).toBeGreaterThan(0);
      });
    });

    it('should display total amount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/220,000/).length).toBeGreaterThan(0);
      });
    });

    it('should display tax amount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/20,000/).length).toBeGreaterThan(0);
      });
    });

    it('should display order status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/受注確認待ち|pending/)).toBeInTheDocument();
      });
    });
  });

  describe('Items Display', () => {
    it('should display order items', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Sales Product')).toBeInTheDocument();
      });
    });

    it('should display item quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/20/).length).toBeGreaterThan(0);
      });
    });

    it('should display item unit price', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/10,000/)).toBeInTheDocument();
      });
    });

    it('should display tax rate', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/10%/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle order fetch error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });
    });

    it('should handle order not found', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/受注が見つかりません/)).toBeInTheDocument();
      });
    });

  });

  describe('Loading States', () => {
    it('should show loading during initial data fetch', () => {
      renderComponent();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should hide loading after data loads', async () => {
      renderComponent();

      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should handle order with no items', async () => {
      const orderWithNoItems = {
        ...mockOrder,
        items: [],
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const single = vi.fn().mockResolvedValue({
            data: orderWithNoItems,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('SO-001').length).toBeGreaterThan(0);
      });
    });

    it('should display delivery address when provided', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test Delivery Address/)).toBeInTheDocument();
      });
    });

    it('should display notes when provided', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test sales order notes/)).toBeInTheDocument();
      });
    });
  });

  describe('Status Display', () => {
    it('should display pending status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/受注確認待ち|pending/)).toBeInTheDocument();
      });
    });

    it('should display confirmed status', async () => {
      const confirmedOrder = { ...mockOrder, status: 'confirmed' as const };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const single = vi.fn().mockResolvedValue({
            data: confirmedOrder,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/受注確定|confirmed/)).toBeInTheDocument();
      });
    });
  });
});
