/**
 * Script de verificación de conexión a Supabase
 * Ejecutar con: node test-supabase.js
 */

require('dotenv').config();
const { supabase, pool, testConnection } = require('./config/database');

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase Connection...\n');
  console.log('Environment Variables:');
  console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  console.log('- DB_HOST:', process.env.DB_HOST || 'Not set');
  console.log('- DB_USER:', process.env.DB_USER || 'Not set');
  console.log('- DB_NAME:', process.env.DB_NAME || 'Not set');
  console.log('');

  // Test 1: Supabase Client
  if (supabase) {
    console.log('📊 Test 1: Supabase Client API');
    try {
      // Try to query a simple table
      const { data, error, count } = await supabase
        .from('fiber_nodes')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log('⚠️  Supabase query error:', error.message);
        console.log('   This is normal if tables don\'t exist yet');
      } else {
        console.log('✅ Supabase client connection successful');
        console.log(`   Found ${count} records in fiber_nodes table`);
      }
    } catch (err) {
      console.log('❌ Supabase client error:', err.message);
    }
  } else {
    console.log('❌ Supabase client not initialized');
    console.log('   Check SUPABASE_URL and SUPABASE_*_KEY in .env');
  }

  console.log('');

  // Test 2: PostgreSQL Pool
  console.log('📊 Test 2: PostgreSQL Direct Connection');
  try {
    const result = await testConnection();
    if (result) {
      console.log('✅ PostgreSQL pool connection successful');
    } else {
      console.log('❌ PostgreSQL pool connection failed');
    }
  } catch (err) {
    console.log('❌ PostgreSQL pool error:', err.message);
  }

  console.log('');

  // Test 3: Check PostGIS
  console.log('📊 Test 3: PostGIS Verification');
  try {
    const result = await pool.query("SELECT PostGIS_version() as version");
    console.log('✅ PostGIS is available:', result.rows[0].version);
  } catch (err) {
    console.log('❌ PostGIS not available:', err.message);
    console.log('   Enable PostGIS extension in Supabase Dashboard > Database > Extensions');
  }

  console.log('');

  // Test 4: Check pgRouting
  console.log('📊 Test 4: pgRouting Verification');
  try {
    const result = await pool.query("SELECT pgr_version() as version");
    console.log('✅ pgRouting is available:', result.rows[0].version);
  } catch (err) {
    console.log('❌ pgRouting not available:', err.message);
    console.log('   Enable pgrouting extension in Supabase Dashboard > Database > Extensions');
  }

  console.log('');

  // Test 5: List available tables
  console.log('📊 Test 5: Available Tables');
  try {
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Found tables:');
      result.rows.forEach(row => {
        console.log(`   - ${row.tablename}`);
      });
    } else {
      console.log('⚠️  No tables found. Run schema.sql to create tables.');
    }
  } catch (err) {
    console.log('❌ Error listing tables:', err.message);
  }

  console.log('\n✨ Connection test completed!\n');
  
  // Close connections
  await pool.end();
  process.exit(0);
}

// Run tests
testSupabaseConnection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
