# コードアーキテクチャ

## 📁 ディレクトリ構造

### `src/components/` - UIコンポーネント
- **Layout/**: ヘッダー、サイドバー、メインレイアウト
- **common/**: 再利用可能な共通コンポーネント
- **Dashboard/**: ダッシュボード関連コンポーネント
- **products/**: 商品管理UI
- **transactions/**: 取引関連UI
- **inventory/**: 在庫管理UI
- **ui/**: 基本UIコンポーネント
- **enhanced/**: 機能拡張コンポーネント
- **shared/**: プロジェクト間共有コンポーネント

### `src/hooks/` - カスタムフック
- **useAuth.ts**: 認証関連ロジック
- **useProducts.ts**: 商品データ管理
- **useTransactions.ts**: 取引データ管理
- **useInventory.ts**: 在庫データ管理
- **useOptimized*.ts**: パフォーマンス最適化フック
- **useSystem*.ts**: システム監視・整合性管理

### `src/stores/` - 状態管理
- **authStore.ts**: 認証状態（Zustand）
- **deliveryModal.store.ts**: 配送モーダル状態
- **addInstallmentModal.store.ts**: 分納追加モーダル
- **darkModeStore.ts**: ダークモード設定

### `src/pages/` - ページコンポーネント
- **Dashboard.tsx**: メインダッシュボード
- **Products.tsx**: 商品管理画面
- **Inventory.tsx**: 在庫管理画面
- **Orders.tsx**: 注文管理画面
- **Partners.tsx**: パートナー管理画面
- **Login.tsx**: ログイン画面

## 🏗️ アーキテクチャパターン

### データフロー
```
UI Components → Custom Hooks → API Layer → Supabase
     ↓              ↓              ↓
Zustand Stores ← TanStack Query ← Database
```

### 責任分離
- **Components**: 表示ロジックのみ
- **Hooks**: ビジネスロジック、データ取得
- **Stores**: アプリケーション状態
- **API**: データアクセス層