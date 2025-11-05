// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import './index.css'

// QueryClientインスタンスの作成（Phase 16B最適化）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate pattern
      staleTime: 2 * 60 * 1000,         // 2分間データを新鮮として扱う（デフォルト）
      gcTime: 30 * 60 * 1000,           // 30分間キャッシュを保持

      // リトライ戦略: ネットワークエラーのみリトライ
      retry: (failureCount, error: any) => {
        // 認証エラー（401, 403）やクライアントエラー（400番台）はリトライしない
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        // サーバーエラー（500番台）やネットワークエラーは最大2回リトライ
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数バックオフ

      // バックグラウンド更新戦略
      refetchOnWindowFocus: true,       // ウィンドウフォーカス時にデータを再取得（stale時のみ）
      refetchOnReconnect: true,         // ネットワーク再接続時にデータを再取得
      refetchOnMount: true,             // コンポーネントマウント時にデータを再取得（stale時のみ）

      // ネットワーク最適化
      networkMode: 'online',            // オンライン時のみクエリを実行
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* 開発時のReact Query DevTools */}
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </React.StrictMode>,
)