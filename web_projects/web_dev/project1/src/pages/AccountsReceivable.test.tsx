import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccountsReceivable from './AccountsReceivable';
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

// Mock PageManual component
vi.mock('../components/PageManual', () => ({
  default: () => <div>Page Manual</div>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Calendar: () => <div>Calendar Icon</div>,
  AlertCircle: () => <div>AlertCircle Icon</div>,
  TrendingUp: () => <div>TrendingUp Icon</div>,
  DollarSign: () => <div>DollarSign Icon</div>,
  Filter: () => <div>Filter Icon</div>,
  CreditCard: () => <div>CreditCard Icon</div>,
  Info: () => <div>Info Icon</div>,
  ArrowUpDown: () => <div>ArrowUpDown Icon</div>,
  ArrowUp: () => <div>ArrowUp Icon</div>,
  ArrowDown: () => <div>ArrowDown Icon</div>,
  CheckSquare: () => <div>CheckSquare Icon</div>,
  Square: () => <div>Square Icon</div>,
  Plus: () => <div>Plus Icon</div>,
}));

describe('AccountsReceivable', () => {
  let queryClient: QueryClient;

  const mockPartners = [
    {
      id: 'partner-1',
      name: 'Customer A',
      partner_code: 'CA001',
      closing_day: 31,
      payment_day: 15,
      payment_month_offset: 1,
    },
    {
      id: 'partner-2',
      name: 'Customer B',
      partner_code: 'CB002',
      closing_day: 20,
      payment_day: 10,
      payment_month_offset: 1,
    },
  ];

  const mockReceivables = [
    {
      id: 'receivable-1',
      invoice_no: 'INV-001',
      customer_id: 'partner-1',
      sales_transaction_id: 'trans-1',
      amount: 100000,
      tax_amount: 10000,
      total_amount: 110000,
      received_amount: 0,
      balance: 110000,
      due_date: '2024-12-31',
      invoice_date: '2024-11-30',
      status: 'unpaid',
      created_at: '2024-11-30T10:00:00Z',
      partners: mockPartners[0],
    },
    {
      id: 'receivable-2',
      invoice_no: 'INV-002',
      customer_id: 'partner-2',
      sales_transaction_id: 'trans-2',
      amount: 200000,
      tax_amount: 20000,
      total_amount: 220000,
      received_amount: 100000,
      balance: 120000,
      due_date: '2024-11-15',
      invoice_date: '2024-10-31',
      status: 'partial',
      created_at: '2024-10-31T10:00:00Z',
      partners: mockPartners[1],
    },
    {
      id: 'receivable-3',
      invoice_no: 'INV-003',
      customer_id: 'partner-1',
      sales_transaction_id: 'trans-3',
      amount: 150000,
      tax_amount: 15000,
      total_amount: 165000,
      received_amount: 165000,
      balance: 0,
      due_date: '2024-11-30',
      invoice_date: '2024-10-31',
      status: 'paid',
      created_at: '2024-10-31T10:00:00Z',
      partners: mockPartners[0],
    },
  ];

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
      if (table === 'accounts_receivable') {
        const order = vi.fn().mockResolvedValue({
          data: mockReceivables,
          error: null,
        });

        const select = vi.fn().mockReturnValue({
          order,
        });

        return {
          select,
        } as any;
      } else if (table === 'partners') {
        const order = vi.fn().mockResolvedValue({
          data: mockPartners,
          error: null,
        });

        const eq = vi.fn().mockReturnValue({
          order,
        });

        const _in = vi.fn().mockReturnValue({
          eq,
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
          <AccountsReceivable />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('売掛金管理')).toBeInTheDocument();
      });
    });

    it('should fetch receivables on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('accounts_receivable');
      });
    });

    it('should fetch partners on mount', async () => {
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
        expect(screen.getByText('未入金総額')).toBeInTheDocument();
      });
    });

    it('should display overdue count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('期限超過件数')).toBeInTheDocument();
      });
    });

    it('should display monthly receipt amount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('今月入金予定')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('should display filter buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /すべて/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /未入金/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /期限超過/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /入金済/ })).toBeInTheDocument();
      });
    });
  });

  describe('Receivables List', () => {
    it('should display receivable data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('INV-001')).toBeInTheDocument();
        expect(screen.getByText('INV-002')).toBeInTheDocument();
      });
    });

    it('should display customer names', async () => {
      renderComponent();

      await waitFor(() => {
        const customerAElements = screen.getAllByText('Customer A');
        expect(customerAElements.length).toBeGreaterThan(0);

        const customerBElements = screen.getAllByText('Customer B');
        expect(customerBElements.length).toBeGreaterThan(0);
      });
    });

    it('should display amounts', async () => {
      renderComponent();

      await waitFor(() => {
        const amounts = screen.getAllByText(/¥|円/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no receivables', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_receivable') {
          const order = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });

          const select = vi.fn().mockReturnValue({
            order,
          });

          return {
            select,
          } as any;
        } else if (table === 'partners') {
          const order = vi.fn().mockResolvedValue({
            data: mockPartners,
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            order,
          });

          const _in = vi.fn().mockReturnValue({
            eq,
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
        expect(screen.getByText('売掛金がありません')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_receivable') {
          const order = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Fetch failed' },
          });

          const select = vi.fn().mockReturnValue({
            order,
          });

          return {
            select,
          } as any;
        } else if (table === 'partners') {
          const order = vi.fn().mockResolvedValue({
            data: mockPartners,
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            order,
          });

          const _in = vi.fn().mockReturnValue({
            eq,
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
        expect(screen.getByText('売掛金管理')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'accounts_receivable') {
          const order = vi.fn().mockImplementation(() => new Promise(() => {}));

          const select = vi.fn().mockReturnValue({
            order,
          });

          return {
            select,
          } as any;
        } else if (table === 'partners') {
          const order = vi.fn().mockResolvedValue({
            data: mockPartners,
            error: null,
          });

          const eq = vi.fn().mockReturnValue({
            order,
          });

          const _in = vi.fn().mockReturnValue({
            eq,
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
