-- Script para configurar las tablas en Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- Habilitar la extensión PostGIS si no está habilitada
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla para infraestructura (contiene tanto Points como LineStrings)
DROP TABLE IF EXISTS infrastructure CASCADE;
CREATE TABLE infrastructure (
    id SERIAL PRIMARY KEY,
    type TEXT,
    properties JSONB,
    geometry GEOMETRY(Geometry, 4326)
);

-- Tabla para datacenters (solo Points)
DROP TABLE IF EXISTS datacenters CASCADE;
CREATE TABLE datacenters (
    id SERIAL PRIMARY KEY,
    type TEXT,
    properties JSONB,
    geometry GEOMETRY(Point, 4326)
);

-- Tabla para earthquakes (solo Points)
DROP TABLE IF EXISTS earthquakes CASCADE;
CREATE TABLE earthquakes (
    id SERIAL PRIMARY KEY,
    type TEXT,
    properties JSONB,
    geometry GEOMETRY(Point, 4326)
);

-- Tabla unificada para todas las amenazas
DROP TABLE IF EXISTS threats CASCADE;
CREATE TABLE threats (
    id SERIAL PRIMARY KEY,
    threat_type TEXT NOT NULL,  -- 'earthquake', 'forest_fire', 'extreme_weather', etc.
    magnitude DECIMAL,
    depth DECIMAL,
    event_date TIMESTAMP,
    location TEXT,
    severity TEXT,
    affected_area_km2 DECIMAL,
    description TEXT,
    source TEXT,
    properties JSONB,  -- Propiedades adicionales específicas de cada amenaza
    geometry GEOMETRY(Geometry, 4326),  -- Permite Point, LineString, Polygon
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices espaciales para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS infrastructure_geom_idx ON infrastructure USING GIST (geometry);
CREATE INDEX IF NOT EXISTS datacenters_geom_idx ON datacenters USING GIST (geometry);
CREATE INDEX IF NOT EXISTS earthquakes_geom_idx ON earthquakes USING GIST (geometry);
CREATE INDEX IF NOT EXISTS threats_geom_idx ON threats USING GIST (geometry);
CREATE INDEX IF NOT EXISTS threats_type_idx ON threats (threat_type);

-- Desactivar Row Level Security (RLS) para permitir inserciones desde la API
ALTER TABLE infrastructure DISABLE ROW LEVEL SECURITY;
ALTER TABLE datacenters DISABLE ROW LEVEL SECURITY;
ALTER TABLE earthquakes DISABLE ROW LEVEL SECURITY;
ALTER TABLE threats DISABLE ROW LEVEL SECURITY;

-- O alternativamente, crear políticas que permitan todas las operaciones:
-- ALTER TABLE infrastructure ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable all operations for infrastructure" ON infrastructure FOR ALL USING (true) WITH CHECK (true);

-- ALTER TABLE datacenters ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable all operations for datacenters" ON datacenters FOR ALL USING (true) WITH CHECK (true);

-- ALTER TABLE earthquakes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable all operations for earthquakes" ON earthquakes FOR ALL USING (true) WITH CHECK (true);

-- ALTER TABLE threats ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable all operations for threats" ON threats FOR ALL USING (true) WITH CHECK (true);
