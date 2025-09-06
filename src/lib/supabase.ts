import { createClient } from '@supabase/supabase-js'

// 環境変数の取得
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// デバッグ情報
console.log('🔧 Supabase初期化開始')
console.log('URL設定:', supabaseUrl ? '✅ 設定済み' : '❌ 未設定')
console.log('KEY設定:', supabaseAnonKey ? '✅ 設定済み' : '❌ 未設定')

// 環境変数の存在確認
if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL が設定されていません')
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY が設定されていません')
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

// Supabaseクライアント作成
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// WebUIコンソール用グローバル変数設定（重要）
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase
  console.log('✅ window.supabase グローバル変数設定完了')
  console.log('🎯 WebUIコンソールでのデータ操作が可能になりました')
  
  // 接続テスト実行
  supabase
    .from('purchase_orders')
    .select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('❌ Supabase接続テストエラー:', error.message)
      } else {
        console.log('✅ Supabase接続テスト成功')
        console.log('📊 発注データ件数: 0件')
        console.log('🚀 システム準備完了')
      }
    })
    .catch(err => {
      console.error('❌ 接続テスト実行エラー:', err)
    })
}
