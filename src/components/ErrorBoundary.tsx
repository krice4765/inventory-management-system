import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Bug, ExternalLink } from 'lucide-react';
import { errorHandler, StructuredError } from '../utils/enhancedErrorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  structuredError?: StructuredError;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const componentName = this.props.componentName || 'ErrorBoundary';

    // 強化エラーハンドラーを使用
    const structuredError = errorHandler.handleError(error, {
      component: componentName,
      action: 'Component Render Error',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });

    this.setState({ structuredError });
    console.error(`${componentName} caught an error:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      structuredError: undefined,
      showDetails: false
    });
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  private getSeverityColor(severity?: string): string {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { structuredError } = this.state;

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-2xl w-full">
            {/* エラーヘッダー */}
            <div className="flex items-center mb-6">
              <div className={`p-3 rounded-full ${
                structuredError?.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/20' :
                structuredError?.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/20' :
                'bg-gray-100 dark:bg-gray-700'
              }`}>
                <AlertCircle className={`w-8 h-8 ${
                  structuredError?.severity === 'critical' ? 'text-red-600 dark:text-red-400' :
                  structuredError?.severity === 'high' ? 'text-orange-600 dark:text-orange-400' :
                  'text-gray-600 dark:text-gray-400'
                }`} />
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  コンポーネントエラー
                </h2>
                {structuredError && (
                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
                    this.getSeverityColor(structuredError.severity)
                  }`}>
                    重要度: {structuredError.severity?.toUpperCase()} | カテゴリ: {structuredError.category}
                  </div>
                )}
              </div>
            </div>

            {/* ユーザーメッセージ */}
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">
                {structuredError?.userMessage ||
                 'ページの読み込み中にエラーが発生しました。もう一度お試しください。'}
              </p>

              {/* 回復手順 */}
              {structuredError?.recoveryActions && structuredError.recoveryActions.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    推奨される対処法:
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                    {structuredError.recoveryActions.map((action, index) => (
                      <li key={index} className="text-sm">{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* エラー詳細の切り替え */}
            {structuredError && (
              <div className="mb-6">
                <button
                  onClick={this.toggleDetails}
                  className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <Bug className="w-4 h-4 mr-2" />
                  {this.state.showDetails ? 'エラー詳細を隠す' : 'エラー詳細を表示'}
                </button>

                {this.state.showDetails && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          エラーID
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white font-mono">{structuredError.id}</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          コンポーネント
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">{structuredError.context.component}</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          発生時刻
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {new Date(structuredError.timestamp).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          エラーメッセージ
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                          {structuredError.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                再試行
              </button>

              {structuredError?.severity === 'critical' && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="inline-flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-semibold"
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  ホームに戻る
                </button>
              )}
            </div>

            {/* システム管理者向け情報 */}
            {structuredError?.severity === 'critical' && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  この問題が継続する場合は、エラーID「{structuredError.id}」を
                  システム管理者にお知らせください。
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;