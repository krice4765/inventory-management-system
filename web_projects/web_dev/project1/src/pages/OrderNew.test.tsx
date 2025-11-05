import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OrderNew from './OrderNew';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' },
    userProfile: null,
    loading: false,
    setUser: vi.fn(),
    setUserProfile: vi.fn(),
    setLoading: vi.fn(),
  })),
}));

vi.mock('../components/FormField', () => ({
  FormField: ({ label, children, error }: any) => (
    <div>
      <label>{label}</label>
      {children}
      {error && <span role="alert">{error.message}</span>}
    </div>
  ),
  FormInput: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('../components/DrawingInfoSection', () => ({
  default: ({ title }: any) => <div>{title}</div>,
}));

vi.mock('react-select', () => ({
  default: ({ options, onChange, placeholder, value, name }: any) => (
    <select
      onChange={(e) => {
        const selected = options.find((opt: any) => opt.value === e.target.value);
        onChange(selected || null);
      }}
      value={value?.value || ''}
      data-testid={placeholder}
      name={name}
    >
      <option value="">{placeholder}</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock data
const mockPartners = [
  {
    id: 'partner-1',
    name: 'Test Supplier',
    partner_code: 'SUP001',
    partner_type: 'supplier',
    is_active: true,
  },
];

const mockProducts = [
  {
    id: 'product-1',
    product_name: 'Test Product',
    product_code: 'PROD001',
    standard_cost: 1000,
    tax_category: 'standard_10',
    drawing_number: 'DRW-001',
    drawing_revision: 'Rev A',
    drawing_name: 'Test Drawing',
    drawing_notes: 'Test notes',
  },
];

const mockUsers = [
  {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
      role: 'purchasing_staff',
    },
  },
];

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <OrderNew />
    </BrowserRouter>
  );
};

describe('OrderNew', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase queries with proper chaining
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'partners') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockPartners,
                  error: null,
                }),
              }),
            }),
          }),
        } as any;
      }

      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockProducts,
              error: null,
            }),
          }),
        } as any;
      }

      if (table === 'purchase_orders') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'order-1', order_no: 'PO-001' },
                error: null,
              }),
            }),
          }),
        } as any;
      }

      if (table === 'purchase_order_items') {
        return {
          insert: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any;
      }

      return {} as any;
    });

    // Mock auth session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
        } as any,
      },
      error: null,
    });

    // Mock Edge Function
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: mockUsers }),
    } as any);

    // Mock RPC for order number generation
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 'PO-001',
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('should display loading spinner initially', () => {
      renderComponent();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display form after data loads', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('新規発注書作成')).toBeInTheDocument();
      });
    });

    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('発注管理に戻る')).toBeInTheDocument();
      });
    });

    it('should display form fields', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('仕入先')).toBeInTheDocument();
        expect(screen.getByText('発注日')).toBeInTheDocument();
        expect(screen.getByText('発注担当者')).toBeInTheDocument();
        expect(screen.getByText('希望納期')).toBeInTheDocument();
      });
    });

    it('should display item table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品')).toBeInTheDocument();
        expect(screen.getByText('数量')).toBeInTheDocument();
        expect(screen.getByText('単価')).toBeInTheDocument();
        expect(screen.getByText('小計')).toBeInTheDocument();
      });
    });
  });

  describe('Master Data Loading', () => {
    it('should load partners on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('partners');
      });
    });

    it('should load products on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });

    it('should load users from Edge Function', async () => {
      renderComponent();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/list-users'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should handle master data fetch error', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        const order = vi.fn().mockRejectedValue(new Error('Database error'));
        const inMethod = vi.fn().mockReturnValue({ order });
        const eq = vi.fn().mockReturnValue({ in: inMethod });
        const select = vi.fn().mockReturnValue({ eq });
        return { select } as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('マスターデータの取得に失敗しました。ページをリロードしてください。');
      });
    });

    it('should handle Edge Function error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('ユーザー一覧の取得に失敗しました');
      });
    });
  });

  describe('Form Interaction', () => {
    it('should allow adding item row', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('行追加')).toBeInTheDocument();
      });

      const addButton = screen.getByText('行追加');
      fireEvent.click(addButton);

      // Should have 2 rows (initial + added)
      const deleteButtons = screen.getAllByTitle('行削除');
      expect(deleteButtons).toHaveLength(2);
    });

    it('should prevent removing last item row', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTitle('行削除')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle('行削除');
      fireEvent.click(deleteButton);

      expect(toast.error).toHaveBeenCalledWith('明細行は最低1行必要です');
    });

    it('should allow removing item row when multiple exist', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('行追加')).toBeInTheDocument();
      });

      // Add a second row
      const addButton = screen.getByText('行追加');
      fireEvent.click(addButton);

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('行削除');
        expect(deleteButtons).toHaveLength(2);
      });

      // Remove the first row
      const deleteButtons = screen.getAllByTitle('行削除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        const remainingButtons = screen.getAllByTitle('行削除');
        expect(remainingButtons).toHaveLength(1);
      });
    });

    it('should display drawing info section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('カスタム図面情報（この発注専用）')).toBeInTheDocument();
      });
    });

    it('should display shipping cost section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('送料設定')).toBeInTheDocument();
        expect(screen.getByText('送料')).toBeInTheDocument();
        expect(screen.getByText('送料消費税率')).toBeInTheDocument();
      });
    });

    it('should display total calculation section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品小計:')).toBeInTheDocument();
        expect(screen.getByText('消費税合計:')).toBeInTheDocument();
        expect(screen.getByText('総合計:')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should display submit button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('発注書作成')).toBeInTheDocument();
      });
    });

    it('should display cancel button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('キャンセル')).toBeInTheDocument();
      });
    });

    it('should handle successful form submission', async () => {
      renderComponent();

      // Wait for complete form load including item table
      await waitFor(() => {
        expect(screen.getByText('商品')).toBeInTheDocument();
        expect(screen.getByTestId('仕入先を検索または選択...')).toBeInTheDocument();
      });

      // Fill partner
      const partnerSelect = screen.getByTestId('仕入先を検索または選択...');
      fireEvent.change(partnerSelect, { target: { value: 'partner-1' } });

      // Fill assigned user
      const userSelect = screen.getByTestId('担当者を選択...');
      fireEvent.change(userSelect, { target: { value: 'user-1' } });

      // Wait for product select to appear and fill it
      await waitFor(() => {
        const productSelects = screen.queryAllByTestId('商品を検索または選択...');
        expect(productSelects.length).toBeGreaterThan(0);
      });

      const productSelects = screen.getAllByTestId('商品を検索または選択...');
      fireEvent.change(productSelects[0], { target: { value: 'product-1' } });

      // Submit form
      const submitButton = screen.getByText('発注書作成');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('generate_order_no');
        expect(supabase.from).toHaveBeenCalledWith('purchase_orders');
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling', () => {
    it('should handle order number generation error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品')).toBeInTheDocument();
      });

      const partnerSelect = screen.getByTestId('仕入先を検索または選択...');
      fireEvent.change(partnerSelect, { target: { value: 'partner-1' } });

      const userSelect = screen.getByTestId('担当者を選択...');
      fireEvent.change(userSelect, { target: { value: 'user-1' } });

      await waitFor(() => {
        expect(screen.queryAllByTestId('商品を検索または選択...').length).toBeGreaterThan(0);
      });

      const productSelects = screen.getAllByTestId('商品を検索または選択...');
      fireEvent.change(productSelects[0], { target: { value: 'product-1' } });

      const submitButton = screen.getByText('発注書作成');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('発注書の作成に失敗しました');
      }, { timeout: 2000 });
    });

    it('should handle order insert error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_orders') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert error' },
          });
          const select = vi.fn().mockReturnValue({ single });
          const insert = vi.fn().mockReturnValue({ select });
          return { insert } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品')).toBeInTheDocument();
      });

      const partnerSelect = screen.getByTestId('仕入先を検索または選択...');
      fireEvent.change(partnerSelect, { target: { value: 'partner-1' } });

      const userSelect = screen.getByTestId('担当者を選択...');
      fireEvent.change(userSelect, { target: { value: 'user-1' } });

      await waitFor(() => {
        expect(screen.queryAllByTestId('商品を検索または選択...').length).toBeGreaterThan(0);
      });

      const productSelects = screen.getAllByTestId('商品を検索または選択...');
      fireEvent.change(productSelects[0], { target: { value: 'product-1' } });

      const submitButton = screen.getByText('発注書作成');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('発注書の作成に失敗しました');
      }, { timeout: 2000 });
    });

    it('should handle items insert error', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'purchase_order_items') {
          const insert = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Items insert error' },
          });
          return { insert } as any;
        }

        if (table === 'purchase_orders') {
          const single = vi.fn().mockResolvedValue({
            data: { id: 'order-1', order_no: 'PO-001' },
            error: null,
          });
          const select = vi.fn().mockReturnValue({ single });
          const insert = vi.fn().mockReturnValue({ select });
          return { insert } as any;
        }

        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品')).toBeInTheDocument();
      });

      const partnerSelect = screen.getByTestId('仕入先を検索または選択...');
      fireEvent.change(partnerSelect, { target: { value: 'partner-1' } });

      const userSelect = screen.getByTestId('担当者を選択...');
      fireEvent.change(userSelect, { target: { value: 'user-1' } });

      await waitFor(() => {
        expect(screen.queryAllByTestId('商品を検索または選択...').length).toBeGreaterThan(0);
      });

      const productSelects = screen.getAllByTestId('商品を検索または選択...');
      fireEvent.change(productSelects[0], { target: { value: 'product-1' } });

      const submitButton = screen.getByText('発注書作成');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('発注書の作成に失敗しました');
      }, { timeout: 2000 });
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

    it('should disable buttons during submission', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('発注書作成')).toBeInTheDocument();
      });

      const submitButton = screen.getByText('発注書作成');
      fireEvent.click(submitButton);

      // Button should show submitting state
      await waitFor(() => {
        expect(screen.queryByText('作成中...')).toBeInTheDocument();
      });
    });
  });
});
