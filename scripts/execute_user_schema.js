// Supabaseユーザー管理スキーマ実行スクリプト
// 実行方法: node scripts/execute_user_schema.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase設定
const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key-here';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// SQL文を分割して実行
async function executeUserManagementSchema() {
  console.log('🚀 ユーザー管理システムスキーマ実行開始...');

  try {
    // 1. ユーザー申請テーブル作成
    console.log('📋 1. user_applications テーブル作成中...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_applications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          company_name VARCHAR(255),
          department VARCHAR(255),
          position VARCHAR(255),
          requested_reason TEXT,
          application_status VARCHAR(50) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
          reviewed_by UUID REFERENCES auth.users(id),
          reviewed_at TIMESTAMP WITH TIME ZONE,
          review_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (error1) throw error1;
    console.log('✅ user_applications テーブル作成完了');

    // 2. ユーザー招待テーブル作成
    console.log('📋 2. user_invitations テーブル作成中...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_invitations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          invited_by UUID REFERENCES auth.users(id) NOT NULL,
          invitation_token VARCHAR(255) NOT NULL UNIQUE,
          role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
          accepted_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (error2) throw error2;
    console.log('✅ user_invitations テーブル作成完了');

    // 3. ユーザープロファイルテーブル作成
    console.log('📋 3. user_profiles テーブル作成中...');
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_profiles (
          id UUID REFERENCES auth.users(id) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          company_name VARCHAR(255),
          department VARCHAR(255),
          position VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
          is_active BOOLEAN DEFAULT true,
          last_login_at TIMESTAMP WITH TIME ZONE,
          invited_by UUID REFERENCES auth.users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (error3) throw error3;
    console.log('✅ user_profiles テーブル作成完了');

    // 4. システム通知テーブル作成
    console.log('📋 4. system_notifications テーブル作成中...');
    const { error: error4 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS system_notifications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (error4) throw error4;
    console.log('✅ system_notifications テーブル作成完了');

    // 5. システム設定テーブル作成
    console.log('📋 5. system_settings テーブル作成中...');
    const { error: error5 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(255) PRIMARY KEY,
          value JSONB NOT NULL,
          description TEXT,
          updated_by UUID REFERENCES auth.users(id),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (error5) throw error5;
    console.log('✅ system_settings テーブル作成完了');

    // 6. インデックス作成
    console.log('📊 6. インデックス作成中...');
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_user_applications_email ON user_applications(email);',
      'CREATE INDEX IF NOT EXISTS idx_user_applications_status ON user_applications(application_status);',
      'CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);',
      'CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);',
      'CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);',
      'CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);',
      'CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);',
      'CREATE INDEX IF NOT EXISTS idx_system_notifications_user_id ON system_notifications(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_system_notifications_type ON system_notifications(type);',
      'CREATE INDEX IF NOT EXISTS idx_system_notifications_is_read ON system_notifications(is_read);'
    ];

    for (const query of indexQueries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) console.warn('インデックス作成警告:', error.message);
    }
    console.log('✅ インデックス作成完了');

    // 7. 初期データ投入
    console.log('💾 7. 初期データ投入中...');
    const { error: dataError } = await supabase
      .from('system_settings')
      .upsert([
        { key: 'invitation_expiry_hours', value: 72, description: '招待リンクの有効期限（時間）' },
        { key: 'auto_approve_domains', value: [], description: '自動承認するドメインリスト' },
        { key: 'require_admin_approval', value: true, description: '管理者承認を必須とするか' },
        { key: 'notification_email_enabled', value: true, description: 'メール通知を有効にするか' }
      ], { onConflict: 'key' });

    if (dataError) throw dataError;
    console.log('✅ 初期データ投入完了');

    // 8. テーブル確認
    console.log('🔍 8. テーブル存在確認中...');
    const tables = ['user_applications', 'user_invitations', 'user_profiles', 'system_notifications', 'system_settings'];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`❌ ${table} テーブルアクセスエラー:`, error.message);
      } else {
        console.log(`✅ ${table} テーブル正常動作確認`);
      }
    }

    console.log('\n🎉 ユーザー管理システムスキーマ実行完了！');
    console.log('📝 次の手順:');
    console.log('  1. Supabase管理画面でテーブル確認');
    console.log('  2. RLSポリシー設定確認');
    console.log('  3. アプリケーションでの動作確認');

  } catch (error) {
    console.error('❌ スキーマ実行エラー:', error);
    console.log('\n🔧 手動実行方法:');
    console.log('  1. Supabase → SQL Editor を開く');
    console.log('  2. scripts/user_management_schema.sql の内容をコピー');
    console.log('  3. SQL Editorで実行');
  }
}

// 実行
if (require.main === module) {
  executeUserManagementSchema();
}

module.exports = { executeUserManagementSchema };