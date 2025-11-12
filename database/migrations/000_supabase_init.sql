-- Migración inicial para Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Habilitar extensiones necesarias
-- Estas extensiones deben estar habilitadas desde el panel de Extensions de Supabase
-- pero por si acaso, intentamos habilitarlas por SQL también

-- PostGIS para datos geoespaciales
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- pgRouting para algoritmos de ruteo
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- Extensiones útiles adicionales
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Para búsquedas de texto

-- 2. Verificar versiones
SELECT PostGIS_version() as postgis_version;
SELECT pgr_version() as pgrouting_version;

-- 3. Nota importante sobre Row Level Security (RLS)
-- Supabase habilita RLS por defecto en todas las tablas
-- Para desarrollo, puedes deshabilitarlo temporalmente:

/*
-- Descomentar estas líneas SOLO para desarrollo:
ALTER TABLE IF EXISTS fiber_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fiber_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS datacenters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS earthquakes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS forest_fires DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS extreme_weather DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ground_type DISABLE ROW LEVEL SECURITY;
*/

-- 4. Crear políticas de seguridad permisivas para desarrollo
-- Estas políticas permiten acceso completo de lectura/escritura
-- IMPORTANTE: Ajusta estas políticas según tus necesidades de seguridad

-- Política de lectura pública para todas las tablas principales
DO $$ 
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'fiber_links', 'fiber_nodes', 'datacenters', 
            'earthquakes', 'forest_fires', 'extreme_weather', 
            'ground_type', 'node_probabilities', 'edge_probabilities'
        )
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        
        -- Crear política de lectura pública
        EXECUTE format('
            DROP POLICY IF EXISTS "Allow public read access" ON %I;
            CREATE POLICY "Allow public read access" 
            ON %I FOR SELECT 
            USING (true)
        ', table_name, table_name);
        
        -- Crear política de escritura para service role
        EXECUTE format('
            DROP POLICY IF EXISTS "Allow service role all access" ON %I;
            CREATE POLICY "Allow service role all access" 
            ON %I FOR ALL 
            USING (true)
        ', table_name, table_name);
    END LOOP;
END $$;

-- 5. Verificar que las tablas existen
SELECT 
    tablename,
    schemaname
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 6. Mensaje de éxito
DO $$ 
BEGIN
    RAISE NOTICE 'Supabase setup completed successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run schema.sql to create all tables';
    RAISE NOTICE '2. Run migrations in order';
    RAISE NOTICE '3. Load initial data using Python scripts';
END $$;
