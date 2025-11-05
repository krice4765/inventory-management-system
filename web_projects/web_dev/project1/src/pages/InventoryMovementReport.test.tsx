import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import InventoryMovementReport from './InventoryMovementReport';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

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
    toast,
    default: toast,
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

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
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

describe('InventoryMovementReport', () => {
  const mockMovements = [
    {
      id: '1',
      transaction_date: '2024-01-15T10:00:00Z',
      product_id: 'prod-1',
      transaction_type: 'in',
      quantity: 100,
      reference_type: 'purchase_order',
      reference_id: 'PO-001',
      notes: 'Bulk purchase',
      products: {
        id: 'prod-1',
        name: 'Product A',
        product_code: 'PA001',
      },
    },
    {
      id: '2',
      transaction_date: '2024-01-16T10:00:00Z',
      product_id: 'prod-2',
      transaction_type: 'out',
      quantity: -50,
      reference_type: 'sales_order',
      reference_id: 'SO-001',
      notes: null,
      products: {
        id: 'prod-2',
        name: 'Product B',
        product_code: 'PB002',
      },
    },
    {
      id: '3',
      transaction_date: '2024-01-17T10:00:00Z',
      product_id: 'prod-1',
      transaction_type: 'adjustment',
      quantity: 10,
      reference_type: null,
      reference_id: null,
      notes: 'Stock count adjustment',
      products: {
        id: 'prod-1',
        name: 'Product A',
        product_code: 'PA001',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    const mockOrder = vi.fn().mockResolvedValue({
      data: mockMovements,
      error: null,
    });

    const mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
    });

    const mockLte = vi.fn().mockReturnValue({
      eq: mockEq,
      order: mockOrder,
    });

    const mockGte = vi.fn().mockReturnValue({
      lte: mockLte,
      eq: mockEq,
      order: mockOrder,
    });

    const mockSelect = vi.fn().mockReturnValue({
      gte: mockGte,
      lte: mockLte,
      eq: mockEq,
      order: mockOrder,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <InventoryMovementReport />
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫移動履歴レポート')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('入出庫履歴と商品別移動の分析')).toBeInTheDocument();
      });
    });

    it('should fetch inventory movements on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('inventory_transactions');
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total inbound quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Movement 1: in = 100, Movement 3: adjustment = 10 (not counted in inbound)
      // Only transaction_type === 'in' is counted
      const inboundElement = screen.getByText('総入庫数').closest('div')?.querySelector('.text-3xl');
      expect(inboundElement).toBeTruthy();
      expect(inboundElement?.textContent).toBe('100');
    });

    it('should display total outbound quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総出庫数')).toBeInTheDocument();
      });

      // Movement 2: out = 50 (Math.abs(-50))
      const outboundElement = screen.getByText('総出庫数').closest('div')?.querySelector('.text-3xl');
      expect(outboundElement).toBeTruthy();
      expect(outboundElement?.textContent).toBe('50');
    });

    it('should display total adjustment quantity', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('調整数')).toBeInTheDocument();
      });

      // Movement 3: adjustment = 10
      const adjustmentElement = screen.getByText('調整数').closest('div')?.querySelector('.text-3xl');
      expect(adjustmentElement).toBeTruthy();
      expect(adjustmentElement?.textContent).toBe('10');
    });
  });

  describe('Date Filters', () => {
    it('should display start date filter', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('開始日')).toBeInTheDocument();
      const dateInputs = screen.getAllByDisplayValue('');
      expect(dateInputs.length).toBeGreaterThan(0);
    });

    it('should display end date filter', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('終了日')).toBeInTheDocument();
    });

    it('should filter by date range when dates are set', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      const startDateInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement;
      const endDateInput = screen.getAllByDisplayValue('')[1] as HTMLInputElement;

      vi.clearAllMocks();

      const mockGte = vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [mockMovements[0]],
            error: null,
          }),
        }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        gte: mockGte,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      fireEvent.change(startDateInput, { target: { value: '2024-01-15' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-16' } });

      await waitFor(() => {
        expect(mockGte).toHaveBeenCalled();
      });
    });
  });

  describe('Product Filter', () => {
    it('should display product dropdown', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // 商品 appears in both filter label and table header
      const productElements = screen.getAllByText('商品');
      expect(productElements.length).toBeGreaterThan(0);

      expect(screen.getByText('すべての商品')).toBeInTheDocument();
    });

    it('should populate product dropdown with unique products', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Should display unique products from movements
      expect(screen.getByText(/PA001 - Product A/)).toBeInTheDocument();
      expect(screen.getByText(/PB002 - Product B/)).toBeInTheDocument();
    });
  });

  describe('Transaction Type Filter', () => {
    it('should display transaction type dropdown', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      const transactionTypeElements = screen.getAllByText('取引区分');
      expect(transactionTypeElements.length).toBeGreaterThan(0);

      expect(screen.getByText('すべての区分')).toBeInTheDocument();
    });

    it('should display transaction type options', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // 入庫 appears in both dropdown and table
      const inboundElements = screen.getAllByText('入庫');
      expect(inboundElements.length).toBeGreaterThan(0);

      const outboundElements = screen.getAllByText('出庫');
      expect(outboundElements.length).toBeGreaterThan(0);

      const adjustmentElements = screen.getAllByText('調整');
      expect(adjustmentElements.length).toBeGreaterThan(0);
    });
  });

  describe('Charts', () => {
    it('should display daily movement trend chart', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('日次入出庫推移（直近30日）')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    it('should display transaction type distribution chart', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('取引区分別構成比')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });

    it('should show no data message when charts have no data', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      renderComponent();

      await waitFor(() => {
        const noDataMessages = screen.getAllByText('データがありません');
        expect(noDataMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Transaction Type Summary Table', () => {
    it('should display summary table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('取引区分別集計')).toBeInTheDocument();

      const quantityHeaders = screen.getAllByText('数量');
      expect(quantityHeaders.length).toBeGreaterThan(0);

      expect(screen.getByText('構成比')).toBeInTheDocument();
    });

    it('should display summary data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Transaction types should be displayed with Japanese labels
      await waitFor(() => {
        const inboundElements = screen.getAllByText('入庫');
        expect(inboundElements.length).toBeGreaterThan(0);
      });
    });

    it('should calculate percentages correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Percentages should be displayed
      await waitFor(() => {
        const percentageElements = screen.getAllByText(/\d+\.\d%/);
        expect(percentageElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Movement History Table', () => {
    it('should display movement history table headers', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('在庫移動履歴')).toBeInTheDocument();
      expect(screen.getByText('取引日')).toBeInTheDocument();

      const productHeaders = screen.getAllByText('商品');
      expect(productHeaders.length).toBeGreaterThan(0);

      expect(screen.getByText('参照')).toBeInTheDocument();
      expect(screen.getByText('備考')).toBeInTheDocument();
    });

    it('should display movement data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Products should be displayed (Product A appears twice in movements)
      const productAElements = screen.getAllByText('Product A');
      expect(productAElements.length).toBeGreaterThan(0);

      expect(screen.getByText('Product B')).toBeInTheDocument();

      // Product codes should be displayed (PA001 appears twice)
      const pa001Elements = screen.getAllByText('PA001');
      expect(pa001Elements.length).toBeGreaterThan(0);

      expect(screen.getByText('PB002')).toBeInTheDocument();
    });

    it('should display reference information', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('purchase_order')).toBeInTheDocument();
      expect(screen.getByText('sales_order')).toBeInTheDocument();
    });

    it('should display notes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('Bulk purchase')).toBeInTheDocument();
      expect(screen.getByText('Stock count adjustment')).toBeInTheDocument();
    });

    it('should display dash for empty reference and notes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Should display "-" for null/undefined values
      const dashElements = screen.getAllByText('-');
      expect(dashElements.length).toBeGreaterThan(0);
    });

    it('should display empty state when no movements', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫移動データがありません')).toBeInTheDocument();
      });
    });
  });

  describe('CSV Export', () => {
    it('should display export button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      expect(screen.getByText('CSVエクスポート')).toBeInTheDocument();
    });

    it('should export data to CSV when button clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('CSVエクスポート');
      fireEvent.click(exportButton);

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('CSVファイルをダウンロードしました');
    });
  });

  describe('Navigation', () => {
    it('should display back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: '' });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      const mockError = { message: 'Database error' };
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('在庫移動データの取得に失敗しました');
      });
    });
  });

  describe('Data Calculations', () => {
    it('should calculate summaries correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('総入庫数')).toBeInTheDocument();
      });

      // Inbound: 100 (only 'in' type)
      const inboundElement = screen.getByText('総入庫数').closest('div')?.querySelector('.text-3xl');
      expect(inboundElement).toBeTruthy();
      expect(inboundElement?.textContent).toBe('100');

      // Outbound: 50 (Math.abs of 'out' type)
      const outboundElement = screen.getByText('総出庫数').closest('div')?.querySelector('.text-3xl');
      expect(outboundElement).toBeTruthy();
      expect(outboundElement?.textContent).toBe('50');

      // Adjustment: 10 (only 'adjustment' type)
      const adjustmentElement = screen.getByText('調整数').closest('div')?.querySelector('.text-3xl');
      expect(adjustmentElement).toBeTruthy();
      expect(adjustmentElement?.textContent).toBe('10');
    });

    it('should handle products with null values', async () => {
      const movementsWithNulls = [
        {
          id: '1',
          transaction_date: '2024-01-15T10:00:00Z',
          product_id: 'prod-1',
          transaction_type: 'in',
          quantity: null,
          reference_type: null,
          reference_id: null,
          notes: null,
          products: null,
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({
        data: movementsWithNulls,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('在庫移動履歴レポート')).toBeInTheDocument();
      });

      // Should handle null products gracefully
      await waitFor(() => {
        expect(screen.getByText('不明')).toBeInTheDocument();
      });
    });
  });
});
