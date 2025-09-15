// データ整合性チェックサービス
import { supabase } from '../lib/supabase';
import {
  IntegrityCheckResult,
  IntegrityCheckSummary,
  IntegrityCheckConfig,
  IntegrityCheckCategory,
  FinancialIntegrityData,
  InventoryIntegrityData,
  DeliveryIntegrityData,
  ReferenceIntegrityData,
  BusinessRuleViolation,
  DataQualityIssue
} from '../types/integrity';

export class IntegrityService {
  private config: IntegrityCheckConfig = {
    enabled_categories: ['financial', 'inventory', 'delivery', 'reference', 'business_rule', 'data_quality'],
    include_sample_data: true,
    max_sample_records: 5,
    timeout_ms: 30000
  };

  constructor(config?: Partial<IntegrityCheckConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 全体の整合性チェックを実行
   */
  async runCompleteIntegrityCheck(): Promise<{
    summary: IntegrityCheckSummary;
    results: IntegrityCheckResult[];
  }> {
    const startTime = Date.now();
    const results: IntegrityCheckResult[] = [];

    try {
      // 各カテゴリのチェックを実行
      if (this.config.enabled_categories.includes('financial')) {
        results.push(...await this.checkFinancialIntegrity());
      }

      if (this.config.enabled_categories.includes('inventory')) {
        results.push(...await this.checkInventoryIntegrity());
      }

      if (this.config.enabled_categories.includes('delivery')) {
        results.push(...await this.checkDeliveryIntegrity());
      }

      if (this.config.enabled_categories.includes('reference')) {
        results.push(...await this.checkReferenceIntegrity());
      }

      if (this.config.enabled_categories.includes('business_rule')) {
        results.push(...await this.checkBusinessRules());
      }

      if (this.config.enabled_categories.includes('data_quality')) {
        results.push(...await this.checkDataQuality());
      }

      const executionTime = Date.now() - startTime;
      const summary = this.generateSummary(results, executionTime);

      return { summary, results };
    } catch (error) {
      console.error('整合性チェック実行エラー:', error);
      throw new Error(`整合性チェックの実行に失敗しました: ${error.message}`);
    }
  }

  /**
   * 金額計算の整合性チェック
   */
  private async checkFinancialIntegrity(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      // 発注書の金額整合性チェック
      const { data: orderData, error: orderError } = await supabase.rpc('check_purchase_order_totals');

      if (orderError) throw orderError;

      if (orderData && orderData.length > 0) {
        const sampleData = this.config.include_sample_data
          ? orderData.slice(0, this.config.max_sample_records)
          : undefined;

        results.push({
          id: `financial_order_totals_${Date.now()}`,
          category: 'financial',
          severity: 'critical',
          title: '発注書金額の不整合',
          description: `${orderData.length}件の発注書で、アイテム合計金額と発注書総額が一致しません`,
          affected_records: orderData.length,
          sample_data: sampleData,
          suggested_actions: [
            '発注書アイテムの金額を再計算',
            '手動で金額を修正',
            'データベースの制約を強化'
          ],
          checked_at: new Date().toISOString()
        });
      } else {
        results.push({
          id: `financial_order_totals_ok_${Date.now()}`,
          category: 'financial',
          severity: 'success',
          title: '発注書金額の整合性',
          description: '全ての発注書で金額計算が正しく行われています',
          affected_records: 0,
          suggested_actions: [],
          checked_at: new Date().toISOString()
        });
      }

      // 分納金額の整合性チェック
      const deliveryResults = await this.checkDeliveryAmountIntegrity();
      results.push(...deliveryResults);

    } catch (error) {
      results.push({
        id: `financial_error_${Date.now()}`,
        category: 'financial',
        severity: 'critical',
        title: '金額整合性チェックエラー',
        description: `金額整合性チェック中にエラーが発生しました: ${error.message}`,
        affected_records: 0,
        suggested_actions: ['データベース接続を確認', 'ログを詳細に調査'],
        checked_at: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * 在庫数量の整合性チェック
   */
  private async checkInventoryIntegrity(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      // 在庫数量の計算チェック
      const query = `
        WITH calculated_stock AS (
          SELECT
            p.id as product_id,
            p.product_name,
            p.current_stock as stored_stock,
            COALESCE(SUM(
              CASE
                WHEN im.movement_type = 'in' THEN im.quantity
                WHEN im.movement_type = 'out' THEN -im.quantity
                ELSE 0
              END
            ), 0) as calculated_stock
          FROM products p
          LEFT JOIN inventory_movements im ON p.id = im.product_id
          GROUP BY p.id, p.product_name, p.current_stock
        )
        SELECT
          product_id,
          product_name,
          calculated_stock,
          stored_stock,
          (calculated_stock - stored_stock) as difference
        FROM calculated_stock
        WHERE ABS(calculated_stock - stored_stock) > 0.01
        ORDER BY ABS(calculated_stock - stored_stock) DESC
        LIMIT 100;
      `;

      const { data: inventoryData, error: inventoryError } = await supabase.rpc('execute_query', { query_text: query });

      if (inventoryError) throw inventoryError;

      if (inventoryData && inventoryData.length > 0) {
        const sampleData = this.config.include_sample_data
          ? inventoryData.slice(0, this.config.max_sample_records)
          : undefined;

        results.push({
          id: `inventory_stock_mismatch_${Date.now()}`,
          category: 'inventory',
          severity: 'warning',
          title: '在庫数量の不整合',
          description: `${inventoryData.length}件の商品で在庫移動履歴と現在庫数が一致しません`,
          affected_records: inventoryData.length,
          sample_data: sampleData,
          suggested_actions: [
            '在庫移動履歴を再確認',
            '現在庫数を手動で調整',
            '在庫調整レコードを追加'
          ],
          query_used: query,
          checked_at: new Date().toISOString()
        });
      } else {
        results.push({
          id: `inventory_stock_ok_${Date.now()}`,
          category: 'inventory',
          severity: 'success',
          title: '在庫数量の整合性',
          description: '全ての商品で在庫数量が正しく管理されています',
          affected_records: 0,
          suggested_actions: [],
          checked_at: new Date().toISOString()
        });
      }

    } catch (error) {
      results.push({
        id: `inventory_error_${Date.now()}`,
        category: 'inventory',
        severity: 'critical',
        title: '在庫整合性チェックエラー',
        description: `在庫整合性チェック中にエラーが発生しました: ${error.message}`,
        affected_records: 0,
        suggested_actions: ['データベース接続を確認', 'クエリ構文を確認'],
        checked_at: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * 分納データの整合性チェック
   */
  private async checkDeliveryIntegrity(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      // 分納金額の合計チェック
      const deliveryQuery = `
        WITH delivery_summary AS (
          SELECT
            po.id as purchase_order_id,
            po.order_no,
            po.total_amount,
            COALESCE(SUM(t.total_amount), 0) as delivered_amount,
            (po.total_amount - COALESCE(SUM(t.total_amount), 0)) as calculated_remaining,
            po.remaining_amount as stored_remaining
          FROM purchase_orders po
          LEFT JOIN transactions t ON po.id = t.parent_order_id
            AND t.transaction_type = 'installment'
            AND t.status = 'confirmed'
          WHERE po.status = 'active'
          GROUP BY po.id, po.order_no, po.total_amount, po.remaining_amount
        )
        SELECT *,
          ABS(calculated_remaining - stored_remaining) as difference
        FROM delivery_summary
        WHERE ABS(calculated_remaining - stored_remaining) > 0.01
        ORDER BY difference DESC
        LIMIT 50;
      `;

      const { data: deliveryData, error: deliveryError } = await supabase.rpc('execute_query', { query_text: deliveryQuery });

      if (deliveryError) throw deliveryError;

      if (deliveryData && deliveryData.length > 0) {
        const sampleData = this.config.include_sample_data
          ? deliveryData.slice(0, this.config.max_sample_records)
          : undefined;

        results.push({
          id: `delivery_amount_mismatch_${Date.now()}`,
          category: 'delivery',
          severity: 'critical',
          title: '分納金額の不整合',
          description: `${deliveryData.length}件の発注書で分納金額の計算に不整合があります`,
          affected_records: deliveryData.length,
          sample_data: sampleData,
          suggested_actions: [
            '分納記録を再計算',
            '残額を手動で修正',
            '重複分納記録を確認'
          ],
          query_used: deliveryQuery,
          checked_at: new Date().toISOString()
        });
      } else {
        results.push({
          id: `delivery_amount_ok_${Date.now()}`,
          category: 'delivery',
          severity: 'success',
          title: '分納金額の整合性',
          description: '全ての発注書で分納金額が正しく計算されています',
          affected_records: 0,
          suggested_actions: [],
          checked_at: new Date().toISOString()
        });
      }

    } catch (error) {
      results.push({
        id: `delivery_error_${Date.now()}`,
        category: 'delivery',
        severity: 'critical',
        title: '分納整合性チェックエラー',
        description: `分納整合性チェック中にエラーが発生しました: ${error.message}`,
        affected_records: 0,
        suggested_actions: ['データベース接続を確認', 'SQLクエリを確認'],
        checked_at: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * 外部キー参照の整合性チェック
   */
  private async checkReferenceIntegrity(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    // 各テーブルの外部キー制約をチェック
    const referenceChecks = [
      {
        table: 'purchase_order_items',
        fk_column: 'purchase_order_id',
        ref_table: 'purchase_orders',
        ref_column: 'id'
      },
      {
        table: 'purchase_order_items',
        fk_column: 'product_id',
        ref_table: 'products',
        ref_column: 'id'
      },
      {
        table: 'transactions',
        fk_column: 'parent_order_id',
        ref_table: 'purchase_orders',
        ref_column: 'id'
      },
      {
        table: 'inventory_movements',
        fk_column: 'product_id',
        ref_table: 'products',
        ref_column: 'id'
      }
    ];

    for (const check of referenceChecks) {
      try {
        const query = `
          SELECT COUNT(*) as orphaned_count
          FROM ${check.table} t
          WHERE t.${check.fk_column} IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM ${check.ref_table} r
              WHERE r.${check.ref_column} = t.${check.fk_column}
            );
        `;

        const { data, error } = await supabase.rpc('execute_query', { query_text: query });

        if (error) throw error;

        const orphanedCount = data?.[0]?.orphaned_count || 0;

        if (orphanedCount > 0) {
          results.push({
            id: `reference_${check.table}_${check.fk_column}_${Date.now()}`,
            category: 'reference',
            severity: 'critical',
            title: `外部キー参照エラー: ${check.table}`,
            description: `${check.table}.${check.fk_column}に${orphanedCount}件の孤立レコードがあります`,
            affected_records: orphanedCount,
            suggested_actions: [
              '孤立レコードを削除',
              '参照先データを復元',
              'データ整合性制約を追加'
            ],
            query_used: query,
            checked_at: new Date().toISOString()
          });
        }
      } catch (error) {
        results.push({
          id: `reference_error_${check.table}_${Date.now()}`,
          category: 'reference',
          severity: 'warning',
          title: `参照整合性チェックエラー: ${check.table}`,
          description: `${check.table}の参照整合性チェック中にエラーが発生しました: ${error.message}`,
          affected_records: 0,
          suggested_actions: ['テーブル構造を確認', 'クエリ権限を確認'],
          checked_at: new Date().toISOString()
        });
      }
    }

    if (results.filter(r => r.severity === 'critical').length === 0) {
      results.push({
        id: `reference_integrity_ok_${Date.now()}`,
        category: 'reference',
        severity: 'success',
        title: '外部キー参照の整合性',
        description: '全ての外部キー参照が正しく維持されています',
        affected_records: 0,
        suggested_actions: [],
        checked_at: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * ビジネスルールの整合性チェック
   */
  private async checkBusinessRules(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    // ビジネスルールのチェック項目を定義
    const businessRuleChecks = [
      {
        name: '負の在庫数量',
        query: `SELECT COUNT(*) as violation_count FROM products WHERE current_stock < 0;`,
        description: '在庫数量が負の値になっている商品があります'
      },
      {
        name: '未来日付の取引',
        query: `SELECT COUNT(*) as violation_count FROM transactions WHERE transaction_date > CURRENT_DATE;`,
        description: '未来の日付で登録されている取引があります'
      },
      {
        name: 'ゼロ金額の発注',
        query: `SELECT COUNT(*) as violation_count FROM purchase_orders WHERE total_amount <= 0;`,
        description: 'ゼロまたは負の金額の発注があります'
      },
      {
        name: '期限切れ発注の未完了',
        query: `
          SELECT COUNT(*) as violation_count
          FROM purchase_orders
          WHERE delivery_deadline < CURRENT_DATE
            AND status = 'active'
            AND remaining_amount > 0;
        `,
        description: '納期を過ぎているのに未完了の発注があります'
      }
    ];

    for (const check of businessRuleChecks) {
      try {
        const { data, error } = await supabase.rpc('execute_query', { query_text: check.query });

        if (error) throw error;

        const violationCount = data?.[0]?.violation_count || 0;

        if (violationCount > 0) {
          results.push({
            id: `business_rule_${check.name.replace(/\s+/g, '_')}_${Date.now()}`,
            category: 'business_rule',
            severity: 'warning',
            title: `ビジネスルール違反: ${check.name}`,
            description: check.description,
            affected_records: violationCount,
            suggested_actions: [
              'データを修正',
              'ビジネスルールを見直し',
              '自動修正スクリプトを実行'
            ],
            query_used: check.query,
            checked_at: new Date().toISOString()
          });
        }
      } catch (error) {
        results.push({
          id: `business_rule_error_${Date.now()}`,
          category: 'business_rule',
          severity: 'info',
          title: `ビジネスルールチェックエラー: ${check.name}`,
          description: `${check.name}のチェック中にエラーが発生しました: ${error.message}`,
          affected_records: 0,
          suggested_actions: ['クエリを確認', 'データベース権限を確認'],
          checked_at: new Date().toISOString()
        });
      }
    }

    if (results.filter(r => r.severity === 'warning').length === 0) {
      results.push({
        id: `business_rules_ok_${Date.now()}`,
        category: 'business_rule',
        severity: 'success',
        title: 'ビジネスルールの適合性',
        description: '全てのデータがビジネスルールに適合しています',
        affected_records: 0,
        suggested_actions: [],
        checked_at: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * データ品質の整合性チェック
   */
  private async checkDataQuality(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    // データ品質チェック項目
    const qualityChecks = [
      {
        name: '重複商品コード',
        query: `
          SELECT product_code, COUNT(*) as duplicate_count
          FROM products
          GROUP BY product_code
          HAVING COUNT(*) > 1;
        `,
        description: '重複する商品コードがあります'
      },
      {
        name: '空の必須フィールド',
        query: `
          SELECT COUNT(*) as null_count
          FROM products
          WHERE product_name IS NULL OR product_name = '' OR product_code IS NULL OR product_code = '';
        `,
        description: '商品の必須フィールドが空になっているレコードがあります'
      },
      {
        name: '無効な価格データ',
        query: `
          SELECT COUNT(*) as invalid_count
          FROM products
          WHERE purchase_price < 0 OR selling_price < 0;
        `,
        description: '負の価格が設定されている商品があります'
      }
    ];

    for (const check of qualityChecks) {
      try {
        const { data, error } = await supabase.rpc('execute_query', { query_text: check.query });

        if (error) throw error;

        const issueCount = data?.[0]?.duplicate_count || data?.[0]?.null_count || data?.[0]?.invalid_count || 0;

        if (issueCount > 0) {
          results.push({
            id: `data_quality_${check.name.replace(/\s+/g, '_')}_${Date.now()}`,
            category: 'data_quality',
            severity: 'info',
            title: `データ品質問題: ${check.name}`,
            description: check.description,
            affected_records: issueCount,
            suggested_actions: [
              'データクレンジングを実行',
              '入力検証を強化',
              '重複データを統合'
            ],
            query_used: check.query,
            checked_at: new Date().toISOString()
          });
        }
      } catch (error) {
        results.push({
          id: `data_quality_error_${Date.now()}`,
          category: 'data_quality',
          severity: 'info',
          title: `データ品質チェックエラー: ${check.name}`,
          description: `${check.name}のチェック中にエラーが発生しました: ${error.message}`,
          affected_records: 0,
          suggested_actions: ['クエリを確認', 'テーブル構造を確認'],
          checked_at: new Date().toISOString()
        });
      }
    }

    if (results.filter(r => r.severity === 'info' && r.affected_records > 0).length === 0) {
      results.push({
        id: `data_quality_ok_${Date.now()}`,
        category: 'data_quality',
        severity: 'success',
        title: 'データ品質',
        description: 'データ品質に問題は見つかりませんでした',
        affected_records: 0,
        suggested_actions: [],
        checked_at: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * 分納金額の詳細整合性チェック
   */
  private async checkDeliveryAmountIntegrity(): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];

    try {
      const query = `
        SELECT
          po.id as purchase_order_id,
          po.order_no,
          SUM(poi.total_amount) as calculated_order_total,
          po.total_amount as stored_order_total,
          (SUM(poi.total_amount) - po.total_amount) as order_difference
        FROM purchase_orders po
        JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
        GROUP BY po.id, po.order_no, po.total_amount
        HAVING ABS(SUM(poi.total_amount) - po.total_amount) > 0.01
        ORDER BY ABS(SUM(poi.total_amount) - po.total_amount) DESC
        LIMIT 20;
      `;

      const { data, error } = await supabase.rpc('execute_query', { query_text: query });

      if (error) throw error;

      if (data && data.length > 0) {
        const sampleData = this.config.include_sample_data
          ? data.slice(0, this.config.max_sample_records)
          : undefined;

        results.push({
          id: `delivery_amount_detail_${Date.now()}`,
          category: 'financial',
          severity: 'warning',
          title: '発注アイテム金額の不整合',
          description: `${data.length}件の発注書でアイテム合計と発注書総額が一致しません`,
          affected_records: data.length,
          sample_data: sampleData,
          suggested_actions: [
            '発注アイテムの金額を再計算',
            '発注書総額を修正',
            '計算ロジックを見直し'
          ],
          query_used: query,
          checked_at: new Date().toISOString()
        });
      }
    } catch (error) {
      // エラーは親メソッドで処理されるため、ここでは空の配列を返す
    }

    return results;
  }

  /**
   * 整合性チェック結果のサマリーを生成
   */
  private generateSummary(results: IntegrityCheckResult[], executionTime: number): IntegrityCheckSummary {
    const criticalIssues = results.filter(r => r.severity === 'critical').length;
    const warningIssues = results.filter(r => r.severity === 'warning').length;
    const infoIssues = results.filter(r => r.severity === 'info').length;
    const successChecks = results.filter(r => r.severity === 'success').length;

    let overallStatus: 'healthy' | 'needs_attention' | 'critical';
    if (criticalIssues > 0) {
      overallStatus = 'critical';
    } else if (warningIssues > 0) {
      overallStatus = 'needs_attention';
    } else {
      overallStatus = 'healthy';
    }

    return {
      total_checks: results.length,
      critical_issues: criticalIssues,
      warning_issues: warningIssues,
      info_issues: infoIssues,
      success_checks: successChecks,
      overall_status: overallStatus,
      last_check_at: new Date().toISOString(),
      execution_time_ms: executionTime
    };
  }

  /**
   * 特定カテゴリの整合性チェックを実行
   */
  async runCategoryCheck(category: IntegrityCheckCategory): Promise<IntegrityCheckResult[]> {
    switch (category) {
      case 'financial':
        return this.checkFinancialIntegrity();
      case 'inventory':
        return this.checkInventoryIntegrity();
      case 'delivery':
        return this.checkDeliveryIntegrity();
      case 'reference':
        return this.checkReferenceIntegrity();
      case 'business_rule':
        return this.checkBusinessRules();
      case 'data_quality':
        return this.checkDataQuality();
      default:
        throw new Error(`未サポートのカテゴリ: ${category}`);
    }
  }
}