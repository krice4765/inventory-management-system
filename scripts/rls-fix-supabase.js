import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 環境変数読み込み
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Service roleキーが必要ですが、anon keyでもRPCを試してみます
const supabase = createClient(supabaseUrl, supabaseKey);

// SQL実行用のRPC関数を呼び出すヘルパー
async function executeSQL(query, description) {
  try {
    console.log(`\n--- ${description} ---`);
    console.log(`SQL: ${query}`);

    // Supabase RPCでSQL実行（ただしanon keyでは制限があります）
    const { data, error } = await supabase.rpc('exec_sql', { query });

    if (error) {
      console.error(`エラー: ${error.message}`);
      return { success: false, error };
    }

    if (data && data.length > 0) {
      console.log('結果:');
      console.table(data);
    } else {
      console.log('実行完了 (結果行数: 0)');
    }

    return { success: true, data };
  } catch (error) {
    console.error(`予期しないエラー: ${error.message}`);
    return { success: false, error };
  }
}

// 直接的なテーブル操作を試す関数
async function testDirectAccess() {
  console.log('\n=== 直接的なテーブルアクセステスト ===');

  try {
    // user_applicationsテーブルの存在確認（SELECT権限テスト）
    const { data: testData, error: testError } = await supabase
      .from('user_applications')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('テーブルアクセスエラー:', testError.message);
    } else {
      console.log('✅ user_applicationsテーブルへのアクセスが可能です');
      console.log('現在のレコード数:', testData?.length || 0);
    }
  } catch (error) {
    console.error('予期しないエラー:', error);
  }
}

// 申請データの挿入テスト
async function testApplicationSubmission() {
  console.log('\n=== 申請フォーム送信テスト ===');

  const testApplication = {
    email: 'test@example.com',
    company_name: 'テスト会社',
    department: 'テスト部署',
    position: 'テストポジション',
    requested_reason: 'RLSポリシー修正後のテスト'
  };

  try {
    const { data, error } = await supabase
      .from('user_applications')
      .insert([testApplication])
      .select();

    if (error) {
      console.error('❌ 申請送信エラー:', error.message);
      console.error('詳細:', error);
      return false;
    } else {
      console.log('✅ 申請送信成功！');
      console.log('挿入されたデータ:', data);
      return true;
    }
  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
    return false;
  }
}

// メイン実行関数
async function main() {
  console.log('=== Supabase RLSポリシー確認・テスト開始 ===');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase接続情報が不足しています');
    console.log('VITE_SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
    console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '設定済み' : '未設定');
    return;
  }

  console.log('✅ Supabase接続情報確認完了');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseKey?.substring(0, 20) + '...');

  // 1. 直接的なテーブルアクセステスト
  await testDirectAccess();

  // 2. 申請データ挿入テスト
  const insertSuccess = await testApplicationSubmission();

  if (insertSuccess) {
    console.log('\n🎉 RLSポリシーが正常に機能しています！');
    console.log('✨ 匿名ユーザーからの申請フォーム送信が可能になりました。');
  } else {
    console.log('\n⚠️ RLSポリシーの設定に問題がある可能性があります。');
    console.log('🔧 手動でSupabaseダッシュボードからポリシーを確認してください。');
  }

  console.log('\n=== 実行完了 ===');
}

// 実行
main().catch(console.error);