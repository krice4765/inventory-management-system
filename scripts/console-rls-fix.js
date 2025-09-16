// Copy and paste this into the browser console at http://localhost:5178
// This applies RLS policy fix for user_applications table

(async function applyRLSFix() {
  console.log('🔧 Applying RLS policy fix for user_applications...');

  if (!window.supabase) {
    console.error('❌ Supabase client not found! Make sure you are on the application page.');
    return;
  }

  const supabase = window.supabase;

  try {
    // Test current state first
    console.log('🧪 Testing current permission state...');

    const testData = {
      email: 'test-console@example.com',
      company_name: 'Console Test Company',
      department: 'Testing Dept',
      position: 'Console Tester',
      requested_reason: 'Testing RLS policy from browser console for debugging purposes'
    };

    const { data: testResult, error: testError } = await supabase
      .from('user_applications')
      .insert(testData)
      .select()
      .single();

    if (testError) {
      console.log('🚨 Current error (expected):', testError.message);
      console.log('Error code:', testError.code);

      if (testError.code === '42501') {
        console.log('✅ Confirmed: RLS policy blocking public INSERT as expected');
      }
    } else {
      console.log('✅ INSERT already works! Data:', testResult);

      // Clean up successful test
      await supabase
        .from('user_applications')
        .delete()
        .eq('id', testResult.id);

      console.log('🧹 Test data cleaned up');
      console.log('🎉 RLS policy already allows public INSERT!');
      return;
    }

    // Try to query existing policies (this might not work from browser but let's try)
    console.log('🔍 Attempting to query current policies...');

    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_applications');

    if (policyError) {
      console.log('⚠️ Cannot query policies from browser (expected):', policyError.message);
    } else {
      console.log('📋 Current policies:', policies);
    }

    // Since we can't execute DDL from browser, provide instructions
    console.log('📝 Manual steps needed:');
    console.log('1. Go to Supabase Dashboard');
    console.log('2. Navigate to Database > SQL Editor');
    console.log('3. Execute the following SQL:');

    const sqlFix = `
-- Fix RLS policy for user_applications table
DROP POLICY IF EXISTS "Users can only access their own applications" ON user_applications;

-- Allow public INSERT for application form
CREATE POLICY "Allow public application submission"
ON user_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow users to view their own applications
CREATE POLICY "Users can view their own applications"
ON user_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- Allow admins to view all applications
CREATE POLICY "Admins can view all applications"
ON user_applications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Allow admins to update application status
CREATE POLICY "Admins can update application status"
ON user_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT INSERT ON user_applications TO anon;
GRANT SELECT, UPDATE ON user_applications TO authenticated;
`;

    console.log(sqlFix);

    console.log('4. After executing SQL, run this function again to test');

    // Store the test function for later use
    window.testUserApplicationInsert = async function() {
      const testData2 = {
        email: 'test-after-fix@example.com',
        company_name: 'Post-Fix Test Company',
        department: 'Testing Dept',
        position: 'Post-Fix Tester',
        requested_reason: 'Testing after RLS policy fix to confirm public INSERT works'
      };

      const { data: result, error } = await supabase
        .from('user_applications')
        .insert(testData2)
        .select()
        .single();

      if (error) {
        console.error('❌ Still failing after fix:', error);
        return false;
      } else {
        console.log('✅ Success! RLS fix working:', result);

        // Clean up
        await supabase
          .from('user_applications')
          .delete()
          .eq('id', result.id);

        console.log('🧹 Test data cleaned up');
        console.log('🎉 RLS policy fix confirmed working!');
        return true;
      }
    };

    console.log('💡 After applying the SQL fix, run: testUserApplicationInsert()');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
})();