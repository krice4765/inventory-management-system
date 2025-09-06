/**
 * システムヘルスダッシュボード
 * 日次チェック結果の可視化とリアルタイム監視
 */

import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useErrorHandler, UserFriendlyError } from '../utils/error-handler';
import { ErrorDisplay } from './shared/ErrorDisplay';

interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  lastUpdate: string;
  trend?: 'up' | 'down' | 'stable';
}

interface HealthScore {
  integrity_score: number;
  performance_score: number;
  security_score: number;
  operational_score: number;
  overall_health_score: number;
  health_status: string;
  evaluation_time: string;
}

interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export const HealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError] = useState<UserFriendlyError | null>(null);
  const { handleError } = useErrorHandler();

  // ヘルスデータの取得
  const fetchHealthData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 基本的なシステムメトリクス取得
      const { data: operationalData, error: opError } = await supabase
        .rpc('operational_dashboard');

      if (opError) throw opError;

      // 運用メトリクス取得
      const { data: metricsData, error: metricsError } = await supabase
        .from('operational_metrics')
        .select('*')
        .order('measurement_time', { ascending: false })
        .limit(20);

      if (metricsError) throw metricsError;

      // パフォーマンス監視データ取得
      const { data: performanceData, error: perfError } = await supabase
        .rpc('monitor_rpc_performance');

      if (perfError) throw perfError;

      // エラー傾向データ取得
      const { data: errorTrends, error: errorError } = await supabase
        .rpc('analyze_error_trends', { days: 1 });

      if (errorError) throw errorError;

      // メトリクスデータの整形
      const healthMetrics: HealthMetric[] = [];

      // システムメトリクス
      if (operationalData && Array.isArray(operationalData)) {
        operationalData.forEach((item: any) => {
          if (item.metric_name && typeof item.metric_value === 'number') {
            healthMetrics.push({
              name: item.metric_name,
              value: item.metric_value,
              unit: item.unit || '',
              status: determineStatus(item.metric_name, item.metric_value),
              lastUpdate: item.measurement_time || new Date().toISOString(),
              trend: 'stable'
            });
          }
        });
      }

      // パフォーマンスメトリクス
      if (performanceData && Array.isArray(performanceData)) {
        performanceData.forEach((item: any) => {
          if (item.function_name && item.avg_duration_ms) {
            healthMetrics.push({
              name: `API応答時間: ${item.function_name}`,
              value: item.avg_duration_ms,
              unit: 'ms',
              status: item.avg_duration_ms > 1000 ? 'critical' : item.avg_duration_ms > 500 ? 'warning' : 'healthy',
              lastUpdate: new Date().toISOString(),
              trend: 'stable'
            });
          }
        });
      }

      setMetrics(healthMetrics);

      // アラートの生成
      const systemAlerts: SystemAlert[] = [];

      // エラーが多い場合のアラート
      if (errorTrends && Array.isArray(errorTrends)) {
        errorTrends.forEach((trend: any) => {
          if (trend.error_count > 10) {
            systemAlerts.push({
              id: `error-${trend.error_code}`,
              level: 'error',
              message: `エラー${trend.error_code}が過去24時間で${trend.error_count}回発生`,
              timestamp: new Date().toISOString(),
              resolved: false
            });
          } else if (trend.error_count > 5) {
            systemAlerts.push({
              id: `warning-${trend.error_code}`,
              level: 'warning',
              message: `エラー${trend.error_code}が過去24時間で${trend.error_count}回発生`,
              timestamp: new Date().toISOString(),
              resolved: false
            });
          }
        });
      }

      // パフォーマンス問題のアラート
      if (performanceData && Array.isArray(performanceData)) {
        const slowFunctions = performanceData.filter((item: any) => item.avg_duration_ms > 1000);
        if (slowFunctions.length > 0) {
          systemAlerts.push({
            id: 'performance-slow',
            level: 'warning',
            message: `${slowFunctions.length}個のAPI関数で応答時間が1秒を超過`,
            timestamp: new Date().toISOString(),
            resolved: false
          });
        }
      }

      setAlerts(systemAlerts);
      setLastRefresh(new Date());

      // 健康度スコアの計算（簡易版）
      const integrityScore = systemAlerts.filter(a => a.level === 'error').length === 0 ? 100 : 70;
      const performanceScore = healthMetrics.some(m => m.name.includes('API応答時間') && m.value > 1000) ? 60 : 
                             healthMetrics.some(m => m.name.includes('API応答時間') && m.value > 500) ? 80 : 100;
      const securityScore = 100; // RLS設定確認は別途実装
      const operationalScore = systemAlerts.filter(a => a.level === 'error').length > 0 ? 70 : 
                               systemAlerts.filter(a => a.level === 'warning').length > 0 ? 85 : 100;
      
      const overallScore = (integrityScore + performanceScore + securityScore + operationalScore) / 4;
      
      setHealthScore({
        integrity_score: integrityScore,
        performance_score: performanceScore,
        security_score: securityScore,
        operational_score: operationalScore,
        overall_health_score: overallScore,
        health_status: overallScore >= 95 ? '🟢 優秀' : 
                       overallScore >= 85 ? '🟡 良好' : 
                       overallScore >= 70 ? '🟠 注意' : '🔴 要対応',
        evaluation_time: new Date().toISOString()
      });

    } catch (err) {
      const userError = handleError(err);
      setError(userError);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  // 状態判定ロジック
  const determineStatus = (metricName: string, value: number): 'healthy' | 'warning' | 'critical' => {
    if (metricName.includes('error') && value > 0) {
      return value > 10 ? 'critical' : 'warning';
    }
    if (metricName.includes('response_time') && value > 500) {
      return value > 1000 ? 'critical' : 'warning';
    }
    if (metricName.includes('usage') && value > 80) {
      return value > 95 ? 'critical' : 'warning';
    }
    return 'healthy';
  };

  // 日次ヘルスチェック実行
  const runDailyHealthCheck = useCallback(async () => {
    setIsLoading(true);
    try {
      // 複数のヘルスチェック関数を並行実行
      const healthChecks = [
        supabase.rpc('operational_dashboard'),
        supabase.rpc('comprehensive_integrity_check'),
        supabase.rpc('monitor_rpc_performance'),
        supabase.rpc('analyze_error_trends', { days: 7 })
      ];

      const results = await Promise.allSettled(healthChecks);
      
      // 結果を処理してレポート生成
      const report = results.map((result, index) => ({
        check: ['運用ダッシュボード', 'データ整合性', 'パフォーマンス', 'エラー傾向'][index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : result.reason
      }));

      console.log('日次ヘルスチェック結果:', report);
      
      // データを再取得
      await fetchHealthData();
      
    } catch (err) {
      const userError = handleError(err);
      setError(userError);
    } finally {
      setIsLoading(false);
    }
  }, [fetchHealthData, handleError]);

  // 自動更新の設定
  useEffect(() => {
    fetchHealthData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000); // 30秒ごと
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchHealthData]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              💊 システムヘルス ダッシュボード
            </h2>
            <p className="text-gray-600 mt-1">
              システムの健康状態をリアルタイム監視
            </p>
          </div>
          <div className="flex space-x-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              自動更新
            </label>
            <button
              onClick={runDailyHealthCheck}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
            >
              {isLoading ? '実行中...' : '🔍 ヘルスチェック実行'}
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mt-2">
          最終更新: {lastRefresh.toLocaleString()}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <ErrorDisplay
          error={error}
          onDismiss={() => setError(null)}
          onRetry={fetchHealthData}
          showTechnicalDetails={import.meta.env.DEV}
        />
      )}

      {/* 健康度スコア */}
      {healthScore && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 システム健康度スコア</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{healthScore.integrity_score}</div>
              <div className="text-sm text-gray-600">データ整合性</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{healthScore.performance_score}</div>
              <div className="text-sm text-gray-600">パフォーマンス</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{healthScore.security_score}</div>
              <div className="text-sm text-gray-600">セキュリティ</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{healthScore.operational_score}</div>
              <div className="text-sm text-gray-600">運用品質</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <div className="text-3xl font-bold text-purple-600">{Math.round(healthScore.overall_health_score)}</div>
              <div className="text-sm text-gray-600">総合スコア</div>
              <div className="text-lg mt-1">{healthScore.health_status}</div>
            </div>
          </div>

          {/* 健康度による推奨アクション */}
          <div className={`p-4 rounded-lg ${
            healthScore.overall_health_score >= 95 ? 'bg-green-50 border-green-200' :
            healthScore.overall_health_score >= 85 ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          } border`}>
            <h4 className="font-medium mb-2">💡 推奨アクション</h4>
            <p className="text-sm">
              {healthScore.overall_health_score >= 95 
                ? '✅ システムは良好に動作しています。引き続き監視を継続してください。'
                : healthScore.overall_health_score >= 85
                ? '⚠️ 一部に改善の余地があります。詳細な調査を検討してください。'
                : '🚨 緊急の対応が必要です。システム管理者に連絡してください。'
              }
            </p>
          </div>
        </div>
      )}

      {/* システムアラート */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🚨 システムアラート ({alerts.filter(a => !a.resolved).length}件)
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${
                  alert.level === 'error' ? 'bg-red-50 border-red-400' :
                  alert.level === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">
                        {alert.level === 'error' ? '🔴' : alert.level === 'warning' ? '🟡' : '🔵'}
                      </span>
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="text-gray-400 hover:text-gray-600 ml-2"
                    onClick={() => setAlerts(prev => 
                      prev.map(a => a.id === alert.id ? {...a, resolved: true} : a)
                    )}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* システムメトリクス */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 システムメトリクス</h3>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">データを読み込み中...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  metric.status === 'healthy' ? 'bg-green-50 border-green-200' :
                  metric.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm">{metric.name}</h4>
                    <div className="flex items-baseline space-x-2 mt-2">
                      <span className="text-2xl font-bold">
                        {typeof metric.value === 'number' ? 
                          metric.value.toLocaleString(undefined, {maximumFractionDigits: 2}) : 
                          metric.value}
                      </span>
                      <span className="text-sm text-gray-500">{metric.unit}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(metric.lastUpdate).toLocaleString()}
                    </div>
                  </div>
                  <div className="ml-2">
                    <span className="text-lg">
                      {metric.status === 'healthy' ? '✅' : 
                       metric.status === 'warning' ? '⚠️' : '🚨'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!isLoading && metrics.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            メトリクスデータがありません
          </div>
        )}
      </div>

      {/* クイックアクション */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ クイックアクション</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={fetchHealthData}
            disabled={isLoading}
            className="p-4 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 rounded-lg text-left"
          >
            <div className="text-2xl mb-2">🔄</div>
            <div className="font-medium">データ更新</div>
            <div className="text-sm text-gray-600">最新データを取得</div>
          </button>
          
          <button
            onClick={runDailyHealthCheck}
            disabled={isLoading}
            className="p-4 bg-green-50 hover:bg-green-100 disabled:bg-gray-100 rounded-lg text-left"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-medium">フルチェック</div>
            <div className="text-sm text-gray-600">包括的健康診断</div>
          </button>
          
          <button
            onClick={() => window.open('/admin/logs', '_blank')}
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-left"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-medium">ログ確認</div>
            <div className="text-sm text-gray-600">エラーログを表示</div>
          </button>
        </div>
      </div>
    </div>
  );
};