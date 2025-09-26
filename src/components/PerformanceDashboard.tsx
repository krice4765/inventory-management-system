// パフォーマンスダッシュボードコンポーネント
import React, { useState, useEffect } from 'react';
import { usePerformanceMonitoring, useWebVitals, usePerformanceMeasurement } from '../hooks/usePerformanceMonitoring';
import {
  PerformanceDashboardData,
  PerformanceOptimizationSuggestion,
  QueryPerformanceReport,
  BundleAnalysisReport,
  RenderPerformanceMetric
} from '../types/performance';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Database,
  Globe,
  Code,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  Play,
  RefreshCw
} from 'lucide-react';

interface PerformanceDashboardProps {
      className?: string; autoRefresh?: boolean; refreshInterval?: number; }

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className = '',
  autoRefresh = false,
  refreshInterval = 60000 // 1分
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'queries' | 'rendering' | 'network' | 'bundle' | 'optimization'>('overview');
  const [isTestRunning, setIsTestRunning] = useState(false);

  const {
    dashboardData,
    realtimeData,
    alerts,
    isLoading,
    isAnalyzing,
    isMonitoring,
    executeAnalysis,
    executeTest,
    refreshDashboard,
    startMonitoring,
    stopMonitoring
  } = usePerformanceMonitoring({
    enabled_metrics: ['query_time', 'api_response', 'render_time', 'page_load', 'memory_usage'],
    sampling_rate: 0.1,
      auto_optimization: false });

  const { vitals, grade: vitalsGrade, isComplete: vitalsComplete } = useWebVitals();

  // 自動更新設定
  useEffect(() => {
    if (autoRefresh) {
      startMonitoring();
      const interval = setInterval(refreshDashboard, refreshInterval);
      return () => {
        clearInterval(interval);
        stopMonitoring();
      };
    }
  }, [autoRefresh, refreshInterval, startMonitoring, stopMonitoring, refreshDashboard]);

  // パフォーマンステスト実行
  const handleRunTest = async () => {
    setIsTestRunning(true);
    try {
      await executeTest('comprehensive-performance-test');
    } finally {
      setIsTestRunning(false);
    }
  };

  // スコア表示用のカラーを取得
      const getScoreColor = (score: number) => { if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-blue-600 bg-blue-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // グレード表示用のカラーを取得
      const getGradeColor = (grade: string) => { switch (grade) {
      case 'A': return 'text-green-600 bg-green-100'; case 'B': return 'text-blue-600 bg-blue-100'; case 'C': return 'text-yellow-600 bg-yellow-100'; case 'D': return 'text-orange-600 bg-orange-100'; case 'F': return 'text-red-600 bg-red-100'; default: return 'text-gray-600 bg-gray-100'; }
  };

  // トレンドアイコンを取得
      const getTrendIcon = (trend: string) => { switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'degrading':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading && !dashboardData) {
    return (
      <div className={`${className} p-6`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-6"></div>
      <div className="grid grid-cols-1 md: grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-300 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-white rounded-lg shadow-sm border border-gray-200`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            パフォーマンスダッシュボード
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshDashboard}
              disabled={isLoading}
      className="flex items-center px-3 py-1 text-sm text-gray-600 hover: text-gray-800 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button
              onClick={handleRunTest}
              disabled={isTestRunning}
      className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover: bg-blue-700 disabled:opacity-50">
              <Play className="h-4 w-4 mr-1" />
              {isTestRunning ? '実行中...' : 'テスト実行'}
            </button>
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              className={`flex items-center px-3 py-1 text-sm rounded ${
                isMonitoring
      ? 'bg-red-600 text-white hover: bg-red-700' : 'bg-green-600 text-white hover:bg-green-700' }`}
            >
              <Monitor className="h-4 w-4 mr-1" />
              {isMonitoring ? '監視停止' : '監視開始'}
            </button>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="px-6 py-3 border-b border-gray-200">
        <div className="flex space-x-1">
          {[
            { id: 'overview', label: '概要', icon: BarChart3 },
            { id: 'queries', label: 'データベース', icon: Database },
            { id: 'rendering', label: 'レンダリング', icon: Code },
            { id: 'network', label: 'ネットワーク', icon: Globe },
            { id: 'bundle', label: 'バンドル', icon: Zap },
            { id: 'optimization', label: '最適化提案', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100' }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isAnalyzing && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center">
            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">パフォーマンス分析実行中...</p>
              <p className="text-xs text-blue-600">データベース・レンダリング・ネットワークの包括的分析を実行しています</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            dashboardData={dashboardData}
            realtimeData={realtimeData}
            alerts={alerts}
            vitals={vitals}
            vitalsGrade={vitalsGrade}
            getScoreColor={getScoreColor}
            getGradeColor={getGradeColor}
            getTrendIcon={getTrendIcon}
          />
        )}

        {activeTab === 'queries' && (
          <QueriesTab
            queryPerformance={dashboardData?.query_performance || []}
            getGradeColor={getGradeColor}
          />
        )}

        {activeTab === 'rendering' && (
          <RenderingTab
            renderPerformance={dashboardData?.render_performance || []}
            getScoreColor={getScoreColor}
          />
        )}

        {activeTab === 'network' && (
          <NetworkTab
            networkPerformance={dashboardData?.network_performance || []}
            getScoreColor={getScoreColor}
          />
        )}

        {activeTab === 'bundle' && (
          <BundleTab
            bundleAnalysis={dashboardData?.bundle_analysis}
            getScoreColor={getScoreColor}
          />
        )}

        {activeTab === 'optimization' && (
          <OptimizationTab
            suggestions={dashboardData?.optimization_suggestions || []}
          />
        )}
      </div>
    </div>
  );
};

// 概要タブコンポーネント
const OverviewTab: React.FC<{
      dashboardData?: PerformanceDashboardData; realtimeData?: any; alerts: any[]; vitals: any; vitalsGrade: string; getScoreColor: (score: number) => string; getGradeColor: (grade: string) => string; getTrendIcon: (trend: string) => React.ReactNode; }> = ({ dashboardData, realtimeData, alerts, vitals, vitalsGrade, getScoreColor, getGradeColor, getTrendIcon }) => (
  <div className="space-y-6">
    {/* 総合スコア */}
    {dashboardData && (
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold ${getScoreColor(dashboardData.overall_score)}`}>
          {dashboardData.overall_score}
        </div>
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-3 ${getGradeColor(dashboardData.grade)}`}>
          グレード {dashboardData.grade}
        </div>
      </div>
    )}

    {/* Web Vitals */}
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Core Web Vitals</h3>
      <div className="grid grid-cols-2 md: grid-cols-4 gap-4">{[
          { name: 'LCP', value: vitals.lcp, unit: 'ms', threshold: 2500 },
          { name: 'FID', value: vitals.fid, unit: 'ms', threshold: 100 },
          { name: 'CLS', value: vitals.cls, unit: '', threshold: 0.1 },
          { name: 'FCP', value: vitals.fcp, unit: 'ms', threshold: 1800 }
        ].map(vital => (
          <div key={vital.name} className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {vital.value ? Math.round(vital.value * (vital.name === 'CLS' ? 1000 : 1)) / (vital.name === 'CLS' ? 1000 : 1) : '-'}
            </div>
            <div className="text-sm text-gray-500">{vital.name}</div>
            <div className="text-xs text-gray-400">{vital.unit}</div>
          </div>
        ))}
      </div>
    </div>

    {/* アラート */}
    {alerts.length > 0 && (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-yellow-800 mb-3 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          パフォーマンスアラート ({alerts.length}件)
        </h3>
        <div className="space-y-2">
          {alerts.slice(0, 3).map(alert => (
            <div key={alert.id} className="flex items-center justify-between text-sm">
              <span className="text-yellow-700">{alert.message}</span>
              <span className="text-yellow-600">{alert.current_value}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* トレンド */}
    {dashboardData?.trends && (
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">パフォーマンストレンド</h3>
        <div className="space-y-3">
          {dashboardData.trends.map(trend => (
            <div key={trend.metric} className="flex items-center justify-between">
              <div className="flex items-center">
                {getTrendIcon(trend.trend)}
                <span className="ml-2 text-sm text-gray-700">{trend.metric}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className={trend.change_percentage > 0 ? 'text-red-600' : 'text-green-600'}>
                  {trend.change_percentage > 0 ? '+' : ''}{trend.change_percentage}%
                </span>
                <span className="ml-2 text-gray-500">({trend.period_days}日間)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// データベースタブコンポーネント
const QueriesTab: React.FC<{
      queryPerformance: QueryPerformanceReport[]; getGradeColor: (grade: string) => string; }> = ({ queryPerformance, getGradeColor }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium text-gray-900">データベースクエリパフォーマンス</h3>
    <div className="space-y-3">
      {queryPerformance.map((query, index) => (
        <div key={index} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getGradeColor(query.performance_grade)}`}>
              グレード {query.performance_grade}
            </div>
            <div className="text-sm text-gray-600">
              平均実行時間: {query.avg_execution_time_ms.toFixed(1)}ms
            </div>
          </div>
          <div className="text-sm text-gray-700 mb-2 font-mono bg-white p-2 rounded border">
            {query.query_text.length > 100 ? `${query.query_text.substring(0, 100)}...` : query.query_text}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>実行回数: {query.execution_count.toLocaleString()}</div>
            <div>最大実行時間: {query.max_execution_time_ms.toFixed(1)}ms</div>
            {query.recommendations.length > 0 && (
              <div className="mt-2">
      <div className="font-medium">推奨事項: </div> <ul className="list-disc list-inside">
                  {query.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// レンダリングタブコンポーネント
const RenderingTab: React.FC<{
      renderPerformance: RenderPerformanceMetric[]; getScoreColor: (score: number) => string; }> = ({ renderPerformance, getScoreColor }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium text-gray-900">コンポーネントレンダリングパフォーマンス</h3>
      <div className="grid grid-cols-1 md: grid-cols-2 gap-4">{renderPerformance.map((component, index) => (
        <div key={index} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{component.component_name}</h4>
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getScoreColor(component.optimization_score)}`}>
              {component.optimization_score}点
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div>平均レンダリング時間: {component.avg_render_time_ms.toFixed(1)}ms</div>
            <div>レンダリング回数: {component.render_count}</div>
            <div>最大レンダリング時間: {component.max_render_time_ms.toFixed(1)}ms</div>
            <div>Props変更数: {component.props_changes}</div>
            <div>不要レンダリング数: {component.unnecessary_renders}</div>
            {component.recommendations.length > 0 && (
              <div className="mt-2">
      <div className="font-medium text-gray-700">推奨事項: </div> <ul className="list-disc list-inside text-xs">
                  {component.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ネットワークタブコンポーネント
const NetworkTab: React.FC<{
      networkPerformance: any[]; getScoreColor: (score: number) => string; }> = ({ networkPerformance, getScoreColor }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium text-gray-900">ネットワークパフォーマンス</h3>
    <div className="space-y-3">
      {networkPerformance.map((endpoint, index) => (
        <div key={index} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className="font-medium text-gray-900">{endpoint.method}</span>
              <span className="ml-2 text-gray-600">{endpoint.endpoint}</span>
            </div>
            <div className="text-sm text-gray-600">
              {endpoint.avg_response_time_ms.toFixed(0)}ms
            </div>
          </div>
      <div className="grid grid-cols-2 md: grid-cols-4 gap-4 text-xs text-gray-600"><div>成功率: {endpoint.success_rate.toFixed(1)}%</div>
            <div>エラー率: {endpoint.error_rate.toFixed(1)}%</div>
            <div>最大応答時間: {endpoint.max_response_time_ms.toFixed(0)}ms</div>
            <div>データ転送: {endpoint.data_transfer_mb.toFixed(2)}MB</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// バンドルタブコンポーネント
const BundleTab: React.FC<{
      bundleAnalysis?: BundleAnalysisReport; getScoreColor: (score: number) => string; }> = ({ bundleAnalysis, getScoreColor }) => (
  <div className="space-y-6">
    {bundleAnalysis && (
      <>
      <div className="grid grid-cols-1 md: grid-cols-3 gap-4"><div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{bundleAnalysis.total_size_mb.toFixed(1)}MB</div>
            <div className="text-sm text-gray-600">総バンドルサイズ</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{bundleAnalysis.gzipped_size_mb.toFixed(1)}MB</div>
            <div className="text-sm text-gray-600">Gzip圧縮後</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{bundleAnalysis.chunk_count}</div>
            <div className="text-sm text-gray-600">チャンク数</div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-3">大きなチャンク</h4>
          <div className="space-y-2">
            {bundleAnalysis.largest_chunks.map((chunk, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">{chunk.name}</span>
                  <span className="ml-2 text-sm text-gray-600">({chunk.percentage}%)</span>
                </div>
                <span className="text-sm text-gray-600">{chunk.size_mb.toFixed(1)}MB</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-3">最適化機会</h4>
          <div className="space-y-3">
            {bundleAnalysis.optimization_opportunities.map((opportunity, index) => (
              <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-blue-900">{opportunity.description}</h5>
                  <span className="text-sm text-blue-700">-{opportunity.potential_savings_mb.toFixed(1)}MB</span>
                </div>
                <div className="text-sm text-blue-800">タイプ: {opportunity.type}</div>
              </div>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
);

// 最適化提案タブコンポーネント
const OptimizationTab: React.FC<{
      suggestions: PerformanceOptimizationSuggestion[]; }> = ({ suggestions }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium text-gray-900">パフォーマンス最適化提案</h3>
    <div className="space-y-4">
      {suggestions.map((suggestion, index) => (
        <div key={index} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-medium text-gray-900">{suggestion.title}</h4>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                suggestion.priority === 'critical' ? 'bg-red-100 text-red-800' :
                suggestion.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {suggestion.priority}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                {suggestion.category}
              </span>
            </div>
          </div>

          <p className="text-gray-600 mb-3">{suggestion.description}</p>

      <div className="grid grid-cols-1 md: grid-cols-2 gap-4 mb-4"><div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-sm font-medium text-green-800">期待される効果</div>
              <div className="text-sm text-green-700">{suggestion.impact_description}</div>
              <div className="text-sm font-medium text-green-800 mt-1">{suggestion.estimated_improvement}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-800">実装の難易度</div>
              <div className="text-sm text-blue-700">
                {suggestion.implementation_effort === 'easy' ? '簡単' :
                 suggestion.implementation_effort === 'moderate' ? '普通' : '複雑'}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium text-gray-800 mb-2">実装手順</div>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              {suggestion.implementation_steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

      <div className="grid grid-cols-1 md: grid-cols-2 gap-4 text-sm text-gray-600"><div>
              <div className="font-medium text-gray-800">影響するコンポーネント</div>
              <ul className="list-disc list-inside">
                {suggestion.affected_components.slice(0, 3).map((component, i) => (
                  <li key={i}>{component}</li>
                ))}
                {suggestion.affected_components.length > 3 && (
                  <li>...他 {suggestion.affected_components.length - 3} 件</li>
                )}
              </ul>
            </div>
            <div>
              <div className="font-medium text-gray-800">監視すべきメトリクス</div>
              <ul className="list-disc list-inside">
                {suggestion.metrics_to_monitor.map((metric, i) => (
                  <li key={i}>{metric}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// default エクスポートのみ
export default PerformanceDashboard;