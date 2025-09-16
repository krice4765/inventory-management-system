/**
 * 正しいカラム名でのRLSテスト
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTg2MDUsImV4cCI6MjA3MTUzNDYwNX0.GVKk3tOAi5mUYkkC8AqrQutpcbxR1mM5YWiWpCQtjlE';

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('🧪 正しいカラム名でのRLSテスト開始');

  // 実際のフォームデータ構造でテスト
  const testData = {
    email: 'test@example.com',
    company_name: 'テスト会社株式会社',
    department: 'テスト部署',
    position: 'テスト役職',
    requested_reason: 'システムテストのための申請データです。RLSポリシーの動作確認を行っています。'
  };

  console.log('\n📝 テストデータ:', testData);

  try {
    console.log('\n🚀 匿名ユーザーでのINSERT実行...');

    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select();

    if (error) {
      console.log('❌ INSERT失敗:', error.message);
      console.log('エラーコード:', error.code);
      console.log('エラー詳細:', error.details);

      if (error.code === '42501') {
        console.log('\n💡 権限エラー分析:');
        console.log('   - 現在のRLSポリシーで匿名ユーザーのINSERTが許可されていません');
        console.log('   - 必要な対処: scripts/fix_user_applications_rls.sql を実行');
        return false;
      } else if (error.code === '23505') {
        console.log('\n💡 重複エラー:');
        console.log('   - 同じメールアドレスでの申請が既に存在します');
        console.log('   - RLSポリシーは正しく機能している可能性があります');

        // 重複の場合は、削除してから再テスト
        await cleanupExisting(testData.email);
        return await retryInsert(testData);
      }

      return false;

    } else {
      console.log('✅ INSERT成功!');
      console.log('作成されたデータ:', data);

      // 成功した場合はクリーンアップ
      if (data && data[0]?.id) {
        await cleanupTestRecord(data[0].id);
      }

      console.log('\n🎉 RLSポリシーが正しく動作しています');
      console.log('   ✅ 匿名ユーザーによるINSERTが許可されています');
      return true;
    }

  } catch (err) {
    console.log('❌ 実行例外:', err.message);
    return false;
  }
}

async function cleanupExisting(email) {
  console.log(`\n🧹 既存データクリーンアップ: ${email}`);

  try {
    const { error } = await anonClient
      .from('user_applications')
      .delete()
      .eq('email', email);

    if (error) {
      console.log('⚠️ クリーンアップエラー:', error.message);
    } else {
      console.log('✅ 既存データ削除完了');
    }
  } catch (err) {
    console.log('⚠️ クリーンアップ例外:', err.message);
  }
}

async function retryInsert(testData) {
  console.log('\n🔄 再INSERT実行...');

  try {
    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select();

    if (error) {
      console.log('❌ 再INSERT失敗:', error.message);
      return false;
    } else {
      console.log('✅ 再INSERT成功:', data);

      if (data && data[0]?.id) {
        await cleanupTestRecord(data[0].id);
      }

      return true;
    }
  } catch (err) {
    console.log('❌ 再INSERT例外:', err.message);
    return false;
  }
}

async function cleanupTestRecord(recordId) {
  console.log(`\n🧹 テストレコード削除: ${recordId}`);

  try {
    const { error } = await anonClient
      .from('user_applications')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.log('⚠️ 削除エラー:', error.message);
    } else {
      console.log('✅ テストレコード削除完了');
    }
  } catch (err) {
    console.log('⚠️ 削除例外:', err.message);
  }
}

main().catch(console.error);