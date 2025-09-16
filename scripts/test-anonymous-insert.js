/**
 * Test anonymous INSERT after RLS policy fix
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🧪 Anonymous INSERT Test');
console.log('========================');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境変数が設定されていません');
  console.log('必要: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Anonymous client (公開アクセス)
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Service client (管理操作用)
const serviceKey = process.env.VITE_SUPABASE_SERVICE_KEY || supabaseAnonKey;
const serviceClient = createClient(supabaseUrl, serviceKey);

async function testAnonymousInsert() {
  console.log('🔄 匿名ユーザーINSERTテスト開始...\n');

  const testData = {
    email: 'anonymous-test@example.com',
    company_name: 'Anonymous Test Company',
    department: 'Testing Department',
    position: 'QA Tester',
    requested_reason: 'Testing anonymous user application submission after RLS policy fix'
  };

  try {
    console.log('📤 テストデータ送信中...');
    console.log('   Email:', testData.email);
    console.log('   Company:', testData.company_name);

    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('\n❌ 匿名INSERTテスト失敗');
      console.error('エラーコード:', error.code);
      console.error('エラーメッセージ:', error.message);

      if (error.code === '42501') {
        console.log('\n📋 解決方法:');
        console.log('1. scripts/rls-fix-execution-guide.md を参照');
        console.log('2. Supabase DashboardのSQL Editorで修正SQLを実行');
        console.log('3. scripts/rls-fix-queries.sql の内容をコピーして実行');
      }

      return false;
    } else {
      console.log('\n✅ 匿名INSERTテスト成功!');
      console.log('挿入されたレコードID:', data.id);
      console.log('作成日時:', data.created_at);

      // Test data cleanup
      console.log('\n🧹 テストデータ削除中...');
      const { error: deleteError } = await serviceClient
        .from('user_applications')
        .delete()
        .eq('id', data.id);

      if (deleteError) {
        console.warn('⚠️ テストデータ削除に失敗:', deleteError.message);
        console.log('手動削除が必要: ID =', data.id);
      } else {
        console.log('✅ テストデータ削除完了');
      }

      return true;
    }
  } catch (error) {
    console.error('\n❌ 予期しないエラー:', error.message);
    return false;
  }
}

async function testUserApplicationsAccess() {
  console.log('\n🔍 user_applicationsテーブルアクセステスト...');

  try {
    const { data, error, count } = await anonClient
      .from('user_applications')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ テーブルアクセス失敗:', error.message);
      return false;
    } else {
      console.log('✅ テーブルアクセス成功');
      console.log('現在のレコード数:', count || 0);
      return true;
    }
  } catch (error) {
    console.error('❌ アクセステストエラー:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('📋 RLS Policy Fix 検証テスト');
  console.log('===========================\n');

  const results = {
    tableAccess: false,
    anonymousInsert: false
  };

  // Test 1: Table access
  results.tableAccess = await testUserApplicationsAccess();

  // Test 2: Anonymous insert
  results.anonymousInsert = await testAnonymousInsert();

  // Results summary
  console.log('\n📊 テスト結果サマリー');
  console.log('====================');
  console.log('テーブルアクセス:', results.tableAccess ? '✅ 成功' : '❌ 失敗');
  console.log('匿名INSERT:', results.anonymousInsert ? '✅ 成功' : '❌ 失敗');

  if (results.tableAccess && results.anonymousInsert) {
    console.log('\n🎉 すべてのテストが成功しました！');
    console.log('✅ RLS policy修正が正常に完了');
    console.log('✅ 401 Unauthorizedエラーが解消');
    console.log('✅ 申請フォームが正常に動作するはずです');
  } else {
    console.log('\n⚠️  一部のテストが失敗しました');
    console.log('📋 次のステップ:');
    console.log('1. scripts/rls-fix-execution-guide.md を確認');
    console.log('2. Supabase DashboardでRLSポリシーを手動実行');
    console.log('3. 再度このテストを実行');
  }

  console.log('\n📝 詳細ガイド: scripts/rls-fix-execution-guide.md');
}

runAllTests();