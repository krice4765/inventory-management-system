import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DateRangeFilter,
  SelectFilter,
  CheckboxFilter,
  ReportFilters,
} from './ReportFilters';

describe('DateRangeFilter', () => {
  it('renders with default labels', () => {
    const mockStartChange = vi.fn();
    const mockEndChange = vi.fn();

    render(
      <DateRangeFilter
        startDate="2024-01-01"
        endDate="2024-01-31"
        onStartDateChange={mockStartChange}
        onEndDateChange={mockEndChange}
      />
    );

    expect(screen.getByText('開始日')).toBeInTheDocument();
    expect(screen.getByText('終了日')).toBeInTheDocument();
  });

  it('renders with custom labels', () => {
    const mockStartChange = vi.fn();
    const mockEndChange = vi.fn();

    render(
      <DateRangeFilter
        startDate="2024-01-01"
        endDate="2024-01-31"
        onStartDateChange={mockStartChange}
        onEndDateChange={mockEndChange}
        startLabel="開始"
        endLabel="終了"
      />
    );

    expect(screen.getByText('開始')).toBeInTheDocument();
    expect(screen.getByText('終了')).toBeInTheDocument();
  });

  it('displays current date values', () => {
    const mockStartChange = vi.fn();
    const mockEndChange = vi.fn();

    render(
      <DateRangeFilter
        startDate="2024-01-01"
        endDate="2024-01-31"
        onStartDateChange={mockStartChange}
        onEndDateChange={mockEndChange}
      />
    );

    const inputs = screen.getAllByDisplayValue(/2024-01/);
    expect(inputs).toHaveLength(2);
  });

  it('calls onStartDateChange when start date is changed', () => {
    const mockStartChange = vi.fn();
    const mockEndChange = vi.fn();

    render(
      <DateRangeFilter
        startDate="2024-01-01"
        endDate="2024-01-31"
        onStartDateChange={mockStartChange}
        onEndDateChange={mockEndChange}
      />
    );

    const startInput = screen.getByDisplayValue('2024-01-01');
    fireEvent.change(startInput, { target: { value: '2024-02-01' } });

    expect(mockStartChange).toHaveBeenCalledWith('2024-02-01');
  });

  it('calls onEndDateChange when end date is changed', () => {
    const mockStartChange = vi.fn();
    const mockEndChange = vi.fn();

    render(
      <DateRangeFilter
        startDate="2024-01-01"
        endDate="2024-01-31"
        onStartDateChange={mockStartChange}
        onEndDateChange={mockEndChange}
      />
    );

    const endInput = screen.getByDisplayValue('2024-01-31');
    fireEvent.change(endInput, { target: { value: '2024-02-28' } });

    expect(mockEndChange).toHaveBeenCalledWith('2024-02-28');
  });
});

describe('SelectFilter', () => {
  const mockOptions = [
    { value: '1', label: 'オプション1' },
    { value: '2', label: 'オプション2' },
    { value: '3', label: 'オプション3' },
  ];

  it('renders with label and default placeholder', () => {
    const mockChange = vi.fn();

    render(
      <SelectFilter
        label="カテゴリ"
        value=""
        onChange={mockChange}
        options={mockOptions}
      />
    );

    expect(screen.getByText('カテゴリ')).toBeInTheDocument();
    expect(screen.getByText('すべて')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const mockChange = vi.fn();

    render(
      <SelectFilter
        label="カテゴリ"
        value=""
        onChange={mockChange}
        options={mockOptions}
        placeholder="選択してください"
      />
    );

    expect(screen.getByText('選択してください')).toBeInTheDocument();
  });

  it('renders all options', () => {
    const mockChange = vi.fn();

    render(
      <SelectFilter
        label="カテゴリ"
        value=""
        onChange={mockChange}
        options={mockOptions}
      />
    );

    expect(screen.getByText('オプション1')).toBeInTheDocument();
    expect(screen.getByText('オプション2')).toBeInTheDocument();
    expect(screen.getByText('オプション3')).toBeInTheDocument();
  });

  it('displays selected value', () => {
    const mockChange = vi.fn();

    const { container } = render(
      <SelectFilter
        label="カテゴリ"
        value="2"
        onChange={mockChange}
        options={mockOptions}
      />
    );

    const select = container.querySelector('select');
    expect(select).toHaveValue('2');
  });

  it('calls onChange when selection changes', () => {
    const mockChange = vi.fn();

    const { container } = render(
      <SelectFilter
        label="カテゴリ"
        value=""
        onChange={mockChange}
        options={mockOptions}
      />
    );

    const select = container.querySelector('select');
    if (select) {
      fireEvent.change(select, { target: { value: '2' } });
    }

    expect(mockChange).toHaveBeenCalledWith('2');
  });
});

describe('CheckboxFilter', () => {
  it('renders with label', () => {
    const mockChange = vi.fn();

    render(
      <CheckboxFilter label="完了のみ表示" checked={false} onChange={mockChange} />
    );

    expect(screen.getByText('完了のみ表示')).toBeInTheDocument();
  });

  it('displays checked state correctly', () => {
    const mockChange = vi.fn();

    render(
      <CheckboxFilter label="完了のみ表示" checked={true} onChange={mockChange} />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('displays unchecked state correctly', () => {
    const mockChange = vi.fn();

    render(
      <CheckboxFilter label="完了のみ表示" checked={false} onChange={mockChange} />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('calls onChange when checkbox is clicked', () => {
    const mockChange = vi.fn();

    render(
      <CheckboxFilter label="完了のみ表示" checked={false} onChange={mockChange} />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockChange).toHaveBeenCalledWith(true);
  });

  it('toggles checked state', () => {
    const mockChange = vi.fn();

    render(
      <CheckboxFilter label="完了のみ表示" checked={true} onChange={mockChange} />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockChange).toHaveBeenCalledWith(false);
  });
});

describe('ReportFilters', () => {
  it('renders children content', () => {
    render(
      <ReportFilters>
        <div data-testid="filter-1">Filter 1</div>
        <div data-testid="filter-2">Filter 2</div>
      </ReportFilters>
    );

    expect(screen.getByTestId('filter-1')).toBeInTheDocument();
    expect(screen.getByTestId('filter-2')).toBeInTheDocument();
  });

  it('applies default 3-column grid layout', () => {
    const { container } = render(
      <ReportFilters>
        <div>Filter 1</div>
      </ReportFilters>
    );

    const grid = container.querySelector('.md\\:grid-cols-3');
    expect(grid).toBeInTheDocument();
  });

  it('applies 2-column grid layout when specified', () => {
    const { container } = render(
      <ReportFilters columns={2}>
        <div>Filter 1</div>
      </ReportFilters>
    );

    const grid = container.querySelector('.md\\:grid-cols-2');
    expect(grid).toBeInTheDocument();
  });

  it('applies 4-column grid layout when specified', () => {
    const { container } = render(
      <ReportFilters columns={4}>
        <div>Filter 1</div>
      </ReportFilters>
    );

    const grid = container.querySelector('.md\\:grid-cols-4');
    expect(grid).toBeInTheDocument();
  });

  it('maintains proper container styling', () => {
    const { container } = render(
      <ReportFilters>
        <div>Filter 1</div>
      </ReportFilters>
    );

    const filterContainer = container.querySelector('.bg-white.p-4.rounded-lg');
    expect(filterContainer).toBeInTheDocument();
  });

  it('integrates all filter components together', () => {
    const mockDateChange = vi.fn();
    const mockSelectChange = vi.fn();
    const mockCheckChange = vi.fn();

    render(
      <ReportFilters>
        <DateRangeFilter
          startDate="2024-01-01"
          endDate="2024-01-31"
          onStartDateChange={mockDateChange}
          onEndDateChange={mockDateChange}
        />
        <SelectFilter
          label="カテゴリ"
          value=""
          onChange={mockSelectChange}
          options={[{ value: '1', label: 'オプション1' }]}
        />
        <CheckboxFilter
          label="完了のみ"
          checked={false}
          onChange={mockCheckChange}
        />
      </ReportFilters>
    );

    expect(screen.getByText('開始日')).toBeInTheDocument();
    expect(screen.getByText('カテゴリ')).toBeInTheDocument();
    expect(screen.getByText('完了のみ')).toBeInTheDocument();
  });
});
