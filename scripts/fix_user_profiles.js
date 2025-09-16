import { createClient } from '@supabase/supabase-js';

// Note: This script requires the service role key to execute DDL statements
// The anon key cannot execute CREATE/DROP operations

const supabaseUrl = 'https://tleequspizctgoosostd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here';

console.log('=== User Profiles Table Fix ===');
console.log('This script requires the Supabase service role key to execute DDL statements.');
console.log('The anon key cannot create/drop tables.');
console.log();
console.log('To fix this issue manually:');
console.log('1. Go to your Supabase Dashboard');
console.log('2. Navigate to Table Editor');
console.log('3. Delete the user_profiles table if it exists');
console.log('4. Create a new user_profiles table with the following structure:');
console.log();
console.log('Table: user_profiles');
console.log('Columns:');
console.log('- id: UUID (Primary Key, References auth.users(id))');
console.log('- email: VARCHAR(255) NOT NULL');
console.log('- full_name: VARCHAR(255)');
console.log('- company_name: VARCHAR(255)');
console.log('- department: VARCHAR(255)');
console.log('- position: VARCHAR(255)');
console.log('- role: VARCHAR(50) DEFAULT \'user\' CHECK (role IN (\'admin\', \'manager\', \'user\'))');
console.log('- is_active: BOOLEAN DEFAULT true');
console.log('- last_login_at: TIMESTAMP WITH TIME ZONE');
console.log('- invited_by: UUID (References auth.users(id))');
console.log('- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
console.log('- updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
console.log();
console.log('5. Enable Row Level Security (RLS)');
console.log('6. Add the following policies:');
console.log('   - Allow users to read their own profile');
console.log('   - Allow admins to read/write all profiles');
console.log();

// Attempt to check if we have service role access
async function checkServiceRoleAccess() {
  if (supabaseServiceKey && supabaseServiceKey !== 'your-service-role-key-here') {
    console.log('Attempting to use service role key...');

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    try {
      // Test service role access
      const { data, error } = await supabaseService
        .from('auth.users')
        .select('id, email')
        .limit(1);

      if (error) {
        console.log('Service role test failed:', error.message);
        return false;
      } else {
        console.log('Service role access confirmed');
        return true;
      }
    } catch (err) {
      console.log('Service role test error:', err.message);
      return false;
    }
  } else {
    console.log('No service role key provided.');
    return false;
  }
}

async function fixUserProfiles() {
  const hasServiceRole = await checkServiceRoleAccess();

  if (!hasServiceRole) {
    console.log('');
    console.log('⚠️  Manual intervention required in Supabase Dashboard');
    console.log('The table needs to be recreated through the Supabase web interface.');
    return;
  }

  // If we have service role access, we could execute the DDL here
  console.log('✅ Service role access available - automated fix could be implemented');
}

fixUserProfiles();