// Supabase RLSポリシー設定スクリプト
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase RLSポリシー設定開始');
console.log('URL:', supabaseUrl || '❌ 未設定');
console.log('KEY:', supabaseAnonKey ? '✅ 設定済み' : '❌ 未設定');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupUserApplicationsTable() {
  try {
    console.log('\n📋 user_applicationsテーブルの状態確認');

    // テーブル存在確認
    const { data: existingData, error: checkError } = await supabase
      .from('user_applications')
      .select('count')
      .limit(1);

    if (checkError && checkError.code === 'PGRST116') {
      console.log('⚠️ user_applicationsテーブルが存在しません');
      console.log('📝 Supabaseダッシュボードで以下のSQLを実行してください:');

      console.log(`
-- user_applicationsテーブル作成
CREATE TABLE user_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  department VARCHAR(255),
  position VARCHAR(255),
  requested_reason TEXT,
  application_status VARCHAR(50) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT
);

-- RLS有効化
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成
CREATE POLICY "Allow anonymous insert applications"
ON user_applications FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read own applications"
ON user_applications FOR SELECT
TO authenticated
USING (auth.email() = email);

CREATE POLICY "Allow admin full access"
ON user_applications FOR ALL
TO authenticated
USING (
  auth.email() IN (
    'dev@inventory.test',
    'Krice4765104@gmail.com',
    'prod@inventory.test'
  )
);
      `);

      return false;
    } else if (checkError) {
      console.error('❌ テーブル確認エラー:', checkError.message);
      return false;
    } else {
      console.log('✅ user_applicationsテーブル存在確認完了');
      return true;
    }
  } catch (error) {
    console.error('❌ 設定エラー:', error.message);
    return false;
  }
}

async function testUserApplications() {
  try {
    console.log('\n🧪 user_applications機能テスト');

    const testData = {
      email: 'test-' + Date.now() + '@example.com',
      company_name: 'テスト株式会社',
      department: '開発部',
      position: 'エンジニア',
      requested_reason: 'RLSポリシーのテストのため'
    };

    console.log('📝 テストデータ挿入試行:', testData.email);

    const { data, error } = await supabase
      .from('user_applications')
      .insert([testData])
      .select();

    if (error) {
      console.error('❌ 挿入エラー:', error.message);
      console.error('エラーコード:', error.code);

      if (error.code === '42501') {
        console.log('🛡️ RLSポリシーが正しく設定されていません');
        console.log('📝 Supabaseダッシュボードで上記のRLSポリシーSQLを実行してください');
      }

      return false;
    } else {
      console.log('✅ テストデータ挿入成功:', data[0].id);

      // テストデータを削除
      const { error: deleteError } = await supabase
        .from('user_applications')
        .delete()
        .eq('id', data[0].id);

      if (!deleteError) {
        console.log('✅ テストデータ削除完了');
      }

      return true;
    }
  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    return false;
  }
}

async function main() {
  const tableExists = await setupUserApplicationsTable();

  if (tableExists) {
    const testSuccess = await testUserApplications();

    if (testSuccess) {
      console.log('\n🎉 user_applications機能は正常に動作しています！');
    } else {
      console.log('\n⚠️ user_applications機能にRLSポリシーの問題があります');
    }
  }
}

main().catch(console.error);