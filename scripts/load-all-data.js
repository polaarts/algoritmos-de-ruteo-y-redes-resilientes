#!/usr/bin/env node
/**
 * Complete Data Loading Script
 * Loads all data into the fiber network database in the correct order
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fiber_network',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkConnection() {
  console.log('🔌 Checking database connection...');
  let retries = 30;
  while (retries > 0) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Database connected!', result.rows[0].now);
      return true;
    } catch (error) {
      console.log(`⏳ Waiting for database... (${retries} retries left)`);
      retries--;
      await delay(2000);
    }
  }
  throw new Error('❌ Could not connect to database');
}

async function runScript(scriptPath, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${description}`);
  console.log(`   Script: ${path.basename(scriptPath)}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.log(`⚠️  Script not found: ${scriptPath}`);
      return false;
    }

    // Execute script
    const scriptModule = require(scriptPath);
    if (typeof scriptModule === 'function') {
      await scriptModule();
    } else if (scriptModule.run && typeof scriptModule.run === 'function') {
      await scriptModule.run();
    } else if (scriptModule.main && typeof scriptModule.main === 'function') {
      await scriptModule.main();
    }

    console.log(`✅ ${description} - COMPLETED`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${description}:`);
    console.error(error.message);
    console.error(error.stack);
    return false;
  }
}

async function loadData() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Fiber Network - Complete Data Loading Script         ║
╚═══════════════════════════════════════════════════════════╝
  `);

  const startTime = Date.now();
  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  try {
    // Check connection
    await checkConnection();

    const scriptsToRun = [
      // 1. Infrastructure (nodes and edges)
      {
        path: path.join(__dirname, '../infraestructura/scripts/cargar_datos_supabase.js'),
        description: 'Loading Infrastructure (nodes and edges)',
        priority: 1
      },
      
      // 2. Metadata (datacenters, ground type, etc.)
      {
        path: path.join(__dirname, '../metadata/scripts/load_datacenters.js'),
        description: 'Loading Datacenters',
        priority: 2
      },
      {
        path: path.join(__dirname, '../metadata/scripts/load_metadata_to_supabase.js'),
        description: 'Loading Metadata (ground type, infrastructure support)',
        priority: 2
      },
      
      // 3. Threats (earthquakes, fires, weather)
      {
        path: path.join(__dirname, '../amenazas/adaptar_para_supabase.js'),
        description: 'Loading Threat Data (earthquakes, fires, weather)',
        priority: 3
      },
      
      // 4. Probabilities
      {
        path: path.join(__dirname, '../scripts/calculate_and_load_probabilities.js'),
        description: 'Calculating and Loading Failure Probabilities',
        priority: 4
      }
    ];

    // Sort by priority
    scriptsToRun.sort((a, b) => a.priority - b.priority);

    // Run each script
    for (const script of scriptsToRun) {
      const success = await runScript(script.path, script.description);
      if (success) {
        results.success.push(script.description);
      } else if (fs.existsSync(script.path)) {
        results.failed.push(script.description);
      } else {
        results.skipped.push(script.description);
      }
      
      // Small delay between scripts
      await delay(1000);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during data loading:');
    console.error(error);
  } finally {
    await pool.end();
  }

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n
╔═══════════════════════════════════════════════════════════╗
║                    LOADING SUMMARY                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log(`⏱️  Total time: ${duration}s\n`);
  
  console.log(`✅ Successfully loaded (${results.success.length}):`);
  results.success.forEach(desc => console.log(`   ✓ ${desc}`));
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed (${results.failed.length}):`);
    results.failed.forEach(desc => console.log(`   ✗ ${desc}`));
  }
  
  if (results.skipped.length > 0) {
    console.log(`\n⚠️  Skipped (${results.skipped.length}):`);
    results.skipped.forEach(desc => console.log(`   - ${desc}`));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  
  if (results.failed.length === 0) {
    console.log('🎉 All data loaded successfully!');
  } else {
    console.log('⚠️  Some scripts failed. Check logs above for details.');
  }
  
  console.log(`${'='.repeat(60)}\n`);
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  loadData().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = loadData;
