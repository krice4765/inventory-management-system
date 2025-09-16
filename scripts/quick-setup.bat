@echo off
:: Supabase ユーザー管理システム クイックセットアップ (Windows)
:: 使用方法: scripts\quick-setup.bat

echo 🎯 Supabase ユーザー管理システム クイックセットアップ
echo ==================================================

:: 現在のディレクトリを確認
if not exist "package.json" (
    echo ❌ package.json が見つかりません。プロジェクトルートで実行してください
    pause
    exit /b 1
)

:: 1. Supabase CLI の確認
echo.
echo 🔍 Supabase CLI の確認...
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Supabase CLI が見つかりません
    echo インストール方法:
    echo   npm install -g supabase
    echo   または scoop install supabase
    echo.
    set /p "dummy=インストール後、Enterキーを押してください..."

    supabase --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Supabase CLI がまだ見つかりません
        pause
        exit /b 1
    )
)

echo ✅ Supabase CLI が利用可能です
supabase --version

:: 2. プロジェクト設定
echo.
echo 🔧 プロジェクト設定...

:: supabaseディレクトリが存在しない場合は初期化
if not exist "supabase" (
    echo 📦 Supabaseプロジェクトを初期化しています...
    supabase init
    echo ✅ プロジェクト初期化完了
) else (
    echo ✅ Supabaseプロジェクトは既に初期化済みです
)

:: 3. 環境変数の確認
echo.
echo 🔗 プロジェクト設定の確認...

:: .env ファイルの存在確認
if not exist ".env" (
    echo ⚠️  .env ファイルが見つかりません
    goto :setup_env
)

:: .env の内容確認
findstr "VITE_SUPABASE_URL" .env >nul 2>&1
if errorlevel 1 (
    goto :setup_env
)

findstr "VITE_SUPABASE_ANON_KEY" .env >nul 2>&1
if errorlevel 1 (
    goto :setup_env
)

echo ✅ 環境変数が設定済みです
goto :sql_setup

:setup_env
echo 以下の情報を入力してください:
echo.
set /p "project_url=Supabase Project URL: "
set /p "anon_key=Supabase Anon Key: "
set /p "project_ref=Project Reference ID: "

:: .env ファイルを作成
echo VITE_SUPABASE_URL=%project_url% > .env
echo VITE_SUPABASE_ANON_KEY=%anon_key% >> .env

echo ✅ 環境変数を設定しました

:: プロジェクトをリンク
echo.
echo 🔗 プロジェクトをリンクしています...
set /p "db_password=データベースパスワード: "

supabase link --project-ref %project_ref% --password %db_password%
if errorlevel 1 (
    echo ❌ プロジェクトリンクに失敗しました
    pause
    exit /b 1
)
echo ✅ プロジェクトリンク完了

:sql_setup
:: 4. SQLスキーマの実行
echo.
echo 📄 SQLスキーマの実行...

if not exist "scripts\user_management_schema.sql" (
    echo ❌ SQLスキーマファイルが見つかりません
    pause
    exit /b 1
)

echo 🔧 ユーザー管理テーブルを作成しています...

:: タイムスタンプを生成
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,4%%dt:~4,2%%dt:~6,2%_%dt:~8,2%%dt:~10,2%%dt:~12,2%"

:: マイグレーション名を生成
set "migration_name=create_user_management_%timestamp%"

:: マイグレーションファイルを作成
supabase migration new %migration_name%
if errorlevel 1 (
    echo ❌ マイグレーション作成に失敗しました
    pause
    exit /b 1
)

:: 最新のマイグレーションファイルを見つけてコピー
for /f "delims=" %%i in ('dir /b /o-d "supabase\migrations\*_%migration_name%.sql"') do (
    copy "scripts\user_management_schema.sql" "supabase\migrations\%%i"
    goto :found_migration
)

echo ❌ マイグレーションファイルが見つかりません
pause
exit /b 1

:found_migration
echo 📤 マイグレーションを実行しています...

:: マイグレーションを適用
supabase db push
if errorlevel 1 (
    echo ❌ マイグレーション実行に失敗しました
    pause
    exit /b 1
)

echo ✅ SQLスキーマ実行完了

:: 5. 確認とまとめ
echo.
echo 🔍 セットアップ確認...
echo SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%%user%%'; | supabase db psql --linked

echo.
echo 🎉 セットアップ完了！
echo ==================================================
echo 次の手順:
echo 1. 開発サーバーを起動: npm run dev
echo 2. ユーザー管理画面にアクセス: http://localhost:5174/user-management
echo 3. エラーが解消されていることを確認
echo.
echo 管理者権限を持つユーザー:
echo - dev@inventory.test
echo - Krice4765104@gmail.com
echo - prod@inventory.test
echo.
echo ⚠️  注意: 管理者ユーザーでログインしてから管理メニューにアクセスしてください

pause