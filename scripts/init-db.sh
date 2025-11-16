#!/bin/bash
# ============================================================================
# Database Initialization Script - Complete Setup
# ============================================================================
# This script initializes the fiber network database with schema and all data
# Executed automatically by Docker on first container start
# ============================================================================

set -e  # Exit on error

echo "============================================"
echo "🚀 Fiber Network Database Initialization"
echo "============================================"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -U postgres; do
  sleep 1
done
echo "✅ PostgreSQL is ready!"

# Install pgRouting extension
echo "📦 Installing pgRouting extension..."
apt-get update > /dev/null 2>&1
apt-get install -y postgresql-15-pgrouting postgresql-15-pgrouting-scripts > /dev/null 2>&1
echo "✅ pgRouting installed!"

# Create database if not exists
echo "📊 Creating database 'fiber_network'..."
psql -v ON_ERROR_STOP=1 --username "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE fiber_network'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fiber_network')\gexec
EOSQL

# Enable extensions
echo "🔧 Enabling extensions..."
psql -v ON_ERROR_STOP=1 --username "postgres" --dbname "fiber_network" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pgrouting;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOSQL
echo "✅ Extensions enabled!"

# Load schema
echo "📋 Loading schema..."
if [ -f "/docker-entrypoint-initdb.d/sql/schema.sql" ]; then
    psql -v ON_ERROR_STOP=1 --username "postgres" --dbname "fiber_network" -f /docker-entrypoint-initdb.d/sql/schema.sql
    echo "✅ Schema loaded!"
else
    echo "⚠️  Warning: schema.sql not found"
fi

# Load migrations
echo "🔄 Loading migrations..."
for migration in /docker-entrypoint-initdb.d/sql/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "   → Loading $(basename $migration)..."
        psql -v ON_ERROR_STOP=0 --username "postgres" --dbname "fiber_network" -f "$migration"
    fi
done
echo "✅ Migrations loaded!"

# Verify installation
echo "🔍 Verifying installation..."
psql --username "postgres" --dbname "fiber_network" <<-EOSQL
    SELECT 'PostGIS: ' || PostGIS_Full_Version();
    SELECT 'pgRouting: ' || pgr_version();
    SELECT 'Tables: ' || count(*)::text FROM information_schema.tables WHERE table_schema = 'public';
EOSQL

echo "============================================"
echo "✅ Database initialization completed!"
echo "============================================"
echo ""
echo "📝 Next steps:"
echo "   1. Wait for backend to start"
echo "   2. Load data using scripts:"
echo "      - docker-compose exec backend node /app/scripts/load-all-data.js"
echo "============================================"
