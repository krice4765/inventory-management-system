// Advanced RLS Policy Setup using Supabase Admin API
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Advanced Supabase RLS Policy Setup');
console.log('URL:', supabaseUrl || '❌ Not configured');
console.log('KEY:', supabaseAnonKey ? '✅ Configured' : '❌ Not configured');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Environment variables not configured');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupRLSPolicies() {
  try {
    console.log('\n📋 Setting up RLS policies for user_applications');

    // RLS policies SQL commands
    const rlsPolicies = [
      `ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;`,

      `DROP POLICY IF EXISTS "Allow anonymous insert applications" ON user_applications;`,
      `DROP POLICY IF EXISTS "Allow authenticated users to read own applications" ON user_applications;`,
      `DROP POLICY IF EXISTS "Allow admin full access" ON user_applications;`,

      `CREATE POLICY "Allow anonymous insert applications"
       ON user_applications FOR INSERT
       TO anon
       WITH CHECK (true);`,

      `CREATE POLICY "Allow authenticated users to read own applications"
       ON user_applications FOR SELECT
       TO authenticated
       USING (auth.email() = email);`,

      `CREATE POLICY "Allow admin full access"
       ON user_applications FOR ALL
       TO authenticated
       USING (
         auth.email() IN (
           'dev@inventory.test',
           'Krice4765104@gmail.com',
           'prod@inventory.test'
         )
       );`
    ];

    // Execute each policy (Note: This may not work with anon key due to permissions)
    for (const [index, policy] of rlsPolicies.entries()) {
      console.log(`\n🔄 Executing policy ${index + 1}/${rlsPolicies.length}:`);
      console.log(policy.substring(0, 50) + '...');

      try {
        const { data, error } = await supabase.rpc('execute_sql', {
          sql_query: policy
        });

        if (error) {
          console.error(`❌ Policy ${index + 1} failed:`, error.message);
          if (error.code === '42501') {
            console.log('🔒 Permission denied - Admin privileges required');
            console.log('📝 Please execute these policies manually in Supabase Dashboard:');
            console.log('\n' + rlsPolicies.join('\n\n'));
            return false;
          }
        } else {
          console.log(`✅ Policy ${index + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Policy ${index + 1} exception:`, err.message);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ RLS setup error:', error.message);
    return false;
  }
}

async function testRLSPolicies() {
  try {
    console.log('\n🧪 Testing RLS policies');

    const testData = {
      email: 'test-' + Date.now() + '@example.com',
      company_name: 'Test Company',
      department: 'Development',
      position: 'Engineer',
      requested_reason: 'RLS policy testing'
    };

    console.log('📝 Test data insertion:', testData.email);

    const { data, error } = await supabase
      .from('user_applications')
      .insert([testData])
      .select();

    if (error) {
      console.error('❌ Test insertion failed:', error.message);
      console.error('Error code:', error.code);

      if (error.code === '42501') {
        console.log('🛡️ RLS policies still not configured properly');
        return false;
      }
    } else {
      console.log('✅ Test data inserted successfully:', data[0].id);

      // Clean up test data
      const { error: deleteError } = await supabase
        .from('user_applications')
        .delete()
        .eq('id', data[0].id);

      if (!deleteError) {
        console.log('✅ Test data cleaned up');
      }

      return true;
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return false;
  }
}

async function main() {
  const setupSuccess = await setupRLSPolicies();

  if (setupSuccess) {
    const testSuccess = await testRLSPolicies();

    if (testSuccess) {
      console.log('\n🎉 RLS policies successfully configured and tested!');
    } else {
      console.log('\n⚠️ RLS policies may need manual configuration');
    }
  } else {
    console.log('\n📝 Manual RLS configuration required');
    console.log('\nPlease execute the RLS policies manually in Supabase Dashboard:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Execute the policies shown above');
    console.log('3. Run: node scripts/setup-rls.js to test');
  }
}

main().catch(console.error);