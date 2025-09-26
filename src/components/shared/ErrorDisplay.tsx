/**
 * 統一エラー表示コンポーネント
 * ユーザーフレンドリーなエラーメッセージ表示
 */

import React, { useState } from 'react';
import { 
  UserFriendlyError, 
  formatP0001Context, 
  createErrorReport,
  ErrorDisplayProps 
} from '../../utils/error-handler';

/**
 * エラーアイコンの取得
 */
const getErrorIcon = (severity: 'error' | 'warning' | 'info') => {
  switch (severity) {
    case 'error':
      return '🚨';
    case 'warning':
      return '⚠️';
    case 'info':
      return '💡';
    default:
      return '❓';
  }
};

/**
 * エラー表示メインコンポーネント
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showTechnicalDetails = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // エラー色の決定
      const getBgColor = (severity: string) => { switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

      const getTextColor = (severity: string) => { switch (severity) {
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

      const getButtonColor = (severity: string) => { switch (severity) {
      case 'error':
      return 'bg-red-600 hover: bg-red-700 text-white'; case 'warning':
      return 'bg-yellow-600 hover: bg-yellow-700 text-white'; case 'info':
      return 'bg-blue-600 hover: bg-blue-700 text-white'; default:
      return 'bg-gray-600 hover: bg-gray-700 text-white'; }
  };

  // エラーレポート送信
  const handleSendReport = async () => {
    try {
      const { errorId: _errorId, reportData } = createErrorReport(error);
      
      // 実際の実装では、ここでエラーレポートをサーバーに送信
      
      setReportSent(true);
      setTimeout(() => setReportSent(false), 3000);
    } catch (err) {
      console.error('Failed to send error report:', err);
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getBgColor(error.severity)}`}>
      {/* ヘッダー部分 */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">
            {getErrorIcon(error.severity)}
          </div>
          <div className="flex-1">
            <h3 className={`font-medium ${getTextColor(error.severity)}`}>
              {error.title}
            </h3>
            <p className={`mt-1 text-sm ${getTextColor(error.severity)}`}>
              {error.message}
            </p>
            
            {/* P0001エラー専用のコンテキスト情報 */}
            {error.code === 'P0001' && error.context && (
              <div className="mt-2 text-sm font-mono bg-white/50 rounded px-2 py-1">
                {formatP0001Context(error.context)}
              </div>
            )}
            
            {/* ユーザーアクション */}
            {error.action && (
              <div className="mt-2 text-sm font-medium">
                💡 {error.action}
              </div>
            )}
          </div>
        </div>
        
        {/* 閉じるボタン */}
        {onDismiss && (
          <button
            onClick={onDismiss}
      className="text-gray-400 hover: text-gray-600"aria-label="エラーメッセージを閉じる"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      
      {/* アクションボタン */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* 再試行ボタン */}
        {onRetry && error.userFixable && (
          <button
            onClick={onRetry}
            className={`px-4 py-2 rounded-md text-sm font-medium ${getButtonColor(error.severity)}`}
          >
            再試行
          </button>
        )}
        
        {/* 詳細表示ボタン */}
        {showTechnicalDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
      className="px-4 py-2 bg-gray-200 hover: bg-gray-300 text-gray-700 rounded-md text-sm font-medium">
            {isExpanded ? '詳細を隠す' : '詳細を表示'}
          </button>
        )}
        
        {/* エラーレポート送信ボタン */}
        {!error.userFixable && (
          <button
            onClick={handleSendReport}
            disabled={reportSent}
      className="px-4 py-2 bg-gray-600 hover: bg-gray-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium">
            {reportSent ? '送信済み ✓' : 'レポート送信'}
          </button>
        )}
      </div>
      
      {/* 技術詳細の展開表示 */}
      {isExpanded && showTechnicalDetails && (
        <div className="mt-4 border-t pt-4">
          <details>
            <summary className="cursor-pointer font-medium text-sm mb-2">
              技術詳細情報
            </summary>
            <div className="bg-gray-100 rounded p-3 text-xs font-mono">
              <div><strong>エラーコード:</strong> {error.code}</div>
              <div><strong>発生時刻:</strong> {error.timestamp.toLocaleString()}</div>
              {error.context && (
                <div>
      <strong>コンテキスト: </strong> <pre className="mt-1 overflow-x-auto">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              )}
              {error.originalError && (
                <div>
      <strong>元のエラー: </strong> <pre className="mt-1 overflow-x-auto">
                    {JSON.stringify({
                      name: (error.originalError as Record<string, unknown>)?.name,
                      message: (error.originalError as Record<string, unknown>)?.message,
                      code: (error.originalError as Record<string, unknown>)?.code
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

/**
 * シンプルなエラー表示コンポーネント（トースト用）
 */
export const ErrorToast: React.FC<{
      error: UserFriendlyError; onDismiss?: () => void; }> = ({ error, onDismiss }) => {
  return (
    <div className={`flex items-center p-3 rounded-lg shadow-lg ${getBgColor(error.severity)}`}>
      <div className="text-lg mr-3">
        {getErrorIcon(error.severity)}
      </div>
      <div className="flex-1">
        <div className={`font-medium ${getTextColor(error.severity)}`}>
          {error.title}
        </div>
        {error.code === 'P0001' && error.context && (
          <div className="text-xs mt-1 opacity-75">
            {formatP0001Context(error.context)}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
      className="ml-3 text-gray-400 hover: text-gray-600">
          ×
        </button>
      )}
    </div>
  );
};

/**
 * エラー境界コンポーネント（React Error Boundary）
 */
interface ErrorBoundaryState {
      hasError: boolean; error: UserFriendlyError | null; }

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{
      fallback?: (error: UserFriendlyError) => React.ReactNode; onError?: (error: UserFriendlyError) => void; }>,
  ErrorBoundaryState
> {
      constructor(props: React.PropsWithChildren<{ fallback?: (error: UserFriendlyError) => React.ReactNode; onError?: (error: UserFriendlyError) => void; }>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

      static getDerivedStateFromError(error: Error): ErrorBoundaryState { // Import error handler dynamically to avoid circular dependencies
    const { convertToUserFriendlyError } = require('../../utils/error-handler');
    const userError = convertToUserFriendlyError(error);
    
    return {
      hasError: true,
      error: userError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // エラー報告
    if (this.props.onError && this.state.error) {
      this.props.onError(this.state.error);
    }
    
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      
      return (
        <ErrorDisplay
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
          showTechnicalDetails={import.meta.env.DEV}
        />
      );
    }

    return this.props.children;
  }
}

// ヘルパー関数（重複を避けるため関数として定義）
function getBgColor(severity: string) {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

function getTextColor(severity: string) {
  switch (severity) {
    case 'error':
      return 'text-red-800';
    case 'warning':
      return 'text-yellow-800';
    case 'info':
      return 'text-blue-800';
    default:
      return 'text-gray-800';
  }
}