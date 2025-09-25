// システム整合性ダッシュボードコンポーネント
import React, { useState } from 'react';
import { useSystemIntegrity, useIntegritySummary, useIntegrityMonitoring } from '../hooks/useSystemIntegrity';
import {
  IntegrityCheckResult,
  IntegrityCheckSummary,
  IntegrityCheckCategory
} from '../types/integrity';
import { AlertTriangle, CheckCircle, Info, AlertCircle, Play, RefreshCw, Clock } from 'lucide-react';

interface IntegrityDashboardProps {
  className?: string;
  showDetailedResults?: boolean;
  enableMonitoring?: boolean;
  monitoringInterval?: number;
}

export const IntegrityDashboard: React.FC<IntegrityDashboardProps> = ({
  className = '',
  showDetailedResults = true,
  enableMonitoring = false,
  monitoringInterval = 30
}) => {
  const [selectedCategory, setSelectedCategory] = useState<IntegrityCheckCategory | null>(null);

  const {
    summary,
    results,
    isLoading,
    isRunning,
    progress,
    error,
    executeCheck,
    executeCategoryCheck,
    refreshData
  } = useSystemIntegrity();

  const { summary: monitoringSummary, isMonitoring } = useIntegrityMonitoring(
    enableMonitoring ? monitoringInterval : 0
  );

  const displaySummary = enableMonitoring && monitoringSummary ? monitoringSummary : summary;

  // 重要度別の結果をフィルタリング
  const criticalResults = results?.filter(r => r.severity === 'critical') || [];
  const warningResults = results?.filter(r => r.severity === 'warning') || [];
  const infoResults = results?.filter(r => r.severity === 'info') || [];
  const successResults = results?.filter(r => r.severity === 'success') || [];

  // カテゴリ別の結果をフィルタリング
  const categoryResults = selectedCategory
    ? results?.filter(r => r.category === selectedCategory) || []
    : results || [];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'needs_attention':
        return 'text-yellow-600 bg-yellow-100';
      case 'healthy':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const categoryNames: Record<IntegrityCheckCategory, string> = {
    financial: '金額計算',
    inventory: '在庫管理',
    delivery: '分納データ',
    reference: '参照整合性',
    business_rule: 'ビジネスルール',
    data_quality: 'データ品質'
  };

  if (isLoading && !displaySummary) {
    return (
      <div className={`${className} p-6`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-white rounded-lg shadow-sm border border-gray-200`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            システム整合性ダッシュボード
          </h2>
          <div className="flex items-center space-x-2">
            {enableMonitoring && isMonitoring && (
              <div className="flex items-center text-sm text-green-600">
                <Clock className="h-4 w-4 mr-1" />
                監視中
              </div>
            )}
            <button
              onClick={refreshData}
              disabled={isRunning}
              className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRunning ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button
              onClick={executeCheck}
              disabled={isRunning}
              className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4 mr-1" />
              完全チェック実行
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-6 py-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
              <p className="mt-1 text-sm text-red-700">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {displaySummary && (
        <div className="px-6 py-4">
          {/* 実行中プログレス */}
          {isRunning && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">整合性チェック実行中</h3>
                  <p className="text-sm text-blue-600">
                    {progress.currentCategory && `現在: ${categoryNames[progress.currentCategory]}`}
                    ({progress.completedCategories}/{progress.totalCategories} 完了)
                  </p>
                </div>
              </div>
              <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.completedCategories / progress.totalCategories) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg border ${getStatusColor(displaySummary.overall_status)}`}>
              <div className="flex items-center">
                {getSeverityIcon(displaySummary.overall_status)}
                <div className="ml-3">
                  <p className="text-sm font-medium">全体ステータス</p>
                  <p className="text-lg font-semibold">
                    {displaySummary.overall_status === 'healthy' && '健全'}
                    {displaySummary.overall_status === 'needs_attention' && '要注意'}
                    {displaySummary.overall_status === 'critical' && '緊急対応'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">緊急問題</p>
                  <p className="text-2xl font-bold text-red-900">{displaySummary.critical_issues}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-800">警告</p>
                  <p className="text-2xl font-bold text-yellow-900">{displaySummary.warning_issues}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">正常</p>
                  <p className="text-2xl font-bold text-green-900">{displaySummary.success_checks}</p>
                </div>
              </div>
            </div>
          </div>

          {/* メタ情報 */}
          <div className="text-sm text-gray-600 mb-6">
            <p>最終チェック: {new Date(displaySummary.last_check_at).toLocaleString('ja-JP')}</p>
            <p>実行時間: {displaySummary.execution_time_ms}ms</p>
            <p>総チェック数: {displaySummary.total_checks}</p>
          </div>

          {/* カテゴリフィルター */}
          {showDetailedResults && results && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  全カテゴリ ({results.length})
                </button>
                {Object.entries(categoryNames).map(([key, name]) => {
                  const count = results.filter(r => r.category === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key as IntegrityCheckCategory)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        selectedCategory === key
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 詳細結果 */}
          {showDetailedResults && categoryResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">詳細結果</h3>
              {categoryResults.map((result) => (
                <div
                  key={result.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(result.severity)}`}
                >
                  <div className="flex items-start">
                    {getSeverityIcon(result.severity)}
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">{result.title}</h4>
                        <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                          {categoryNames[result.category]}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{result.description}</p>

                      {result.affected_records > 0 && (
                        <p className="text-xs mt-2">
                          影響レコード数: {result.affected_records.toLocaleString()}
                        </p>
                      )}

                      {result.sample_data && result.sample_data.length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs cursor-pointer hover:text-opacity-80">
                            サンプルデータを表示 ({result.sample_data.length}件)
                          </summary>
                          <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                            <pre className="overflow-x-auto">
                              {JSON.stringify(result.sample_data, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}

                      {result.suggested_actions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium">推奨アクション:</p>
                          <ul className="text-xs mt-1 list-disc list-inside space-y-1">
                            {result.suggested_actions.map((action, index) => (
                              <li key={index}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.query_used && (
                        <details className="mt-3">
                          <summary className="text-xs cursor-pointer hover:text-opacity-80">
                            使用クエリを表示
                          </summary>
                          <div className="mt-2 p-2 bg-white bg-opacity-50 rounded">
                            <code className="text-xs whitespace-pre-wrap">{result.query_used}</code>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntegrityDashboard;