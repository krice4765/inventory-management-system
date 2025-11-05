import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PurchaseOrderDetail from './PurchaseOrderDetail';
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

vi.mock('../stores/deliveryModal.store', () => ({
  useDeliveryModal: vi.fn(() => ({
    isOpen: false,
    orderItemId: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  })),
}));

vi.mock('../components/DeliveryModal', () => ({
  DeliveryModal: () => <div>Delivery Modal</div>,
}));

vi.mock('../lib/pdfGenerator', () => ({
  generatePurchaseOrderPDF: vi.fn(),
}));

// Mock data
const mockOrder = {
  id: 'order-1',
  order_no: 'PO-001',
  order_date: '2025-01-01',
  delivery_deadline: '2025-01-31',
  delivery_address: 'Test Address',
  total_amount: 110000,
  notes: 'Test notes',
  shipping_cost: 1000,
  shipping_tax_rate: 0.1,
  partner_id: 'partner-1',
  created_by_user_id: 'user-1',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockPartner = {
  id: 'partner-1',
  name: 'Test Supplier',
  partner_code: 'SUP001',
};

const mockUser = {
  id: 'user-1',
  full_name: 'Test User',
  email: 'test@example.com',
};

const mockItems = [
  {
    id: 'item-1',
    purchase_order_id: 'order-1',
    product_id: 'product-1',
    quantity: 10,
    unit_price: 10000,
    total_amount: 100000,
    notes: null,
    product: {
      id: 'product-1',
      product_name: 'Test Product',
      product_code: 'PROD001',
      unit: '個',
    },
  },
];

const mockProduct = {
  id: 'product-1',
  product_name: 'Test Product',
  product_code: 'PROD001',
  unit: '個',
};

const mockDeliveries = [
  {
    id: 'delivery-1',
    delivered_quantity: 5,
    delivery_date: '2025-01-15',
    receiver_name: 'Test Receiver',
    notes: 'Partial delivery',
  },
];

const renderComponent = (orderId = 'order-1') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
        <Routes>
          <Route path="/orders/:id" element={<PurchaseOrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PurchaseOrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase queries
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'purchase_orders') {
        const single = vi.fn().mockResolvedValue({
          data: mockOrder,
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select } as any;
      }

      if (table === 'partners') {
        const single = vi.fn().mockResolvedValue({
          data: mockPartner,
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select } as any;
      }

      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockUser,
                error: null,
              }),
            }),
          }),
        } as any;
      }

      if (table === 'purchase_order_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockItems,
              error: null,
            }),
          }),
        } as any;
      }

      if (table === 'products') {
        const single = vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select } as any;
      }

      if (table === 'purchase_order_deliveries') {
        const order = vi.fn().mockResolvedValue({
          data: mockDeliveries,
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ order });
        const select = vi.fn().mockReturnValue({ eq });
        return { select } as any;
      }

      if (table === 'delivery_progress') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  progress_status: 'partial',
                  delivered_quantity: 5,
                  ordered_quantity: 10,
                },
                error: null,
              }),
            }),
          }),
        } as any;
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
        expect(screen.getAllByText('PO-001').length).toBeGreaterThan(0);
      });
    });

    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /戻る/ })).toBeInTheDocument();
      });
    });
  });

  describe('Order Information Display', () => {
    it('should display order number', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('PO-001').length).toBeGreaterThan(0);
      });
    });

    it('should display supplier name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test Supplier/)).toBeInTheDocument();
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
        expect(screen.getByText(/110,000/)).toBeInTheDocument();
      });
    });
  });

  describe('Items Display', () => {
    it('should display order items', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });
    });

    it('should display item quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/10/).length).toBeGreaterThan(0);
      });
    });

    it('should display item unit price', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/10,000/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle order fetch error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_orders') {
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
        if (table === 'purchase_orders') {
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
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });
    });

    it('should handle partner fetch error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_orders') {
          const single = vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'partners') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Partner not found' },
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

    it('should handle items fetch error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_orders') {
          const single = vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'partners') {
          const single = vi.fn().mockResolvedValue({
            data: mockPartner,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'user_profiles') {
          const single = vi.fn().mockResolvedValue({
            data: mockUser,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'purchase_order_items') {
          const order = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Items fetch error' },
          });
          const eq = vi.fn().mockReturnValue({ order });
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
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_orders') {
          const single = vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'partners') {
          const single = vi.fn().mockResolvedValue({
            data: mockPartner,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockUser,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'purchase_order_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'delivery_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('PO-001').length).toBeGreaterThan(0);
      });
    });

    it('should handle order with no deliveries', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_orders') {
          const single = vi.fn().mockResolvedValue({
            data: mockOrder,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'partners') {
          const single = vi.fn().mockResolvedValue({
            data: mockPartner,
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ single });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockUser,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'purchase_order_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockItems,
                error: null,
              }),
            }),
          } as any;
        }

        if (table === 'delivery_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          } as any;
        }

        if (table === 'purchase_order_deliveries') {
          const order = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });
          const eq = vi.fn().mockReturnValue({ order });
          const select = vi.fn().mockReturnValue({ eq });
          return { select } as any;
        }

        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('PO-001').length).toBeGreaterThan(0);
      });
    });
  });
});
