#!/usr/bin/env node
/**
 * Supabase CLI セットアップとSQL実行スクリプト
 * 使用方法: node scripts/setup-supabase-cli.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SupabaseCLIManager {
  constructor() {
    this.projectDir = process.cwd();
    this.scriptsDir = path.join(this.projectDir, 'scripts');
    this.schemaFile = path.join(this.scriptsDir, 'user_management_schema.sql');
  }

  // ユーザー入力を取得
  async prompt(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  // Supabase CLIの確認・インストール
  async checkSupabaseCLI() {
    try {
      console.log('🔍 Supabase CLIの確認...');
      execSync('supabase --version', { stdio: 'pipe' });
      console.log('✅ Supabase CLI が見つかりました');
      return true;
    } catch (error) {
      console.log('❌ Supabase CLI が見つかりません');
      return false;
    }
  }

  // Supabase CLIのインストール
  async installSupabaseCLI() {
    console.log('📦 Supabase CLI をインストールしています...');

    const platform = process.platform;
    try {
      if (platform === 'win32') {
        console.log('Windows環境でのインストール:');
        console.log('以下のコマンドを実行してください:');
        console.log('scoop bucket add supabase https://github.com/supabase/scoop-bucket.git');
        console.log('scoop install supabase');
        console.log('');
        console.log('または npm でインストール:');
        console.log('npm install -g supabase');
      } else if (platform === 'darwin') {
        execSync('brew install supabase/tap/supabase', { stdio: 'inherit' });
      } else {
        // Linux
        execSync('curl -sSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb -o supabase.deb && sudo dpkg -i supabase.deb', { stdio: 'inherit' });
      }
      console.log('✅ Supabase CLI インストール完了');
    } catch (error) {
      console.error('❌ インストールに失敗しました:', error.message);
      console.log('手動でインストールしてください: https://supabase.com/docs/guides/cli');
      return false;
    }
    return true;
  }

  // プロジェクトの初期化確認
  async checkProjectInit() {
    const supabaseDir = path.join(this.projectDir, 'supabase');
    if (fs.existsSync(supabaseDir)) {
      console.log('✅ Supabaseプロジェクトが初期化済みです');
      return true;
    }
    return false;
  }

  // プロジェクトの初期化
  async initProject() {
    console.log('🚀 Supabaseプロジェクトを初期化しています...');
    try {
      execSync('supabase init', { stdio: 'inherit', cwd: this.projectDir });
      console.log('✅ プロジェクト初期化完了');
      return true;
    } catch (error) {
      console.error('❌ 初期化に失敗しました:', error.message);
      return false;
    }
  }

  // プロジェクトのリンク
  async linkProject() {
    console.log('🔗 Supabaseプロジェクトをリンクしています...');

    const projectRef = await this.prompt('Supabase Project Reference ID を入力してください: ');
    if (!projectRef) {
      console.log('❌ Project Reference ID が必要です');
      return false;
    }

    const dbPassword = await this.prompt('データベースパスワードを入力してください: ');
    if (!dbPassword) {
      console.log('❌ データベースパスワードが必要です');
      return false;
    }

    try {
      execSync(`supabase link --project-ref ${projectRef} --password ${dbPassword}`, {
        stdio: 'inherit',
        cwd: this.projectDir
      });
      console.log('✅ プロジェクトリンク完了');
      return true;
    } catch (error) {
      console.error('❌ リンクに失敗しました:', error.message);
      return false;
    }
  }

  // SQLファイルの実行
  async executeSQLFile() {
    if (!fs.existsSync(this.schemaFile)) {
      console.error('❌ SQLファイルが見つかりません:', this.schemaFile);
      return false;
    }

    console.log('📄 SQLスキーマを実行しています...');
    try {
      // リモートデータベースに対してSQLを実行
      execSync(`supabase db reset --linked`, {
        stdio: 'inherit',
        cwd: this.projectDir
      });

      // マイグレーションファイルを作成してSQLを実行
      const migrationName = `create_user_management_tables_${Date.now()}`;
      execSync(`supabase migration new ${migrationName}`, {
        stdio: 'inherit',
        cwd: this.projectDir
      });

      // SQLファイルの内容をマイグレーションファイルにコピー
      const migrationFile = path.join(this.projectDir, 'supabase', 'migrations', `*_${migrationName}.sql`);
      const migrationFiles = fs.readdirSync(path.join(this.projectDir, 'supabase', 'migrations'))
        .filter(f => f.includes(migrationName));

      if (migrationFiles.length > 0) {
        const targetFile = path.join(this.projectDir, 'supabase', 'migrations', migrationFiles[0]);
        const sqlContent = fs.readFileSync(this.schemaFile, 'utf8');
        fs.writeFileSync(targetFile, sqlContent);

        // マイグレーションを実行
        execSync('supabase db push', {
          stdio: 'inherit',
          cwd: this.projectDir
        });
      }

      console.log('✅ SQLスキーマ実行完了');
      return true;
    } catch (error) {
      console.error('❌ SQL実行に失敗しました:', error.message);
      return false;
    }
  }

  // 簡易SQL実行（直接実行）
  async executeSQL(sqlContent) {
    console.log('📄 SQL を実行しています...');
    try {
      // 一時ファイルを作成
      const tempSQLFile = path.join(this.scriptsDir, 'temp_execute.sql');
      fs.writeFileSync(tempSQLFile, sqlContent);

      // psqlを使用して直接実行（supabase db psqlを使用）
      const result = execSync(`supabase db psql --linked < "${tempSQLFile}"`, {
        stdio: 'pipe',
        cwd: this.projectDir,
        encoding: 'utf8'
      });

      // 一時ファイルを削除
      fs.unlinkSync(tempSQLFile);

      console.log('✅ SQL実行完了');
      console.log('📋 結果:', result);
      return true;
    } catch (error) {
      console.error('❌ SQL実行に失敗しました:', error.message);
      return false;
    }
  }

  // メインセットアップフロー
  async setup() {
    console.log('🎯 Supabase CLI セットアップを開始します\n');

    // 1. CLI確認・インストール
    const hasCliInstalled = await this.checkSupabaseCLI();
    if (!hasCliInstalled) {
      const shouldInstall = await this.prompt('Supabase CLI をインストールしますか? (y/n): ');
      if (shouldInstall.toLowerCase() === 'y') {
        const installed = await this.installSupabaseCLI();
        if (!installed) return false;
      } else {
        console.log('❌ Supabase CLI が必要です');
        return false;
      }
    }

    // 2. プロジェクト初期化確認
    const isProjectInitialized = await this.checkProjectInit();
    if (!isProjectInitialized) {
      const shouldInit = await this.prompt('Supabaseプロジェクトを初期化しますか? (y/n): ');
      if (shouldInit.toLowerCase() === 'y') {
        const initialized = await this.initProject();
        if (!initialized) return false;
      }
    }

    // 3. プロジェクトリンク
    const shouldLink = await this.prompt('Supabaseプロジェクトをリンクしますか? (y/n): ');
    if (shouldLink.toLowerCase() === 'y') {
      const linked = await this.linkProject();
      if (!linked) return false;
    }

    // 4. SQL実行
    const shouldExecuteSQL = await this.prompt('ユーザー管理テーブルを作成しますか? (y/n): ');
    if (shouldExecuteSQL.toLowerCase() === 'y') {
      await this.executeSQLFile();
    }

    console.log('\n🎉 セットアップ完了！');
    console.log('次の手順:');
    console.log('1. ユーザー管理画面 (/user-management) にアクセス');
    console.log('2. エラーが解消されていることを確認');
    console.log('3. 必要に応じて管理者ユーザーを追加');

    return true;
  }
}

// スクリプト実行
if (require.main === module) {
  const manager = new SupabaseCLIManager();
  manager.setup().catch(console.error);
}

module.exports = SupabaseCLIManager;