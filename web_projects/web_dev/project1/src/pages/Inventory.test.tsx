import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Inventory from './Inventory';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };
  return {
    default: toast,
    toast,
  };
});

vi.mock('../hooks/usePageState', () => ({
  usePageState: () => ({
    savePageState: vi.fn((state) => state),
    restorePageState: vi.fn(() => null),
  }),
}));

vi.mock('../data/manuals', () => ({
  manuals: {
    inventory: {
      title: 'Test Manual',
    },
  },
}));

vi.mock('../components/PageManual', () => ({
  default: () => <div>Page Manual</div>,
}));

// Mock react-select
vi.mock('react-select', () => ({
  default: ({ value, onChange, options, placeholder }: any) => (
    <select
      data-testid="react-select"
      value={value?.value || ''}
      onChange={(e) => {
        const selected = options.find((opt: any) => opt.value === e.target.value);
        onChange(selected || null);
      }}
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

describe('Inventory', () => {
  let queryClient: QueryClient;

  const mockMovements = [
    {
      id: '1',
      product_id: 'prod-1',
      movement_type: 'in',
      quantity: 100,
      unit_price: 50,
      total_amount: 5000,
      memo: 'Bulk purchase',
      created_at: '2024-01-15T10:00:00Z',
      stock_after_transaction: 150,
      reference_type: 'purchase_transaction',
      reference_id: 'po-001',
      products: {
        id: 'prod-1',
        product_name: 'Product A',
        product_code: 'PA001',
        current_stock: 150,
        min_stock_level: 20,
        standard_cost: 50,
      },
      transaction: {
        id: 'trans-1',
        transaction_no: 'T-001',
        parent_order_id: 'po-001',
      },
      purchase_order: {
        order_no: 'PO-001',
      },
    },
    {
      id: '2',
      product_id: 'prod-2',
      movement_type: 'out',
      quantity: 50,
      unit_price: 100,
      total_amount: 5000,
      memo: null,
      created_at: '2024-01-16T10:00:00Z',
      stock_after_transaction: 50,
      reference_type: null,
      reference_id: null,
      products: {
        id: 'prod-2',
        product_name: 'Product B',
        product_code: 'PB002',
        current_stock: 50,
        min_stock_level: 10,
        standard_cost: 100,
      },
      transaction: null,
      purchase_order: null,
    },
    {
      id: '3',
      product_id: 'prod-1',
      movement_type: 'adjustment',
      quantity: 10,
      unit_price: 50,
      total_amount: 500,
      memo: 'Stock count adjustment',
      created_at: '2024-01-17T10:00:00Z',
      stock_after_transaction: 160,
      reference_type: null,
      reference_id: null,
      products: {
        id: 'prod-1',
        product_name: 'Product A',
        product_code: 'PA001',
        current_stock: 160,
        min_stock_level: 20,
        standard_cost: 50,
      },
      transaction: null,
      purchase_order: null,
    },
  ];

  const mockProducts = [
    {
      id: 'prod-1',
      product_name: 'Product A',
      product_code: 'PA001',
      current_stock: 160,
      min_stock_level: 20,
      standard_cost: 50,
    },
    {
      id: 'prod-2',
      product_name: 'Product B',
      product_code: 'PB002',
      current_stock: 50,
      min_stock_level: 10,
      standard_cost: 100,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.clearAllMocks();

    // Mock for different tables - return different mocks based on table name
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'inventory_movements') {
        // inventory_movements: select().order().limit()
        const movementsLimit = vi.fn().mockResolvedValue({
          data: mockMovements,
          error: null,
        });

        const movementsOrder = vi.fn().mockReturnValue({
          limit: movementsLimit,
        });

        const movementsSelect = vi.fn().mockReturnValue({
          order: movementsOrder,
        });

        const insert = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });

        return {
          select: movementsSelect,
          insert,
        } as any;
      } else if (table === 'products') {
        // products: select().order()
        const productsOrder = vi.fn().mockResolvedValue({
          data: mockProducts,
          error: null,
        });

        const productsSelect = vi.fn().mockReturnValue({
          order: productsOrder,
        });

        return {
          select: productsSelect,
        } as any;
      } else if (table === 'purchase_orders') {
        // purchase_orders: select().in()
        const purchaseOrdersIn = vi.fn().mockResolvedValue({
          data: [
            {
              id: 'po-001',
              order_no: 'PO-001',
            },
          ],
          error: null,
        });

        const purchaseOrdersSelect = vi.fn().mockReturnValue({
          in: purchaseOrdersIn,
        });

        return {
          select: purchaseOrdersSelect,
        } as any;
      } else if (table === 'transactions') {
        // transactions: select().in()
        const transactionsIn = vi.fn().mockResolvedValue({
          data: [
            {
              id: 'trans-1',
              transaction_no: 'T-001',
              parent_order_id: 'po-001',
            },
          ],
          error: null,
        });

        const transactionsSelect = vi.fn().mockReturnValue({
          in: transactionsIn,
        });

        return {
          select: transactionsSelect,
        } as any;
      }
      return {} as any;
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <Inventory />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫管理')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品の入出庫履歴を記録・管理')).toBeInTheDocument();
      });
    });

    it('should fetch inventory movements on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('inventory_movements');
      });
    });

    it('should fetch products on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total transactions count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総取引数')).toBeInTheDocument();
      });

      const transactionsElement = screen.getByText('総取引数').closest('div')?.querySelector('.text-2xl');
      expect(transactionsElement).toBeTruthy();
      expect(transactionsElement?.textContent).toBe('3');
    });

    it('should display total inbound quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Movement 1: in = 100 (adjustment not counted in inbound)
      const inboundElement = screen.getByText('総入庫数').closest('div')?.querySelector('.text-2xl');
      expect(inboundElement).toBeTruthy();
      expect(inboundElement?.textContent).toBe('100');
    });

    it('should display total outbound quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総出庫数')).toBeInTheDocument();
      });

      // Movement 2: out = 50
      const outboundElement = screen.getByText('総出庫数').closest('div')?.querySelector('.text-2xl');
      expect(outboundElement).toBeTruthy();
      expect(outboundElement?.textContent).toBe('50');
    });

    it('should display total transaction value', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総取引金額')).toBeInTheDocument();
      });

      // Movement 1: 5000 + Movement 2: 5000 + Movement 3: 500 = 10500
      const valueElement = screen.getByText('総取引金額').closest('div')?.querySelector('.text-2xl');
      expect(valueElement).toBeTruthy();
      expect(valueElement?.textContent).toMatch(/10[,.]500/);
    });
  });

  describe('Quick Movement Form', () => {
    it('should display Quick入出庫 button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Quick入出庫')).toBeInTheDocument();
      });
    });

    it('should show form when Quick入出庫 button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Quick入出庫')).toBeInTheDocument();
      });

      const quickButton = screen.getByText('Quick入出庫');
      fireEvent.click(quickButton);

      await waitFor(() => {
        expect(screen.getByText('商品の入出庫を素早く記録')).toBeInTheDocument();
      });
    });

    it('should display form fields', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Quick入出庫')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Quick入出庫'));

      await waitFor(() => {
        expect(screen.getByText('商品')).toBeInTheDocument();
        expect(screen.getByText('入出庫種別')).toBeInTheDocument();
        expect(screen.getByText('数量')).toBeInTheDocument();
        // 単価とメモはフォームとテーブルヘッダーに出現するため、getAllByTextを使用
        const unitPriceElements = screen.getAllByText('単価');
        expect(unitPriceElements.length).toBeGreaterThan(0);
        const memoElements = screen.getAllByText('メモ');
        expect(memoElements.length).toBeGreaterThan(0);
      });
    });

    it('should close form when キャンセル button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Quick入出庫')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Quick入出庫'));

      await waitFor(() => {
        expect(screen.getByText('商品の入出庫を素早く記録')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('キャンセル');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('商品の入出庫を素早く記録')).not.toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should display filter section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('フィルター')).toBeInTheDocument();
      });
    });

    it('should display search input', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('商品名、商品コード、メモで検索...')).toBeInTheDocument();
      });
    });

    it('should filter by search text', async () => {
      renderComponent();

      await waitFor(() => {
        // Product Aは2回、Product Bは1回出現
        const productAElements = screen.getAllByText('Product A');
        expect(productAElements.length).toBe(2);
        expect(screen.getByText('Product B')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('商品名、商品コード、メモで検索...');
      fireEvent.change(searchInput, { target: { value: 'Product A' } });

      await waitFor(() => {
        // フィルター後もProduct Aは2件表示
        const productAElements = screen.getAllByText('Product A');
        expect(productAElements.length).toBe(2);
        // Product Bは非表示
        expect(screen.queryByText('Product B')).not.toBeInTheDocument();
      });
    });

    it('should expand filters when 開く button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('フィルター')).toBeInTheDocument();
      });

      const openButton = screen.getByText('開く');
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(screen.getByText('移動種別')).toBeInTheDocument();
        expect(screen.getByText('開始日')).toBeInTheDocument();
        expect(screen.getByText('終了日')).toBeInTheDocument();
      });
    });

    it('should filter by movement type', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('フィルター')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('開く'));

      await waitFor(() => {
        expect(screen.getByText('移動種別')).toBeInTheDocument();
      });

      const typeSelect = screen.getAllByRole('combobox').find(
        (select) => select.previousElementSibling?.textContent === '移動種別'
      ) as HTMLSelectElement;

      fireEvent.change(typeSelect, { target: { value: 'in' } });

      await waitFor(() => {
        // Should show only 'in' type movements
        const inElements = screen.getAllByText('入庫');
        expect(inElements.length).toBeGreaterThan(0);
      });
    });

    it('should clear filters when フィルターをクリア button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('フィルター')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('開く'));

      await waitFor(() => {
        expect(screen.getByText('移動種別')).toBeInTheDocument();
      });

      const typeSelect = screen.getAllByRole('combobox').find(
        (select) => select.previousElementSibling?.textContent === '移動種別'
      ) as HTMLSelectElement;

      fireEvent.change(typeSelect, { target: { value: 'in' } });

      await waitFor(() => {
        expect(screen.getByText(/フィルターをクリア/)).toBeInTheDocument();
      });

      const clearButton = screen.getByText(/フィルターをクリア/);
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(typeSelect.value).toBe('all');
      });
    });
  });

  describe('Movement History Table', () => {
    it('should display table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴')).toBeInTheDocument();
      });

      expect(screen.getByText('移動日時')).toBeInTheDocument();
      expect(screen.getByText('商品名')).toBeInTheDocument();
      expect(screen.getByText('商品コード')).toBeInTheDocument();
      expect(screen.getByText('種別')).toBeInTheDocument();
      expect(screen.getByText('移動個数')).toBeInTheDocument();
      expect(screen.getByText('移動後在庫数')).toBeInTheDocument();
      expect(screen.getByText('単価')).toBeInTheDocument();
      expect(screen.getByText('金額')).toBeInTheDocument();
      expect(screen.getByText('関連伝票')).toBeInTheDocument();
      expect(screen.getByText('メモ')).toBeInTheDocument();
    });

    it('should display movement data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴')).toBeInTheDocument();
      });

      // Product A appears twice in movements
      const productAElements = screen.getAllByText('Product A');
      expect(productAElements.length).toBeGreaterThan(0);

      expect(screen.getByText('Product B')).toBeInTheDocument();

      // Product codes
      const pa001Elements = screen.getAllByText('PA001');
      expect(pa001Elements.length).toBeGreaterThan(0);

      expect(screen.getByText('PB002')).toBeInTheDocument();
    });

    it('should display movement type badges', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴')).toBeInTheDocument();
      });

      const inboundBadges = screen.getAllByText('入庫');
      expect(inboundBadges.length).toBeGreaterThan(0);

      const outboundBadges = screen.getAllByText('出庫');
      expect(outboundBadges.length).toBeGreaterThan(0);

      const adjustmentBadges = screen.getAllByText('調整');
      expect(adjustmentBadges.length).toBeGreaterThan(0);
    });

    it('should display quantity with +/- prefix', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴')).toBeInTheDocument();
      });

      // Inbound should have + prefix
      expect(screen.getByText('+100')).toBeInTheDocument();

      // Outbound should have - prefix
      expect(screen.getByText('-50')).toBeInTheDocument();

      // Adjustment should have + prefix
      expect(screen.getByText('+10')).toBeInTheDocument();
    });

    it('should display related transaction links', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴')).toBeInTheDocument();
      });

      // Movement 1 has transaction and purchase order links
      await waitFor(() => {
        expect(screen.getByText('T-001')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/発注: PO-001/)).toBeInTheDocument();
      });
    });

    it('should display memo or dash', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴')).toBeInTheDocument();
      });

      expect(screen.getByText('Bulk purchase')).toBeInTheDocument();
      expect(screen.getByText('Stock count adjustment')).toBeInTheDocument();

      // Should display "-" for null memo
      const dashElements = screen.getAllByText('-');
      expect(dashElements.length).toBeGreaterThan(0);
    });

    it('should display empty state when no movements', async () => {
      // Reset mock to return empty data for inventory_movements
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'inventory_movements') {
          const movementsLimit = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });

          const movementsOrder = vi.fn().mockReturnValue({
            limit: movementsLimit,
          });

          const movementsSelect = vi.fn().mockReturnValue({
            order: movementsOrder,
          });

          return {
            select: movementsSelect,
          } as any;
        } else if (table === 'products') {
          const productsOrder = vi.fn().mockResolvedValue({
            data: mockProducts,
            error: null,
          });

          const productsSelect = vi.fn().mockReturnValue({
            order: productsOrder,
          });

          return {
            select: productsSelect,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫移動履歴がありません')).toBeInTheDocument();
        expect(screen.getByText('Quick入出庫から記録を開始してください')).toBeInTheDocument();
      });
    });

    it('should display filtered empty state', async () => {
      renderComponent();

      await waitFor(() => {
        // Product Aは2回出現
        const productAElements = screen.getAllByText('Product A');
        expect(productAElements.length).toBe(2);
      });

      // Open filters
      const filterButton = screen.getByText('開く');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('種別')).toBeInTheDocument();
      });

      // Select a filter that will result in empty data
      const typeSelects = screen.getAllByRole('combobox');
      const typeSelect = typeSelects.find(
        (select) => (select as HTMLSelectElement).value === 'all'
      );
      if (typeSelect) {
        fireEvent.change(typeSelect, { target: { value: 'return' } });
      }

      await waitFor(() => {
        expect(screen.getByText('該当する在庫移動がありません')).toBeInTheDocument();
        expect(screen.getByText('フィルター条件を変更してください')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Results', () => {
    it('should display results count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/3件の在庫移動が見つかりました/)).toBeInTheDocument();
      });
    });

    it('should update results count when filtered', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/3件の在庫移動が見つかりました/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('商品名、商品コード、メモで検索...');
      fireEvent.change(searchInput, { target: { value: 'Product B' } });

      await waitFor(() => {
        expect(screen.getByText(/1件の在庫移動が見つかりました/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      const mockError = { message: 'Database error' };
      const mockErrorOrder = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockErrorSelect = vi.fn().mockReturnValue({
        order: mockErrorOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockErrorSelect,
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', async () => {
      // Mock with delayed response for inventory_movements
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'inventory_movements') {
          const mockDelayedLimit = vi.fn().mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(() => resolve({ data: mockMovements, error: null }), 100)
              )
          );

          const mockDelayedOrder = vi.fn().mockReturnValue({
            limit: mockDelayedLimit,
          });

          const mockDelayedSelect = vi.fn().mockReturnValue({
            order: mockDelayedOrder,
          });

          return {
            select: mockDelayedSelect,
          } as any;
        } else if (table === 'products') {
          const productsOrder = vi.fn().mockResolvedValue({
            data: mockProducts,
            error: null,
          });

          const productsSelect = vi.fn().mockReturnValue({
            order: productsOrder,
          });

          return {
            select: productsSelect,
          } as any;
        } else if (table === 'purchase_orders') {
          const purchaseOrdersIn = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });

          const purchaseOrdersSelect = vi.fn().mockReturnValue({
            in: purchaseOrdersIn,
          });

          return {
            select: purchaseOrdersSelect,
          } as any;
        } else if (table === 'transactions') {
          const transactionsIn = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });

          const transactionsSelect = vi.fn().mockReturnValue({
            in: transactionsIn,
          });

          return {
            select: transactionsSelect,
          } as any;
        }
        return {} as any;
      });

      renderComponent();

      // Check for loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.getByText('在庫管理')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Refresh Functionality', () => {
    it('should display refresh button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('最新表示に更新')).toBeInTheDocument();
      });
    });

    it('should refetch data when refresh button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('最新表示に更新')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('最新表示に更新');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('inventory_movements');
      });
    });
  });
});
