/**
 * RLSポリシー修正後の動作確認スクリプト
 * Supabase SQLエディターでの修正完了後に実行
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTg2MDUsImV4cCI6MjA3MTUzNDYwNX0.GVKk3tOAi5mUYkkC8AqrQutpcbxR1mM5YWiWpCQtjlE';

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('🎯 RLSポリシー修正後の総合検証開始\n');

  let allTestsPassed = true;

  // Test 1: 匿名ユーザーによる申請投稿
  console.log('📝 Test 1: 匿名ユーザー申請投稿テスト');
  const insertSuccess = await testAnonymousInsert();
  allTestsPassed = allTestsPassed && insertSuccess;

  // Test 2: 重複申請の処理
  console.log('\n📝 Test 2: 重複申請処理テスト');
  const duplicateSuccess = await testDuplicateHandling();
  allTestsPassed = allTestsPassed && duplicateSuccess;

  // Test 3: 不正データの拒否
  console.log('\n📝 Test 3: 不正データ拒否テスト');
  const validationSuccess = await testDataValidation();
  allTestsPassed = allTestsPassed && validationSuccess;

  // 最終結果
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 すべてのテストが成功しました！');
    console.log('✅ RLSポリシー修正が正常に完了しています');
    console.log('✅ 申請フォームからの送信が正常に動作します');
  } else {
    console.log('❌ 一部のテストが失敗しました');
    console.log('💡 Supabase SQLエディターでの修正が必要です');
    console.log('📄 scripts/README_RLS_FIX.md の手順を確認してください');
  }
  console.log('='.repeat(50));
}

async function testAnonymousInsert() {
  const testData = {
    email: `test.${Date.now()}@example.com`,
    company_name: 'テスト会社株式会社',
    department: 'システム開発部',
    position: 'エンジニア',
    requested_reason: 'RLSポリシー動作確認のためのテスト申請です。本番環境での正常動作を検証しています。'
  };

  try {
    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select();

    if (error) {
      console.log('❌ 匿名申請失敗:', error.message);
      console.log('   エラーコード:', error.code);

      if (error.code === '42501') {
        console.log('   💡 RLSポリシーの修正が必要です');
      }

      return false;
    }

    console.log('✅ 匿名申請成功');
    console.log(`   作成ID: ${data[0]?.id}`);

    // クリーンアップ
    if (data[0]?.id) {
      await cleanupRecord(data[0].id);
    }

    return true;

  } catch (err) {
    console.log('❌ 申請例外:', err.message);
    return false;
  }
}

async function testDuplicateHandling() {
  const email = `duplicate.test.${Date.now()}@example.com`;
  const testData = {
    email,
    company_name: '重複テスト会社',
    department: '重複テスト部署',
    position: '重複テスト役職',
    requested_reason: '重複申請処理のテストです。'
  };

  try {
    // 1回目の申請
    const { data: firstData, error: firstError } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select();

    if (firstError) {
      console.log('❌ 1回目申請失敗:', firstError.message);
      return false;
    }

    console.log('✅ 1回目申請成功');

    // 2回目の申請（重複）
    const { data: secondData, error: secondError } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select();

    if (secondError) {
      if (secondError.code === '23505') {
        console.log('✅ 重複拒否正常動作');
        console.log('   期待通りユニーク制約違反で拒否されました');

        // 1回目のデータをクリーンアップ
        if (firstData[0]?.id) {
          await cleanupRecord(firstData[0].id);
        }

        return true;
      } else {
        console.log('❌ 想定外のエラー:', secondError.message);
        return false;
      }
    }

    console.log('⚠️ 重複申請が許可されてしまいました');
    console.log('   データベース制約の確認が必要です');

    // データクリーンアップ
    if (firstData[0]?.id) await cleanupRecord(firstData[0].id);
    if (secondData[0]?.id) await cleanupRecord(secondData[0].id);

    return false;

  } catch (err) {
    console.log('❌ 重複テスト例外:', err.message);
    return false;
  }
}

async function testDataValidation() {
  // 空データでのテスト
  const invalidData = {
    email: '',
    company_name: '',
    department: '',
    position: '',
    requested_reason: ''
  };

  try {
    const { data, error } = await anonClient
      .from('user_applications')
      .insert(invalidData)
      .select();

    if (error) {
      if (error.code === '23502') { // NOT NULL constraint violation
        console.log('✅ 空データ拒否正常動作');
        console.log('   期待通りNOT NULL制約で拒否されました');
        return true;
      } else {
        console.log('✅ データ検証正常動作');
        console.log(`   エラー: ${error.message}`);
        return true;
      }
    }

    console.log('⚠️ 空データが許可されてしまいました');
    console.log('   データベース制約の確認が必要です');

    // 作成されてしまった場合はクリーンアップ
    if (data[0]?.id) {
      await cleanupRecord(data[0].id);
    }

    return false;

  } catch (err) {
    console.log('❌ データ検証例外:', err.message);
    return false;
  }
}

async function cleanupRecord(recordId) {
  try {
    await anonClient
      .from('user_applications')
      .delete()
      .eq('id', recordId);
    console.log(`   🧹 テストレコード削除: ${recordId}`);
  } catch (err) {
    console.log(`   ⚠️ クリーンアップ失敗: ${err.message}`);
  }
}

main().catch(err => {
  console.error('❌ 検証スクリプト実行エラー:', err);
  process.exit(1);
});