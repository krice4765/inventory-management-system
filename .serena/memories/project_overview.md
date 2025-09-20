# プロジェクト概要

## プロジェクトの目的
- 在庫管理システム（業務用Webアプリケーション）
- 商品、パートナー、取引、注文管理機能を統合
- Supabaseバックエンドを使用したモダンWebアプリ
- Gemini CLIからClaude Codeへの移行プロジェクト

## 技術スタック
- **フロントエンド**: React 18.3.1, TypeScript 5.5.3
- **ビルドツール**: Vite 5.4.19
- **スタイリング**: Tailwind CSS 3.4.1, Framer Motion
- **状態管理**: Zustand 5.0.8, TanStack React Query 5.87.4
- **バックエンド**: Supabase 2.57.4 (PostgreSQL)
- **フォーム**: React Hook Form 7.62.0, Yup
- **UI**: Lucide React, React Hot Toast
- **PDF生成**: jsPDF, PDF-lib
- **テスト**: Vitest, Playwright, Testing Library

## プロジェクト構造
```
src/
├── api/          # API呼び出し層
├── components/   # React コンポーネント
├── hooks/        # カスタムフック
├── lib/          # ライブラリ設定
├── pages/        # ページコンポーネント
├── services/     # ビジネスロジック
├── stores/       # 状態管理
├── styles/       # スタイル
├── types/        # 型定義
└── utils/        # ユーティリティ関数
```

## 主要機能
- 認証システム (Supabase Auth)
- ダッシュボード
- 在庫管理
- 商品管理
- パートナー管理
- 注文管理
- 購入注文管理
- レポート生成（PDF）
- 分納システム
- 整合性管理