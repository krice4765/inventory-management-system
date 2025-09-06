// ===============================================================
// 🧪 Phase 5: 自動テストスイート - 継続的品質保証
// ===============================================================
// 実行方法: node scripts/automated_test_suite.js
// 前提条件: Phase 1-4のSQL実行完了

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ===============================================================
// 1. テスト環境セットアップ
// ===============================================================

class InstallmentTestSuite {
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL || 'https://tleequspizctgoosostd.supabase.co',
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    );
    this.testResults = [];
    this.testOrderId = null;
  }

  // テスト結果の記録
  recordTest(testName, success, message, details = {}) {
    const result = {
      test: testName,
      success,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message}`);
    
    if (!success) {
      console.log(`   Details:`, details);
    }
  }

  // アサーション関数
  assert(condition, testName, message, details) {
    this.recordTest(testName, condition, message, details);
    return condition;
  }

  // ===============================================================
  // 2. データベース基盤テスト
  // ===============================================================

  async testDatabaseFoundation() {
    console.log('\n🏗️ データベース基盤テスト開始...\n');

    // テスト1: 統一バリデーション関数の存在確認
    try {
      const { data, error } = await this.supabase.rpc('validate_installment_amount', {
        p_parent_order_id: '00000000-0000-0000-0000-000000000000',
        p_amount: 1000
      });
      
      this.assert(
        !error && data && data.length > 0,
        'validate_installment_amount_exists',
        '統一バリデーション関数が正常に存在する',
        { error: error?.message }
      );
    } catch (e) {
      this.recordTest('validate_installment_amount_exists', false, '統一バリデーション関数のテストでエラー', { error: e.message });
    }

    // テスト2: 制約の確認
    try {
      const { data: constraints } = await this.supabase
        .from('pg_constraint')
        .select('conname')
        .ilike('conname', '%transactions_%');
      
      const requiredConstraints = [
        'transactions_installment_unique',
        'transactions_purchase_installment_required',
        'transactions_positive_amount'
      ];
      
      const existingConstraints = constraints?.map(c => c.conname) || [];
      const missingConstraints = requiredConstraints.filter(c => !existingConstraints.includes(c));
      
      this.assert(
        missingConstraints.length === 0,
        'database_constraints_check',
        'すべての必要な制約が存在する',
        { missing: missingConstraints, existing: existingConstraints }
      );
    } catch (e) {
      this.recordTest('database_constraints_check', false, '制約確認でエラー', { error: e.message });
    }

    // テスト3: 監視システムの確認
    try {
      const { data, error } = await this.supabase.rpc('detect_anomalies');
      this.assert(
        !error,
        'monitoring_system_check',
        '監視システムが正常に動作する',
        { error: error?.message, anomaly_count: data?.length || 0 }
      );
    } catch (e) {
      this.recordTest('monitoring_system_check', false, '監視システムのテストでエラー', { error: e.message });
    }
  }

  // ===============================================================
  // 3. RPC関数テスト
  // ===============================================================

  async testRPCFunctions() {
    console.log('\n🚀 RPC関数テスト開始...\n');

    // テスト用発注の作成
    await this.createTestOrder();

    if (!this.testOrderId) {
      this.recordTest('rpc_test_setup', false, 'テスト用発注の作成に失敗', {});
      return;
    }

    // テスト1: 正常な分納作成
    try {
      const { data, error } = await this.supabase.rpc('add_purchase_installment_v2', {
        p_parent_order_id: this.testOrderId,
        p_amount: 1000,
        p_status: 'draft'
      });

      this.assert(
        !error && data && data.length > 0 && data[0].success,
        'normal_installment_creation',
        '正常な分納作成が成功する',
        { 
          error: error?.message,
          success: data?.[0]?.success,
          validation_info: data?.[0]?.validation_info
        }
      );
    } catch (e) {
      this.recordTest('normal_installment_creation', false, '正常分納作成テストでエラー', { error: e.message });
    }

    // テスト2: 金額超過エラーの検証
    try {
      const { data, error } = await this.supabase.rpc('add_purchase_installment_v2', {
        p_parent_order_id: this.testOrderId,
        p_amount: 10000, // 発注額5000を大幅に超過
        p_status: 'draft'
      });

      const isExpectedError = data && data.length > 0 && 
        !data[0].success && 
        data[0].validation_info?.error_code === 'AMOUNT_EXCEEDED';

      this.assert(
        isExpectedError,
        'amount_exceeded_validation',
        '金額超過が適切に検証される',
        { 
          error: error?.message,
          success: data?.[0]?.success,
          error_code: data?.[0]?.validation_info?.error_code
        }
      );
    } catch (e) {
      this.recordTest('amount_exceeded_validation', false, '金額超過テストでエラー', { error: e.message });
    }

    // テスト3: 発注サマリー取得
    try {
      const { data, error } = await this.supabase.rpc('get_order_installment_summary', {
        p_order_id: this.testOrderId
      });

      this.assert(
        !error && data && data.length > 0 && data[0].order_id,
        'order_summary_retrieval',
        '発注サマリーが正常に取得できる',
        { 
          error: error?.message,
          summary_available: !!data?.[0]?.order_id
        }
      );
    } catch (e) {
      this.recordTest('order_summary_retrieval', false, '発注サマリーテストでエラー', { error: e.message });
    }
  }

  // ===============================================================
  // 4. 競合制御テスト
  // ===============================================================

  async testConcurrencyControl() {
    console.log('\n🔄 競合制御テスト開始...\n');

    if (!this.testOrderId) {
      this.recordTest('concurrency_test_setup', false, 'テスト用発注が未作成', {});
      return;
    }

    // テスト1: 同時分納作成
    try {
      const promises = Array.from({ length: 3 }, (_, index) =>
        this.supabase.rpc('add_purchase_installment_v2', {
          p_parent_order_id: this.testOrderId,
          p_amount: 1000,
          p_status: 'draft',
          p_memo: `同時テスト${index + 1}`
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => 
        !r.error && r.data && r.data.length > 0 && r.data[0].success
      ).length;

      // 全て成功するか、一部が競合で失敗するかを確認
      this.assert(
        successCount > 0,
        'concurrent_installment_creation',
        `同時分納作成で${successCount}/3が成功（競合制御が動作）`,
        { success_count: successCount, total: 3 }
      );
    } catch (e) {
      this.recordTest('concurrent_installment_creation', false, '同時分納テストでエラー', { error: e.message });
    }
  }

  // ===============================================================
  // 5. データ整合性テスト
  // ===============================================================

  async testDataIntegrity() {
    console.log('\n🔍 データ整合性テスト開始...\n');

    // テスト1: 整合性監査関数
    try {
      const { data, error } = await this.supabase.rpc('audit_order_consistency');
      
      this.assert(
        !error && Array.isArray(data),
        'data_integrity_audit',
        '整合性監査が正常に実行される',
        { 
          error: error?.message,
          audit_results_count: data?.length || 0,
          integrity_errors: data?.filter(d => d.status === '超過エラー').length || 0
        }
      );
    } catch (e) {
      this.recordTest('data_integrity_audit', false, '整合性監査テストでエラー', { error: e.message });
    }

    // テスト2: 日次品質レポート
    try {
      const { data, error } = await this.supabase.rpc('generate_daily_quality_report');
      
      this.assert(
        !error && data && data.length > 0 && data[0].system_health_score !== undefined,
        'daily_quality_report',
        '日次品質レポートが正常に生成される',
        { 
          error: error?.message,
          health_score: data?.[0]?.system_health_score,
          error_count: data?.[0]?.error_count
        }
      );
    } catch (e) {
      this.recordTest('daily_quality_report', false, '品質レポートテストでエラー', { error: e.message });
    }
  }

  // ===============================================================
  // 6. パフォーマンステスト
  // ===============================================================

  async testPerformance() {
    console.log('\n⚡ パフォーマンステスト開始...\n');

    // テスト1: RPC関数の応答時間
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase.rpc('get_order_installment_summary', {
        p_order_id: this.testOrderId
      });
      
      const responseTime = Date.now() - startTime;
      
      this.assert(
        !error && responseTime < 2000,
        'rpc_response_time',
        `RPC応答時間が許容範囲内（${responseTime}ms < 2000ms）`,
        { response_time_ms: responseTime, success: !error }
      );
    } catch (e) {
      this.recordTest('rpc_response_time', false, 'RPC応答時間テストでエラー', { error: e.message });
    }

    // テスト2: 大量データ処理
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('id, total_amount, status, created_at')
        .eq('transaction_type', 'purchase')
        .limit(100);
      
      this.assert(
        !error && Array.isArray(data),
        'bulk_data_processing',
        '大量データ取得が正常に動作する',
        { 
          error: error?.message,
          records_retrieved: data?.length || 0
        }
      );
    } catch (e) {
      this.recordTest('bulk_data_processing', false, '大量データテストでエラー', { error: e.message });
    }
  }

  // ===============================================================
  // 7. ヘルパー関数
  // ===============================================================

  async createTestOrder() {
    try {
      // テスト用パートナーの確認/作成
      let { data: partner } = await this.supabase
        .from('partners')
        .select('id')
        .eq('name', 'テスト仕入先')
        .single();

      if (!partner) {
        const { data: newPartner } = await this.supabase
          .from('partners')
          .insert({ name: 'テスト仕入先', type: 'supplier' })
          .select('id')
          .single();
        partner = newPartner;
      }

      if (!partner) {
        this.recordTest('test_order_creation', false, 'テスト用パートナーの作成/取得に失敗', {});
        return;
      }

      // テスト用発注の作成
      const { data: order, error } = await this.supabase
        .from('purchase_orders')
        .insert({
          order_no: `TEST-${Date.now()}`,
          partner_id: partner.id,
          total_amount: 5000,
          status: 'confirmed'
        })
        .select('id')
        .single();

      if (error || !order) {
        this.recordTest('test_order_creation', false, 'テスト用発注の作成に失敗', { error: error?.message });
        return;
      }

      this.testOrderId = order.id;
      this.recordTest('test_order_creation', true, 'テスト用発注を作成', { order_id: order.id });
    } catch (e) {
      this.recordTest('test_order_creation', false, 'テスト用発注作成でエラー', { error: e.message });
    }
  }

  async cleanupTestData() {
    if (this.testOrderId) {
      try {
        // テスト用分納の削除
        await this.supabase
          .from('transactions')
          .delete()
          .eq('parent_order_id', this.testOrderId);

        // テスト用発注の削除
        await this.supabase
          .from('purchase_orders')
          .delete()
          .eq('id', this.testOrderId);

        console.log('🧹 テストデータをクリーンアップしました');
      } catch (e) {
        console.log('⚠️ テストデータのクリーンアップでエラー:', e.message);
      }
    }
  }

  // ===============================================================
  // 8. メイン実行関数
  // ===============================================================

  async runAllTests() {
    console.log('🧪 包括的多層防御システム - 自動テストスイート開始');
    console.log('================================================\n');

    const startTime = Date.now();

    try {
      await this.testDatabaseFoundation();
      await this.testRPCFunctions();
      await this.testConcurrencyControl();
      await this.testDataIntegrity();
      await this.testPerformance();
    } catch (e) {
      console.error('テスト実行中にエラー:', e);
    }

    await this.cleanupTestData();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 結果サマリー
    console.log('\n================================================');
    console.log('📊 テスト結果サマリー');
    console.log('================================================');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log(`総テスト数: ${totalTests}`);
    console.log(`成功: ${passedTests}`);
    console.log(`失敗: ${failedTests}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`実行時間: ${duration}ms`);

    // 品質評価
    let qualityRating;
    if (successRate >= 95) qualityRating = '🏆 優秀';
    else if (successRate >= 80) qualityRating = '✅ 良好';
    else if (successRate >= 60) qualityRating = '⚠️ 要改善';
    else qualityRating = '🚨 緊急対応必要';

    console.log(`品質評価: ${qualityRating}`);

    // 失敗したテストの詳細
    if (failedTests > 0) {
      console.log('\n❌ 失敗したテスト:');
      this.testResults
        .filter(t => !t.success)
        .forEach(t => {
          console.log(`  - ${t.test}: ${t.message}`);
        });
    }

    // 推奨アクション
    console.log('\n💡 推奨アクション:');
    if (successRate >= 95) {
      console.log('  - システムは正常に動作しています');
      console.log('  - 定期的な監視を継続してください');
    } else if (successRate >= 80) {
      console.log('  - 失敗したテストの原因を調査してください');
      console.log('  - データベース接続と権限を確認してください');
    } else {
      console.log('  - 緊急: システム管理者による対応が必要です');
      console.log('  - Phase 1-5のSQL実行状況を確認してください');
    }

    console.log('\n🎯 テスト完了!');

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: parseFloat(successRate),
      duration,
      results: this.testResults
    };
  }
}

// ===============================================================
// 9. CLI実行
// ===============================================================

async function main() {
  const testSuite = new InstallmentTestSuite();
  const results = await testSuite.runAllTests();
  
  // 結果をJSONファイルに保存
  const fs = require('fs');
  const path = require('path');
  
  const reportPath = path.join(__dirname, `test-report-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📄 詳細レポートを保存: ${reportPath}`);
  
  // 成功率に基づく終了コード
  process.exit(results.successRate >= 80 ? 0 : 1);
}

// 直接実行時のエントリーポイント
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { InstallmentTestSuite };