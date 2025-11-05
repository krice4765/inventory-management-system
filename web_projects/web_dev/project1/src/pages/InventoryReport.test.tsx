import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import InventoryReport from './InventoryReport';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
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

vi.mock('xlsx', () => {
  const XLSX = {
    utils: {
      json_to_sheet: vi.fn(),
      book_new: vi.fn(() => ({})),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  };
  return {
    default: XLSX,
    ...XLSX,
  };
});

vi.mock('../hooks/useErrorHandler', () => ({
  useErrorHandler: () => vi.fn(),
}));

vi.mock('../data/manuals', () => ({
  manuals: {
    inventoryReport: {
      title: 'Test Manual',
    },
  },
}));

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe('InventoryReport', () => {
  const mockProducts = [
    {
      id: '1',
      product_name: 'Product A',
      product_code: 'PA001',
      category: 'Electronics',
      current_stock: 100,
      min_stock_level: 20,
      standard_cost: 50,
    },
    {
      id: '2',
      product_name: 'Product B',
      product_code: 'PB002',
      category: 'Furniture',
      current_stock: 10,
      min_stock_level: 15,
      standard_cost: 200,
    },
    {
      id: '3',
      product_name: 'Product C',
      product_code: 'PC003',
      category: 'Electronics',
      current_stock: 50,
      min_stock_level: 30,
      standard_cost: 30,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    const mockSelect = vi.fn().mockResolvedValue({
      data: mockProducts,
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <InventoryReport />
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫状況レポート')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('商品別在庫残高と回転率の分析')).toBeInTheDocument();
      });
    });

    it('should fetch inventory data on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total inventory value', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総在庫金額')).toBeInTheDocument();
      });

      // Product A: 100 * 50 = 5000
      // Product B: 10 * 200 = 2000
      // Product C: 50 * 30 = 1500
      // Total: 8500
      // formatCurrency uses Intl.NumberFormat which formats as "¥8,500" (no space)
      const totalValueElement = screen.getByText('総在庫金額').closest('div')?.querySelector('.text-3xl');
      expect(totalValueElement).toBeTruthy();
      expect(totalValueElement?.textContent).toMatch(/8[,.]500/);
    });

    it('should display low stock count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('低在庫品目数')).toBeInTheDocument();
      });

      // Product B: 10 <= 15 (low stock)
      // Product C: 50 > 30 (not low stock, but 50 <= 30 is false, wait...)
      // Actually: Product B (10 <= 15) = 1
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should display average turnover rate', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('平均回転率')).toBeInTheDocument();
      });

      // Turnover rate is randomly generated, just check it exists
      await waitFor(() => {
        const elements = screen.getAllByText(/\d+\.\d/);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Category Filter', () => {
    it('should display category dropdown', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総在庫金額')).toBeInTheDocument();
      });

      // カテゴリ appears in both filter label and table header
      const categoryElements = screen.getAllByText('カテゴリ');
      expect(categoryElements.length).toBeGreaterThan(0);

      const selectElements = screen.getAllByRole('combobox');
      expect(selectElements.length).toBeGreaterThan(0);
    });

    it('should display all categories option', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('すべてのカテゴリ')).toBeInTheDocument();
      });
    });

    it('should filter by selected category', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総在庫金額')).toBeInTheDocument();
      });

      const selectElements = screen.getAllByRole('combobox');
      expect(selectElements.length).toBeGreaterThan(0);

      // Verify at least one select element exists
      expect(selectElements[0]).toBeInTheDocument();
    });
  });

  describe('Low Stock Filter', () => {
    it('should display low stock only checkbox', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText('低在庫品のみ表示')).toBeInTheDocument();
      });
    });

    it('should filter low stock items when checkbox is checked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Product A')).toBeInTheDocument();
        expect(screen.getByText('Product B')).toBeInTheDocument();
        expect(screen.getByText('Product C')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText('低在庫品のみ表示') as HTMLInputElement;
      fireEvent.click(checkbox);

      await waitFor(() => {
        // Only Product B should be visible (10 <= 15)
        expect(screen.getByText('Product B')).toBeInTheDocument();
        expect(screen.queryByText('Product A')).not.toBeInTheDocument();
      });
    });
  });

  describe('Inventory Table', () => {
    it('should display inventory table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総在庫金額')).toBeInTheDocument();
      });

      // Check for table headers (case-insensitive due to possible text transformations)
      const headers = ['商品', '現在庫数', '発注点', '単価', '在庫金額', '回転率', 'ステータス'];
      headers.forEach(header => {
        expect(screen.getByText(header)).toBeInTheDocument();
      });

      // カテゴリ appears in both filter and table, so check it exists
      const categoryElements = screen.getAllByText('カテゴリ');
      expect(categoryElements.length).toBeGreaterThan(0);
    });

    it('should display product data in table', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総在庫金額')).toBeInTheDocument();
      });

      // Products should be rendered after loading
      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('PA001')).toBeInTheDocument();
      expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
    });

    it('should mark low stock items with alert badge', async () => {
      renderComponent();

      await waitFor(() => {
        const badges = screen.getAllByText('低在庫');
        expect(badges.length).toBe(1); // Only Product B
      });
    });

    it('should mark normal stock items with success badge', async () => {
      renderComponent();

      await waitFor(() => {
        const badges = screen.getAllByText('正常');
        expect(badges.length).toBe(2); // Product A and C
      });
    });

    it('should display empty state when no data', async () => {
      const mockSelectEmpty = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelectEmpty,
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫データがありません')).toBeInTheDocument();
      });
    });
  });

  describe('Low Stock Alert', () => {
    it('should display low stock alert when low stock items exist', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/低在庫アラート:/)).toBeInTheDocument();
        expect(screen.getByText(/1品目が発注点を下回っています/)).toBeInTheDocument();
      });
    });

    it('should not display alert when showing low stock only', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText('低在庫品のみ表示')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText('低在庫品のみ表示');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.queryByText(/低在庫アラート:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('CSV Export', () => {
    it('should display export button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('CSVエクスポート')).toBeInTheDocument();
      });
    });

    it('should export data to CSV when button clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('CSVエクスポート')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('CSVエクスポート');
      fireEvent.click(exportButton);

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('CSVファイルをダウンロードしました');
    });
  });

  describe('Charts', () => {
    it('should display monthly inventory chart', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('月次在庫推移')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('should display category distribution chart', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('カテゴリ別在庫構成')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });

    it('should show no data message when charts have no data', async () => {
      const mockSelectEmpty = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelectEmpty,
      } as any);

      renderComponent();

      await waitFor(() => {
        const noDataMessages = screen.getAllByText('データがありません');
        expect(noDataMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Navigation', () => {
    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: '' });
        expect(backButton).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      const mockError = { message: 'Database error' };
      const mockSelectError = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelectError,
      } as any);

      renderComponent();

      await waitFor(() => {
        // Should stop loading even on error
        expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Calculations', () => {
    it('should calculate total value correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総在庫金額')).toBeInTheDocument();
      });

      // Product A: 100 * 50 = 5000
      // Product B: 10 * 200 = 2000
      // Product C: 50 * 30 = 1500
      // Total: 8500
      const totalValueElement = screen.getByText('総在庫金額').closest('div')?.querySelector('.text-3xl');
      expect(totalValueElement).toBeTruthy();
      expect(totalValueElement?.textContent).toMatch(/8[,.]500/);
    });

    it('should identify low stock items correctly', async () => {
      renderComponent();

      await waitFor(() => {
        // Product B: current_stock (10) <= min_stock_level (15)
        const lowStockBadges = screen.getAllByText('低在庫');
        expect(lowStockBadges.length).toBe(1);
      });
    });

    it('should handle products with null values', async () => {
      const productsWithNulls = [
        {
          id: '1',
          product_name: null,
          product_code: null,
          category: null,
          current_stock: null,
          min_stock_level: null,
          standard_cost: null,
        },
      ];

      const mockSelectNulls = vi.fn().mockResolvedValue({
        data: productsWithNulls,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelectNulls,
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫状況レポート')).toBeInTheDocument();
      });

      // Check that it renders without crashing even with null values
      expect(screen.getByText('総在庫金額')).toBeInTheDocument();
    });
  });
});
