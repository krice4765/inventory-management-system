/**
 * RPC関数診断ツール
 * create_installment_v2 の404エラー根本原因分析
 */

import { supabase } from '../lib/supabase';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  data?: any;
  error?: any;
}

export class RPCDiagnostics {

  /**
   * 包括的診断実行
   */
  static async runFullDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    console.log('🔍 RPC関数診断開始: create_installment_v2');

    // Test 1: Supabase接続確認
    results.push(await this.testSupabaseConnection());

    // Test 2: RPC関数存在確認
    results.push(await this.testRPCFunctionExists());

    // Test 3: 最小パラメータでのRPC呼び出しテスト
    results.push(await this.testMinimalRPCCall());

    // Test 4: 完全パラメータでのRPC呼び出しテスト
    results.push(await this.testFullRPCCall());

    // Test 5: 権限確認
    results.push(await this.testRPCPermissions());

    // Test 6: Supabaseクライアント設定確認
    results.push(await this.testSupabaseClientConfig());

    // 結果サマリー
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const warningCount = results.filter(r => r.status === 'warning').length;

    console.log('🎯 診断結果サマリー:', {
      total: results.length,
      success: successCount,
      errors: errorCount,
      warnings: warningCount,
      successRate: `${Math.round((successCount / results.length) * 100)}%`
    });

    results.forEach(result => {
      const icon = result.status === 'success' ? '✅' :
                  result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${result.test}: ${result.message}`);
      if (result.error) {
        console.log(`   Error:`, result.error);
      }
      if (result.data) {
        console.log(`   Data:`, result.data);
      }
    });

    return results;
  }

  /**
   * Test 1: Supabase接続確認
   */
  static async testSupabaseConnection(): Promise<DiagnosticResult> {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('count')
        .limit(1)
        .single();

      if (error) {
        return {
          test: 'Supabase接続確認',
          status: 'error',
          message: 'データベース接続失敗',
          error: error
        };
      }

      return {
        test: 'Supabase接続確認',
        status: 'success',
        message: 'データベース接続正常',
        data: { url: supabase.supabaseUrl }
      };
    } catch (error) {
      return {
        test: 'Supabase接続確認',
        status: 'error',
        message: '接続テスト例外発生',
        error: error
      };
    }
  }

  /**
   * Test 2: RPC関数存在確認（メタデータクエリ）
   */
  static async testRPCFunctionExists(): Promise<DiagnosticResult> {
    try {
      // information_schemaから関数情報を取得
      const { data, error } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_type, specific_name')
        .eq('routine_schema', 'public')
        .eq('routine_name', 'create_installment_v2');

      if (error) {
        return {
          test: 'RPC関数存在確認',
          status: 'warning',
          message: 'メタデータアクセス不可（権限制限の可能性）',
          error: error
        };
      }

      if (!data || data.length === 0) {
        return {
          test: 'RPC関数存在確認',
          status: 'error',
          message: 'create_installment_v2関数が見つかりません',
          data: { searched_schema: 'public', function_name: 'create_installment_v2' }
        };
      }

      return {
        test: 'RPC関数存在確認',
        status: 'success',
        message: `関数発見: ${data.length}個`,
        data: data
      };
    } catch (error) {
      return {
        test: 'RPC関数存在確認',
        status: 'error',
        message: 'メタデータクエリ例外',
        error: error
      };
    }
  }

  /**
   * Test 3: 最小パラメータでのRPC呼び出し
   */
  static async testMinimalRPCCall(): Promise<DiagnosticResult> {
    try {
      // テスト用のUUIDを生成
      const testOrderId = '00000000-0000-4000-8000-000000000001';

      const { data, error } = await supabase.rpc('create_installment_v2', {
        p_parent_order_id: testOrderId,
        p_partner_id: null,
        p_transaction_date: '2025-09-16',
        p_due_date: '2025-09-23',
        p_total_amount: 1000.00,
        p_memo: 'RPC診断テスト'
      });

      if (error) {
        // 404エラーの場合
        if (error.message?.includes('does not exist') || error.code === '42883') {
          return {
            test: '最小パラメータRPC呼び出し',
            status: 'error',
            message: '404 Not Found - 関数が本番環境に存在しない',
            error: {
              code: error.code,
              message: error.message,
              hint: '本番Supabaseプロジェクトでfix_installment_schema.sqlを実行してください'
            }
          };
        }

        return {
          test: '最小パラメータRPC呼び出し',
          status: 'error',
          message: `RPC呼び出し失敗: ${error.message}`,
          error: error
        };
      }

      return {
        test: '最小パラメータRPC呼び出し',
        status: 'success',
        message: 'RPC関数呼び出し成功',
        data: data
      };
    } catch (error) {
      return {
        test: '最小パラメータRPC呼び出し',
        status: 'error',
        message: 'RPC呼び出し例外',
        error: error
      };
    }
  }

  /**
   * Test 4: 完全パラメータでのRPC呼び出し
   */
  static async testFullRPCCall(): Promise<DiagnosticResult> {
    try {
      const testOrderId = '00000000-0000-4000-8000-000000000002';

      const { data, error } = await supabase.rpc('create_installment_v2', {
        p_parent_order_id: testOrderId,
        p_partner_id: '00000000-0000-4000-8000-000000000003',
        p_transaction_date: '2025-09-16',
        p_due_date: '2025-09-23',
        p_total_amount: 2500.00,
        p_memo: 'RPC完全パラメータテスト',
        p_delivery_sequence: 1,
        p_product_name: 'テスト商品',
        p_unit_price: 2500.00,
        p_quantity: 1
      });

      if (error) {
        return {
          test: '完全パラメータRPC呼び出し',
          status: 'error',
          message: `完全パラメータRPC失敗: ${error.message}`,
          error: error
        };
      }

      return {
        test: '完全パラメータRPC呼び出し',
        status: 'success',
        message: '完全パラメータRPC成功',
        data: data
      };
    } catch (error) {
      return {
        test: '完全パラメータRPC呼び出し',
        status: 'error',
        message: '完全パラメータRPC例外',
        error: error
      };
    }
  }

  /**
   * Test 5: RPC権限確認
   */
  static async testRPCPermissions(): Promise<DiagnosticResult> {
    try {
      // 現在のユーザーロール確認
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        return {
          test: 'RPC権限確認',
          status: 'warning',
          message: 'ユーザー情報取得失敗（匿名アクセス）',
          error: userError
        };
      }

      const userRole = userData.user ? 'authenticated' : 'anon';

      return {
        test: 'RPC権限確認',
        status: 'success',
        message: `現在のロール: ${userRole}`,
        data: {
          user_id: userData.user?.id,
          role: userRole,
          expected_grants: ['authenticated', 'anon']
        }
      };
    } catch (error) {
      return {
        test: 'RPC権限確認',
        status: 'error',
        message: '権限確認例外',
        error: error
      };
    }
  }

  /**
   * Test 6: Supabaseクライアント設定確認
   */
  static async testSupabaseClientConfig(): Promise<DiagnosticResult> {
    try {
      const config = {
        url: supabase.supabaseUrl,
        key: supabase.supabaseKey?.substring(0, 20) + '...',
        auth: {
          autoRefreshToken: supabase.auth.autoRefreshToken,
          persistSession: supabase.auth.persistSession
        }
      };

      // URLとキーの基本検証
      if (!supabase.supabaseUrl.includes('supabase.co')) {
        return {
          test: 'Supabaseクライアント設定',
          status: 'error',
          message: '無効なSupabase URL',
          data: config
        };
      }

      if (!supabase.supabaseKey || supabase.supabaseKey.length < 50) {
        return {
          test: 'Supabaseクライアント設定',
          status: 'error',
          message: '無効なSupabase APIキー',
          data: config
        };
      }

      return {
        test: 'Supabaseクライアント設定',
        status: 'success',
        message: 'クライアント設定正常',
        data: config
      };
    } catch (error) {
      return {
        test: 'Supabaseクライアント設定',
        status: 'error',
        message: '設定確認例外',
        error: error
      };
    }
  }

  /**
   * 簡単な診断実行（コンソールログのみ）
   */
  static async quickDiagnostic(): Promise<void> {
    console.log('🚀 RPC関数クイック診断開始');

    const results = await this.runFullDiagnostics();

    const hasErrors = results.some(r => r.status === 'error');
    const mainIssue = results.find(r => r.status === 'error');

    if (hasErrors) {
      console.log('🚨 診断結果: 問題発見');
      console.log('🎯 主要問題:', mainIssue?.message);
      console.log('💡 推奨対応:', mainIssue?.error?.hint || '詳細ログを確認してください');
    } else {
      console.log('✅ 診断結果: 正常動作');
    }
  }
}