// データ整合性チェック関連の型定義

export type IntegrityCheckSeverity = 'critical' | 'warning' | 'info' | 'success';

export type IntegrityCheckCategory =
  | 'financial'      // 金額計算の整合性
  | 'inventory'      // 在庫数量の整合性
  | 'delivery'       // 分納データの整合性
  | 'reference'      // 外部キー参照の整合性
  | 'business_rule'  // ビジネスルールの整合性
  | 'data_quality';  // データ品質の整合性

export interface IntegrityCheckResult {
  id: string;
  category: IntegrityCheckCategory;
  severity: IntegrityCheckSeverity;
  title: string;
  description: string;
  affected_records: number;
  sample_data?: any[];
  suggested_actions: string[];
  query_used?: string;
  checked_at: string;
}

export interface IntegrityCheckSummary {
  total_checks: number;
  critical_issues: number;
  warning_issues: number;
  info_issues: number;
  success_checks: number;
  overall_status: 'healthy' | 'needs_attention' | 'critical';
  last_check_at: string;
  execution_time_ms: number;
}

export interface IntegrityCheckConfig {
  enabled_categories: IntegrityCheckCategory[];
  include_sample_data: boolean;
  max_sample_records: number;
  timeout_ms: number;
}

// 個別チェック項目の定義
export interface FinancialIntegrityData {
  purchase_order_id: string;
  order_no: string;
  calculated_total: number;
  stored_total: number;
  difference: number;
  item_count: number;
}

export interface InventoryIntegrityData {
  product_id: string;
  product_name: string;
  calculated_stock: number;
  stored_stock: number;
  difference: number;
  last_movement_date: string;
}

export interface DeliveryIntegrityData {
  purchase_order_id: string;
  order_no: string;
  total_amount: number;
  delivered_amount: number;
  remaining_amount: number;
  stored_remaining: number;
  difference: number;
  delivery_count: number;
}

export interface ReferenceIntegrityData {
  table_name: string;
  foreign_key_column: string;
  referenced_table: string;
  orphaned_records: number;
  sample_orphaned_ids?: string[];
}

export interface BusinessRuleViolation {
  rule_name: string;
  violation_type: string;
  affected_table: string;
  record_id: string;
  violation_details: string;
  suggested_fix: string;
}

export interface DataQualityIssue {
  table_name: string;
  column_name: string;
  issue_type: 'null_values' | 'duplicate_values' | 'invalid_format' | 'out_of_range';
  affected_records: number;
  percentage: number;
  sample_values?: any[];
}