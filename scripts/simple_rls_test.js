/**
 * 簡単なRLSテスト - user_applicationsテーブルの実際の構造を確認
 */

import { createClient } from '@supabase/supabase-js';

// 環境変数の取得
const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTg2MDUsImV4cCI6MjA3MTUzNDYwNX0.GVKk3tOAi5mUYkkC8AqrQutpcbxR1mM5YWiWpCQtjlE';

// 匿名クライアント
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('🔍 user_applicationsテーブル構造調査');

  // 1. まず空のSELECTで構造を確認
  try {
    console.log('\n1️⃣ 空SELECTでテーブル構造確認...');
    const { data, error } = await anonClient
      .from('user_applications')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ SELECT エラー:', error.message);
      console.log('エラーコード:', error.code);

      if (error.code === '42P01') {
        console.log('💡 テーブルが存在しないか、権限がありません');
      }
    } else {
      console.log('✅ SELECT成功');
      console.log('データ例:', data);
    }
  } catch (err) {
    console.log('❌ SELECT例外:', err.message);
  }

  // 2. 最小限のINSERTテスト（必須カラムのみ）
  console.log('\n2️⃣ 最小限のINSERTテスト...');

  // よくある申請フォームのカラム名でテスト
  const testCases = [
    { name: 'テスト太郎', email: 'test@example.com' },
    { name: 'テスト太郎', email: 'test@example.com', message: 'テスト申請' },
    { name: 'テスト太郎', email: 'test@example.com', purpose: 'テスト', status: 'pending' }
  ];

  for (let i = 0; i < testCases.length; i++) {
    try {
      console.log(`\n📝 テストケース ${i + 1}:`, testCases[i]);

      const { data, error } = await anonClient
        .from('user_applications')
        .insert(testCases[i])
        .select();

      if (error) {
        console.log(`❌ INSERT失敗:`, error.message);
        console.log('エラーコード:', error.code);

        if (error.code === 'PGRST204') {
          console.log('💡 スキーマキャッシュエラー - カラム名が間違っているか、テーブル構造が更新されていません');
        } else if (error.code === '42501') {
          console.log('💡 権限エラー - RLSポリシーに問題があります');
        }
      } else {
        console.log(`✅ INSERT成功:`, data);

        // 成功した場合はクリーンアップ
        if (data && data[0]?.id) {
          await anonClient
            .from('user_applications')
            .delete()
            .eq('id', data[0].id);
          console.log('🧹 テストデータ削除完了');
        }
        break; // 成功したら終了
      }
    } catch (err) {
      console.log(`❌ テストケース ${i + 1} 例外:`, err.message);
    }
  }

  console.log('\n📊 調査完了');
  console.log('💡 次のステップ:');
  console.log('   1. Supabase SQLエディターで実際のテーブル構造を確認');
  console.log('   2. fix_user_applications_rls.sql を実行');
  console.log('   3. 再度このテストを実行');
}

main().catch(console.error);