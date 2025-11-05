import React, { memo, useCallback } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReportLayoutProps {
  title: string;
  description: string;
  onExport?: () => void;
  exportLabel?: string;
  children: React.ReactNode;
}

/**
 * Common layout component for all report pages
 * Provides consistent header with back button and export functionality
 * Memoized to prevent unnecessary re-renders
 */
export const ReportLayout = memo<ReportLayoutProps>(function ReportLayout({
  title,
  description,
  onExport,
  exportLabel = 'CSVエクスポート',
  children,
}) {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="戻る"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            {exportLabel}
          </button>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
});

export default ReportLayout;
