import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../test-utils';
import { ReportLayout } from '../../components/common/ReportLayout';
import { ReportFilters, DateRangeFilter, SelectFilter, CheckboxFilter } from '../../components/common/ReportFilters';
import { SummaryCard } from '../../components/common/SummaryCard';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Report Components Integration', () => {
  it('renders complete report page with all components', () => {
    const mockExport = vi.fn();
    const mockStartDateChange = vi.fn();
    const mockEndDateChange = vi.fn();
    const mockCategoryChange = vi.fn();
    const mockCheckboxChange = vi.fn();

    renderWithRouter(
      <ReportLayout
        title="支払履歴レポート"
        description="期間別の支払状況を確認できます"
        onExport={mockExport}
      >
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            title="総支払額"
            value="¥1,234,567"
            icon={DollarSign}
            colorFrom="from-blue-500"
            colorTo="to-blue-600"
          />
          <SummaryCard
            title="支払件数"
            value={42}
            icon={TrendingUp}
            colorFrom="from-green-500"
            colorTo="to-green-600"
          />
          <SummaryCard
            title="平均支払額"
            value="¥29,395"
            icon={Calendar}
            colorFrom="from-purple-500"
            colorTo="to-purple-600"
          />
        </div>

        {/* Filters */}
        <ReportFilters>
          <DateRangeFilter
            startDate="2024-01-01"
            endDate="2024-01-31"
            onStartDateChange={mockStartDateChange}
            onEndDateChange={mockEndDateChange}
          />
          <SelectFilter
            label="カテゴリ"
            value=""
            onChange={mockCategoryChange}
            options={[
              { value: '1', label: 'カテゴリ1' },
              { value: '2', label: 'カテゴリ2' },
            ]}
          />
          <CheckboxFilter
            label="完了のみ表示"
            checked={false}
            onChange={mockCheckboxChange}
          />
        </ReportFilters>

        {/* Content */}
        <div className="mt-6 bg-white p-6 rounded-lg">
          <p>Report content here</p>
        </div>
      </ReportLayout>
    );

    // Verify all components are rendered
    expect(screen.getByText('支払履歴レポート')).toBeInTheDocument();
    expect(screen.getByText('期間別の支払状況を確認できます')).toBeInTheDocument();
    expect(screen.getByText('CSVエクスポート')).toBeInTheDocument();
    expect(screen.getByText('総支払額')).toBeInTheDocument();
    expect(screen.getByText('¥1,234,567')).toBeInTheDocument();
    expect(screen.getByText('支払件数')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('開始日')).toBeInTheDocument();
    expect(screen.getByText('終了日')).toBeInTheDocument();
    expect(screen.getByText('カテゴリ')).toBeInTheDocument();
    expect(screen.getByText('完了のみ表示')).toBeInTheDocument();
  });

  it('handles user interactions across multiple components', async () => {
    const mockExport = vi.fn();
    const mockStartDateChange = vi.fn();
    const mockEndDateChange = vi.fn();
    const mockCategoryChange = vi.fn();
    const mockCheckboxChange = vi.fn();

    const { container } = renderWithRouter(
      <ReportLayout
        title="テストレポート"
        description="テスト"
        onExport={mockExport}
      >
        <ReportFilters>
          <DateRangeFilter
            startDate="2024-01-01"
            endDate="2024-01-31"
            onStartDateChange={mockStartDateChange}
            onEndDateChange={mockEndDateChange}
          />
          <SelectFilter
            label="カテゴリ"
            value=""
            onChange={mockCategoryChange}
            options={[{ value: '1', label: 'カテゴリ1' }]}
          />
          <CheckboxFilter
            label="完了のみ"
            checked={false}
            onChange={mockCheckboxChange}
          />
        </ReportFilters>
      </ReportLayout>
    );

    // Interact with date filter
    const startDateInput = screen.getByDisplayValue('2024-01-01');
    fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });
    expect(mockStartDateChange).toHaveBeenCalledWith('2024-02-01');

    // Interact with select filter
    const select = container.querySelector('select');
    if (select) {
      fireEvent.change(select, { target: { value: '1' } });
    }
    expect(mockCategoryChange).toHaveBeenCalledWith('1');

    // Interact with checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockCheckboxChange).toHaveBeenCalledWith(true);

    // Click export button
    const exportButton = screen.getByText('CSVエクスポート');
    fireEvent.click(exportButton);
    expect(mockExport).toHaveBeenCalled();

    // Click back button
    const backButton = screen.getByRole('button', { name: /戻る/i });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('maintains state consistency across filter interactions', () => {
    const mockStartDateChange = vi.fn();
    const mockEndDateChange = vi.fn();

    const TestComponent = () => {
      const [startDate, setStartDate] = React.useState('2024-01-01');
      const [endDate, setEndDate] = React.useState('2024-01-31');

      return (
        <ReportLayout title="テスト" description="テスト">
          <ReportFilters>
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(date) => {
                setStartDate(date);
                mockStartDateChange(date);
              }}
              onEndDateChange={(date) => {
                setEndDate(date);
                mockEndDateChange(date);
              }}
            />
          </ReportFilters>
          <div data-testid="date-display">
            {startDate} to {endDate}
          </div>
        </ReportLayout>
      );
    };

    const { rerender } = renderWithRouter(<TestComponent />);

    const startInput = screen.getByDisplayValue('2024-01-01');
    fireEvent.change(startInput, { target: { value: '2024-02-01' } });

    expect(mockStartDateChange).toHaveBeenCalledWith('2024-02-01');
  });

  it('handles multiple summary cards with different configurations', () => {
    renderWithRouter(
      <ReportLayout title="テスト" description="テスト">
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard
            title="金額1"
            value="¥100,000"
            icon={DollarSign}
            colorFrom="from-blue-500"
            colorTo="to-blue-600"
          />
          <SummaryCard
            title="金額2"
            value="¥200,000"
            icon={DollarSign}
            colorFrom="from-green-500"
            colorTo="to-green-600"
            textColor="text-gray-900"
          />
          <SummaryCard
            title="金額3"
            value="¥300,000"
            icon={DollarSign}
            colorFrom="from-purple-500"
            colorTo="to-purple-600"
            iconColor="text-yellow-500"
          />
          <SummaryCard
            title="件数"
            value={999}
            icon={TrendingUp}
            colorFrom="from-red-500"
            colorTo="to-red-600"
          />
        </div>
      </ReportLayout>
    );

    expect(screen.getByText('金額1')).toBeInTheDocument();
    expect(screen.getByText('¥100,000')).toBeInTheDocument();
    expect(screen.getByText('金額2')).toBeInTheDocument();
    expect(screen.getByText('¥200,000')).toBeInTheDocument();
    expect(screen.getByText('金額3')).toBeInTheDocument();
    expect(screen.getByText('¥300,000')).toBeInTheDocument();
    expect(screen.getByText('件数')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('renders filters with various column layouts', () => {
    const { rerender } = renderWithRouter(
      <ReportFilters columns={2}>
        <div data-testid="filter-1">Filter 1</div>
        <div data-testid="filter-2">Filter 2</div>
      </ReportFilters>
    );

    let grid = document.querySelector('.md\\:grid-cols-2');
    expect(grid).toBeInTheDocument();

    rerender(
      <ReportFilters columns={3}>
        <div data-testid="filter-1">Filter 1</div>
        <div data-testid="filter-2">Filter 2</div>
      </ReportFilters>
    );

    grid = document.querySelector('.md\\:grid-cols-3');
    expect(grid).toBeInTheDocument();

    rerender(
      <ReportFilters columns={4}>
        <div data-testid="filter-1">Filter 1</div>
        <div data-testid="filter-2">Filter 2</div>
      </ReportFilters>
    );

    grid = document.querySelector('.md\\:grid-cols-4');
    expect(grid).toBeInTheDocument();
  });

  it('handles navigation and export actions in sequence', async () => {
    const mockExport = vi.fn().mockResolvedValue(undefined);

    renderWithRouter(
      <ReportLayout title="テスト" description="テスト" onExport={mockExport}>
        <div>Content</div>
      </ReportLayout>
    );

    // First export
    const exportButton = screen.getByText('CSVエクスポート');
    fireEvent.click(exportButton);
    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(1));

    // Second export
    fireEvent.click(exportButton);
    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(2));

    // Navigate back
    const backButton = screen.getByRole('button', { name: /戻る/i });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
