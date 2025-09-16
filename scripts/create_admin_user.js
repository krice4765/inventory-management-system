// 管理者ユーザー作成スクリプト
// 実行方法: node scripts/create_admin_user.js

import { createClient } from '@supabase/supabase-js';

// Supabase設定
const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZWVxdXNwaXpjdGdvb3Nvc3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTg2MDUsImV4cCI6MjA3MTUzNDYwNX0.GVKk3tOAi5mUYkkC8AqrQutpcbxR1mM5YWiWpCQtjlE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 管理者ユーザー情報
const adminUsers = [
  {
    email: 'Krice4765104@gmail.com',
    password: 'AdminPass123!',
    full_name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'dev@inventory.test',
    password: 'DevPass123!',
    full_name: 'Development User',
    role: 'admin'
  },
  {
    email: 'prod@inventory.test',
    password: 'ProdPass123!',
    full_name: 'Production User',
    role: 'admin'
  }
];

async function createAdminUsers() {
  console.log('🚀 管理者ユーザー作成開始...');

  for (const admin of adminUsers) {
    try {
      console.log(`\n📧 ${admin.email} のユーザー作成中...`);

      // 1. ユーザー登録
      const { data, error } = await supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
        options: {
          data: {
            full_name: admin.full_name,
            role: admin.role
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`⚠️  ${admin.email} は既に登録済みです`);
          continue;
        }
        throw error;
      }

      if (data.user) {
        console.log(`✅ ${admin.email} ユーザー作成成功`);
        console.log(`   User ID: ${data.user.id}`);

        // 2. user_profilesテーブルにプロファイル情報を挿入
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: admin.email,
            full_name: admin.full_name,
            role: admin.role,
            is_active: true
          });

        if (profileError) {
          console.warn(`⚠️  ${admin.email} のプロファイル作成でエラー:`, profileError.message);
        } else {
          console.log(`✅ ${admin.email} プロファイル作成成功`);
        }
      }

    } catch (error) {
      console.error(`❌ ${admin.email} の作成でエラー:`, error.message);
    }
  }

  console.log('\n🎉 管理者ユーザー作成処理完了！');
  console.log('\n📝 ログイン情報:');
  adminUsers.forEach(admin => {
    console.log(`   ${admin.email} : ${admin.password}`);
  });

  console.log('\n🔧 次の手順:');
  console.log('  1. ブラウザでアプリにアクセス');
  console.log('  2. 上記の認証情報でログイン');
  console.log('  3. ユーザー管理画面で機能確認');
}

// Supabaseの認証設定確認
async function checkAuthSettings() {
  console.log('🔍 Supabase認証設定確認...');

  try {
    // テスト接続
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('⚠️  認証接続警告:', error.message);
    } else {
      console.log('✅ Supabase認証接続正常');
    }
  } catch (error) {
    console.error('❌ Supabase接続エラー:', error.message);
  }
}

// 実行
async function main() {
  await checkAuthSettings();
  await createAdminUsers();
}

// 実行
main().catch(console.error);