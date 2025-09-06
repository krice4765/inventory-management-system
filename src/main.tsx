import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Supabaseクライアントの確実な初期化（重要）
import './lib/supabase'

// 環境変数埋め込み確認ログ
console.log('🚀 仕入管理システム起動開始')
console.log('🌐 デプロイ環境:', import.meta.env.MODE)
console.log('🔧 環境変数確認:')
console.log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ 正常埋め込み' : '❌ 埋め込み失敗')
console.log('  VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ 正常埋め込み' : '❌ 埋め込み失敗')
console.log('📱 WebUI環境準備完了')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
