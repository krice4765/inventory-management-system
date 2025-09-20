# 推奨コマンド集

## 開発コマンド
```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プレビューサーバー
npm run preview
```

## 品質管理コマンド
```bash
# ESLint実行
npm run lint

# 単体テスト実行
npm run test

# テストUI表示
npm run test:ui

# テストカバレッジ
npm run test:coverage

# E2Eテスト実行
npm run test:e2e

# 全テスト実行
npm run test:all
```

## Supabaseコマンド
```bash
# Supabase CLI セットアップ
npm run supabase:setup

# クイックセットアップ (Linux/Mac)
npm run supabase:quick

# クイックセットアップ (Windows)
npm run supabase:quick:win
```

## Gitコマンド（Windows）
```bash
# ステータス確認
git status

# ファイル一覧
dir /B

# ファイル検索
findstr /s /i "keyword" *.ts *.tsx

# プロセス確認
tasklist | findstr node
```

## システムユーティリティ（Windows）
```bash
# ディレクトリ移動
cd path\to\directory

# ファイル検索
where filename

# 環境変数表示
echo %PATH%

# ポート確認
netstat -an | findstr :3000
```