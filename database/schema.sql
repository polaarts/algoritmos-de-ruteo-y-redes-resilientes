-- ============================================================================
-- SCHEMA.SQL - Base de Datos para Red de Fibra Óptica en Chile (Supabase)
-- ============================================================================
-- Proyecto: Resiliencia de Redes de Fibra Óptica en zonas críticas de Chile
-- Descripción: Base de datos geoespacial con PostGIS y pgRouting para
--              análisis de infraestructura, metadata y amenazas
-- Versión: 2.0 - Optimizado para Supabase
-- ============================================================================

-- Crear extensiones necesarias
-- ============================================================================
-- NOTA: En Supabase, habilita estas extensiones primero desde:
-- Dashboard > Database > Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- TABLA: fiber_nodes (Nodos de la red de fibra óptica)
-- ============================================================================
-- Descripción: Puntos de conexión en la red (intersecciones, datacenters, etc.)
-- Fuente: Extraído de infraestructura/mapa_completo_v2.geojson
DROP TABLE IF EXISTS fiber_nodes CASCADE;

CREATE TABLE fiber_nodes (
    id BIGSERIAL PRIMARY KEY,
    osm_id BIGINT,                          -- ID de OpenStreetMap (si aplica)
    node_type VARCHAR(50),                  -- Tipo: intersection, datacenter, endpoint
    latitude DOUBLE PRECISION,              -- Latitud
    longitude DOUBLE PRECISION,             -- Longitud
    region VARCHAR(100),                    -- Región de Chile
    city VARCHAR(100),                      -- Ciudad
    elevation DOUBLE PRECISION,             -- Elevación en metros (opcional)
    
    -- Campos para análisis de resiliencia
    is_critical BOOLEAN DEFAULT FALSE,      -- Si es un nodo crítico
    redundancy_level INTEGER DEFAULT 1,     -- Nivel de redundancia (1-5)
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    geometry GEOMETRY(Point, 4326)          -- Geometría espacial (SRID 4326 = WGS84)
);

-- Índices para fiber_nodes
CREATE INDEX idx_fiber_nodes_geometry ON fiber_nodes USING GIST(geometry);
CREATE INDEX idx_fiber_nodes_osm_id ON fiber_nodes(osm_id);
CREATE INDEX idx_fiber_nodes_region ON fiber_nodes(region);
CREATE INDEX idx_fiber_nodes_type ON fiber_nodes(node_type);
CREATE INDEX idx_fiber_nodes_critical ON fiber_nodes(is_critical);

-- Vista de compatibilidad (eliminar cualquier objeto existente)
DROP TABLE IF EXISTS nodes CASCADE;
DROP VIEW IF EXISTS nodes CASCADE;
CREATE VIEW nodes AS SELECT * FROM fiber_nodes;

-- ============================================================================
-- TABLA: fiber_links (Enlaces/Aristas de la red)
-- ============================================================================
-- Descripción: Conexiones físicas entre nodos (cables de fibra óptica)
-- Fuente: infraestructura/mapa_completo_v2.geojson y vias_con_recubrimiento_estim.geojson
DROP TABLE IF EXISTS fiber_links CASCADE;

CREATE TABLE fiber_links (
    id BIGSERIAL PRIMARY KEY,
    source BIGINT REFERENCES fiber_nodes(id) ON DELETE CASCADE,  -- ID del nodo origen
    target BIGINT REFERENCES fiber_nodes(id) ON DELETE CASCADE,  -- ID del nodo destino
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
    
    -- Campos para resiliencia
    is_redundant BOOLEAN DEFAULT FALSE,     -- Si tiene rutas alternativas
    bandwidth_gbps DOUBLE PRECISION,        -- Ancho de banda en Gbps
    maintenance_priority INTEGER DEFAULT 3, -- Prioridad de mantenimiento (1-5)

    -- Campos para pgRouting
    cost DOUBLE PRECISION,                  -- Costo directo (por defecto = length)
    reverse_cost DOUBLE PRECISION,          -- Costo inverso (para vías bidireccionales)

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para fiber_links
CREATE INDEX idx_fiber_links_geometry ON fiber_links USING GIST(geometry);
CREATE INDEX idx_fiber_links_source ON fiber_links(source);
CREATE INDEX idx_fiber_links_target ON fiber_links(target);
CREATE INDEX idx_fiber_links_highway ON fiber_links(highway);
CREATE INDEX idx_fiber_links_region ON fiber_links(region);
CREATE INDEX idx_fiber_links_source_target ON fiber_links(source, target);
CREATE INDEX idx_fiber_links_redundant ON fiber_links(is_redundant);

-- Vista de compatibilidad (eliminar cualquier objeto existente)
DROP TABLE IF EXISTS edges CASCADE;
DROP VIEW IF EXISTS edges CASCADE;
CREATE VIEW edges AS SELECT * FROM fiber_links;

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
    BEFORE INSERT OR UPDATE ON fiber_links
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
-- TABLA: node_probabilities (Probabilidades de fallo de nodos)
-- ============================================================================
-- Descripción: Probabilidades de fallo para cada nodo basadas en amenazas
DROP TABLE IF EXISTS node_probabilities CASCADE;

CREATE TABLE node_probabilities (
    id SERIAL PRIMARY KEY,
    node_id BIGINT REFERENCES fiber_nodes(id) ON DELETE CASCADE,
    
    -- Probabilidades por tipo de amenaza (0-100)
    earthquake_probability DOUBLE PRECISION DEFAULT 0,
    fire_probability DOUBLE PRECISION DEFAULT 0,
    flood_probability DOUBLE PRECISION DEFAULT 0,
    weather_probability DOUBLE PRECISION DEFAULT 0,
    
    -- Probabilidad total agregada (0-100)
    total_failure_probability DOUBLE PRECISION DEFAULT 0,
    
    -- Factores de metadata
    ground_stability_factor DOUBLE PRECISION DEFAULT 1.0,  -- 0.5 a 2.0
    urban_density_factor DOUBLE PRECISION DEFAULT 1.0,     -- 0.5 a 1.5
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT NOW(),
    calculation_method VARCHAR(50) DEFAULT 'weighted_average'
);

CREATE INDEX idx_node_prob_node ON node_probabilities(node_id);
CREATE INDEX idx_node_prob_total ON node_probabilities(total_failure_probability);

-- ============================================================================
-- TABLA: edge_probabilities (Probabilidades de fallo de enlaces)
-- ============================================================================
-- Descripción: Probabilidades de fallo para cada enlace basadas en amenazas
DROP TABLE IF EXISTS edge_probabilities CASCADE;

CREATE TABLE edge_probabilities (
    id SERIAL PRIMARY KEY,
    edge_id BIGINT REFERENCES fiber_links(id) ON DELETE CASCADE,
    
    -- Probabilidades por tipo de amenaza (0-100)
    earthquake_probability DOUBLE PRECISION DEFAULT 0,
    fire_probability DOUBLE PRECISION DEFAULT 0,
    flood_probability DOUBLE PRECISION DEFAULT 0,
    weather_probability DOUBLE PRECISION DEFAULT 0,
    landslide_probability DOUBLE PRECISION DEFAULT 0,
    
    -- Probabilidad total agregada (0-100)
    total_failure_probability DOUBLE PRECISION DEFAULT 0,
    
    -- Factores de infraestructura
    bridge_factor DOUBLE PRECISION DEFAULT 1.0,           -- 1.5 si es puente
    tunnel_factor DOUBLE PRECISION DEFAULT 1.0,           -- 0.8 si es túnel
    surface_quality_factor DOUBLE PRECISION DEFAULT 1.0,  -- 0.7-1.3
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT NOW(),
    calculation_method VARCHAR(50) DEFAULT 'weighted_average'
);

CREATE INDEX idx_edge_prob_edge ON edge_probabilities(edge_id);
CREATE INDEX idx_edge_prob_total ON edge_probabilities(total_failure_probability);

-- ============================================================================
-- TABLA: routes (Rutas calculadas y guardadas)
-- ============================================================================
-- Descripción: Almacena rutas calculadas con diferentes algoritmos
DROP TABLE IF EXISTS routes CASCADE;

CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    route_name VARCHAR(255),                -- Nombre descriptivo
    start_node_id BIGINT REFERENCES fiber_nodes(id),
    end_node_id BIGINT REFERENCES fiber_nodes(id),
    
    -- Coordenadas de inicio y fin
    start_lat DOUBLE PRECISION,
    start_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,

    -- Resultados del cálculo
    total_cost DOUBLE PRECISION,            -- Costo total
    total_length_km DOUBLE PRECISION,       -- Longitud total en km
    total_time_minutes DOUBLE PRECISION,    -- Tiempo estimado en minutos
    edge_sequence BIGINT[],                 -- Array de IDs de edges en la ruta
    node_sequence BIGINT[],                 -- Array de IDs de nodes en la ruta

    -- Tipo de ruta y algoritmo
    route_type VARCHAR(50),                 -- shortest, safest, balanced, optimal
    algorithm VARCHAR(50),                  -- dijkstra, dijkstra_weighted, cplex, genetic
    considers_threats BOOLEAN DEFAULT FALSE,
    
    -- Métricas de resiliencia
    average_failure_probability DOUBLE PRECISION,  -- Probabilidad promedio de fallo
    max_failure_probability DOUBLE PRECISION,      -- Máxima probabilidad en la ruta
    resilience_score DOUBLE PRECISION,             -- Score de resiliencia (0-100)

    -- Metadata de cálculo
    calculation_date TIMESTAMP DEFAULT NOW(),
    computation_time_ms INTEGER,            -- Tiempo de cómputo en milisegundos
    user_id UUID,                           -- Usuario que calculó (opcional)
    
    -- Restricciones aplicadas
    max_probability_threshold DOUBLE PRECISION,
    avoid_high_risk_zones BOOLEAN DEFAULT FALSE,
    prefer_redundant_links BOOLEAN DEFAULT FALSE,

    geometry GEOMETRY(LineString, 4326)     -- Geometría de la ruta completa
);

-- Índices para routes
CREATE INDEX idx_routes_geometry ON routes USING GIST(geometry);
CREATE INDEX idx_routes_start ON routes(start_node_id);
CREATE INDEX idx_routes_end ON routes(end_node_id);
CREATE INDEX idx_routes_algorithm ON routes(algorithm);
CREATE INDEX idx_routes_date ON routes(calculation_date);

-- ============================================================================
-- TABLA: simulation_results (Resultados de simulaciones)
-- ============================================================================
-- Descripción: Almacena resultados de simulaciones Monte Carlo
DROP TABLE IF EXISTS simulation_results CASCADE;

CREATE TABLE simulation_results (
    id SERIAL PRIMARY KEY,
    simulation_name VARCHAR(255),
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    
    -- Parámetros de simulación
    num_iterations INTEGER DEFAULT 1000,
    random_seed INTEGER,
    
    -- Resultados agregados
    failure_count INTEGER,                  -- Cuántas veces falló la ruta
    success_rate DOUBLE PRECISION,          -- Tasa de éxito (0-100)
    average_failed_links INTEGER,           -- Promedio de enlaces fallidos
    
    -- Nodos y enlaces que fallaron más frecuentemente
    most_critical_nodes BIGINT[],
    most_critical_edges BIGINT[],
    
    -- Metadata
    simulation_date TIMESTAMP DEFAULT NOW(),
    computation_time_ms INTEGER
);

CREATE INDEX idx_simulation_route ON simulation_results(route_id);
CREATE INDEX idx_simulation_date ON simulation_results(simulation_date);

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: calculate_shortest_path (Dijkstra básico - solo distancia)
-- ============================================================================
DROP FUNCTION IF EXISTS calculate_shortest_path(double precision, double precision, double precision, double precision) CASCADE;

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
        SELECT id FROM fiber_nodes
        ORDER BY ST_Distance(
            geometry,
            ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326)
        )
        LIMIT 1
    ),
    end_node AS (
        SELECT id FROM fiber_nodes
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
        'SELECT id, source, target, cost, reverse_cost FROM fiber_links WHERE cost > 0',
        (SELECT id FROM start_node),
        (SELECT id FROM end_node),
        directed := false
    ) r
    LEFT JOIN fiber_links e ON r.edge = e.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: calculate_resilient_path (Dijkstra con probabilidades)
-- ============================================================================
DROP FUNCTION IF EXISTS calculate_resilient_path(double precision, double precision, double precision, double precision, double precision) CASCADE;

CREATE OR REPLACE FUNCTION calculate_resilient_path(
    start_lat DOUBLE PRECISION,
    start_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    probability_weight DOUBLE PRECISION DEFAULT 0.5
)
RETURNS TABLE (
    seq INTEGER,
    path_seq INTEGER,
    node BIGINT,
    edge BIGINT,
    cost DOUBLE PRECISION,
    agg_cost DOUBLE PRECISION,
    geom GEOMETRY,
    failure_prob DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    WITH start_node AS (
        SELECT id FROM fiber_nodes
        ORDER BY ST_Distance(
            geometry,
            ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326)
        )
        LIMIT 1
    ),
    end_node AS (
        SELECT id FROM fiber_nodes
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
        e.geometry as geom,
        COALESCE(ep.total_failure_probability, 0) as failure_prob
    FROM pgr_dijkstra(
        format('SELECT 
            l.id, 
            l.source, 
            l.target, 
            l.length * (1 + COALESCE(p.total_failure_probability, 0) * %s / 100) as cost,
            l.length * (1 + COALESCE(p.total_failure_probability, 0) * %s / 100) as reverse_cost
        FROM fiber_links l
        LEFT JOIN edge_probabilities p ON l.id = p.edge_id
        WHERE l.cost > 0', probability_weight, probability_weight),
        (SELECT id FROM start_node),
        (SELECT id FROM end_node),
        directed := false
    ) r
    LEFT JOIN fiber_links e ON r.edge = e.id
    LEFT JOIN edge_probabilities ep ON e.id = ep.edge_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: find_nearby_threats (Encontrar amenazas cercanas)
-- ============================================================================
DROP FUNCTION IF EXISTS find_nearby_threats(double precision, double precision, double precision) CASCADE;

CREATE OR REPLACE FUNCTION find_nearby_threats(
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
    threat_type VARCHAR,
    threat_id INTEGER,
    distance_km DOUBLE PRECISION,
    severity VARCHAR,
    geometry_json JSON
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
        threat_level as severity,
        ST_AsGeoJSON(geometry)::JSON as geometry_json
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
        risk_level,
        ST_AsGeoJSON(geometry)::JSON
    FROM fire_risk_zones
    WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        radius_km * 1000
    )

    UNION ALL

    -- Eventos climáticos
    SELECT
        'weather'::VARCHAR,
        id,
        ST_Distance(
            ST_Centroid(geometry)::geography,
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        ) / 1000,
        severity,
        ST_AsGeoJSON(geometry)::JSON
    FROM weather_events
    WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        radius_km * 1000
    )

    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: calculate_edge_threat_probability
-- ============================================================================
DROP FUNCTION IF EXISTS calculate_edge_threat_probability(bigint) CASCADE;

CREATE OR REPLACE FUNCTION calculate_edge_threat_probability(
    p_edge_id BIGINT
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_earthquake_prob DOUBLE PRECISION := 0;
    v_fire_prob DOUBLE PRECISION := 0;
    v_weather_prob DOUBLE PRECISION := 0;
    v_total_prob DOUBLE PRECISION := 0;
    v_geometry GEOMETRY;
BEGIN
    -- Obtener geometría del enlace
    SELECT geometry INTO v_geometry FROM fiber_links WHERE id = p_edge_id;
    
    IF v_geometry IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calcular probabilidad por sismos cercanos (dentro de 50km)
    SELECT COALESCE(AVG(
        CASE 
            WHEN magnitude >= 7.0 THEN 80
            WHEN magnitude >= 6.0 THEN 50
            WHEN magnitude >= 5.0 THEN 25
            ELSE 10
        END / (1 + ST_Distance(geometry::geography, v_geometry::geography) / 10000)
    ), 0)
    INTO v_earthquake_prob
    FROM earthquakes
    WHERE ST_DWithin(geometry::geography, v_geometry::geography, 50000);
    
    -- Calcular probabilidad por zonas de incendio
    SELECT COALESCE(MAX(
        CASE risk_level
            WHEN 'extreme' THEN 70
            WHEN 'high' THEN 50
            WHEN 'medium' THEN 30
            ELSE 15
        END
    ), 0)
    INTO v_fire_prob
    FROM fire_risk_zones
    WHERE ST_Intersects(geometry, v_geometry) OR 
          ST_DWithin(geometry::geography, v_geometry::geography, 5000);
    
    -- Calcular probabilidad por eventos climáticos recientes
    SELECT COALESCE(AVG(
        CASE severity
            WHEN 'extreme' THEN 60
            WHEN 'high' THEN 40
            WHEN 'medium' THEN 20
            ELSE 10
        END
    ), 0)
    INTO v_weather_prob
    FROM weather_events
    WHERE ST_Intersects(geometry, v_geometry)
    AND event_date >= CURRENT_DATE - INTERVAL '1 year';
    
    -- Calcular probabilidad total (no puede exceder 100)
    v_total_prob := LEAST(
        v_earthquake_prob * 0.4 + 
        v_fire_prob * 0.35 + 
        v_weather_prob * 0.25,
        95
    );
    
    RETURN v_total_prob;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: update_all_probabilities
-- ============================================================================
DROP FUNCTION IF EXISTS update_all_probabilities() CASCADE;

CREATE OR REPLACE FUNCTION update_all_probabilities()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_edge_record RECORD;
BEGIN
    -- Actualizar probabilidades de enlaces
    FOR v_edge_record IN SELECT id FROM fiber_links LOOP
        INSERT INTO edge_probabilities (edge_id, total_failure_probability, last_updated)
        VALUES (
            v_edge_record.id,
            calculate_edge_threat_probability(v_edge_record.id),
            NOW()
        )
        ON CONFLICT (edge_id) DO UPDATE SET
            total_failure_probability = calculate_edge_threat_probability(v_edge_record.id),
            last_updated = NOW();
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: simulate_route_failures (Simulación Monte Carlo)
-- ============================================================================
DROP FUNCTION IF EXISTS simulate_route_failures(integer, integer) CASCADE;

CREATE OR REPLACE FUNCTION simulate_route_failures(
    p_route_id INTEGER,
    p_num_simulations INTEGER DEFAULT 1000
)
RETURNS TABLE (
    simulation_id INTEGER,
    failed_edges BIGINT[],
    failed_nodes BIGINT[],
    route_failed BOOLEAN,
    failure_count INTEGER
) AS $$
DECLARE
    v_edge_sequence BIGINT[];
    v_edge_id BIGINT;
    v_failure_prob DOUBLE PRECISION;
    v_random_value DOUBLE PRECISION;
    v_failed_edges BIGINT[];
    v_route_failed BOOLEAN;
    v_sim_num INTEGER;
BEGIN
    -- Obtener secuencia de enlaces de la ruta
    SELECT edge_sequence INTO v_edge_sequence FROM routes WHERE id = p_route_id;
    
    -- Ejecutar simulaciones
    FOR v_sim_num IN 1..p_num_simulations LOOP
        v_failed_edges := ARRAY[]::BIGINT[];
        v_route_failed := FALSE;
        
        -- Para cada enlace en la ruta
        FOREACH v_edge_id IN ARRAY v_edge_sequence LOOP
            -- Obtener probabilidad de fallo
            SELECT COALESCE(total_failure_probability, 0) 
            INTO v_failure_prob
            FROM edge_probabilities 
            WHERE edge_id = v_edge_id;
            
            -- Generar número aleatorio
            v_random_value := random() * 100;
            
            -- Si el número aleatorio es menor que la probabilidad, el enlace falla
            IF v_random_value < v_failure_prob THEN
                v_failed_edges := array_append(v_failed_edges, v_edge_id);
                v_route_failed := TRUE;
            END IF;
        END LOOP;
        
        -- Retornar resultado de esta simulación
        RETURN QUERY SELECT 
            v_sim_num,
            v_failed_edges,
            ARRAY[]::BIGINT[] as failed_nodes_arr,
            v_route_failed,
            array_length(v_failed_edges, 1);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLA: user_constraints (Restricciones de usuario para rutas)
-- ============================================================================
DROP TABLE IF EXISTS user_constraints CASCADE;

CREATE TABLE user_constraints (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4(),
    
    -- Restricciones de probabilidad
    max_failure_probability DOUBLE PRECISION DEFAULT 50,
    avoid_high_risk_zones BOOLEAN DEFAULT TRUE,
    
    -- Restricciones de infraestructura
    avoid_bridges BOOLEAN DEFAULT FALSE,
    avoid_tunnels BOOLEAN DEFAULT FALSE,
    min_redundancy_level INTEGER DEFAULT 1,
    
    -- Restricciones de tipo de vía
    allowed_highway_types VARCHAR[] DEFAULT ARRAY['motorway', 'trunk', 'primary', 'secondary'],
    
    -- Preferencias
    prefer_redundant_links BOOLEAN DEFAULT TRUE,
    prefer_urban_areas BOOLEAN DEFAULT FALSE,
    
    -- Límites
    max_route_length_km DOUBLE PRECISION,
    max_computation_time_seconds INTEGER DEFAULT 30,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_constraints_session ON user_constraints(session_id);

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
FROM fiber_links e
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
),
weather_regions AS (
    SELECT
        'weather' as threat_type,
        COUNT(*) as threat_count,
        AVG(CASE severity
            WHEN 'extreme' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            ELSE 1
        END) as avg_severity
    FROM weather_events
)
SELECT threat_type, threat_count, avg_severity FROM earthquake_regions
UNION ALL
SELECT threat_type, threat_count, total_area_km2 FROM fire_regions
UNION ALL
SELECT threat_type, threat_count, avg_severity FROM weather_regions;

-- Vista: Enlaces con alta probabilidad de fallo
CREATE OR REPLACE VIEW high_risk_edges AS
SELECT 
    l.id,
    l.name,
    l.region,
    l.highway,
    l.length / 1000 as length_km,
    p.total_failure_probability,
    p.earthquake_probability,
    p.fire_probability,
    p.weather_probability,
    l.geometry
FROM fiber_links l
INNER JOIN edge_probabilities p ON l.id = p.edge_id
WHERE p.total_failure_probability > 50
ORDER BY p.total_failure_probability DESC;

-- Vista: Resumen de rutas calculadas
CREATE OR REPLACE VIEW routes_summary AS
SELECT
    r.id,
    r.route_name,
    r.algorithm,
    r.route_type,
    r.total_length_km,
    r.computation_time_ms,
    r.average_failure_probability,
    r.resilience_score,
    r.calculation_date,
    ST_AsGeoJSON(r.geometry)::JSON as geometry_json
FROM routes r
ORDER BY r.calculation_date DESC;

-- Vista: Probabilidades combinadas de enlaces (para API)
CREATE OR REPLACE VIEW edge_combined_probabilities AS
SELECT 
    ep.edge_id,
    ep.total_failure_probability as combined_probability,
    (CASE WHEN ep.earthquake_probability > 0 THEN 1 ELSE 0 END +
     CASE WHEN ep.fire_probability > 0 THEN 1 ELSE 0 END +
     CASE WHEN ep.flood_probability > 0 THEN 1 ELSE 0 END +
     CASE WHEN ep.weather_probability > 0 THEN 1 ELSE 0 END +
     CASE WHEN ep.landslide_probability > 0 THEN 1 ELSE 0 END) as threat_count,
    GREATEST(
        ep.earthquake_probability,
        ep.fire_probability,
        ep.flood_probability,
        ep.weather_probability,
        ep.landslide_probability
    ) as max_individual_probability,
    CASE 
        WHEN ep.earthquake_probability = GREATEST(ep.earthquake_probability, ep.fire_probability, ep.flood_probability, ep.weather_probability, ep.landslide_probability) 
            THEN 'earthquake'
        WHEN ep.fire_probability = GREATEST(ep.earthquake_probability, ep.fire_probability, ep.flood_probability, ep.weather_probability, ep.landslide_probability) 
            THEN 'fire'
        WHEN ep.flood_probability = GREATEST(ep.earthquake_probability, ep.fire_probability, ep.flood_probability, ep.weather_probability, ep.landslide_probability) 
            THEN 'flood'
        WHEN ep.weather_probability = GREATEST(ep.earthquake_probability, ep.fire_probability, ep.flood_probability, ep.weather_probability, ep.landslide_probability) 
            THEN 'weather'
        WHEN ep.landslide_probability = GREATEST(ep.earthquake_probability, ep.fire_probability, ep.flood_probability, ep.weather_probability, ep.landslide_probability) 
            THEN 'landslide'
        ELSE 'none'
    END as dominant_threat_type,
    ep.last_updated
FROM edge_probabilities ep;

-- ============================================================================
-- COMENTARIOS EN TABLAS (para documentación)
-- ============================================================================
COMMENT ON TABLE fiber_nodes IS 'Nodos de la red de fibra óptica (intersecciones, datacenters, endpoints)';
COMMENT ON TABLE fiber_links IS 'Enlaces físicos entre nodos (cables de fibra óptica sobre vías)';
COMMENT ON TABLE node_probabilities IS 'Probabilidades de fallo para cada nodo basadas en amenazas';
COMMENT ON TABLE edge_probabilities IS 'Probabilidades de fallo para cada enlace basadas en amenazas';
COMMENT ON TABLE datacenters IS 'Ubicación y detalles de centros de datos en Chile';
COMMENT ON TABLE earthquakes IS 'Registro histórico de sismos (fuente: USGS)';
COMMENT ON TABLE fire_risk_zones IS 'Zonas con riesgo de incendios forestales';
COMMENT ON TABLE weather_events IS 'Eventos climáticos extremos registrados';
COMMENT ON TABLE ground_type IS 'Clasificación del tipo de suelo por zona';
COMMENT ON TABLE routes IS 'Rutas calculadas con diferentes algoritmos (Dijkstra, CPLEX, Genético)';
COMMENT ON TABLE simulation_results IS 'Resultados de simulaciones Monte Carlo de fallos en rutas';
COMMENT ON TABLE user_constraints IS 'Restricciones y preferencias del usuario para cálculo de rutas';

-- ============================================================================
-- TRIGGERS ADICIONALES
-- ============================================================================

-- Trigger para actualizar timestamp en fiber_nodes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fiber_nodes_updated_at
    BEFORE UPDATE ON fiber_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_fiber_links_updated_at
    BEFORE UPDATE ON fiber_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger para auto-actualizar geometría de nodos
CREATE OR REPLACE FUNCTION update_node_geometry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geometry = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_node_geometry
    BEFORE INSERT OR UPDATE ON fiber_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_node_geometry();

-- ============================================================================
-- ÍNDICE CONSTRAINT PARA edge_probabilities (un registro por enlace)
-- ============================================================================
CREATE UNIQUE INDEX idx_edge_prob_unique ON edge_probabilities(edge_id);
CREATE UNIQUE INDEX idx_node_prob_unique ON node_probabilities(node_id);

-- ============================================================================
-- DATOS DE EJEMPLO Y CONFIGURACIÓN INICIAL
-- ============================================================================

-- Insertar restricciones por defecto
INSERT INTO user_constraints (session_id, max_failure_probability, avoid_high_risk_zones) 
VALUES 
    (uuid_generate_v4(), 50, TRUE),
    (uuid_generate_v4(), 30, TRUE),
    (uuid_generate_v4(), 70, FALSE)
ON CONFLICT DO NOTHING;

-- Función helper para insertar nodos de ejemplo (usar solo si no hay datos)
CREATE OR REPLACE FUNCTION insert_sample_nodes() RETURNS VOID AS $$
BEGIN
    -- Solo insertar si la tabla está vacía
    IF NOT EXISTS (SELECT 1 FROM fiber_nodes LIMIT 1) THEN
        INSERT INTO fiber_nodes (osm_id, node_type, latitude, longitude, region, city, is_critical) VALUES
        (1001, 'datacenter', -33.4489, -70.6693, 'Región Metropolitana', 'Santiago', TRUE),
        (1002, 'datacenter', -36.8270, -73.0498, 'Región del Biobío', 'Concepción', TRUE),
        (1003, 'datacenter', -33.0472, -71.6127, 'Región de Valparaíso', 'Valparaíso', TRUE),
        (1004, 'intersection', -33.5000, -70.7000, 'Región Metropolitana', 'Maipú', FALSE),
        (1005, 'intersection', -33.4000, -70.6000, 'Región Metropolitana', 'Providencia', FALSE);
        
        RAISE NOTICE 'Sample nodes inserted successfully';
    ELSE
        RAISE NOTICE 'Nodes table already has data, skipping sample insert';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS) PARA SUPABASE
-- ============================================================================

-- Habilitar RLS en todas las tablas principales
ALTER TABLE fiber_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiber_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_probabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_probabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE datacenters ENABLE ROW LEVEL SECURITY;
ALTER TABLE earthquakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fire_risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ground_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_constraints ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública (para desarrollo)
CREATE POLICY "Allow public read access" ON fiber_nodes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON fiber_links FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON node_probabilities FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON edge_probabilities FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON datacenters FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON earthquakes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON fire_risk_zones FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON weather_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON ground_type FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON routes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON simulation_results FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON user_constraints FOR SELECT USING (true);

-- Políticas de escritura para service role (backend)
CREATE POLICY "Allow service role all access" ON fiber_nodes FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON fiber_links FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON node_probabilities FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON edge_probabilities FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON datacenters FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON earthquakes FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON fire_risk_zones FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON weather_events FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON ground_type FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON routes FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON simulation_results FOR ALL USING (true);
CREATE POLICY "Allow service role all access" ON user_constraints FOR ALL USING (true);

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================

-- Verificar instalación
DO $$ 
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Schema de Red de Fibra Óptica Chile - Instalación Completa';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Extensiones instaladas:';
    RAISE NOTICE '- PostGIS version: %', PostGIS_Full_Version();
    RAISE NOTICE '- pgRouting version: %', pgr_version();
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas creadas:';
    RAISE NOTICE '✓ fiber_nodes (nodos de red)';
    RAISE NOTICE '✓ fiber_links (enlaces de red)';
    RAISE NOTICE '✓ node_probabilities (probabilidades de fallo de nodos)';
    RAISE NOTICE '✓ edge_probabilities (probabilidades de fallo de enlaces)';
    RAISE NOTICE '✓ datacenters (centros de datos)';
    RAISE NOTICE '✓ earthquakes (sismos)';
    RAISE NOTICE '✓ fire_risk_zones (zonas de riesgo de incendio)';
    RAISE NOTICE '✓ weather_events (eventos climáticos)';
    RAISE NOTICE '✓ ground_type (tipos de suelo)';
    RAISE NOTICE '✓ routes (rutas calculadas)';
    RAISE NOTICE '✓ simulation_results (resultados de simulaciones)';
    RAISE NOTICE '✓ user_constraints (restricciones de usuario)';
    RAISE NOTICE '';
    RAISE NOTICE 'Funciones disponibles:';
    RAISE NOTICE '✓ calculate_shortest_path() - Dijkstra básico';
    RAISE NOTICE '✓ calculate_resilient_path() - Dijkstra con probabilidades';
    RAISE NOTICE '✓ find_nearby_threats() - Buscar amenazas cercanas';
    RAISE NOTICE '✓ calculate_edge_threat_probability() - Calcular probabilidad de enlace';
    RAISE NOTICE '✓ update_all_probabilities() - Actualizar todas las probabilidades';
    RAISE NOTICE '✓ simulate_route_failures() - Simulación Monte Carlo';
    RAISE NOTICE '';
    RAISE NOTICE 'Próximos pasos:';
    RAISE NOTICE '1. Cargar datos usando scripts de Python';
    RAISE NOTICE '2. Ejecutar update_all_probabilities() para calcular probabilidades';
    RAISE NOTICE '3. Probar las funciones de ruteo';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
END $$;

COMMENT ON SCHEMA public IS 'Schema para análisis de resiliencia de redes de fibra óptica en Chile - Versión 2.0 Supabase';
