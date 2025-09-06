/**
 * API統合テストフレームワーク
 * P0001エラー対応と包括的テストスイート
 */

import { supabase } from '../lib/supabase';

// テスト結果の型定義
interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

interface ApiTestSuite {
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

/**
 * 分納API統合テストクラス
 */
export class InstallmentApiTester {
  private results: TestResult[] = [];

  /**
   * 新しい分納作成テスト（成功ケース）- 修正版
   */
  async testCreateInstallmentSuccess(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '分納作成成功テスト';

    try {
      // v_order_payment_summary を使用して残額のある発注を取得
      const { data: orders, error: orderError } = await supabase
        .from('v_order_payment_summary')
        .select('order_id, order_total, remaining_amount')
        .gt('remaining_amount', 0)
        .limit(1);

      if (orderError || !orders || orders.length === 0) {
        throw new Error('残額のある発注が見つかりません');
      }

      const order = orders[0];
      const amount = Math.max(1, Math.floor(order.remaining_amount * 0.1)); // 残額の10%

      // 正しいRPC関数名を使用
      const { data, error } = await supabase.rpc('add_purchase_installment_secure', {
        p_order_id: order.order_id,
        p_amount: amount,
        p_transaction_no: `TEST-${Date.now()}`
      });

      if (error) {
        throw new Error(`RPC実行エラー: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      return {
        testName,
        success: true,
        duration,
        data: data
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * P0001エラー発生テスト - 修正版
   */
  async testP0001ErrorHandling(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = 'P0001エラーハンドリングテスト';

    try {
      // 完全支払済み発注を探す
      let { data: paidOrders } = await supabase
        .from('v_order_payment_summary')
        .select('order_id, remaining_amount')
        .eq('remaining_amount', 0)
        .limit(1);

      let testOrderId: string;
      let testAmount: number;

      if (paidOrders && paidOrders.length > 0) {
        // 完全支払済み発注に1円を追加してP0001を発生させる
        testOrderId = paidOrders[0].order_id;
        testAmount = 1;
      } else {
        // 完全支払済みがない場合、残額のある発注で超過額をテスト
        const { data: partialOrders } = await supabase
          .from('v_order_payment_summary')
          .select('order_id, remaining_amount')
          .gt('remaining_amount', 0)
          .limit(1);

        if (!partialOrders || partialOrders.length === 0) {
          throw new Error('テスト用の発注が見つかりません');
        }

        testOrderId = partialOrders[0].order_id;
        testAmount = partialOrders[0].remaining_amount + 1; // 残額+1で超過
      }

      // 超過額での分納作成を試行
      const { data, error } = await supabase.rpc('add_purchase_installment_secure', {
        p_order_id: testOrderId,
        p_amount: testAmount,
        p_transaction_no: `TEST-P0001-${Date.now()}`
      });

      // エラーが発生しなかった場合は失敗
      if (!error) {
        throw new Error('P0001エラーが期待通りに発生しませんでした');
      }

      // P0001エラーの確認
      if (error.code === 'P0001') {
        const duration = Date.now() - startTime;
        return {
          testName,
          success: true,
          duration,
          data: {
            errorCode: error.code,
            message: error.message
          }
        };
      }

      throw new Error(`期待しないエラー: ${error.code} - ${error.message}`);

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 担当者一覧取得テスト - 修正版
   */
  async testStaffMembersList(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = '担当者一覧取得テスト';

    try {
      // list_staff_members RPC を使用
      const { data, error } = await supabase.rpc('list_staff_members', { 
        p_only_active: true 
      });

      if (error) {
        throw new Error(`担当者一覧取得エラー: ${error.message}`);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('担当者データが見つかりません');
      }

      // データ構造の検証
      const firstStaff = data[0];
      const requiredFields = ['id', 'name', 'is_active'];
      for (const field of requiredFields) {
        if (!(field in firstStaff)) {
          throw new Error(`必要なフィールドが不足: ${field}`);
        }
      }

      const duration = Date.now() - startTime;
      return {
        testName,
        success: true,
        duration,
        data: {
          totalCount: data.length,
          activeCount: data.filter(s => s.is_active).length,
          sample: data[0]
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * システムヘルスチェックテスト - 修正版
   */
  async testSystemHealth(): Promise<TestResult> {
    const startTime = Date.now();
    const testName = 'システムヘルスチェックテスト';

    try {
      // v_system_dashboard ビューを使用
      const { data, error } = await supabase
        .from('v_system_dashboard')
        .select('*')
        .maybeSingle();

      if (error) {
        throw new Error(`システムヘルスチェックエラー: ${error.message}`);
      }

      if (!data) {
        throw new Error('ヘルスチェックデータが取得できません');
      }

      const duration = Date.now() - startTime;
      return {
        testName,
        success: true,
        duration,
        data: data
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 全テストスイートを実行
   */
  async runAllTests(): Promise<ApiTestSuite> {
    console.log('🧪 API統合テストスイート開始...');
    const suiteStartTime = Date.now();
    const results: TestResult[] = [];

    // 各テストを順次実行
    const tests = [
      () => this.testCreateInstallmentSuccess(),
      () => this.testP0001ErrorHandling(),
      () => this.testStaffMembersList(),
      () => this.testSystemHealth()
    ];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
        
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.testName} (${result.duration}ms)`);
        
        if (!result.success) {
          console.error(`   エラー: ${result.error}`);
        } else if (result.data) {
          console.log(`   結果: ${JSON.stringify(result.data, null, 2)}`);
        }
      } catch (error) {
        results.push({
          testName: 'テスト実行エラー',
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const suiteDuration = Date.now() - suiteStartTime;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = results.length - passedTests;

    const suite: ApiTestSuite = {
      suiteName: 'API統合テストスイート',
      results,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration: suiteDuration
    };

    console.log('\n📊 テスト結果サマリー');
    console.log(`総テスト数: ${suite.totalTests}`);
    console.log(`✅ 成功: ${suite.passedTests}`);
    console.log(`❌ 失敗: ${suite.failedTests}`);
    console.log(`⏱️ 実行時間: ${suite.duration}ms`);

    return suite;
  }

  /**
   * 簡易テスト実行（コンソール用）
   */
  static async quickTest(): Promise<void> {
    const tester = new InstallmentApiTester();
    
    try {
      console.log('🚀 API統合テスト開始');
      const results = await tester.runAllTests();
      
      if (results.failedTests === 0) {
        console.log('\n🎉 すべてのテストが成功しました！');
      } else {
        console.warn(`\n⚠️  ${results.failedTests}個のテストが失敗しました`);
      }
    } catch (error) {
      console.error('❌ テスト実行中にエラーが発生しました:', error);
    }
  }
}

// 開発時のクイックテスト実行
if (import.meta.env.DEV) {
  // @ts-ignore
  window.runApiTests = () => InstallmentApiTester.quickTest();
}