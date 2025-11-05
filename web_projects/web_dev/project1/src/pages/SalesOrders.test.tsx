import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SalesOrders from './SalesOrders';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock react-router-dom Link
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: () => <div>Plus Icon</div>,
  Search: () => <div>Search Icon</div>,
  Filter: () => <div>Filter Icon</div>,
  Eye: () => <div>Eye Icon</div>,
  Package: () => <div>Package Icon</div>,
  CheckCircle: () => <div>CheckCircle Icon</div>,
  XCircle: () => <div>XCircle Icon</div>,
  Clock: () => <div>Clock Icon</div>,
  Truck: () => <div>Truck Icon</div>,
}));

describe('SalesOrders', () => {
  let queryClient: QueryClient;

  const mockSalesOrders = [
    {
      id: 'so-1',
      order_no: 'SO-001',
      order_date: '2024-01-15',
      delivery_date: '2024-01-25',
      delivery_address: 'Tokyo, Japan',
      total_amount: 100000,
      tax_amount: 10000,
      status: 'pending' as const,
      notes: 'Test order 1',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      customer: {
        id: 'customer-1',
        name: 'Customer A',
        partner_code: 'CA001',
      },
    },
    {
      id: 'so-2',
      order_no: 'SO-002',
      order_date: '2024-01-16',
      delivery_date: '2024-01-26',
      delivery_address: 'Osaka, Japan',
      total_amount: 200000,
      tax_amount: 20000,
      status: 'confirmed' as const,
      notes: 'Test order 2',
      created_at: '2024-01-16T10:00:00Z',
      updated_at: '2024-01-16T10:00:00Z',
      customer: {
        id: 'customer-2',
        name: 'Customer B',
        partner_code: 'CB002',
      },
    },
    {
      id: 'so-3',
      order_no: 'SO-003',
      order_date: '2024-01-17',
      delivery_date: '2024-01-27',
      delivery_address: 'Kyoto, Japan',
      total_amount: 150000,
      tax_amount: 15000,
      status: 'shipped' as const,
      notes: 'Test order 3',
      created_at: '2024-01-17T10:00:00Z',
      updated_at: '2024-01-17T10:00:00Z',
      customer: {
        id: 'customer-1',
        name: 'Customer A',
        partner_code: 'CA001',
      },
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
      if (table === 'sales_orders') {
        const order1 = vi.fn().mockResolvedValue({
          data: mockSalesOrders,
          error: null,
        });

        const order2 = vi.fn().mockReturnValue({
          order: order1,
        });

        const select = vi.fn().mockReturnValue({
          order: order2,
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
          <SalesOrders />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注管理')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注の登録・確認・出荷管理を行います')).toBeInTheDocument();
      });
    });

    it('should fetch sales orders on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('sales_orders');
      });
    });

    it('should display new order button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規受注')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total orders count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('表示件数')).toBeInTheDocument();
        // "3 件" may appear in multiple places
        const countTexts = screen.getAllByText(/3 件/);
        expect(countTexts.length).toBeGreaterThan(0);
      });
    });

    it('should display total amount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('合計金額（税込）')).toBeInTheDocument();
        expect(screen.getByText(/450,000/)).toBeInTheDocument();
      });
    });

    it('should display pending orders count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注確認待ち')).toBeInTheDocument();
      });
    });

    it('should display confirmed orders count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注確定')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter', () => {
    it('should display search input', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('受注番号・顧客名で検索...');
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should filter by search keyword', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('SO-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('受注番号・顧客名で検索...');
      fireEvent.change(searchInput, { target: { value: 'SO-001' } });

      await waitFor(() => {
        expect(screen.getByText('SO-001')).toBeInTheDocument();
        expect(screen.queryByText('SO-002')).not.toBeInTheDocument();
        expect(screen.queryByText('SO-003')).not.toBeInTheDocument();
      });
    });

    it('should filter by status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('SO-001')).toBeInTheDocument();
      });

      // Find status select by role instead of label
      const statusSelects = screen.getAllByRole('combobox');
      const statusSelect = statusSelects.find(select =>
        (select as HTMLSelectElement).querySelector('option[value="confirmed"]')
      ) as HTMLSelectElement;

      expect(statusSelect).toBeDefined();
      fireEvent.change(statusSelect, { target: { value: 'confirmed' } });

      await waitFor(() => {
        expect(screen.queryByText('SO-001')).not.toBeInTheDocument();
        expect(screen.getByText('SO-002')).toBeInTheDocument();
        expect(screen.queryByText('SO-003')).not.toBeInTheDocument();
      });
    });

    it('should display all status options', async () => {
      renderComponent();

      await waitFor(() => {
        // Find status select by checking for status option values
        const statusSelects = screen.getAllByRole('combobox');
        const statusSelect = statusSelects.find(select =>
          (select as HTMLSelectElement).querySelector('option[value="confirmed"]')
        ) as HTMLSelectElement;
        expect(statusSelect).toBeDefined();
      });

      // Check if status options are available
      const statusSelects = screen.getAllByRole('combobox');
      const statusSelect = statusSelects.find(select =>
        (select as HTMLSelectElement).querySelector('option[value="confirmed"]')
      ) as HTMLSelectElement;
      expect(statusSelect.options.length).toBeGreaterThan(1);
    });
  });

  describe('Sales Orders Table', () => {
    it('should display table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注番号')).toBeInTheDocument();
      });

      const headers = ['受注日', '顧客', '納期', '金額（税込）', '操作'];
      headers.forEach(header => {
        expect(screen.getByText(header)).toBeInTheDocument();
      });

      // "ステータス" appears multiple times (filter label and table header)
      const statusHeaders = screen.getAllByText('ステータス');
      expect(statusHeaders.length).toBeGreaterThan(0);
    });

    it('should display order data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('SO-001')).toBeInTheDocument();
        expect(screen.getByText('SO-002')).toBeInTheDocument();
        expect(screen.getByText('SO-003')).toBeInTheDocument();

        // Customer names may appear multiple times
        const customerAElements = screen.getAllByText('Customer A');
        expect(customerAElements.length).toBeGreaterThan(0);

        const customerBElements = screen.getAllByText('Customer B');
        expect(customerBElements.length).toBeGreaterThan(0);
      });
    });

    it('should display formatted amounts', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/100,000/)).toBeInTheDocument();
        expect(screen.getByText(/200,000/)).toBeInTheDocument();
        expect(screen.getByText(/150,000/)).toBeInTheDocument();
      });
    });

    it('should display status badges with correct text', async () => {
      renderComponent();

      await waitFor(() => {
        // Check for Japanese status labels
        const pendingBadges = screen.getAllByText('受注確認待ち');
        expect(pendingBadges.length).toBeGreaterThan(0);

        const confirmedBadges = screen.getAllByText('受注確定');
        expect(confirmedBadges.length).toBeGreaterThan(0);

        const shippedBadges = screen.getAllByText('出荷済み');
        expect(shippedBadges.length).toBeGreaterThan(0);
      });
    });

    it('should have view detail links for each order', async () => {
      renderComponent();

      await waitFor(() => {
        const viewLinks = screen.getAllByText('詳細');
        expect(viewLinks.length).toBe(3);
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no orders', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const order1 = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });

          const order2 = vi.fn().mockReturnValue({
            order: order1,
          });

          const select = vi.fn().mockReturnValue({
            order: order2,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('受注データがありません')).toBeInTheDocument();
      });
    });

    it('should display empty state after filtering', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('SO-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('受注番号・顧客名で検索...');
      fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

      await waitFor(() => {
        expect(screen.getByText('受注データがありません')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const order1 = vi.fn().mockRejectedValue(new Error('Fetch failed'));

          const order2 = vi.fn().mockReturnValue({
            order: order1,
          });

          const select = vi.fn().mockReturnValue({
            order: order2,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sales_orders') {
          const order1 = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

          const order2 = vi.fn().mockReturnValue({
            order: order1,
          });

          const select = vi.fn().mockReturnValue({
            order: order2,
          });

          return {
            select,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('読み込み中...')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
