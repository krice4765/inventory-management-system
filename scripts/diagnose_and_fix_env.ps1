# ===============================================================
# 環境変数問題の診断・修復スクリプト
# ===============================================================

Write-Host "🔍 Step 2: 環境変数問題の診断・修復" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# 1. 既存環境変数ファイルの確認
Write-Host "🔍 環境変数ファイル確認:" -ForegroundColor Green
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local 存在" -ForegroundColor Green
    Get-Content ".env.local"
} elseif (Test-Path ".env") {
    Write-Host "⚠️ .env のみ存在" -ForegroundColor Yellow  
    Get-Content ".env"
} else {
    Write-Host "❌ 環境変数ファイルなし - 作成が必要" -ForegroundColor Red
}

Write-Host ""

# 2. 環境変数ファイルが不足している場合の作成
if (!(Test-Path ".env.local")) {
    Write-Host "🔨 .env.local ファイル作成中..." -ForegroundColor Yellow
    
    # 注意: 実際のSupabase Anon Keyに置き換えてください
    $envContent = @"
VITE_SUPABASE_URL=https://tleequspizctgoosostd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MjMxNjQsImV4cCI6MjA0MTA5OTE2NH0.gqxPgbIJ3Nx-OgPJG5HQ_KnNh0rH1MpkYe6tV1s7t5A
"@
    
    $envContent | Out-File -FilePath ".env.local" -Encoding utf8 -Force
    Write-Host "✅ .env.local 作成完了" -ForegroundColor Green
}

Write-Host ""
Write-Host "🏗️ 完全再ビルド（環境変数埋め込み確保）" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# 1. クリーンアップ
Write-Host "🧹 クリーンアップ中..." -ForegroundColor Yellow
Remove-Item -Recurse -Force dist/ -ErrorAction SilentlyContinue

# 2. 本番ビルド実行
Write-Host "🔨 本番ビルド実行中..." -ForegroundColor Yellow
npm run build

# 3. _redirectsファイル再作成（確実な配置）
Write-Host "🔀 SPA対応設定..." -ForegroundColor Yellow
"/* /index.html 200" | Out-File -FilePath "dist\_redirects" -Encoding utf8 -NoNewline

# 4. 環境変数埋め込み確認
Write-Host "✅ 環境変数埋め込み確認..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem "dist/assets/*.js" -ErrorAction SilentlyContinue
if ($jsFiles) {
    $hasSupabaseUrl = Select-String "tleequspizctgoosostd" $jsFiles[0].FullName -Quiet
    if ($hasSupabaseUrl) {
        Write-Host "✅ 環境変数のビルド埋め込み成功" -ForegroundColor Green
    } else {
        Write-Host "❌ 環境変数のビルド埋め込み失敗 - .env.local を確認してください" -ForegroundColor Red
    }
} else {
    Write-Host "❌ JSファイルが見つかりません - ビルドに失敗した可能性があります" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 環境変数診断・修復完了！" -ForegroundColor Green
Write-Host "次は Netlify へのデプロイを実行してください" -ForegroundColor Cyan