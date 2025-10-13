-- ============================================================================
-- SCHEMA.SQL - Base de Datos para Red de Fibra Óptica en Chile
-- ============================================================================
-- Proyecto: Resiliencia de Redes de Fibra Óptica en zonas críticas de Chile
-- Descripción: Base de datos geoespacial con PostGIS y pgRouting para
--              análisis de infraestructura, metadata y amenazas
-- ============================================================================

-- Crear extensiones necesarias
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ============================================================================
-- TABLA: nodes (Nodos de la red de fibra óptica)
-- ============================================================================
-- Descripción: Puntos de conexión en la red (intersecciones, datacenters, etc.)
-- Fuente: Extraído de infraestructura/mapa_completo_v2.geojson
DROP TABLE IF EXISTS nodes CASCADE;

CREATE TABLE nodes (
    id BIGSERIAL PRIMARY KEY,
    osm_id BIGINT,                          -- ID de OpenStreetMap (si aplica)
    node_type VARCHAR(50),                  -- Tipo: intersection, datacenter, endpoint
    latitude DOUBLE PRECISION,              -- Latitud
    longitude DOUBLE PRECISION,             -- Longitud
    region VARCHAR(100),                    -- Región de Chile
    city VARCHAR(100),                      -- Ciudad
    elevation DOUBLE PRECISION,             -- Elevación en metros (opcional)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    geometry GEOMETRY(Point, 4326)          -- Geometría espacial (SRID 4326 = WGS84)
);

-- Índices para nodes
CREATE INDEX idx_nodes_geometry ON nodes USING GIST(geometry);
CREATE INDEX idx_nodes_osm_id ON nodes(osm_id);
CREATE INDEX idx_nodes_region ON nodes(region);
CREATE INDEX idx_nodes_type ON nodes(node_type);

-- ============================================================================
-- TABLA: edges (Enlaces/Aristas de la red)
-- ============================================================================
-- Descripción: Conexiones físicas entre nodos (cables de fibra óptica)
-- Fuente: infraestructura/mapa_completo_v2.geojson y vias_con_recubrimiento_estim.geojson
DROP TABLE IF EXISTS edges CASCADE;

CREATE TABLE edges (
    id BIGSERIAL PRIMARY KEY,
    source BIGINT,                          -- ID del nodo origen (FK a nodes)
    target BIGINT,                          -- ID del nodo destino (FK a nodes)
    osm_id VARCHAR(100),                    -- ID de OpenStreetMap

    -- Propiedades geométricas
    length DOUBLE PRECISION,                -- Longitud en metros
    geometry GEOMETRY(LineString, 4326),    -- Geometría del enlace

    -- Propiedades de la vía
    highway VARCHAR(50),                    -- Tipo de vía (motorway, primary, secondary, etc.)
    name VARCHAR(255),                      -- Nombre de la calle/ruta
    surface VARCHAR(50),                    -- Tipo de superficie (paved, unpaved, etc.)
    lanes INTEGER,                          -- Número de carriles
    maxspeed VARCHAR(20),                   -- Velocidad máxima
    oneway BOOLEAN DEFAULT FALSE,           -- Si es de un solo sentido
    bridge BOOLEAN DEFAULT FALSE,           -- Si es un puente
    tunnel BOOLEAN DEFAULT FALSE,           -- Si es un túnel

    -- Metadata adicional
    region VARCHAR(100),                    -- Región de Chile
    source_type VARCHAR(50),                -- osm, osrm, manual
    link_type VARCHAR(50),                  -- local, regional, national, international

    -- Recubrimiento de fibra (específico del proyecto)
    recubrimiento_estim VARCHAR(100),       -- Tipo estimado de recubrimiento

    -- Campos para pgRouting
    cost DOUBLE PRECISION,                  -- Costo directo (por defecto = length)
    reverse_cost DOUBLE PRECISION,          -- Costo inverso (para vías bidireccionales)

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para edges
CREATE INDEX idx_edges_geometry ON edges USING GIST(geometry);
CREATE INDEX idx_edges_source ON edges(source);
CREATE INDEX idx_edges_target ON edges(target);
CREATE INDEX idx_edges_highway ON edges(highway);
CREATE INDEX idx_edges_region ON edges(region);
CREATE INDEX idx_edges_source_target ON edges(source, target);

-- Trigger para auto-calcular cost basado en length
CREATE OR REPLACE FUNCTION update_edge_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Si no se especifica cost, usar length
    IF NEW.cost IS NULL THEN
        NEW.cost := NEW.length;
    END IF;

    -- Si es bidireccional (oneway = false), reverse_cost = cost
    IF NEW.oneway = FALSE THEN
        NEW.reverse_cost := NEW.cost;
    ELSE
        -- Si es unidireccional, reverse_cost muy alto (prácticamente infinito)
        NEW.reverse_cost := 1000000;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_edge_cost
    BEFORE INSERT OR UPDATE ON edges
    FOR EACH ROW
    EXECUTE FUNCTION update_edge_cost();

-- ============================================================================
-- TABLA: datacenters (Centros de datos)
-- ============================================================================
-- Descripción: Ubicación de datacenters en Chile
-- Fuente: metadata/datacenters_fixed.geojson
DROP TABLE IF EXISTS datacenters CASCADE;

CREATE TABLE datacenters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,             -- Nombre del datacenter
    company_name VARCHAR(255),              -- Empresa operadora
    address VARCHAR(500),                   -- Dirección
    city VARCHAR(100),                      -- Ciudad
    state VARCHAR(100),                     -- Región/Estado
    country VARCHAR(100),                   -- País (Chile)

    -- Información adicional
    capacity_mw DOUBLE PRECISION,           -- Capacidad en MW (opcional)
    tier_level INTEGER,                     -- Tier level (1-4)
    year_opened INTEGER,                    -- Año de apertura

    -- Metadata de población cercana
    urban_density VARCHAR(50),              -- Alta, Media, Baja
    population_5km INTEGER,                 -- Población en radio de 5km

    geometry GEOMETRY(Point, 4326),         -- Ubicación geográfica
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para datacenters
CREATE INDEX idx_datacenters_geometry ON datacenters USING GIST(geometry);
CREATE INDEX idx_datacenters_city ON datacenters(city);
CREATE INDEX idx_datacenters_company ON datacenters(company_name);

-- ============================================================================
-- TABLA: earthquakes (Sismos)
-- ============================================================================
-- Descripción: Registro de sismos históricos y recientes
-- Fuente: USGS Earthquake API (amenazas/seismicidad.py)
DROP TABLE IF EXISTS earthquakes CASCADE;

CREATE TABLE earthquakes (
    id SERIAL PRIMARY KEY,
    usgs_id VARCHAR(100) UNIQUE,            -- ID único de USGS
    magnitude DOUBLE PRECISION NOT NULL,    -- Magnitud (Richter)
    depth DOUBLE PRECISION,                 -- Profundidad en km
    time TIMESTAMP,                         -- Fecha y hora del sismo
    place VARCHAR(255),                     -- Descripción del lugar

    -- Clasificación de amenaza
    threat_level VARCHAR(20),               -- low, medium, high, critical

    geometry GEOMETRY(Point, 4326),         -- Epicentro
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para earthquakes
CREATE INDEX idx_earthquakes_geometry ON earthquakes USING GIST(geometry);
CREATE INDEX idx_earthquakes_magnitude ON earthquakes(magnitude);
CREATE INDEX idx_earthquakes_time ON earthquakes(time);
CREATE INDEX idx_earthquakes_threat ON earthquakes(threat_level);

-- Trigger para auto-calcular threat_level basado en magnitud
CREATE OR REPLACE FUNCTION calculate_earthquake_threat()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.magnitude >= 7.0 THEN
        NEW.threat_level := 'critical';
    ELSIF NEW.magnitude >= 6.0 THEN
        NEW.threat_level := 'high';
    ELSIF NEW.magnitude >= 4.5 THEN
        NEW.threat_level := 'medium';
    ELSE
        NEW.threat_level := 'low';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_earthquake_threat
    BEFORE INSERT OR UPDATE ON earthquakes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_earthquake_threat();

-- ============================================================================
-- TABLA: fire_risk_zones (Zonas de riesgo de incendio)
-- ============================================================================
-- Descripción: Áreas con alto riesgo de incendios forestales
-- Fuente: amenazas/incendios_forestales.py
DROP TABLE IF EXISTS fire_risk_zones CASCADE;

CREATE TABLE fire_risk_zones (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(255),                 -- Nombre de la zona
    risk_level VARCHAR(20),                 -- low, medium, high, extreme
    vegetation_type VARCHAR(100),           -- Tipo de vegetación
    area_km2 DOUBLE PRECISION,              -- Área en km²

    -- Períodos de riesgo
    high_risk_months INTEGER[],             -- Array de meses de alto riesgo (1-12)

    -- Metadata
    last_fire_date DATE,                    -- Fecha del último incendio
    fire_frequency INTEGER,                 -- Frecuencia de incendios (por década)

    geometry GEOMETRY(Polygon, 4326),       -- Polígono del área de riesgo
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para fire_risk_zones
CREATE INDEX idx_fire_zones_geometry ON fire_risk_zones USING GIST(geometry);
CREATE INDEX idx_fire_zones_risk ON fire_risk_zones(risk_level);

-- ============================================================================
-- TABLA: weather_events (Eventos climáticos extremos)
-- ============================================================================
-- Descripción: Registro de eventos climáticos extremos (tormentas, inundaciones, etc.)
-- Fuente: amenazas/extreme_weather.py, amenazas/clima_extremo.py
DROP TABLE IF EXISTS weather_events CASCADE;

CREATE TABLE weather_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50),                 -- storm, flood, snow, wind, etc.
    severity VARCHAR(20),                   -- low, medium, high, extreme
    event_date DATE,                        -- Fecha del evento
    duration_hours INTEGER,                 -- Duración en horas

    -- Detalles específicos
    max_wind_speed DOUBLE PRECISION,        -- Velocidad máxima del viento (km/h)
    precipitation_mm DOUBLE PRECISION,      -- Precipitación (mm)
    temperature_c DOUBLE PRECISION,         -- Temperatura (°C)

    -- Impacto
    affected_population INTEGER,            -- Población afectada
    infrastructure_damage VARCHAR(20),      -- none, minor, moderate, severe

    description TEXT,                       -- Descripción del evento
    geometry GEOMETRY(Polygon, 4326),       -- Área afectada
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para weather_events
CREATE INDEX idx_weather_geometry ON weather_events USING GIST(geometry);
CREATE INDEX idx_weather_type ON weather_events(event_type);
CREATE INDEX idx_weather_severity ON weather_events(severity);
CREATE INDEX idx_weather_date ON weather_events(event_date);

-- ============================================================================
-- TABLA: ground_type (Tipo de suelo)
-- ============================================================================
-- Descripción: Clasificación del tipo de suelo para análisis de instalación
-- Fuente: metadata/api-tests/ground_type.py
DROP TABLE IF EXISTS ground_type CASCADE;

CREATE TABLE ground_type (
    id SERIAL PRIMARY KEY,
    soil_type VARCHAR(100),                 -- rock, clay, sand, mixed, etc.
    stability VARCHAR(20),                  -- stable, moderate, unstable
    installation_difficulty VARCHAR(20),    -- easy, moderate, difficult, very_difficult

    -- Propiedades del suelo
    permeability VARCHAR(20),               -- high, medium, low
    bearing_capacity DOUBLE PRECISION,      -- Capacidad de carga (kg/cm²)

    geometry GEOMETRY(Polygon, 4326),       -- Área
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para ground_type
CREATE INDEX idx_ground_geometry ON ground_type USING GIST(geometry);
CREATE INDEX idx_ground_stability ON ground_type(stability);

-- ============================================================================
-- TABLA: routes (Rutas calculadas)
-- ============================================================================
-- Descripción: Almacena rutas calculadas con pgRouting
DROP TABLE IF EXISTS routes CASCADE;

CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    route_name VARCHAR(255),                -- Nombre descriptivo
    start_node_id BIGINT REFERENCES nodes(id),
    end_node_id BIGINT REFERENCES nodes(id),

    -- Resultados del cálculo
    total_cost DOUBLE PRECISION,            -- Costo total (metros, tiempo, etc.)
    total_length_km DOUBLE PRECISION,       -- Longitud total en km
    edge_sequence BIGINT[],                 -- Array de IDs de edges en la ruta
    node_sequence BIGINT[],                 -- Array de IDs de nodes en la ruta

    -- Tipo de ruta
    route_type VARCHAR(50),                 -- shortest, safest, balanced
    considers_threats BOOLEAN DEFAULT FALSE, -- Si considera amenazas

    -- Metadata
    calculation_date TIMESTAMP DEFAULT NOW(),
    algorithm VARCHAR(50),                  -- dijkstra, astar, etc.

    geometry GEOMETRY(LineString, 4326)     -- Geometría de la ruta completa
);

-- Índices para routes
CREATE INDEX idx_routes_geometry ON routes USING GIST(geometry);
CREATE INDEX idx_routes_start ON routes(start_node_id);
CREATE INDEX idx_routes_end ON routes(end_node_id);

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Función para calcular ruta más corta con pgr_dijkstra
CREATE OR REPLACE FUNCTION calculate_shortest_path(
    start_lat DOUBLE PRECISION,
    start_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION
)
RETURNS TABLE (
    seq INTEGER,
    path_seq INTEGER,
    node BIGINT,
    edge BIGINT,
    cost DOUBLE PRECISION,
    agg_cost DOUBLE PRECISION,
    geom GEOMETRY
) AS $$
BEGIN
    RETURN QUERY
    WITH start_node AS (
        SELECT id FROM nodes
        ORDER BY ST_Distance(
            geometry,
            ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326)
        )
        LIMIT 1
    ),
    end_node AS (
        SELECT id FROM nodes
        ORDER BY ST_Distance(
            geometry,
            ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326)
        )
        LIMIT 1
    )
    SELECT
        r.seq,
        r.path_seq,
        r.node,
        r.edge,
        r.cost,
        r.agg_cost,
        e.geometry as geom
    FROM pgr_dijkstra(
        'SELECT id, source, target, cost, reverse_cost FROM edges WHERE cost > 0',
        (SELECT id FROM start_node),
        (SELECT id FROM end_node),
        directed := false
    ) r
    LEFT JOIN edges e ON r.edge = e.id;
END;
$$ LANGUAGE plpgsql;

-- Función para encontrar amenazas cercanas a un punto
CREATE OR REPLACE FUNCTION find_nearby_threats(
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
    threat_type VARCHAR,
    threat_id INTEGER,
    distance_km DOUBLE PRECISION,
    severity VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    -- Sismos cercanos
    SELECT
        'earthquake'::VARCHAR as threat_type,
        id as threat_id,
        ST_Distance(
            geometry::geography,
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        ) / 1000 as distance_km,
        threat_level as severity
    FROM earthquakes
    WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        radius_km * 1000
    )

    UNION ALL

    -- Zonas de incendio
    SELECT
        'fire_zone'::VARCHAR,
        id,
        ST_Distance(
            ST_Centroid(geometry)::geography,
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        ) / 1000,
        risk_level
    FROM fire_risk_zones
    WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        radius_km * 1000
    )

    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista: Estadísticas de la red por región
CREATE OR REPLACE VIEW network_stats_by_region AS
SELECT
    e.region,
    COUNT(DISTINCT e.id) as total_edges,
    COUNT(DISTINCT e.source) + COUNT(DISTINCT e.target) as total_nodes,
    SUM(e.length) / 1000 as total_km,
    AVG(e.length) as avg_edge_length,
    COUNT(CASE WHEN e.highway = 'motorway' THEN 1 END) as motorways,
    COUNT(CASE WHEN e.highway = 'primary' THEN 1 END) as primary_roads,
    COUNT(CASE WHEN e.bridge THEN 1 END) as bridges,
    COUNT(CASE WHEN e.tunnel THEN 1 END) as tunnels
FROM edges e
GROUP BY e.region
ORDER BY total_km DESC;

-- Vista: Amenazas por región
CREATE OR REPLACE VIEW threats_by_region AS
WITH earthquake_regions AS (
    SELECT
        'earthquake' as threat_type,
        COUNT(*) as threat_count,
        AVG(magnitude) as avg_severity
    FROM earthquakes
),
fire_regions AS (
    SELECT
        'fire_zone' as threat_type,
        COUNT(*) as threat_count,
        SUM(area_km2) as total_area_km2
    FROM fire_risk_zones
)
SELECT * FROM earthquake_regions
UNION ALL
SELECT threat_type, threat_count, total_area_km2 FROM fire_regions;

-- ============================================================================
-- COMENTARIOS EN TABLAS (para documentación)
-- ============================================================================
COMMENT ON TABLE nodes IS 'Nodos de la red de fibra óptica (intersecciones, datacenters)';
COMMENT ON TABLE edges IS 'Enlaces físicos entre nodos (cables de fibra óptica sobre vías)';
COMMENT ON TABLE datacenters IS 'Ubicación y detalles de centros de datos en Chile';
COMMENT ON TABLE earthquakes IS 'Registro histórico de sismos (fuente: USGS)';
COMMENT ON TABLE fire_risk_zones IS 'Zonas con riesgo de incendios forestales';
COMMENT ON TABLE weather_events IS 'Eventos climáticos extremos registrados';
COMMENT ON TABLE ground_type IS 'Clasificación del tipo de suelo por zona';
COMMENT ON TABLE routes IS 'Rutas calculadas con algoritmos de pgRouting';

-- ============================================================================
-- DATOS DE EJEMPLO (OPCIONAL - comentar si no se desea)
-- ============================================================================
-- Insertar algunas regiones principales de Chile como referencia
INSERT INTO nodes (osm_id, node_type, latitude, longitude, region, city) VALUES
(1, 'datacenter', -33.4489, -70.6693, 'Región Metropolitana', 'Santiago'),
(2, 'datacenter', -36.8270, -73.0498, 'Región del Biobío', 'Concepción'),
(3, 'datacenter', -33.0472, -71.6127, 'Región de Valparaíso', 'Valparaíso')
ON CONFLICT DO NOTHING;

-- Actualizar geometrías
UPDATE nodes SET geometry = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE geometry IS NULL;

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================

-- Verificar instalación
SELECT 'PostGIS version: ' || PostGIS_Full_Version() as info
UNION ALL
SELECT 'pgRouting version: ' || pgr_version() as info;

COMMENT ON SCHEMA public IS 'Schema para análisis de resiliencia de redes de fibra óptica en Chile';
