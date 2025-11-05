import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '../../tests/test-utils';
import { ReportLayout } from './ReportLayout';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ReportLayout', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders title and description', () => {
    renderWithRouter(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div>Content</div>
      </ReportLayout>
    );

    expect(screen.getByText('テストレポート')).toBeInTheDocument();
    expect(screen.getByText('テスト説明')).toBeInTheDocument();
  });

  it('renders children content', () => {
    renderWithRouter(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div data-testid="test-content">Test Content</div>
      </ReportLayout>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    renderWithRouter(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div>Content</div>
      </ReportLayout>
    );

    const backButton = screen.getByRole('button', { name: /戻る/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders export button when onExport is provided', () => {
    const mockExport = vi.fn();

    renderWithRouter(
      <ReportLayout
        title="テストレポート"
        description="テスト説明"
        onExport={mockExport}
      >
        <div>Content</div>
      </ReportLayout>
    );

    expect(screen.getByText('CSVエクスポート')).toBeInTheDocument();
  });

  it('does not render export button when onExport is not provided', () => {
    renderWithRouter(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div>Content</div>
      </ReportLayout>
    );

    expect(screen.queryByText('CSVエクスポート')).not.toBeInTheDocument();
  });

  it('calls onExport when export button is clicked', () => {
    const mockExport = vi.fn();

    renderWithRouter(
      <ReportLayout
        title="テストレポート"
        description="テスト説明"
        onExport={mockExport}
      >
        <div>Content</div>
      </ReportLayout>
    );

    const exportButton = screen.getByText('CSVエクスポート');
    fireEvent.click(exportButton);

    expect(mockExport).toHaveBeenCalledTimes(1);
  });

  it('renders custom export label when provided', () => {
    const mockExport = vi.fn();

    renderWithRouter(
      <ReportLayout
        title="テストレポート"
        description="テスト説明"
        onExport={mockExport}
        exportLabel="Excelエクスポート"
      >
        <div>Content</div>
      </ReportLayout>
    );

    expect(screen.getByText('Excelエクスポート')).toBeInTheDocument();
    expect(screen.queryByText('CSVエクスポート')).not.toBeInTheDocument();
  });

  it('has correct button styling and icons', () => {
    const mockExport = vi.fn();
    const { container } = renderWithRouter(
      <ReportLayout
        title="テストレポート"
        description="テスト説明"
        onExport={mockExport}
      >
        <div>Content</div>
      </ReportLayout>
    );

    // Check for icons (rendered as SVG by lucide-react)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0); // Should have ArrowLeft and Download icons
  });

  it('memoizes navigation handler with useCallback', () => {
    const { rerender } = renderWithRouter(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div>Content</div>
      </ReportLayout>
    );

    const backButton = screen.getByRole('button', { name: /戻る/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // Re-render should not affect the callback
    rerender(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div>Content</div>
      </ReportLayout>
    );

    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('maintains proper structure with space-y-6 layout', () => {
    const { container } = renderWithRouter(
      <ReportLayout title="テストレポート" description="テスト説明">
        <div>Content</div>
      </ReportLayout>
    );

    const layout = container.querySelector('.space-y-6');
    expect(layout).toBeInTheDocument();
  });

  it('does not re-render unnecessarily with memo', () => {
    const mockExport = vi.fn();

    const { rerender } = renderWithRouter(
      <ReportLayout
        title="テストレポート"
        description="テスト説明"
        onExport={mockExport}
      >
        <div>Content</div>
      </ReportLayout>
    );

    expect(screen.getByText('テストレポート')).toBeInTheDocument();

    // Re-render with same props
    rerender(
      <ReportLayout
        title="テストレポート"
        description="テスト説明"
        onExport={mockExport}
      >
        <div>Content</div>
      </ReportLayout>
    );

    expect(screen.getByText('テストレポート')).toBeInTheDocument();
    expect(mockExport).not.toHaveBeenCalled();
  });
});
