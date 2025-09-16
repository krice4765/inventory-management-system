// Direct PostgreSQL connection test using pg library
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: 'db.tleequspizctgoosostd.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '!@Crice476812$$',
  ssl: {
    rejectUnauthorized: false // For Supabase connections
  }
};

console.log('🔧 Direct PostgreSQL Connection Test');
console.log('Host:', dbConfig.host);
console.log('Port:', dbConfig.port);
console.log('Database:', dbConfig.database);
console.log('User:', dbConfig.user);

async function testDirectConnection() {
  const client = new Client(dbConfig);

  try {
    console.log('\n📡 Attempting connection...');
    await client.connect();
    console.log('✅ Connection successful!');

    // Test basic query
    console.log('\n🧪 Testing basic query...');
    const result = await client.query('SELECT version();');
    console.log('✅ Version query successful:');
    console.log(result.rows[0].version);

    // Check user_applications table
    console.log('\n📋 Checking user_applications table...');
    const tableCheck = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_name = 'user_applications';
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✅ user_applications table exists');

      // Check RLS status
      console.log('\n🛡️ Checking RLS status...');
      const rlsCheck = await client.query(`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE tablename = 'user_applications';
      `);

      if (rlsCheck.rows.length > 0) {
        const rls = rlsCheck.rows[0];
        console.log(`RLS Status: ${rls.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
      }

      // Check existing policies
      console.log('\n📜 Checking existing RLS policies...');
      const policiesCheck = await client.query(`
        SELECT policyname, roles, cmd, qual
        FROM pg_policies
        WHERE tablename = 'user_applications';
      `);

      console.log(`Found ${policiesCheck.rows.length} existing policies:`);
      policiesCheck.rows.forEach((policy, index) => {
        console.log(`${index + 1}. ${policy.policyname} (${policy.cmd}) for roles: ${policy.roles}`);
      });

    } else {
      console.log('❌ user_applications table not found');
    }

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);

    if (error.code === 'ENOTFOUND') {
      console.log('🚨 DNS resolution failed - same issue as MCP');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🚨 Connection refused - database may be down');
    } else if (error.code === '28P01') {
      console.log('🚨 Authentication failed - check credentials');
    }
  } finally {
    await client.end();
  }
}

async function setupRLSPoliciesIfConnected() {
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('\n🔧 Setting up RLS policies...');

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

    for (const [index, policy] of rlsPolicies.entries()) {
      try {
        console.log(`\n🔄 Executing policy ${index + 1}/${rlsPolicies.length}:`);
        console.log(policy.substring(0, 50) + '...');

        await client.query(policy);
        console.log(`✅ Policy ${index + 1} executed successfully`);
      } catch (error) {
        console.error(`❌ Policy ${index + 1} failed:`, error.message);
      }
    }

    console.log('\n🎉 RLS setup completed!');

  } catch (error) {
    console.error('❌ RLS setup failed:', error.message);
  } finally {
    await client.end();
  }
}

async function main() {
  await testDirectConnection();

  console.log('\n❓ Would you like to set up RLS policies now?');
  console.log('Uncomment the line below to execute:');
  console.log('// await setupRLSPoliciesIfConnected();');

  // Uncomment the next line to execute RLS setup
  // await setupRLSPoliciesIfConnected();
}

main().catch(console.error);