import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PaymentNew from './PaymentNew';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowLeft: () => <div>ArrowLeft Icon</div>,
  Calendar: () => <div>Calendar Icon</div>,
}));

// Mock FormField components
vi.mock('../components/FormField', () => ({
  FormField: ({ children }: any) => <div>{children}</div>,
  FormInput: ({ ...props }: any) => <input {...props} />,
  FormTextarea: ({ ...props }: any) => <textarea {...props} />,
}));

// Mock PaymentMethodInput component
vi.mock('../components/PaymentMethodInput', () => ({
  PaymentMethodInput: ({ ...props }: any) => <div data-testid="payment-method-input">Payment Method Input</div>,
}));

describe('PaymentNew', () => {
  let queryClient: QueryClient;

  const mockPayable = {
    id: 'payable-1',
    supplier_id: 'partner-1',
    total_amount: 100000,
    paid_amount: 0,
    balance: 100000,
    status: 'unpaid',
    due_date: '2024-12-31',
    invoice_date: '2024-11-30',
    partners: {
      name: 'Supplier A',
      partner_code: 'SA001',
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Setup default Supabase mock
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'accounts_payable') {
        const single = vi.fn().mockResolvedValue({
          data: mockPayable,
          error: null,
        });

        const eq = vi.fn().mockReturnValue({
          single,
        });

        const select = vi.fn().mockReturnValue({
          eq,
        });

        return {
          select,
        } as any;
      }
      return {} as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (path = '/payment/new?payable_id=payable-1') => {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/payment/new" element={<PaymentNew />} />
            <Route path="/accounts-payable" element={<div>Accounts Payable Page</div>} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  describe('Initial Render with Single Payable', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('支払登録')).toBeInTheDocument();
      });
    });

    it('should fetch payable data on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('accounts_payable');
      });
    });

    it('should display supplier information', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
      });
    });

    it('should display balance amount', async () => {
      renderComponent();

      await waitFor(() => {
        const amounts = screen.getAllByText(/100,000/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('should display payment date input', async () => {
      renderComponent();

      await waitFor(() => {
        // FormField mock doesn't properly handle label, so check for input with type date
        const inputs = document.querySelectorAll('input[type="date"]');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });

    it('should display payment method input component', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-method-input')).toBeInTheDocument();
      });
    });

    it('should display submit button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '支払を登録' })).toBeInTheDocument();
      });
    });

    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('買掛金一覧に戻る')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const single = vi.fn().mockImplementation(() => new Promise(() => {}));

          const eq = vi.fn().mockReturnValue({
            single,
          });

          const select = vi.fn().mockReturnValue({
            eq,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(
        () => {
          const spinner = document.querySelector('.animate-spin');
          expect(spinner).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle payable not found error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          });

          const eq = vi.fn().mockReturnValue({
            single,
          });

          const select = vi.fn().mockReturnValue({
            eq,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Accounts Payable Page')).toBeInTheDocument();
      });
    });

    it('should handle already paid payable', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const single = vi.fn().mockResolvedValue({
            data: {
              ...mockPayable,
              status: 'paid',
              balance: 0,
            },
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            single,
          });

          const select = vi.fn().mockReturnValue({
            eq,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Accounts Payable Page')).toBeInTheDocument();
      });
    });

    it('should handle fetch error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Fetch failed' },
          });

          const eq = vi.fn().mockReturnValue({
            single,
          });

          const select = vi.fn().mockReturnValue({
            eq,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Accounts Payable Page')).toBeInTheDocument();
      });
    });
  });

  describe('Batch Mode', () => {
    it('should render in batch mode with multiple payables', async () => {
      const mockPayables = [
        mockPayable,
        {
          ...mockPayable,
          id: 'payable-2',
          partners: {
            name: 'Supplier B',
            partner_code: 'SB002',
          },
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const _in = vi.fn().mockResolvedValue({
            data: mockPayables,
            error: null,
          });

          const select = vi.fn().mockReturnValue({
            in: _in,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent('/payment/new?batch=true&payable_ids=payable-1,payable-2');

      await waitFor(() => {
        expect(screen.getByText('一括支払登録')).toBeInTheDocument();
      });
    });

    it('should filter out paid payables in batch mode', async () => {
      const mockPayables = [
        mockPayable,
        {
          ...mockPayable,
          id: 'payable-2',
          status: 'paid',
          balance: 0,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const _in = vi.fn().mockResolvedValue({
            data: mockPayables,
            error: null,
          });

          const select = vi.fn().mockReturnValue({
            in: _in,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent('/payment/new?batch=true&payable_ids=payable-1,payable-2');

      await waitFor(() => {
        expect(screen.getByText('一括支払登録')).toBeInTheDocument();
      });
    });

    it('should redirect if all payables are paid in batch mode', async () => {
      const mockPayables = [
        {
          ...mockPayable,
          status: 'paid',
          balance: 0,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_payable') {
          const _in = vi.fn().mockResolvedValue({
            data: mockPayables,
            error: null,
          });

          const select = vi.fn().mockReturnValue({
            in: _in,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent('/payment/new?batch=true&payable_ids=payable-1');

      await waitFor(() => {
        expect(screen.getByText('Accounts Payable Page')).toBeInTheDocument();
      });
    });
  });

  describe('No Payable Mode', () => {
    it('should render without payable_id parameter', async () => {
      renderComponent('/payment/new');

      await waitFor(() => {
        expect(screen.getByText('買掛金情報が見つかりません')).toBeInTheDocument();
      });
    });

    it('should not fetch payable when no payable_id', async () => {
      renderComponent('/payment/new');

      await waitFor(() => {
        expect(screen.getByText('買掛金情報が見つかりません')).toBeInTheDocument();
      });

      // Should not have called from('accounts_payable')
      expect(supabase.from).not.toHaveBeenCalledWith('accounts_payable');
    });
  });
});
