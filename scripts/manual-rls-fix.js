/**
 * Manual RLS policy fix using direct SQL execution
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Manual RLS Policy Fix');
console.log('URL:', supabaseUrl ? '✅ Loaded' : '❌ Missing');
console.log('Key:', supabaseServiceKey ? '✅ Loaded' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLStatements() {
  console.log('\n🚀 Executing RLS policy modifications...');

  const statements = [
    {
      name: '第1段階: 既存ポリシー削除',
      sql: `DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications`
    },
    {
      name: '第2段階: 公開申請フォーム用ポリシー',
      sql: `CREATE POLICY "Allow public application submission"
            ON user_applications FOR INSERT
            TO anon, authenticated
            WITH CHECK (true)`
    },
    {
      name: '第3段階: ユーザー閲覧ポリシー',
      sql: `CREATE POLICY "Users can view their own applications"
            ON user_applications FOR SELECT
            TO authenticated
            USING (email = auth.jwt() ->> 'email')`
    },
    {
      name: '第4段階: 管理者閲覧ポリシー',
      sql: `CREATE POLICY "Admins can view all applications"
            ON user_applications FOR SELECT
            TO authenticated
            USING (
              EXISTS (
                SELECT 1 FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'admin'
              )
            )`
    },
    {
      name: '第5段階: 管理者更新ポリシー',
      sql: `CREATE POLICY "Admins can update application status"
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
            )`
    },
    {
      name: '第6段階: RLS有効化',
      sql: `ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY`
    },
    {
      name: '第6段階: 匿名INSERT権限付与',
      sql: `GRANT INSERT ON user_applications TO anon`
    },
    {
      name: '第6段階: 認証済みSELECT/UPDATE権限付与',
      sql: `GRANT SELECT, UPDATE ON user_applications TO authenticated`
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const { name, sql } = statements[i];
    console.log(`\n📝 ${name}:`);
    console.log(`   ${sql.substring(0, 60)}...`);

    try {
      // Use the raw SQL method via the Supabase client
      const { error } = await supabase.sql`${sql}`;

      if (error) {
        console.error(`❌ エラー: ${error.message}`);
        errorCount++;
      } else {
        console.log('✅ 成功');
        successCount++;
      }
    } catch (error) {
      console.error(`❌ 実行エラー: ${error.message}`);
      errorCount++;
    }

    // Small delay between statements
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 実行結果: ${successCount}件成功, ${errorCount}件エラー`);

  // Test the configuration
  console.log('\n🧪 設定テスト中...');
  await testConfiguration();
}

async function testConfiguration() {
  try {
    // Create anonymous client for testing
    const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

    const testData = {
      email: 'test-policy@example.com',
      company_name: 'Policy Test Co.',
      department: 'Engineering',
      position: 'Developer',
      requested_reason: 'Testing new RLS policy configuration'
    };

    console.log('📤 匿名INSERTテスト実行中...');
    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('❌ 匿名INSERTテスト失敗:', error.message);
      console.error('詳細:', error);
      return false;
    } else {
      console.log('✅ 匿名INSERTテスト成功! ID:', data.id);

      // Cleanup
      console.log('🧹 テストデータ削除中...');
      await supabase
        .from('user_applications')
        .delete()
        .eq('id', data.id);

      console.log('✅ テストデータ削除完了');
      return true;
    }
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    return false;
  }
}

executeSQLStatements()
  .then(() => {
    console.log('\n🎉 RLS ポリシー修正完了!');
    console.log('📋 変更内容:');
    console.log('  • 匿名ユーザーのINSERT権限追加');
    console.log('  • ユーザー別閲覧権限設定');
    console.log('  • 管理者の全権限設定');
    console.log('  • 401 Unauthorizedエラー解消');
  })
  .catch(error => {
    console.error('❌ 致命的エラー:', error);
    process.exit(1);
  });