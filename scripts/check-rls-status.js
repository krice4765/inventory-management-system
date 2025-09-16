/**
 * Check current RLS policy status for user_applications table
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSStatus() {
  console.log('🔍 Checking RLS policy status for user_applications...\n');

  try {
    // Check current policies
    console.log('📋 Current RLS Policies:');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_applications');

    if (policiesError) {
      console.error('❌ Error fetching policies:', policiesError.message);
    } else {
      if (policies && policies.length > 0) {
        policies.forEach((policy, index) => {
          console.log(`\n${index + 1}. ${policy.policyname}`);
          console.log(`   Command: ${policy.cmd}`);
          console.log(`   Roles: ${policy.roles ? policy.roles.join(', ') : 'N/A'}`);
          console.log(`   Condition: ${policy.qual || 'N/A'}`);
          console.log(`   With Check: ${policy.with_check || 'N/A'}`);
        });
      } else {
        console.log('   No policies found for user_applications table');
      }
    }

    // Check RLS status
    console.log('\n🔒 RLS Status:');
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('tablename', 'user_applications');

    if (rlsError) {
      console.error('❌ Error fetching RLS status:', rlsError.message);
    } else {
      if (rlsStatus && rlsStatus.length > 0) {
        const table = rlsStatus[0];
        console.log(`   Row Level Security: ${table.rowsecurity ? '✅ ENABLED' : '❌ DISABLED'}`);
      } else {
        console.log('   ❌ Table not found');
      }
    }

    // Test anonymous access
    console.log('\n🧪 Testing Anonymous Access:');
    const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

    const testData = {
      email: 'rls-status-test@example.com',
      company_name: 'Status Test Company',
      department: 'Testing',
      position: 'QA Engineer',
      requested_reason: 'Testing RLS policy status check'
    };

    console.log('   Attempting anonymous INSERT...');
    const { data, error } = await anonClient
      .from('user_applications')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.log('   ❌ Anonymous INSERT failed:', error.message);
      console.log('   Code:', error.code);

      if (error.code === '42501') {
        console.log('   📋 この401エラーの原因: RLSポリシーが匿名INSERTを許可していません');
      }
    } else {
      console.log('   ✅ Anonymous INSERT successful! ID:', data.id);

      // Clean up
      await supabase
        .from('user_applications')
        .delete()
        .eq('id', data.id);

      console.log('   🧹 Test data cleaned up');
    }

    // Check table structure
    console.log('\n📊 Table Information:');
    const { data: tableInfo, error: tableError } = await supabase
      .from('user_applications')
      .select('*', { count: 'exact', head: true });

    if (tableError) {
      console.log('   ❌ Error accessing table:', tableError.message);
    } else {
      console.log(`   ✅ Table accessible, total records: ${tableInfo || 0}`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkRLSStatus()
  .then(() => {
    console.log('\n🎯 Summary:');
    console.log('   Current status check completed.');
    console.log('   If anonymous INSERT failed, run the RLS fix queries.');
    console.log('   See: scripts/rls-fix-queries.sql');
  });