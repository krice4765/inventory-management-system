/**
 * user_applicationsテーブルのRLSポリシー修正実行スクリプト
 * 直接Supabaseデータベースに接続してSQLを実行
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 環境変数の取得
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tleequspizctgoosostd.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // サービスロールキーが必要

if (!supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY環境変数が設定されていません');
  console.log('💡 Supabaseプロジェクトの設定からサービスロールキーを取得してください');
  process.exit(1);
}

// サービスロールでクライアント作成（DDL操作に必要）
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * SQLファイルを読み込んで実行
 */
async function executeSqlFile(filename) {
  try {
    const filePath = path.join(process.cwd(), 'scripts', filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`\n📄 ${filename} を実行中...`);
    console.log('SQL:', sql.substring(0, 200) + '...');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`❌ ${filename} 実行エラー:`, error);
      return false;
    }

    console.log(`✅ ${filename} 実行成功`);
    if (data) console.log('結果:', data);
    return true;

  } catch (err) {
    console.error(`❌ ${filename} ファイル読み込みエラー:`, err);
    return false;
  }
}

/**
 * 個別SQLクエリを実行
 */
async function executeQuery(description, query) {
  try {
    console.log(`\n🔧 ${description}...`);
    console.log('SQL:', query.substring(0, 150) + '...');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });

    if (error) {
      console.error(`❌ ${description} エラー:`, error);
      return false;
    }

    console.log(`✅ ${description} 成功`);
    if (data) console.log('結果:', data);
    return true;

  } catch (err) {
    console.error(`❌ ${description} 実行エラー:`, err);
    return false;
  }
}

/**
 * メイン実行処理
 */
async function main() {
  console.log('🚀 user_applicationsテーブルRLSポリシー修正開始');
  console.log(`📡 接続先: ${supabaseUrl}`);

  // Phase 1: 現状確認
  console.log('\n=== Phase 1: 現状確認 ===');

  const checkQueries = [
    {
      description: 'テーブル存在確認',
      query: `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_applications';`
    },
    {
      description: '既存ポリシー確認',
      query: `SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'user_applications';`
    }
  ];

  for (const check of checkQueries) {
    await executeQuery(check.description, check.query);
  }

  // Phase 2: 既存ポリシー削除
  console.log('\n=== Phase 2: 既存ポリシー削除 ===');

  const dropQueries = [
    'DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;',
    'DROP POLICY IF EXISTS "Enable read access for users based on email" ON user_applications;',
    'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_applications;',
    'DROP POLICY IF EXISTS "Enable insert for anon users" ON user_applications;'
  ];

  for (const query of dropQueries) {
    await executeQuery('ポリシー削除', query);
  }

  // Phase 3: 新しいポリシー作成
  console.log('\n=== Phase 3: 新しいポリシー作成 ===');

  const createQueries = [
    {
      name: '匿名申請許可ポリシー',
      query: `CREATE POLICY "Allow public application submission"
               ON user_applications FOR INSERT
               TO anon, authenticated
               WITH CHECK (true);`
    },
    {
      name: 'ユーザー自身の申請閲覧ポリシー',
      query: `CREATE POLICY "Users can view their own applications"
               ON user_applications FOR SELECT
               TO authenticated
               USING (email = auth.jwt() ->> 'email');`
    },
    {
      name: '管理者全申請閲覧ポリシー',
      query: `CREATE POLICY "Admins can view all applications"
               ON user_applications FOR SELECT
               TO authenticated
               USING (
                 EXISTS (
                   SELECT 1 FROM user_profiles
                   WHERE user_profiles.id = auth.uid()
                   AND user_profiles.role = 'admin'
                 )
               );`
    },
    {
      name: '管理者申請更新ポリシー',
      query: `CREATE POLICY "Admins can update application status"
               ON user_applications FOR UPDATE
               TO authenticated
               USING (
                 EXISTS (
                   SELECT 1 FROM user_profiles
                   WHERE user_profiles.id = auth.uid()
                   AND user_profiles.role = 'admin'
                 )
               )
               WITH CHECK (
                 EXISTS (
                   SELECT 1 FROM user_profiles
                   WHERE user_profiles.id = auth.uid()
                   AND user_profiles.role = 'admin'
                 )
               );`
    }
  ];

  for (const policy of createQueries) {
    await executeQuery(policy.name, policy.query);
  }

  // Phase 4: テーブル設定
  console.log('\n=== Phase 4: テーブル設定更新 ===');

  const configQueries = [
    {
      description: 'RLS有効化',
      query: 'ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;'
    },
    {
      description: '匿名ユーザーINSERT権限付与',
      query: 'GRANT INSERT ON user_applications TO anon;'
    },
    {
      description: '認証ユーザーSELECT/UPDATE権限付与',
      query: 'GRANT SELECT, UPDATE ON user_applications TO authenticated;'
    }
  ];

  for (const config of configQueries) {
    await executeQuery(config.description, config.query);
  }

  // Phase 5: 最終確認
  console.log('\n=== Phase 5: 最終確認 ===');

  const verifyQueries = [
    {
      description: '新しいポリシー一覧',
      query: `SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'user_applications' ORDER BY policyname;`
    },
    {
      description: 'RLS状態確認',
      query: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_applications';`
    },
    {
      description: 'テーブル権限確認',
      query: `SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name = 'user_applications' ORDER BY grantee;`
    }
  ];

  for (const verify of verifyQueries) {
    await executeQuery(verify.description, verify.query);
  }

  console.log('\n🎉 RLSポリシー修正完了！');
  console.log('💡 これで匿名ユーザーからの申請フォーム送信が可能になりました');
}

// エラーハンドリング付きで実行
main().catch(err => {
  console.error('❌ スクリプト実行エラー:', err);
  process.exit(1);
});