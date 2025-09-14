import { supabase } from '../lib/supabase'

/**
 * システム整合性テストユーティリティ
 */
export class IntegrityTester {
  /**
   * テーブル構造を確認
   */
  static async checkTableSchema(tableName: string) {
    try {
      const { data, error } = await supabase.rpc('check_table_schema', {
        table_name_param: tableName
      })

      if (error) throw error

      console.log(`✅ ${tableName}テーブル構造:`, {
        columns: data.column_count,
        details: data.columns
      })

      return data
    } catch (error) {
      console.error(`❌ ${tableName}テーブル構造確認エラー:`, error)
      throw error
    }
  }

  /**
   * 一括整合性修正を実行
   */
  static async fixAllIntegrityIssues() {
    try {
      console.log('🔧 一括整合性修正を開始...')

      const { data, error } = await supabase.rpc('fix_all_integrity_issues')

      if (error) throw error

      console.log('✅ 一括修正完了:', {
        success: data.success,
        totalFixed: data.total_fixed,
        orderFixes: data.order_fixes,
        inventoryFixes: data.inventory_fixes,
        message: data.message
      })

      return data
    } catch (error) {
      console.error('❌ 一括修正エラー:', error)
      throw error
    }
  }

  /**
   * 発注書合計値を修正
   */
  static async fixPurchaseOrderTotals() {
    try {
      console.log('📋 発注書合計値修正を開始...')

      const { data, error } = await supabase.rpc('fix_purchase_order_totals')

      if (error) throw error

      console.log('✅ 発注書修正完了:', data)

      return data
    } catch (error) {
      console.error('❌ 発注書修正エラー:', error)
      throw error
    }
  }

  /**
   * 在庫数量を修正
   */
  static async fixInventoryQuantities() {
    try {
      console.log('📦 在庫数量修正を開始...')

      const { data, error } = await supabase.rpc('fix_inventory_quantities')

      if (error) throw error

      console.log('✅ 在庫修正完了:', data)

      return data
    } catch (error) {
      console.error('❌ 在庫修正エラー:', error)
      throw error
    }
  }

  /**
   * 全体的な整合性テストを実行
   */
  static async runFullIntegrityTest() {
    try {
      console.log('🚀 システム整合性テストを開始...')

      // 1. テーブル構造確認
      await IntegrityTester.checkTableSchema('products')
      await IntegrityTester.checkTableSchema('purchase_orders')
      await IntegrityTester.checkTableSchema('transactions')

      // 2. 個別修正テスト
      await IntegrityTester.fixPurchaseOrderTotals()
      await IntegrityTester.fixInventoryQuantities()

      // 3. 一括修正テスト
      await IntegrityTester.fixAllIntegrityIssues()

      console.log('🎉 全体的な整合性テスト完了')

      return true
    } catch (error) {
      console.error('💥 整合性テスト失敗:', error)
      return false
    }
  }
}

/**
 * ブラウザコンソールからテストを実行するためのグローバル関数
 */
declare global {
  interface Window {
    testIntegrity: typeof IntegrityTester.runFullIntegrityTest;
    fixIntegrity: typeof IntegrityTester.fixAllIntegrityIssues;
    checkSchema: typeof IntegrityTester.checkTableSchema;
  }
}

// ブラウザコンソールでアクセス可能にする
if (typeof window !== 'undefined') {
  window.testIntegrity = IntegrityTester.runFullIntegrityTest
  window.fixIntegrity = IntegrityTester.fixAllIntegrityIssues
  window.checkSchema = IntegrityTester.checkTableSchema
}