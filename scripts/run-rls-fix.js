/**
 * RLS policy fix execution script with dotenv support
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Loading environment variables...');
console.log('URL:', supabaseUrl ? '✅ Loaded' : '❌ Missing');
console.log('Key:', supabaseServiceKey ? '✅ Loaded' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function executeRLSFix() {
  console.log('🔧 Applying RLS policy fix for user_applications...');

  try {
    // Read the migration SQL
    const migrationPath = join(__dirname, '../supabase/migrations/20250915154000_fix_user_applications_rls.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📖 Migration file loaded successfully');

    // Split by statements and execute each one
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🚀 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\n📝 Statement ${i + 1}/${statements.length}:`);
        console.log('  ', statement.substring(0, 80) + '...');

        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          console.error('❌ Error:', error.message);
          // Continue with other statements for partial fixes
        } else {
          console.log('✅ Success');
        }
      }
    }

    // Test the fix with a simple query
    console.log('\n🧪 Testing RLS policies...');

    // Test public INSERT capability (without authentication)
    const testClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    const testData = {
      email: 'rls-test@example.com',
      company_name: 'RLS Test Company',
      department: 'Testing Dept',
      position: 'Test Engineer',
      requested_reason: 'Testing RLS policy fix for public application submission'
    };

    console.log('📤 Testing anonymous INSERT...');
    const { data, error } = await testClient
      .from('user_applications')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('❌ Test INSERT failed:', error.message);
      console.error('Details:', error);
    } else {
      console.log('✅ Test INSERT successful! ID:', data.id);

      // Clean up test data
      console.log('🧹 Cleaning up test data...');
      const { error: deleteError } = await supabase
        .from('user_applications')
        .delete()
        .eq('id', data.id);

      if (deleteError) {
        console.warn('⚠️ Could not clean up test data:', deleteError.message);
      } else {
        console.log('✅ Test data cleaned up');
      }
    }

    console.log('\n🎉 RLS policy fix execution completed!');

  } catch (error) {
    console.error('❌ Fatal error applying RLS fix:', error);
    process.exit(1);
  }
}

executeRLSFix();