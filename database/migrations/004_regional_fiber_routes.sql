-- ============================================================================
-- MIGRATION: Tabla para rutas regionales de fibra (Región del Biobío)
-- ============================================================================
-- Descripción: Enlaces de fibra óptica filtrados por región con datos de OSRM
-- Archivo origen: backend/infraestructura/data/rutas_filtradas_regiones.geojson
-- ============================================================================

-- Crear tabla para almacenar las rutas regionales de fibra
DROP TABLE IF EXISTS regional_fiber_routes CASCADE;

CREATE TABLE regional_fiber_routes (
    id SERIAL PRIMARY KEY,
    
    -- Identificadores de nodos origen y destino
    from_idx DOUBLE PRECISION,              -- Índice del nodo origen
    to_idx DOUBLE PRECISION,                -- Índice del nodo destino
    
    -- Propiedades de la ruta
    route_type VARCHAR(50),                 -- Tipo: local, regional, national
    region VARCHAR(100),                    -- Región de Chile
    source VARCHAR(50),                     -- Fuente de datos (osrm, osm, etc.)
    
    -- Información adicional (campos del GeoJSON original)
    company_name VARCHAR(255),              -- Nombre de la compañía (si aplica)
    address TEXT,                           -- Dirección
    city VARCHAR(100),                      -- Ciudad
    state VARCHAR(100),                     -- Estado/Provincia
    country VARCHAR(100),                   -- País
    
    -- Geometría
    geometry GEOMETRY(LineString, 4326),    -- Línea que representa la ruta
    length_meters DOUBLE PRECISION,         -- Longitud calculada en metros
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimización de consultas espaciales
CREATE INDEX idx_regional_fiber_routes_geometry ON regional_fiber_routes USING GIST(geometry);
CREATE INDEX idx_regional_fiber_routes_region ON regional_fiber_routes(region);
CREATE INDEX idx_regional_fiber_routes_type ON regional_fiber_routes(route_type);
CREATE INDEX idx_regional_fiber_routes_from_idx ON regional_fiber_routes(from_idx);
CREATE INDEX idx_regional_fiber_routes_to_idx ON regional_fiber_routes(to_idx);

-- Trigger para actualizar el campo updated_at
CREATE OR REPLACE FUNCTION update_regional_fiber_routes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_regional_fiber_routes_timestamp
    BEFORE UPDATE ON regional_fiber_routes
    FOR EACH ROW
    EXECUTE FUNCTION update_regional_fiber_routes_timestamp();

-- Comentarios de documentación
COMMENT ON TABLE regional_fiber_routes IS 'Rutas de fibra óptica filtradas por región (generadas desde OSRM)';
COMMENT ON COLUMN regional_fiber_routes.from_idx IS 'Índice del nodo de origen de la ruta';
COMMENT ON COLUMN regional_fiber_routes.to_idx IS 'Índice del nodo de destino de la ruta';
COMMENT ON COLUMN regional_fiber_routes.route_type IS 'Tipo de ruta: local, regional o national';
COMMENT ON COLUMN regional_fiber_routes.region IS 'Región administrativa de Chile donde se encuentra la ruta';
COMMENT ON COLUMN regional_fiber_routes.geometry IS 'Geometría LineString en WGS84 (SRID 4326)';
COMMENT ON COLUMN regional_fiber_routes.length_meters IS 'Longitud de la ruta en metros (calculada desde geometría)';
