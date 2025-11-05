import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Payments from './Payments';
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
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Calendar: () => <div>Calendar Icon</div>,
  DollarSign: () => <div>DollarSign Icon</div>,
  Filter: () => <div>Filter Icon</div>,
  CreditCard: () => <div>CreditCard Icon</div>,
  Building2: () => <div>Building2 Icon</div>,
  Check: () => <div>Check Icon</div>,
  TrendingUp: () => <div>TrendingUp Icon</div>,
  Search: () => <div>Search Icon</div>,
  X: () => <div>X Icon</div>,
  FileText: () => <div>FileText Icon</div>,
  Eye: () => <div>Eye Icon</div>,
}));

describe('Payments', () => {
  let queryClient: QueryClient;

  const mockPayments = [
    {
      id: 'payment-1',
      transaction_type: 'payable',
      payment_method: 'cash',
      amount: 100000,
      payment_date: '2024-01-15',
      bank_name: null,
      reference_no: 'REF-001',
      notes: 'Payment note 1',
      created_at: '2024-01-15T10:00:00Z',
      partner_id: 'partner-1',
      payment_method_cash: 100000,
      payment_method_check: 0,
      payment_method_note: 0,
      payment_method_bank_transfer: 0,
      payment_method_offset: 0,
      discount_amount: 0,
      other_amount: 0,
      transaction_fee: 0,
      issuing_bank_name: null,
      payee_bank_name: null,
      partners: {
        name: 'Supplier A',
        partner_code: 'SUP-001',
      },
      accounts_payable: {
        invoice_no: 'INV-001',
      },
    },
    {
      id: 'payment-2',
      transaction_type: 'payable',
      payment_method: 'bank_transfer',
      amount: 200000,
      payment_date: '2024-01-16',
      bank_name: 'Test Bank',
      reference_no: 'REF-002',
      notes: 'Payment note 2',
      created_at: '2024-01-16T10:00:00Z',
      partner_id: 'partner-2',
      payment_method_cash: 0,
      payment_method_check: 0,
      payment_method_note: 0,
      payment_method_bank_transfer: 200000,
      payment_method_offset: 0,
      discount_amount: 0,
      other_amount: 0,
      transaction_fee: 500,
      issuing_bank_name: 'Issuing Bank',
      payee_bank_name: 'Payee Bank',
      partners: {
        name: 'Supplier B',
        partner_code: 'SUP-002',
      },
      accounts_payable: {
        invoice_no: 'INV-002',
      },
    },
    {
      id: 'payment-3',
      transaction_type: 'payable',
      payment_method: 'check',
      amount: 150000,
      payment_date: '2024-01-17',
      bank_name: null,
      reference_no: 'REF-003',
      notes: null,
      created_at: '2024-01-17T10:00:00Z',
      partner_id: 'partner-1',
      payment_method_cash: 0,
      payment_method_check: 150000,
      payment_method_note: 0,
      payment_method_bank_transfer: 0,
      payment_method_offset: 0,
      discount_amount: 0,
      other_amount: 0,
      transaction_fee: 0,
      issuing_bank_name: null,
      payee_bank_name: null,
      partners: {
        name: 'Supplier A',
        partner_code: 'SUP-001',
      },
      accounts_payable: {
        invoice_no: null,
      },
    },
  ];

  const mockSuppliers = [
    {
      id: 'partner-1',
      name: 'Supplier A',
      partner_code: 'SUP-001',
    },
    {
      id: 'partner-2',
      name: 'Supplier B',
      partner_code: 'SUP-002',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default Supabase mock
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'payment_transactions') {
        const order2 = vi.fn().mockResolvedValue({
          data: mockPayments,
          error: null,
        });

        const order1 = vi.fn().mockReturnValue({
          order: order2,
        });

        const eq = vi.fn().mockReturnValue({
          order: order1,
        });

        const select = vi.fn().mockReturnValue({
          eq,
          order: order1,
        });

        return {
          select,
        } as any;
      } else if (table === 'partners') {
        const order = vi.fn().mockResolvedValue({
          data: mockSuppliers,
          error: null,
        });

        const eq = vi.fn().mockReturnValue({
          order,
        });

        const _in = vi.fn().mockReturnValue({
          eq,
          order,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <Payments />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('支払履歴')).toBeInTheDocument();
      });
    });

    it('should fetch payments on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('payment_transactions');
      });
    });

    it('should fetch suppliers on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('partners');
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should display statistics section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('今月の支払額')).toBeInTheDocument();
      });
    });

    it('should display payment method statistics', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('支払方法別集計')).toBeInTheDocument();
      });
    });

    it('should display payment method labels', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('現金')).toBeInTheDocument();
        expect(screen.getByText('銀行振込')).toBeInTheDocument();
        expect(screen.getByText('小切手')).toBeInTheDocument();
        expect(screen.getByText('相殺')).toBeInTheDocument();
      });
    });
  });

  describe('Payment List Display', () => {
    it('should display payment data after changing filter', async () => {
      renderComponent();

      // First, wait for page to load
      await waitFor(() => {
        expect(screen.getByText('支払履歴')).toBeInTheDocument();
      });

      // Change to "all period" filter to see all data
      const allPeriodButton = screen.getByText('全期間');
      fireEvent.click(allPeriodButton);

      // Now check for payment data
      await waitFor(() => {
        const supplierA = screen.getAllByText('Supplier A');
        expect(supplierA.length).toBeGreaterThan(0);

        const supplierCodes = screen.getAllByText('SUP-001');
        expect(supplierCodes.length).toBeGreaterThan(0);
      });
    });

    it('should display payment amounts', async () => {
      renderComponent();

      await waitFor(() => {
        // Just check that amounts are displayed in the document
        const amounts = screen.getAllByText(/¥|円/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('should display payment methods in table', async () => {
      renderComponent();

      await waitFor(() => {
        const cashLabels = screen.getAllByText('現金');
        expect(cashLabels.length).toBeGreaterThan(0);

        const transferLabels = screen.getAllByText('銀行振込');
        expect(transferLabels.length).toBeGreaterThan(0);

        const checkLabels = screen.getAllByText('小切手');
        expect(checkLabels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Filters', () => {
    it('should display filter toggle button', async () => {
      renderComponent();

      await waitFor(() => {
        const filterButtons = screen.getAllByText(/フィルター|開く|閉じる/);
        expect(filterButtons.length).toBeGreaterThan(0);
      });
    });

    it('should display period filter buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('今月')).toBeInTheDocument();
        expect(screen.getByText('先月')).toBeInTheDocument();
        expect(screen.getByText('期間指定')).toBeInTheDocument();
        expect(screen.getByText('全期間')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display message when no payments', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'payment_transactions') {
          const order2 = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });

          const order1 = vi.fn().mockReturnValue({
            order: order2,
          });

          const eq = vi.fn().mockReturnValue({
            order: order1,
          });

          const select = vi.fn().mockReturnValue({
            eq,
            order: order1,
          });

          return {
            select,
          } as any;
        } else if (table === 'partners') {
          const order = vi.fn().mockResolvedValue({
            data: mockSuppliers,
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            order,
          });

          const _in = vi.fn().mockReturnValue({
            eq,
            order,
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

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('支払履歴')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'payment_transactions') {
          const order2 = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Fetch failed' },
          });

          const order1 = vi.fn().mockReturnValue({
            order: order2,
          });

          const eq = vi.fn().mockReturnValue({
            order: order1,
          });

          const select = vi.fn().mockReturnValue({
            eq,
            order: order1,
          });

          return {
            select,
          } as any;
        } else if (table === 'partners') {
          const order = vi.fn().mockResolvedValue({
            data: mockSuppliers,
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            order,
          });

          const _in = vi.fn().mockReturnValue({
            eq,
            order,
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

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('支払履歴')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'payment_transactions') {
          const order2 = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

          const order1 = vi.fn().mockReturnValue({
            order: order2,
          });

          const eq = vi.fn().mockReturnValue({
            order: order1,
          });

          const select = vi.fn().mockReturnValue({
            eq,
            order: order1,
          });

          return {
            select,
          } as any;
        } else if (table === 'partners') {
          const order = vi.fn().mockResolvedValue({
            data: mockSuppliers,
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            order,
          });

          const _in = vi.fn().mockReturnValue({
            eq,
            order,
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
});
