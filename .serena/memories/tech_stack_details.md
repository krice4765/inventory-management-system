# 技術スタック詳細

## 開発環境
- **Node.js**: ESModule形式
- **TypeScript**: 厳格モード有効
- **Vite**: 高速ビルド、HMR対応
- **ESLint**: 厳格なリンティング設定

## フロントエンド技術
- **React**: 関数コンポーネント、Hooks中心
- **TypeScript**: 厳格な型チェック
- **Tailwind CSS**: ユーティリティファースト
- **Framer Motion**: アニメーション
- **React Router v7**: SPA ルーティング

## 状態管理
- **Zustand**: 軽量状態管理
- **TanStack React Query**: サーバー状態管理
- **React Hook Form**: フォーム状態管理

## バックエンド接続
- **Supabase**: BaaS、PostgreSQL、リアルタイム機能
- **Row Level Security (RLS)**: データベースレベルセキュリティ

## パフォーマンス最適化
- **コード分割**: Manual chunks設定
- **Bundle Analysis**: rollup-plugin-visualizer
- **Tree Shaking**: 不要コード除去
- **Lazy Loading**: 遅延読み込み

## セキュリティ
- **認証**: Supabase Auth
- **型安全性**: TypeScript厳格モード
- **XSS対策**: React標準の保護