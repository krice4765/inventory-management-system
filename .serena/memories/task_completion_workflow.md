# タスク完了時のワークフロー

## 🔍 コード品質チェック
```bash
# 1. ESLintによるコード品質チェック
npm run lint

# 2. TypeScriptコンパイルチェック
npx tsc --noEmit

# 3. ビルドテスト
npm run build
```

## 🧪 テスト実行
```bash
# 単体テスト
npm run test

# テストカバレッジ確認
npm run test:coverage

# E2Eテスト
npm run test:e2e

# 全テスト実行
npm run test:all
```

## 📦 パフォーマンス確認
```bash
# ビルドサイズ確認
npm run build
# dist/bundle-analysis.html を確認

# 開発サーバーでの動作確認
npm run dev
```

## 🔐 セキュリティチェック
- **認証フロー**: ログイン/ログアウトの動作確認
- **認可**: ページアクセス制御の確認
- **データ検証**: フォーム入力検証の確認
- **RLS**: Supabaseのデータアクセス制御確認

## 📋 完了前チェックリスト
- [ ] ESLintエラー0件
- [ ] TypeScriptコンパイルエラー0件
- [ ] 全テスト通過
- [ ] ビルド成功
- [ ] UI動作確認
- [ ] レスポンシブデザイン確認
- [ ] アクセシビリティ確認
- [ ] パフォーマンス確認

## 🚀 デプロイ前確認
- [ ] 環境変数設定確認
- [ ] Supabase設定確認
- [ ] プロダクションビルド確認
- [ ] ログ出力の確認（console.log除去確認）