// Console script to verify and fix missing user_profiles records
// Run this in the browser console on the user management page

console.log('🔧 Starting user_profiles fix verification...');

// Function to execute the fix
async function fixMissingUserProfiles() {
  try {
    console.log('📊 Checking current state...');

    // Check approved applications
    const { data: approvedApps, error: appsError } = await supabase
      .from('user_applications')
      .select('*')
      .eq('status', 'approved');

    if (appsError) {
      console.error('❌ Error fetching approved applications:', appsError);
      return;
    }

    console.log(`✅ Found ${approvedApps.length} approved applications`);

    // Check existing user_profiles
    const { data: userProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('email, full_name');

    if (profilesError) {
      console.error('❌ Error fetching user profiles:', profilesError);
      return;
    }

    console.log(`✅ Found ${userProfiles.length} existing user profiles`);

    // Find missing profiles
    const existingEmails = new Set(userProfiles.map(p => p.email));
    const missingProfiles = approvedApps.filter(app => !existingEmails.has(app.email));

    console.log(`🔍 Found ${missingProfiles.length} missing user profiles:`,
      missingProfiles.map(app => ({
        email: app.email,
        name: app.requested_reason?.match(/【申請者名】(.+?)(?:\n|$)/)?.[1]?.trim() || 'Unknown'
      }))
    );

    // Create missing profiles
    if (missingProfiles.length > 0) {
      console.log('🛠️ Creating missing user profiles...');

      const profilesToCreate = missingProfiles.map(app => {
        const fullName = app.requested_reason?.match(/【申請者名】(.+?)(?:\n|$)/)?.[1]?.trim();

        return {
          id: crypto.randomUUID(),
          email: app.email,
          full_name: fullName || app.email.split('@')[0],
          company_name: app.company_name,
          department: app.department,
          position: app.position,
          role: 'user',
          is_active: true,
          last_login_at: null,
          created_at: app.created_at,
          updated_at: new Date().toISOString()
        };
      });

      const { data: insertResult, error: insertError } = await supabase
        .from('user_profiles')
        .insert(profilesToCreate)
        .select();

      if (insertError) {
        console.error('❌ Error creating user profiles:', insertError);
        return;
      }

      console.log(`✅ Successfully created ${insertResult.length} user profiles`);
      console.log('Created profiles:', insertResult.map(p => ({ email: p.email, name: p.full_name })));

      // Refresh the page data
      console.log('🔄 Refreshing page data...');
      if (typeof loadUsers === 'function') {
        await loadUsers();
      }
      window.location.reload();

    } else {
      console.log('✅ All approved applications already have user profiles');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixMissingUserProfiles();