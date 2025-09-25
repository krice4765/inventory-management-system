// パフォーマンス監視ユーティリティ
// 低速クエリとコンポーネントレンダリングの最適化効果を追跡

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'query' | 'render' | 'api';
  threshold: number;
  isOptimized?: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly QUERY_THRESHOLD = 500; // 500ms
  private readonly RENDER_THRESHOLD = 16; // 16ms
  private readonly API_THRESHOLD = 1000; // 1000ms

  // データベースクエリの監視
  trackQuery(name: string, duration: number, isOptimized = false) {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      type: 'query',
      threshold: this.QUERY_THRESHOLD,
      isOptimized
    };

    this.metrics.push(metric);

    if (duration > this.QUERY_THRESHOLD) {
      console.warn(`🐌 低速クエリ検出: ${name} - ${duration.toFixed(1)}ms (閾値: ${this.QUERY_THRESHOLD}ms)`);
    } else if (isOptimized && duration < this.QUERY_THRESHOLD) {
    }

    return metric;
  }

  // コンポーネントレンダリングの監視
  trackRender(componentName: string, duration: number, isOptimized = false) {
    const metric: PerformanceMetric = {
      name: componentName,
      duration,
      timestamp: Date.now(),
      type: 'render',
      threshold: this.RENDER_THRESHOLD,
      isOptimized
    };

    this.metrics.push(metric);

    if (duration > this.RENDER_THRESHOLD) {
      console.warn(`🔄 低速レンダリング検出: ${componentName} - ${duration.toFixed(1)}ms (閾値: ${this.RENDER_THRESHOLD}ms)`);
    } else if (isOptimized && duration < this.RENDER_THRESHOLD) {
    }

    return metric;
  }

  // API呼び出しの監視
  trackAPI(endpointName: string, duration: number) {
    const metric: PerformanceMetric = {
      name: endpointName,
      duration,
      timestamp: Date.now(),
      type: 'api',
      threshold: this.API_THRESHOLD
    };

    this.metrics.push(metric);

    if (duration > this.API_THRESHOLD) {
      console.warn(`🌐 低速API検出: ${endpointName} - ${duration.toFixed(1)}ms (閾値: ${this.API_THRESHOLD}ms)`);
    }

    return metric;
  }

  // パフォーマンス統計の取得
  getPerformanceStats(timeRangeMs = 5 * 60 * 1000) { // デフォルト5分
    const now = Date.now();
    const recentMetrics = this.metrics.filter(
      metric => now - metric.timestamp <= timeRangeMs
    );

    const queryMetrics = recentMetrics.filter(m => m.type === 'query');
    const renderMetrics = recentMetrics.filter(m => m.type === 'render');
    const apiMetrics = recentMetrics.filter(m => m.type === 'api');

    return {
      queries: {
        total: queryMetrics.length,
        slow: queryMetrics.filter(m => m.duration > m.threshold).length,
        optimized: queryMetrics.filter(m => m.isOptimized).length,
        avgDuration: queryMetrics.length > 0
          ? queryMetrics.reduce((sum, m) => sum + m.duration, 0) / queryMetrics.length
          : 0
      },
      renders: {
        total: renderMetrics.length,
        slow: renderMetrics.filter(m => m.duration > m.threshold).length,
        optimized: renderMetrics.filter(m => m.isOptimized).length,
        avgDuration: renderMetrics.length > 0
          ? renderMetrics.reduce((sum, m) => sum + m.duration, 0) / renderMetrics.length
          : 0
      },
      apis: {
        total: apiMetrics.length,
        slow: apiMetrics.filter(m => m.duration > m.threshold).length,
        avgDuration: apiMetrics.length > 0
          ? apiMetrics.reduce((sum, m) => sum + m.duration, 0) / apiMetrics.length
          : 0
      },
      overall: {
        totalMetrics: recentMetrics.length,
        slowOperations: recentMetrics.filter(m => m.duration > m.threshold).length,
        optimizedOperations: recentMetrics.filter(m => m.isOptimized).length
      }
    };
  }

  // デバッグ用統計表示
  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    console.group('📊 パフォーマンス統計 (過去5分)');

      '総数': stats.queries.total,
      '低速': stats.queries.slow,
      '最適化済': stats.queries.optimized,
      '平均時間': `${stats.queries.avgDuration.toFixed(1)}ms`
    });

      '総数': stats.renders.total,
      '低速': stats.renders.slow,
      '最適化済': stats.renders.optimized,
      '平均時間': `${stats.renders.avgDuration.toFixed(1)}ms`
    });

      '総数': stats.apis.total,
      '低速': stats.apis.slow,
      '平均時間': `${stats.apis.avgDuration.toFixed(1)}ms`
    });

    console.groupEnd();
  }

  // メトリクスをクリア
  clearMetrics() {
    this.metrics = [];
  }
}

// シングルトンインスタンス
export const performanceMonitor = new PerformanceMonitor();

// React開発ツール用のグローバル公開
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}

// 高階関数: 非同期関数の実行時間を監視
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  type: 'query' | 'api' = 'query',
  isOptimized = false
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - startTime;

      if (type === 'query') {
        performanceMonitor.trackQuery(name, duration, isOptimized);
      } else {
        performanceMonitor.trackAPI(name, duration);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.trackQuery(`${name} (エラー)`, duration, isOptimized);
      throw error;
    }
  }) as T;
}