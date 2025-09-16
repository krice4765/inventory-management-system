#!/bin/bash
# Supabase ユーザー管理システム クイックセットアップ
# 使用方法: bash scripts/quick-setup.sh

set -e  # エラー時に停止

echo "🎯 Supabase ユーザー管理システム クイックセットアップ"
echo "=================================================="

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 現在のディレクトリを確認
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json が見つかりません。プロジェクトルートで実行してください${NC}"
    exit 1
fi

# 1. Supabase CLI の確認
echo -e "\n${BLUE}🔍 Supabase CLI の確認...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI が見つかりません${NC}"
    echo "インストール方法:"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  brew install supabase/tap/supabase"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git"
        echo "  scoop install supabase"
        echo "  または: npm install -g supabase"
    else
        echo "  npm install -g supabase"
    fi

    read -p "インストール後、Enterキーを押してください..."

    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}❌ Supabase CLI がまだ見つかりません${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Supabase CLI が利用可能です${NC}"
supabase --version

# 2. プロジェクト設定
echo -e "\n${BLUE}🔧 プロジェクト設定...${NC}"

# supabaseディレクトリが存在しない場合は初期化
if [ ! -d "supabase" ]; then
    echo -e "${YELLOW}📦 Supabaseプロジェクトを初期化しています...${NC}"
    supabase init
    echo -e "${GREEN}✅ プロジェクト初期化完了${NC}"
else
    echo -e "${GREEN}✅ Supabaseプロジェクトは既に初期化済みです${NC}"
fi

# 3. プロジェクトリンクの確認
echo -e "\n${BLUE}🔗 プロジェクトリンクの確認...${NC}"

# .env ファイルから設定を読み込み
if [ -f ".env" ]; then
    source .env
fi

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}⚠️  環境変数が設定されていません${NC}"
    echo "以下の情報を入力してください:"

    read -p "Supabase Project URL: " project_url
    read -p "Supabase Anon Key: " anon_key
    read -p "Project Reference ID: " project_ref

    # .env ファイルを更新
    cat > .env << EOF
VITE_SUPABASE_URL=$project_url
VITE_SUPABASE_ANON_KEY=$anon_key
EOF

    echo -e "${GREEN}✅ 環境変数を設定しました${NC}"

    # プロジェクトをリンク
    echo -e "${YELLOW}🔗 プロジェクトをリンクしています...${NC}"
    read -s -p "データベースパスワード: " db_password
    echo

    supabase link --project-ref "$project_ref" --password "$db_password"
    echo -e "${GREEN}✅ プロジェクトリンク完了${NC}"
else
    echo -e "${GREEN}✅ 環境変数が設定済みです${NC}"
fi

# 4. SQLスキーマの実行
echo -e "\n${BLUE}📄 SQLスキーマの実行...${NC}"

if [ ! -f "scripts/user_management_schema.sql" ]; then
    echo -e "${RED}❌ SQLスキーマファイルが見つかりません${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 ユーザー管理テーブルを作成しています...${NC}"

# マイグレーション名を生成
migration_name="create_user_management_$(date +%Y%m%d_%H%M%S)"

# マイグレーションファイルを作成
supabase migration new "$migration_name"

# 最新のマイグレーションファイルを見つける
latest_migration=$(ls -t supabase/migrations/*_${migration_name}.sql | head -n1)

# SQLスキーマをマイグレーションファイルにコピー
cp scripts/user_management_schema.sql "$latest_migration"

echo -e "${YELLOW}📤 マイグレーションを実行しています...${NC}"

# マイグレーションを適用
supabase db push

echo -e "${GREEN}✅ SQLスキーマ実行完了${NC}"

# 5. 確認
echo -e "\n${BLUE}🔍 セットアップ確認...${NC}"

# テーブルの存在確認
echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%user%';" | supabase db psql --linked

echo -e "\n${GREEN}🎉 セットアップ完了！${NC}"
echo "=================================================="
echo "次の手順:"
echo "1. 開発サーバーを起動: npm run dev"
echo "2. ユーザー管理画面にアクセス: http://localhost:5174/user-management"
echo "3. エラーが解消されていることを確認"
echo ""
echo "管理者権限を持つユーザー:"
echo "- dev@inventory.test"
echo "- Krice4765104@gmail.com"
echo "- prod@inventory.test"
echo ""
echo -e "${YELLOW}注意: 管理者ユーザーでログインしてから管理メニューにアクセスしてください${NC}"