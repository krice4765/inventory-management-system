// パフォーマンス監視関連の型定義

export type PerformanceMetricType =
  | 'query_time'      // データベースクエリ実行時間
  | 'api_response'    // API応答時間
  | 'render_time'     // コンポーネントレンダリング時間
  | 'bundle_size'     // バンドルサイズ
  | 'memory_usage'    // メモリ使用量
  | 'network_timing'  // ネットワーク通信時間
  | 'user_interaction' // ユーザーインタラクション応答時間
  | 'page_load';      // ページロード時間

export interface PerformanceMetric {
  id: string;
  type: PerformanceMetricType;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  context?: Record<string, any>;
  threshold_warning?: number;
  threshold_critical?: number;
  tags?: string[];
}

export interface PerformanceBenchmark {
  metric_type: PerformanceMetricType;
  name: string;
  target_value: number;
  warning_threshold: number;
  critical_threshold: number;
  unit: string;
  description: string;
}

export interface QueryPerformanceReport {
  query_hash: string;
  query_text: string;
  avg_execution_time_ms: number;
  max_execution_time_ms: number;
  min_execution_time_ms: number;
  execution_count: number;
  total_time_ms: number;
  first_seen: string;
  last_seen: string;
  performance_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
}

export interface BundleAnalysisReport {
  total_size_mb: number;
  gzipped_size_mb: number;
  chunk_count: number;
  largest_chunks: Array<{
    name: string;
    size_mb: number;
    percentage: number;
  }>;
  vendor_size_mb: number;
  app_size_mb: number;
  unused_exports: string[];
  optimization_opportunities: Array<{
    type: 'code_splitting' | 'tree_shaking' | 'compression' | 'lazy_loading';
    description: string;
    potential_savings_mb: number;
  }>;
}

export interface RenderPerformanceMetric {
  component_name: string;
  render_count: number;
  avg_render_time_ms: number;
  max_render_time_ms: number;
  total_render_time_ms: number;
  props_changes: number;
  unnecessary_renders: number;
  optimization_score: number; // 0-100
  recommendations: string[];
}

export interface NetworkPerformanceReport {
  endpoint: string;
  method: string;
  avg_response_time_ms: number;
  max_response_time_ms: number;
  min_response_time_ms: number;
  success_rate: number;
  error_rate: number;
  timeout_count: number;
  retry_count: number;
  data_transfer_mb: number;
  cache_hit_rate: number;
}

export interface PerformanceOptimizationSuggestion {
  id: string;
  category: 'database' | 'frontend' | 'network' | 'bundle' | 'caching' | 'rendering';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact_description: string;
  estimated_improvement: string;
  implementation_effort: 'easy' | 'moderate' | 'complex';
  implementation_steps: string[];
  affected_components: string[];
  metrics_to_monitor: string[];
  related_files?: string[];
}

export interface PerformanceDashboardData {
  overall_score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  key_metrics: PerformanceMetric[];
  query_performance: QueryPerformanceReport[];
  render_performance: RenderPerformanceMetric[];
  network_performance: NetworkPerformanceReport[];
  bundle_analysis: BundleAnalysisReport;
  optimization_suggestions: PerformanceOptimizationSuggestion[];
  last_analysis: string;
  trends: Array<{
    metric: string;
    trend: 'improving' | 'degrading' | 'stable';
    change_percentage: number;
    period_days: number;
  }>;
}

export interface PerformanceMonitorConfig {
  enabled_metrics: PerformanceMetricType[];
  sampling_rate: number; // 0-1
  retention_days: number;
  alert_thresholds: Record<PerformanceMetricType, {
    warning: number;
    critical: number;
  }>;
  auto_optimization: boolean;
  benchmark_mode: boolean;
}

// パフォーマンステスト結果
export interface PerformanceTestResult {
  test_id: string;
  test_name: string;
  timestamp: string;
  duration_ms: number;
  success: boolean;
  metrics: PerformanceMetric[];
  errors?: string[];
  comparison_baseline?: {
    baseline_date: string;
    improvement_percentage: number;
    regression_detected: boolean;
  };
}

// リアルタイムパフォーマンス監視
export interface RealTimePerformanceData {
  current_users: number;
  active_sessions: number;
  avg_page_load_time: number;
  avg_api_response_time: number;
  error_rate_percentage: number;
  memory_usage_percentage: number;
  cpu_usage_percentage: number;
  database_connections: number;
  cache_hit_rate: number;
  alerts_active: number;
}

// パフォーマンスアラート
export interface PerformanceAlert {
  id: string;
  metric_type: PerformanceMetricType;
  severity: 'warning' | 'critical';
  message: string;
  current_value: number;
  threshold_value: number;
  started_at: string;
  resolved_at?: string;
  affected_components: string[];
  suggested_actions: string[];
}