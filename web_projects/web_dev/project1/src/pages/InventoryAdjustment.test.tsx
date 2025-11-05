import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InventoryAdjustment from './InventoryAdjustment';
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
  ArrowLeft: () => <div>ArrowLeft Icon</div>,
  Edit2: () => <div>Edit2 Icon</div>,
  AlertCircle: () => <div>AlertCircle Icon</div>,
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ productId: 'product-1' }),
  };
});

describe('InventoryAdjustment', () => {
  let queryClient: QueryClient;

  const mockProduct = {
    id: 'product-1',
    product_name: 'Test Product',
    product_code: 'P001',
    current_stock: 100,
    min_stock_level: 10,
  };

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
      if (table === 'products') {
        const single = vi.fn().mockResolvedValue({
          data: mockProduct,
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
      } else if (table === 'inventory_movements') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
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
          <InventoryAdjustment />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫調整')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品の在庫数量を調整します')).toBeInTheDocument();
      });
    });

    it('should fetch product on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });

    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        const backButtons = screen.getAllByRole('button');
        expect(backButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Product Display', () => {
    it('should display product name and code', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Product (P001)')).toBeInTheDocument();
      });
    });

    it('should display current stock', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('現在在庫')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
      });
    });

    it('should display adjustment target section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('調整対象商品')).toBeInTheDocument();
      });
    });
  });

  describe('Adjustment Form', () => {
    it('should display quantity input', async () => {
      renderComponent();

      await waitFor(() => {
        const quantityInput = screen.getByPlaceholderText('例: +50 または -10');
        expect(quantityInput).toBeInTheDocument();
      });
    });

    it('should display reason input', async () => {
      renderComponent();

      await waitFor(() => {
        const reasonInput = screen.getByPlaceholderText('例: 初期在庫登録');
        expect(reasonInput).toBeInTheDocument();
      });
    });

    it('should display quantity label with hint', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/調整数量/)).toBeInTheDocument();
        expect(screen.getByText(/\+50で入庫、-10で出庫/)).toBeInTheDocument();
      });
    });

    it('should display quick action buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('クイックアクション:')).toBeInTheDocument();
        expect(screen.getByText('+100')).toBeInTheDocument();
        expect(screen.getByText('+50')).toBeInTheDocument();
        expect(screen.getByText('+10')).toBeInTheDocument();
        expect(screen.getByText('-10')).toBeInTheDocument();
        expect(screen.getByText('-50')).toBeInTheDocument();
        expect(screen.getByText('-100')).toBeInTheDocument();
      });
    });

    it('should display reason suggestions', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('よく使う理由:')).toBeInTheDocument();
        expect(screen.getByText('初期在庫登録')).toBeInTheDocument();
        expect(screen.getByText('棚卸調整')).toBeInTheDocument();
        expect(screen.getByText('破損')).toBeInTheDocument();
      });
    });

    it('should update quantity when quick action button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('+50')).toBeInTheDocument();
      });

      const quickButton = screen.getByText('+50');
      fireEvent.click(quickButton);

      await waitFor(() => {
        const quantityInput = screen.getByPlaceholderText('例: +50 または -10') as HTMLInputElement;
        expect(quantityInput.value).toBe('+50');
      });
    });

    it('should update reason when suggestion button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('初期在庫登録')).toBeInTheDocument();
      });

      const reasonButton = screen.getByText('初期在庫登録');
      fireEvent.click(reasonButton);

      await waitFor(() => {
        const reasonInput = screen.getByPlaceholderText('例: 初期在庫登録') as HTMLInputElement;
        expect(reasonInput.value).toBe('初期在庫登録');
      });
    });
  });

  describe('Form Actions', () => {
    it('should display cancel button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('キャンセル')).toBeInTheDocument();
      });
    });

    it('should display submit button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('調整を記録')).toBeInTheDocument();
      });
    });

    it('should allow typing in quantity input', async () => {
      renderComponent();

      await waitFor(() => {
        const quantityInput = screen.getByPlaceholderText('例: +50 または -10');
        expect(quantityInput).toBeInTheDocument();
      });

      const quantityInput = screen.getByPlaceholderText('例: +50 または -10') as HTMLInputElement;
      fireEvent.change(quantityInput, { target: { value: '+20' } });

      expect(quantityInput.value).toBe('+20');
    });

    it('should allow typing in reason input', async () => {
      renderComponent();

      await waitFor(() => {
        const reasonInput = screen.getByPlaceholderText('例: 初期在庫登録');
        expect(reasonInput).toBeInTheDocument();
      });

      const reasonInput = screen.getByPlaceholderText('例: 初期在庫登録') as HTMLInputElement;
      fireEvent.change(reasonInput, { target: { value: 'Test reason' } });

      expect(reasonInput.value).toBe('Test reason');
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'products') {
          const single = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

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

  describe('Error State', () => {
    it('should display error message when product not found', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'products') {
          const single = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Product not found' },
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
        expect(screen.getByText('商品が見つかりませんでした')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    it('should have all positive quick action buttons', async () => {
      renderComponent();

      await waitFor(() => {
        ['+100', '+50', '+10'].forEach((value) => {
          expect(screen.getByText(value)).toBeInTheDocument();
        });
      });
    });

    it('should have all negative quick action buttons', async () => {
      renderComponent();

      await waitFor(() => {
        ['-10', '-50', '-100'].forEach((value) => {
          expect(screen.getByText(value)).toBeInTheDocument();
        });
      });
    });

    it('should have all reason suggestion buttons', async () => {
      renderComponent();

      await waitFor(() => {
        ['初期在庫登録', '棚卸調整', '破損', '返品', '入荷', '出荷'].forEach((reason) => {
          expect(screen.getByText(reason)).toBeInTheDocument();
        });
      });
    });
  });
});
