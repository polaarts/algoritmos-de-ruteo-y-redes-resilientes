const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase client initialized');
}

// PostgreSQL Pool configuration (using Supabase's connection pooler or direct connection)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // 10 segundos para Supabase
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection on startup
pool.on('connect', () => {
  console.log('✅ PostgreSQL pool connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Query executed in ${duration}ms`);
    return res;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
};

// Helper function to convert PostGIS geometry to GeoJSON
const convertToGeoJSON = (rows, geomColumn = 'geometry') => {
  return {
    type: 'FeatureCollection',
    features: rows.map(row => {
      const { [geomColumn]: geom, ...properties } = row;
      return {
        type: 'Feature',
        geometry: geom, // PostGIS already returns as GeoJSON with ST_AsGeoJSON
        properties
      };
    })
  };
};

// Test database connection function
const testConnection = async () => {
  try {
    // Test PostgreSQL connection
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('🗄️  PostgreSQL version:', result.rows[0].pg_version);

    // Test PostGIS
    const postgisVersion = await pool.query("SELECT PostGIS_version() as postgis_version");
    console.log('🌍 PostGIS version:', postgisVersion.rows[0].postgis_version);

    // Test pgRouting
    const pgroutingVersion = await pool.query("SELECT pgr_version() as pgrouting_version");
    console.log('🛣️  pgRouting version:', pgroutingVersion.rows[0].pgrouting_version);

    // Test Supabase connection if configured
    if (supabase) {
      const { data, error } = await supabase.from('datacenters').select('count', { count: 'exact', head: true });
      if (error) {
        console.warn('⚠️  Supabase test query failed:', error.message);
      } else {
        console.log('✅ Supabase connection verified');
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

module.exports = {
  supabase,
  pool,
  query,
  convertToGeoJSON,
  testConnection
};
