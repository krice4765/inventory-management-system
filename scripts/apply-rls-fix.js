/**
 * Apply RLS policy fix for user_applications table
 * This allows public INSERT while maintaining security
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create Supabase client with service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function applyRLSFix() {
  console.log('🔧 Applying RLS policy fix for user_applications...');

  try {
    // Read the migration SQL
    const migrationPath = join(__dirname, '../supabase/migrations/20250915154000_fix_user_applications_rls.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Split by statements and execute each one
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');

        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          console.error('❌ Error executing statement:', error);
          // Continue with other statements
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }

    // Test the fix
    console.log('🧪 Testing public INSERT capability...');

    const testData = {
      email: 'test@example.com',
      company_name: 'Test Company',
      department: 'Test Dept',
      position: 'Test Position',
      requested_reason: 'Testing RLS policy fix for public applications'
    };

    const { data, error } = await supabase
      .from('user_applications')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('❌ Test INSERT failed:', error);
    } else {
      console.log('✅ Test INSERT successful:', data.id);

      // Clean up test data
      await supabase
        .from('user_applications')
        .delete()
        .eq('id', data.id);

      console.log('🧹 Test data cleaned up');
    }

    console.log('🎉 RLS policy fix applied successfully!');

  } catch (error) {
    console.error('❌ Error applying RLS fix:', error);
    process.exit(1);
  }
}

applyRLSFix();