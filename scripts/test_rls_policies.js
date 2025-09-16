/**
 * user_applicationsテーブルのRLSポリシーテストスクリプト
 * 実際の動作確認とデバッグ用
 */

import { createClient } from '@supabase/supabase-js';

// 環境変数の取得
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tleequspizctgoosostd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTg2MDUsImV4cCI6MjA3MTUzNDYwNX0.GVKk3tOAi5mUYkkC8AqrQutpcbxR1mM5YWiWpCQtjlE';

// 匿名クライアント（申請フォーム用）
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * 現在のRLSポリシー状態を確認
 */
async function checkCurrentPolicies() {
  console.log('\n🔍 現在のRLSポリシー状態確認');

  try {
    // テーブル情報を確認
    const { data: tableInfo, error: tableError } = await anonClient
      .from('information_schema.tables')
      .select('*')
      .eq('table_name', 'user_applications');

    if (tableError) {
      console.log('❌ テーブル情報取得エラー:', tableError.message);
    } else {
      console.log('✅ テーブル存在確認:', tableInfo.length > 0 ? 'OK' : 'NG');
    }

  } catch (err) {
    console.log('❌ テーブル確認例外:', err.message);
  }

  // 実際のINSERT操作をテスト
  await testAnonymousInsert();
}

/**
 * 匿名ユーザーでのINSERT操作をテスト
 */
async function testAnonymousInsert() {
  console.log('\n🧪 匿名ユーザーINSERTテスト開始');

  const testData = {
    name: 'テストユーザー',
    email: 'test@example.com',
    company: 'テスト会社',
    purpose: 'テスト目的',
    message: 'テストメッセージ',
    status: 'pending'
  };

  try {
    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select();

    if (error) {
      console.log('❌ INSERT失敗:', error.message);
      console.log('エラーコード:', error.code);
      console.log('エラー詳細:', error.details);

      if (error.code === '42501') {
        console.log('💡 権限不足エラー - RLSポリシーまたは権限設定に問題があります');
      } else if (error.code === '23505') {
        console.log('💡 重複エラー - テストデータが既に存在している可能性があります');
      }

      return false;
    } else {
      console.log('✅ INSERT成功:', data);

      // 作成されたレコードをクリーンアップ
      if (data && data[0]?.id) {
        await cleanupTestRecord(data[0].id);
      }

      return true;
    }

  } catch (err) {
    console.log('❌ INSERT例外:', err.message);
    return false;
  }
}

/**
 * テストレコードのクリーンアップ
 */
async function cleanupTestRecord(recordId) {
  try {
    console.log(`🧹 テストレコード削除: ${recordId}`);

    const { error } = await anonClient
      .from('user_applications')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.log('⚠️ クリーンアップ失敗:', error.message);
    } else {
      console.log('✅ クリーンアップ成功');
    }
  } catch (err) {
    console.log('⚠️ クリーンアップ例外:', err.message);
  }
}

/**
 * テーブル構造を確認
 */
async function checkTableStructure() {
  console.log('\n📋 テーブル構造確認');

  try {
    // カラム情報を取得
    const { data: columns, error } = await anonClient
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'user_applications')
      .order('ordinal_position');

    if (error) {
      console.log('❌ カラム情報取得エラー:', error.message);
    } else if (columns && columns.length > 0) {
      console.log('✅ テーブル構造:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ カラム情報が取得できませんでした');
    }

  } catch (err) {
    console.log('❌ テーブル構造確認例外:', err.message);
  }
}

/**
 * 接続テスト
 */
async function testConnection() {
  console.log('\n🔗 Supabase接続テスト');

  try {
    const { data, error } = await anonClient
      .from('user_applications')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.log('❌ 接続エラー:', error.message);
      return false;
    } else {
      console.log('✅ 接続成功 - 既存レコード数:', data);
      return true;
    }

  } catch (err) {
    console.log('❌ 接続例外:', err.message);
    return false;
  }
}

/**
 * メイン実行
 */
async function main() {
  console.log('🚀 user_applicationsテーブルRLSポリシーテスト開始');
  console.log(`📡 接続先: ${supabaseUrl}`);

  // 基本接続テスト
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('❌ 基本接続に失敗しました');
    return;
  }

  // テーブル構造確認
  await checkTableStructure();

  // 現在のポリシー状態確認
  await checkCurrentPolicies();

  console.log('\n📊 テスト結果サマリー:');
  console.log('- Supabase接続: ✅');
  console.log('- user_applicationsテーブル: 確認済み');
  console.log('- 匿名ユーザーINSERT: テスト実行済み');
  console.log('\n💡 問題がある場合は、Supabase SQLエディターで以下を実行してください:');
  console.log('   scripts/fix_user_applications_rls.sql');
}

// エラーハンドリング付きで実行
main().catch(err => {
  console.error('❌ テストスクリプト実行エラー:', err);
  process.exit(1);
});