// パフォーマンス監視用カスタムフック
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PerformanceService } from '../services/performanceService';
import {
  PerformanceDashboardData,
  PerformanceMetric,
  PerformanceTestResult,
  RealTimePerformanceData,
  PerformanceAlert,
  PerformanceMonitorConfig
} from '../types/performance';

const performanceService = new PerformanceService();

/**
 * パフォーマンス監視のメインフック
 */
export const usePerformanceMonitoring = (config?: Partial<PerformanceMonitorConfig>) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const queryClient = useQueryClient();

  // パフォーマンス分析実行
  const runAnalysis = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      try {
        const service = config ? new PerformanceService(config) : performanceService;
        const result = await service.runComprehensiveAnalysis();

        // キャッシュを更新
        queryClient.setQueryData(['performance-dashboard'], result);

        return result;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    }
  });

  // パフォーマンステスト実行
  const runTest = useMutation({
    mutationFn: async (testName: string) => {
      const service = config ? new PerformanceService(config) : performanceService;
      return service.runPerformanceTest(testName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    }
  });

  // ダッシュボードデータ取得
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useQuery<PerformanceDashboardData>({
    queryKey: ['performance-dashboard'],
    queryFn: async () => {
      const service = config ? new PerformanceService(config) : performanceService;
      return service.runComprehensiveAnalysis();
    },
    staleTime: 5 * 60 * 1000, // 5分間はフレッシュ
    cacheTime: 15 * 60 * 1000, // 15分間キャッシュ
    refetchOnWindowFocus: false
  });

  // リアルタイムパフォーマンスデータ取得
  const {
    data: realtimeData,
    isLoading: realtimeLoading,
    error: realtimeError
  } = useQuery<RealTimePerformanceData>({
    queryKey: ['performance-realtime'],
    queryFn: async () => {
      const service = config ? new PerformanceService(config) : performanceService;
      return service.getRealTimePerformanceData();
    },
    refetchInterval: isMonitoring ? 10000 : false, // 10秒間隔で更新
    staleTime: 5000, // 5秒でstale
    cacheTime: 30000 // 30秒キャッシュ
  });

  // アラート監視
  useEffect(() => {
    if (dashboardData && dashboardData.key_metrics) {
      const newAlerts: PerformanceAlert[] = [];

      dashboardData.key_metrics.forEach(metric => {
        if (metric.threshold_critical && metric.value > metric.threshold_critical) {
          newAlerts.push({
            id: `alert_${metric.id}`,
            metric_type: metric.type,
            severity: 'critical',
            message: `${metric.name}が危険レベル (${metric.value}${metric.unit})`,
            current_value: metric.value,
            threshold_value: metric.threshold_critical,
            started_at: new Date().toISOString(),
            affected_components: [],
            suggested_actions: [`${metric.name}の最適化が緊急に必要です`]
          });
        } else if (metric.threshold_warning && metric.value > metric.threshold_warning) {
          newAlerts.push({
            id: `alert_${metric.id}`,
            metric_type: metric.type,
            severity: 'warning',
            message: `${metric.name}が警告レベル (${metric.value}${metric.unit})`,
            current_value: metric.value,
            threshold_value: metric.threshold_warning,
            started_at: new Date().toISOString(),
            affected_components: [],
            suggested_actions: [`${metric.name}の監視を継続してください`]
          });
        }
      });

      setAlerts(newAlerts);
    }
  }, [dashboardData]);

  // 手動でダッシュボードを更新
  const refreshDashboard = useCallback(() => {
    refetchDashboard();
  }, [refetchDashboard]);

  // 監視開始/停止
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // パフォーマンステスト実行
  const executeTest = useCallback(async (testName: string) => {
    return runTest.mutate(testName);
  }, [runTest]);

  // 分析実行
  const executeAnalysis = useCallback(async () => {
    return runAnalysis.mutate();
  }, [runAnalysis]);

  return {
    // データ
    dashboardData,
    realtimeData,
    alerts,

    // ローディング状態
    isLoading: dashboardLoading || realtimeLoading,
    isAnalyzing,
    isMonitoring,

    // エラー
    error: dashboardError || realtimeError,

    // アクション
    executeAnalysis,
    executeTest,
    refreshDashboard,
    startMonitoring,
    stopMonitoring,

    // ミューテーション状態
    analysisMutation: runAnalysis,
    testMutation: runTest
  };
};

/**
 * 特定メトリクスの監視用フック
 */
export const useMetricMonitoring = (metricType: string, threshold?: number) => {
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [isExceeded, setIsExceeded] = useState(false);
  const metricsRef = useRef<PerformanceMetric[]>([]);

  const { data: dashboardData } = useQuery<PerformanceDashboardData>({
    queryKey: ['performance-dashboard'],
    staleTime: 60000 // 1分間キャッシュ
  });

  useEffect(() => {
    if (dashboardData && dashboardData.key_metrics) {
      const metric = dashboardData.key_metrics.find(m => m.type === metricType);
      if (metric) {
        setCurrentValue(metric.value);
        setIsExceeded(threshold ? metric.value > threshold : false);

        // メトリクス履歴を保持（最新10件）
        metricsRef.current = [...metricsRef.current, metric].slice(-10);
      }
    }
  }, [dashboardData, metricType, threshold]);

  return {
    currentValue,
    isExceeded,
    history: metricsRef.current,
    trend: metricsRef.current.length > 1
      ? metricsRef.current[metricsRef.current.length - 1].value > metricsRef.current[metricsRef.current.length - 2].value
        ? 'increasing'
        : 'decreasing'
      : 'stable'
  };
};

/**
 * パフォーマンス測定用フック
 */
export const usePerformanceMeasurement = (measurementName: string) => {
  const [measurements, setMeasurements] = useState<Array<{
    name: string;
    duration: number;
    timestamp: number;
  }>>([]);

  const startMeasurement = useCallback(() => {
    if (window.performance && window.performance.mark) {
      window.performance.mark(`${measurementName}-start`);
    }
    return Date.now();
  }, [measurementName]);

  const endMeasurement = useCallback(() => {
    const endTime = Date.now();

    if (window.performance && window.performance.mark && window.performance.measure) {
      try {
        window.performance.mark(`${measurementName}-end`);
        window.performance.measure(
          measurementName,
          `${measurementName}-start`,
          `${measurementName}-end`
        );

        const measures = window.performance.getEntriesByName(measurementName, 'measure');
        if (measures.length > 0) {
          const latestMeasure = measures[measures.length - 1];
          const measurement = {
            name: measurementName,
            duration: latestMeasure.duration,
            timestamp: endTime
          };

          setMeasurements(prev => [...prev, measurement].slice(-50)); // 最新50件保持
          return latestMeasure.duration;
        }
      } catch (error) {
        console.warn('パフォーマンス測定エラー:', error);
      }
    }

    return 0;
  }, [measurementName]);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
    if (window.performance && window.performance.clearMeasures) {
      window.performance.clearMeasures(measurementName);
    }
  }, [measurementName]);

  const averageDuration = measurements.length > 0
    ? measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length
    : 0;

  const maxDuration = measurements.length > 0
    ? Math.max(...measurements.map(m => m.duration))
    : 0;

  const minDuration = measurements.length > 0
    ? Math.min(...measurements.map(m => m.duration))
    : 0;

  return {
    startMeasurement,
    endMeasurement,
    clearMeasurements,
    measurements,
    averageDuration,
    maxDuration,
    minDuration,
    measurementCount: measurements.length
  };
};

/**
 * Web Vitals監視用フック
 */
export const useWebVitals = () => {
  const [vitals, setVitals] = useState<{
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    fcp?: number; // First Contentful Paint
    ttfb?: number; // Time to First Byte
  }>({});

  useEffect(() => {
    // Web Vitals ライブラリがある場合の処理
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // LCP測定
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          setVitals(prev => ({ ...prev, lcp: lastEntry.startTime }));
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FCP測定
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              setVitals(prev => ({ ...prev, fcp: entry.startTime }));
            }
          });
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // CLS測定
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          setVitals(prev => ({ ...prev, cls: clsValue }));
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        return () => {
          lcpObserver.disconnect();
          fcpObserver.disconnect();
          clsObserver.disconnect();
        };
      } catch (error) {
        console.warn('Web Vitals監視エラー:', error);
      }
    }
  }, []);

  // Web Vitalsの評価
  const getVitalsGrade = useCallback(() => {
    const scores = {
      lcp: vitals.lcp ? (vitals.lcp <= 2500 ? 'good' : vitals.lcp <= 4000 ? 'needs-improvement' : 'poor') : 'unknown',
      fid: vitals.fid ? (vitals.fid <= 100 ? 'good' : vitals.fid <= 300 ? 'needs-improvement' : 'poor') : 'unknown',
      cls: vitals.cls ? (vitals.cls <= 0.1 ? 'good' : vitals.cls <= 0.25 ? 'needs-improvement' : 'poor') : 'unknown',
      fcp: vitals.fcp ? (vitals.fcp <= 1800 ? 'good' : vitals.fcp <= 3000 ? 'needs-improvement' : 'poor') : 'unknown'
    };

    const goodCount = Object.values(scores).filter(score => score === 'good').length;
    const totalCount = Object.values(scores).filter(score => score !== 'unknown').length;

    if (totalCount === 0) return 'unknown';
    if (goodCount === totalCount) return 'good';
    if (goodCount / totalCount >= 0.5) return 'needs-improvement';
    return 'poor';
  }, [vitals]);

  return {
    vitals,
    grade: getVitalsGrade(),
    isComplete: Object.keys(vitals).length >= 3 // LCP, FCP, CLS が測定済み
  };
};