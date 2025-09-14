import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/supabase'; // 🚨 副作用起動用インポート追加（必須）
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App.tsx';
import './index.css';
import './utils/sql-test-runner'; // SQLテスト実行用
import './utils/excessive-installment-analyzer'; // 過剰分納分析用
import './utils/simple-installment-check'; // シンプル分納チェック
import './utils/correction-executor'; // 分納修正実行
import './utils/safe-correction'; // 安全な修正ツール
import './utils/direct-correction'; // 直接修正ツール
import './utils/batch-correction'; // バッチ修正ツール
import './utils/proportional-reduction'; // 比例削減システム
import './utils/continuous-monitoring'; // 継続監視システム
import './utils/final-system-verification'; // 最終システム検証
import './utils/large-case-processor'; // 大型案件処理システム
import './utils/specific-case-analyzer'; // 特定案件詳細分析システム
import './utils/precise-tax-adjuster'; // 精密税込調整システム
import './utils/performanceMonitor'; // パフォーマンス監視システム
import './utils/integrity-test'; // 整合性テストシステム

// 富士精工様向けシステム用QueryClient - パフォーマンス最適化設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分間キャッシュ
      gcTime: 1000 * 60 * 10, // 10分間メモリ保持
      retry: (failureCount, error) => {
        // 404エラーはリトライしない
        if (error?.status === 404) return false;
        // ネットワークエラー以外は最大2回
        if (error?.message?.includes('NetworkError')) return failureCount < 3;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // 本番環境での不要な再取得を防止
      refetchOnMount: true, // マウント時のデータ更新
      refetchInterval: false, // デフォルトでは自動更新しない
      networkMode: 'online', // オンライン時のみクエリ実行
    },
    mutations: {
      retry: (failureCount, error) => {
        // 重複エラー（409）やバリデーションエラー（400）はリトライしない
        if (error?.status === 409 || error?.status === 400) return false;
        return failureCount < 1; // 変更処理は1回のリトライのみ
      },
      networkMode: 'online',
    },
  },
})

// 環境変数埋め込み確認ログ
console.log('🚀 仕入管理システム起動開始')
console.log('🌐 デプロイ環境:', import.meta.env.MODE)
console.log('🔧 環境変数確認:')
console.log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ 正常埋め込み' : '❌ 埋め込み失敗')
console.log('  VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ 正常埋め込み' : '❌ 埋め込み失敗')
console.log('📊 React Query初期化完了')
console.log('📱 WebUI環境準備完了')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* 開発環境でのみDevToolsを表示 */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>,
)
