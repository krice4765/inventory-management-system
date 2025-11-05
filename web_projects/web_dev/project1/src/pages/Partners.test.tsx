import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Partners from './Partners';
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
  Plus: () => <div>Plus Icon</div>,
  Edit: () => <div>Edit Icon</div>,
  Building: () => <div>Building Icon</div>,
  Search: () => <div>Search Icon</div>,
  X: () => <div>X Icon</div>,
  Users: () => <div>Users Icon</div>,
  TrendingUp: () => <div>TrendingUp Icon</div>,
  ShoppingCart: () => <div>ShoppingCart Icon</div>,
  CheckCircle: () => <div>CheckCircle Icon</div>,
}));

// Mock PageManual component
vi.mock('../components/PageManual', () => ({
  default: () => <div>Page Manual</div>,
}));

// Mock FormField components
vi.mock('../components/FormField', () => ({
  FormField: ({ children }: any) => <div>{children}</div>,
  FormInput: ({ ...props }: any) => <input {...props} />,
  FormSelect: ({ options, ...props }: any) => (
    <select {...props}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
  FormTextarea: ({ ...props }: any) => <textarea {...props} />,
}));

// Mock DayPicker component
vi.mock('../components/DayPicker', () => ({
  DayPicker: ({ value, onChange }: any) => (
    <input
      type="number"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
      data-testid="day-picker"
    />
  ),
}));

describe('Partners', () => {
  let queryClient: QueryClient;

  const mockPartners = [
    {
      id: 'partner-1',
      name: 'Supplier A',
      partner_code: 'SUP-001',
      partner_type: 'supplier',
      contact_person: 'Taro Tanaka',
      phone: '03-1234-5678',
      email: 'tanaka@supplier-a.com',
      address: 'Tokyo, Japan',
      is_active: true,
      closing_day: 20,
      payment_day: 31,
      payment_month_offset: 1,
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'partner-2',
      name: 'Customer B',
      partner_code: 'CUS-001',
      partner_type: 'customer',
      contact_person: 'Hanako Suzuki',
      phone: '03-9876-5432',
      email: 'suzuki@customer-b.com',
      address: 'Osaka, Japan',
      is_active: true,
      closing_day: 15,
      payment_day: 25,
      payment_month_offset: 0,
      created_at: '2024-01-16T10:00:00Z',
    },
    {
      id: 'partner-3',
      name: 'Both Trading C',
      partner_code: 'BOT-001',
      partner_type: 'both',
      contact_person: 'Jiro Sato',
      phone: '03-5555-7777',
      email: 'sato@both-c.com',
      address: 'Kyoto, Japan',
      is_active: false,
      closing_day: null,
      payment_day: null,
      payment_month_offset: 1,
      created_at: '2024-01-17T10:00:00Z',
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
      if (table === 'partners') {
        const order = vi.fn().mockResolvedValue({
          data: mockPartners,
          error: null,
        });

        const select = vi.fn().mockReturnValue({
          order,
        });

        return {
          select,
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
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
          <Partners />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('取引先管理')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('仕入先・販売先の管理と登録')).toBeInTheDocument();
      });
    });

    it('should fetch partners on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('partners');
      });
    });

    it('should display new partner button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規取引先')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total partners count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総取引先数')).toBeInTheDocument();
        expect(screen.getByText('登録済み取引先')).toBeInTheDocument();
      });
    });

    it('should display supplier count', async () => {
      renderComponent();

      await waitFor(() => {
        const supplierLabels = screen.getAllByText('仕入先');
        expect(supplierLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('仕入先として登録')).toBeInTheDocument();
      });
    });

    it('should display customer count', async () => {
      renderComponent();

      await waitFor(() => {
        const customerLabels = screen.getAllByText('販売先');
        expect(customerLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('販売先として登録')).toBeInTheDocument();
      });
    });

    it('should display active partners count', async () => {
      renderComponent();

      await waitFor(() => {
        const activeLabels = screen.getAllByText('有効');
        expect(activeLabels.length).toBeGreaterThan(0);
        expect(screen.getByText('アクティブな取引先')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter', () => {
    it('should display search input', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          '取引先名、コード、担当者、電話番号、メールアドレスで検索...'
        );
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should filter by search keyword', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        '取引先名、コード、担当者、電話番号、メールアドレスで検索...'
      );
      fireEvent.change(searchInput, { target: { value: 'Supplier A' } });

      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
        expect(screen.queryByText('Customer B')).not.toBeInTheDocument();
      });
    });

    it('should display filter toggle button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('開く')).toBeInTheDocument();
      });
    });

    it('should expand filters when button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('開く')).toBeInTheDocument();
      });

      const filterButton = screen.getByText('開く');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('取引先種別')).toBeInTheDocument();
        expect(screen.getByText('状態')).toBeInTheDocument();
        expect(screen.getByText('並び替え')).toBeInTheDocument();
      });
    });

    it('should filter by partner type', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText('開く');
      fireEvent.click(filterButton);

      await waitFor(() => {
        const typeSelects = screen.getAllByRole('combobox');
        const typeSelect = typeSelects.find(
          (select) => (select as HTMLSelectElement).value === 'all'
        );
        if (typeSelect) {
          fireEvent.change(typeSelect, { target: { value: 'supplier' } });
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
      });
    });

    it('should display filter results count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/件の取引先が見つかりました/)).toBeInTheDocument();
      });
    });
  });

  describe('Partners Table', () => {
    it('should display table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('取引先名')).toBeInTheDocument();
      });

      const headers = ['コード', 'タイプ', '担当者', '電話番号', 'メールアドレス', 'ステータス', '操作'];
      headers.forEach((header) => {
        expect(screen.getByText(header)).toBeInTheDocument();
      });
    });

    it('should display partner data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
        expect(screen.getByText('Customer B')).toBeInTheDocument();
        expect(screen.getByText('Both Trading C')).toBeInTheDocument();
      });
    });

    it('should display partner codes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('SUP-001')).toBeInTheDocument();
        expect(screen.getByText('CUS-001')).toBeInTheDocument();
        expect(screen.getByText('BOT-001')).toBeInTheDocument();
      });
    });

    it('should display partner type badges', async () => {
      renderComponent();

      await waitFor(() => {
        const supplierBadges = screen.getAllByText('仕入先');
        expect(supplierBadges.length).toBeGreaterThan(0);

        const customerBadges = screen.getAllByText('販売先');
        expect(customerBadges.length).toBeGreaterThan(0);

        expect(screen.getByText('仕入先・販売先')).toBeInTheDocument();
      });
    });

    it('should display contact information', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Taro Tanaka')).toBeInTheDocument();
        expect(screen.getByText('03-1234-5678')).toBeInTheDocument();
        expect(screen.getByText('tanaka@supplier-a.com')).toBeInTheDocument();
      });
    });

    it('should display active status badges', async () => {
      renderComponent();

      await waitFor(() => {
        const activeBadges = screen.getAllByText('有効');
        expect(activeBadges.length).toBeGreaterThan(0);

        const inactiveBadges = screen.getAllByText('無効');
        expect(inactiveBadges.length).toBeGreaterThan(0);
      });
    });

    it('should have edit buttons for each partner', async () => {
      renderComponent();

      await waitFor(() => {
        const editButtons = screen.getAllByTitle('編集');
        expect(editButtons.length).toBe(3);
      });
    });

    it('should have toggle active buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('無効化').length).toBe(2); // 2 active partners
        expect(screen.getAllByText('有効化').length).toBe(1); // 1 inactive partner
      });
    });
  });

  describe('Partner Form', () => {
    it('should open form when new partner button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規取引先')).toBeInTheDocument();
      });

      const newButton = screen.getByText('新規取引先');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(screen.getByText('新規取引先作成')).toBeInTheDocument();
      });
    });

    it('should display required form fields', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規取引先')).toBeInTheDocument();
      });

      const newButton = screen.getByText('新規取引先');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('例: ABC商事株式会社')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('例: SUP-001')).toBeInTheDocument();
      });
    });

    it('should display payment terms section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規取引先')).toBeInTheDocument();
      });

      const newButton = screen.getByText('新規取引先');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(screen.getByText('締日・支払日設定')).toBeInTheDocument();
        expect(screen.getByText(/毎月20日締めで翌月末払い/)).toBeInTheDocument();
      });
    });

    it('should display bank account section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規取引先')).toBeInTheDocument();
      });

      const newButton = screen.getByText('新規取引先');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(screen.getByText('銀行口座情報（振込先）')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('例: 三菱UFJ銀行')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('例: 新宿支店')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display table even when no partners', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'partners') {
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
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/件の取引先が見つかりました/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'partners') {
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
        }
        return {} as any;
      });

      renderComponent();

      // Component should still render even if fetch fails
      await waitFor(() => {
        expect(screen.getByText('取引先管理')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'partners') {
          const order = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

          const select = vi.fn().mockReturnValue({
            order,
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
