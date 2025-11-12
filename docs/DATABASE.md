# Base de Datos - PostgreSQL + PostGIS + pgRouting

## Resumen

Base de datos geoespacial que modela la red de fibra óptica de Chile, amenazas naturales y probabilidades de falla.

**Motor:** PostgreSQL 15+
**Extensiones:**
- PostGIS 3.3+ (geometrías, índices espaciales)
- pgRouting 3.4+ (algoritmos de ruteo)

## Instalación y Configuración

### 1. Crear Base de Datos

```bash
# Crear base de datos
createdb -U postgres fiber_network

# Conectar
psql -U postgres -d fiber_network

# Instalar extensiones
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

# Verificar versiones
SELECT postgis_version();
-- Debe retornar 3.3.x o superior

SELECT pgr_version();
-- Debe retornar 3.4.x o superior
```

### 2. Ejecutar Schema

```bash
psql -U postgres -d fiber_network -f database/schema.sql
```

### 3. Ejecutar Migraciones

```bash
# En orden secuencial
psql -U postgres -d fiber_network -f database/migrations/000_supabase_init.sql
psql -U postgres -d fiber_network -f database/migrations/004_add_probabilities.sql
psql -U postgres -d fiber_network -f database/migrations/005_add_simulation.sql
psql -U postgres -d fiber_network -f database/migrations/006_fix_routing_functions.sql
```

### 4. Crear Topología de Red

```bash
psql -U postgres -d fiber_network -f database/functions/create_topology.sql
```

## Schema de Tablas

### Tablas de Infraestructura

#### `nodes` - Nodos de la Red

Puntos de conexión (intersecciones, datacenters, endpoints).

```sql
CREATE TABLE nodes (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT UNIQUE,
  node_type VARCHAR(50),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geometry GEOMETRY(Point, 4326) NOT NULL,
  region VARCHAR(100),
  city VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_nodes_geometry ON nodes USING GIST (geometry);
CREATE INDEX idx_nodes_region ON nodes (region);
```

**Campos clave:**
- `osm_id`: ID de OpenStreetMap (si aplica)
- `node_type`: 'intersection', 'datacenter', 'endpoint'
- `geometry`: Punto geográfico (SRID 4326 = WGS84)

**Ejemplo de fila:**
```sql
INSERT INTO nodes (osm_id, node_type, latitude, longitude, geometry, region)
VALUES (
  123456,
  'intersection',
  -33.4489,
  -70.6693,
  ST_SetSRID(ST_MakePoint(-70.6693, -33.4489), 4326),
  'Región Metropolitana'
);
```

#### `edges` - Enlaces de Fibra Óptica

Conexiones físicas entre nodos (cables sobre vías).

```sql
CREATE TABLE edges (
  id BIGSERIAL PRIMARY KEY,
  source BIGINT,              -- ID nodo origen (para pgRouting)
  target BIGINT,              -- ID nodo destino (para pgRouting)
  cost DOUBLE PRECISION,      -- Longitud en metros (para pgr_dijkstra)
  reverse_cost DOUBLE PRECISION,  -- Costo inverso (bidireccional)
  length DOUBLE PRECISION,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  highway VARCHAR(50),        -- Tipo de vía OSM
  surface VARCHAR(50),        -- Superficie ('paved', 'unpaved', etc.)
  lanes INTEGER,
  maxspeed INTEGER,
  bridge BOOLEAN DEFAULT false,
  tunnel BOOLEAN DEFAULT false,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_edges_geometry ON edges USING GIST (geometry);
CREATE INDEX idx_edges_source ON edges (source);
CREATE INDEX idx_edges_target ON edges (target);
CREATE INDEX idx_edges_source_target ON edges (source, target);
```

**Campos pgRouting:**
- `source`, `target`: IDs de nodos (requeridos para pgr_dijkstra)
- `cost`, `reverse_cost`: Peso del enlace (normalmente longitud en metros)

**Trigger automático:** Calcula `cost` y `reverse_cost` basado en longitud
```sql
CREATE OR REPLACE FUNCTION update_edge_cost()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cost := ST_Length(NEW.geometry::geography);
  NEW.reverse_cost := NEW.cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_edge_cost
  BEFORE INSERT OR UPDATE OF geometry
  ON edges
  FOR EACH ROW
  EXECUTE FUNCTION update_edge_cost();
```

#### `edges_vertices_pgr` - Vértices de la Topología

Tabla auxiliar generada por pgRouting para indexar vértices.

```sql
CREATE TABLE edges_vertices_pgr (
  id BIGSERIAL PRIMARY KEY,
  cnt INTEGER,
  chk INTEGER,
  ein INTEGER,
  eout INTEGER,
  the_geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_edges_vertices_geom ON edges_vertices_pgr USING GIST (the_geom);
```

**Nota:** Esta tabla se genera automáticamente al ejecutar `database/functions/create_topology.sql`.

### Tablas de Metadata

#### `datacenters` - Centros de Datos

```sql
CREATE TABLE datacenters (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Chile',
  postal_code VARCHAR(20),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geometry GEOMETRY(Point, 4326) NOT NULL,
  capacity_mw DOUBLE PRECISION,
  tier_level VARCHAR(10),
  is_colocation BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_datacenters_geometry ON datacenters USING GIST (geometry);
```

**Ejemplo:**
```sql
INSERT INTO datacenters (name, company_name, city, latitude, longitude, geometry, capacity_mw, tier_level)
VALUES (
  'GTD Data Center Santiago',
  'GTD',
  'Santiago',
  -33.4378,
  -70.6504,
  ST_SetSRID(ST_MakePoint(-70.6504, -33.4378), 4326),
  5.0,
  'Tier III'
);
```

### Tablas de Amenazas

#### `earthquakes` - Sismos

```sql
CREATE TABLE earthquakes (
  id BIGSERIAL PRIMARY KEY,
  usgs_id VARCHAR(50) UNIQUE,
  magnitude DOUBLE PRECISION NOT NULL,
  depth DOUBLE PRECISION,
  time TIMESTAMP NOT NULL,
  place TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geometry GEOMETRY(Point, 4326) NOT NULL,
  threat_level VARCHAR(20),
  url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (magnitude >= 0)
);

CREATE INDEX idx_earthquakes_geometry ON earthquakes USING GIST (geometry);
CREATE INDEX idx_earthquakes_magnitude ON earthquakes (magnitude DESC);
CREATE INDEX idx_earthquakes_time ON earthquakes (time DESC);
```

**Niveles de amenaza (automático por trigger):**
```sql
CREATE OR REPLACE FUNCTION calculate_earthquake_threat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.threat_level := CASE
    WHEN NEW.magnitude >= 7.0 THEN 'critical'
    WHEN NEW.magnitude >= 6.0 THEN 'high'
    WHEN NEW.magnitude >= 4.5 THEN 'medium'
    ELSE 'low'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_earthquake_threat
  BEFORE INSERT OR UPDATE OF magnitude
  ON earthquakes
  FOR EACH ROW
  EXECUTE FUNCTION calculate_earthquake_threat();
```

#### `fire_risk_zones` - Zonas de Riesgo de Incendio

```sql
CREATE TABLE fire_risk_zones (
  id BIGSERIAL PRIMARY KEY,
  zone_name VARCHAR(255),
  region VARCHAR(100),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'extreme')),
  area_km2 DOUBLE PRECISION,
  vegetation_type VARCHAR(100),
  last_fire_date DATE,
  fire_frequency_per_year DOUBLE PRECISION,
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fire_zones_geometry ON fire_risk_zones USING GIST (geometry);
CREATE INDEX idx_fire_zones_risk ON fire_risk_zones (risk_level);
```

#### `weather_events` - Eventos Climáticos Extremos

```sql
CREATE TABLE weather_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) CHECK (event_type IN ('storm', 'flood', 'snow', 'wind', 'rain', 'tornado')),
  severity VARCHAR(20) CHECK (severity IN ('low', 'moderate', 'severe', 'extreme')),
  event_date TIMESTAMP NOT NULL,
  duration_hours DOUBLE PRECISION,
  max_wind_speed DOUBLE PRECISION,
  precipitation_mm DOUBLE PRECISION,
  min_temperature DOUBLE PRECISION,
  max_temperature DOUBLE PRECISION,
  description TEXT,
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_events_geometry ON weather_events USING GIST (geometry);
CREATE INDEX idx_weather_events_date ON weather_events (event_date DESC);
```

### Tablas de Probabilidades

#### `edge_failure_probabilities` - Probabilidades por Amenaza

Una fila por combinación (edge, amenaza).

```sql
CREATE TABLE edge_failure_probabilities (
  id BIGSERIAL PRIMARY KEY,
  edge_id BIGINT NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
  threat_type VARCHAR(50) NOT NULL,
  threat_id BIGINT,
  distance_km DOUBLE PRECISION,
  base_probability DOUBLE PRECISION,
  adjusted_probability DOUBLE PRECISION,
  calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (edge_id, threat_type, threat_id)
);

CREATE INDEX idx_edge_failure_probs_edge ON edge_failure_probabilities (edge_id);
```

**Tipos de amenaza:**
- `earthquake`, `fire`, `flood`, `weather`, `landslide`

**Ejemplo:**
```sql
-- Probabilidad de falla del edge 1234 por sismo (usgs_id 'us7000abcd')
INSERT INTO edge_failure_probabilities (edge_id, threat_type, threat_id, distance_km, base_probability, adjusted_probability)
VALUES (
  1234,
  'earthquake',
  5678,  -- ID de fila en tabla earthquakes
  12.5,  -- distancia al epicentro en km
  0.045, -- probabilidad base (función de magnitud y distancia)
  0.038  -- ajustada por tipo de infraestructura
);
```

#### `edge_combined_probabilities` - Probabilidades Combinadas

Una fila por edge, con probabilidad total de falla.

```sql
CREATE TABLE edge_combined_probabilities (
  edge_id BIGINT PRIMARY KEY REFERENCES edges(id) ON DELETE CASCADE,
  earthquake_prob DOUBLE PRECISION DEFAULT 0,
  fire_prob DOUBLE PRECISION DEFAULT 0,
  flood_prob DOUBLE PRECISION DEFAULT 0,
  weather_prob DOUBLE PRECISION DEFAULT 0,
  landslide_prob DOUBLE PRECISION DEFAULT 0,
  total_failure_probability DOUBLE PRECISION,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (total_failure_probability >= 0 AND total_failure_probability <= 1)
);

CREATE INDEX idx_edge_combined_probs_total ON edge_combined_probabilities (total_failure_probability DESC);
```

**Cálculo de probabilidad total:**
```
P_total = 1 - ∏(1 - P_i)

Donde P_i son las probabilidades individuales por amenaza.
```

**Ejemplo:**
```sql
-- Edge con múltiples amenazas
UPDATE edge_combined_probabilities
SET
  earthquake_prob = 0.038,
  fire_prob = 0.012,
  flood_prob = 0.005,
  total_failure_probability = 1 - (1-0.038) * (1-0.012) * (1-0.005)
WHERE edge_id = 1234;
-- total_failure_probability ≈ 0.0544 (5.44%)
```

### Tablas de Simulación

#### `simulations` - Registro de Simulaciones

```sql
CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_name VARCHAR(255),
  probability_threshold DOUBLE PRECISION,
  total_elements_analyzed INTEGER,
  total_failures INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `simulation_failures` - Fallas Simuladas

```sql
CREATE TABLE simulation_failures (
  id BIGSERIAL PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  element_type VARCHAR(10) NOT NULL CHECK (element_type IN ('node', 'edge')),
  element_id BIGINT NOT NULL,
  failed BOOLEAN DEFAULT true,
  random_value DOUBLE PRECISION,  -- Número aleatorio generado (0-100)
  probability DOUBLE PRECISION,   -- Probabilidad del elemento (0-1)
  dominant_threat VARCHAR(20),    -- Amenaza que más contribuyó
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_simulation_failures_sim ON simulation_failures (simulation_id);
CREATE INDEX idx_simulation_failures_element ON simulation_failures (element_type, element_id);
```

**Algoritmo de simulación Monte Carlo:**
```sql
-- Para cada enlace:
1. Generar random_value ~ Uniform(0, 100)
2. Obtener probability de edge_combined_probabilities
3. Si random_value < (probability × 100) → FALLA
4. Identificar amenaza dominante: max(earthquake_prob, fire_prob, ...)
5. Insertar en simulation_failures
```

### Tablas de Rutas

#### `routes` - Rutas Calculadas

```sql
CREATE TABLE routes (
  id BIGSERIAL PRIMARY KEY,
  route_name VARCHAR(255),
  start_node_id BIGINT REFERENCES nodes(id),
  end_node_id BIGINT REFERENCES nodes(id),
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  total_cost DOUBLE PRECISION,
  total_distance_km DOUBLE PRECISION,
  algorithm VARCHAR(50),
  considers_threats BOOLEAN DEFAULT false,
  edge_sequence BIGINT[],
  node_sequence BIGINT[],
  geometry GEOMETRY(LineString, 4326),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_routes_algorithm ON routes (algorithm);
CREATE INDEX idx_routes_geometry ON routes USING GIST (geometry);
```

**Algoritmos:**
- `dijkstra` - Dijkstra simple (solo distancia)
- `dijkstra_resilient` - Dijkstra ponderado (distancia + riesgo)
- `mip` - Optimización MIP
- `genetic` - Algoritmo Genético

## Funciones SQL

### Funciones de Ruteo

#### `calculate_shortest_path` - Dijkstra Simple

```sql
CREATE OR REPLACE FUNCTION calculate_shortest_path(
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION
)
RETURNS TABLE(
  seq INTEGER,
  path_seq INTEGER,
  node BIGINT,
  edge BIGINT,
  cost DOUBLE PRECISION,
  agg_cost DOUBLE PRECISION,
  geom GEOMETRY
) AS $$
DECLARE
  start_node_id BIGINT;
  end_node_id BIGINT;
BEGIN
  -- 1. Encontrar nodos más cercanos a coordenadas
  SELECT n.id INTO start_node_id
  FROM nodes n
  ORDER BY n.geometry <-> ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326)
  LIMIT 1;

  SELECT n.id INTO end_node_id
  FROM nodes n
  ORDER BY n.geometry <-> ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326)
  LIMIT 1;

  -- 2. Ejecutar pgr_dijkstra
  RETURN QUERY
  SELECT
    r.seq,
    r.path_seq,
    r.node,
    r.edge,
    r.cost,
    r.agg_cost,
    e.geometry AS geom
  FROM pgr_dijkstra(
    'SELECT id, source, target, cost, reverse_cost FROM edges WHERE cost > 0',
    start_node_id,
    end_node_id,
    directed := false
  ) AS r
  LEFT JOIN edges e ON r.edge = e.id;
END;
$$ LANGUAGE plpgsql;
```

**Uso:**
```sql
SELECT * FROM calculate_shortest_path(
  -33.4489,  -- start_lat (Santiago)
  -70.6693,  -- start_lon
  -36.8270,  -- end_lat (Concepción)
  -73.0498   -- end_lon
);
```

#### `calculate_resilient_path` - Dijkstra Ponderado

```sql
CREATE OR REPLACE FUNCTION calculate_resilient_path(
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  max_failure_prob DOUBLE PRECISION DEFAULT 1.0,
  risk_weight DOUBLE PRECISION DEFAULT 1.0
)
RETURNS TABLE(
  seq INTEGER,
  path_seq INTEGER,
  node BIGINT,
  edge BIGINT,
  cost DOUBLE PRECISION,
  agg_cost DOUBLE PRECISION,
  failure_prob DOUBLE PRECISION,
  geom GEOMETRY
) AS $$
DECLARE
  start_node_id BIGINT;
  end_node_id BIGINT;
BEGIN
  -- Encontrar nodos más cercanos
  SELECT n.id INTO start_node_id
  FROM nodes n
  ORDER BY n.geometry <-> ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326)
  LIMIT 1;

  SELECT n.id INTO end_node_id
  FROM nodes n
  ORDER BY n.geometry <-> ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326)
  LIMIT 1;

  -- Ejecutar pgr_dijkstra con cost ajustado
  RETURN QUERY
  WITH adjusted_edges AS (
    SELECT
      e.id,
      e.source,
      e.target,
      -- Ajustar cost: distance × (1 + risk_weight × failure_prob)
      e.cost * (1 + risk_weight * COALESCE(p.total_failure_probability, 0)) AS cost,
      e.reverse_cost * (1 + risk_weight * COALESCE(p.total_failure_probability, 0)) AS reverse_cost,
      COALESCE(p.total_failure_probability, 0) AS failure_prob
    FROM edges e
    LEFT JOIN edge_combined_probabilities p ON e.id = p.edge_id
    WHERE
      e.cost > 0
      AND COALESCE(p.total_failure_probability, 0) <= max_failure_prob
  )
  SELECT
    r.seq,
    r.path_seq,
    r.node,
    r.edge,
    r.cost,
    r.agg_cost,
    ae.failure_prob,
    e.geometry AS geom
  FROM pgr_dijkstra(
    'SELECT id, source, target, cost, reverse_cost FROM adjusted_edges',
    start_node_id,
    end_node_id,
    directed := false
  ) AS r
  LEFT JOIN adjusted_edges ae ON r.edge = ae.id
  LEFT JOIN edges e ON r.edge = e.id;
END;
$$ LANGUAGE plpgsql;
```

**Uso:**
```sql
SELECT * FROM calculate_resilient_path(
  -33.4489, -70.6693,  -- start
  -36.8270, -73.0498,  -- end
  0.5,  -- max_failure_prob (filtrar enlaces con prob > 50%)
  5.0   -- risk_weight (penalización por riesgo)
);
```

#### `simulate_failures` - Simulación Monte Carlo

```sql
CREATE OR REPLACE FUNCTION simulate_failures(
  sim_name VARCHAR DEFAULT 'Unnamed Simulation',
  threshold DOUBLE PRECISION DEFAULT 1.0
)
RETURNS UUID AS $$
DECLARE
  sim_id UUID;
  total_analyzed INTEGER;
  total_failed INTEGER;
BEGIN
  -- Crear registro de simulación
  INSERT INTO simulations (simulation_name, probability_threshold)
  VALUES (sim_name, threshold)
  RETURNING id INTO sim_id;

  -- Simular fallas en enlaces
  INSERT INTO simulation_failures (
    simulation_id,
    element_type,
    element_id,
    failed,
    random_value,
    probability,
    dominant_threat
  )
  SELECT
    sim_id,
    'edge',
    e.id,
    (random() * 100) < (p.total_failure_probability * 100) AS failed,
    random() * 100 AS random_value,
    p.total_failure_probability,
    CASE
      WHEN p.earthquake_prob = GREATEST(p.earthquake_prob, p.fire_prob, p.flood_prob, p.weather_prob, p.landslide_prob) THEN 'earthquake'
      WHEN p.fire_prob = GREATEST(p.earthquake_prob, p.fire_prob, p.flood_prob, p.weather_prob, p.landslide_prob) THEN 'fire'
      WHEN p.flood_prob = GREATEST(p.earthquake_prob, p.fire_prob, p.flood_prob, p.weather_prob, p.landslide_prob) THEN 'flood'
      WHEN p.weather_prob = GREATEST(p.earthquake_prob, p.fire_prob, p.flood_prob, p.weather_prob, p.landslide_prob) THEN 'weather'
      ELSE 'landslide'
    END AS dominant_threat
  FROM edges e
  INNER JOIN edge_combined_probabilities p ON e.id = p.edge_id
  WHERE p.total_failure_probability <= threshold;

  -- Actualizar estadísticas
  SELECT COUNT(*), COUNT(*) FILTER (WHERE failed = true)
  INTO total_analyzed, total_failed
  FROM simulation_failures
  WHERE simulation_id = sim_id;

  UPDATE simulations
  SET
    total_elements_analyzed = total_analyzed,
    total_failures = total_failed
  WHERE id = sim_id;

  RETURN sim_id;
END;
$$ LANGUAGE plpgsql;
```

**Uso:**
```sql
-- Ejecutar simulación
SELECT simulate_failures('Terremoto Región Central', 0.5);
-- Retorna UUID de simulación

-- Obtener fallas
SELECT * FROM simulation_failures
WHERE simulation_id = '<UUID>'
AND failed = true;

-- Estadísticas
SELECT
  dominant_threat,
  COUNT(*) AS failure_count
FROM simulation_failures
WHERE simulation_id = '<UUID>' AND failed = true
GROUP BY dominant_threat;
```

### Funciones de Utilidad

#### `find_nearby_threats` - Amenazas Cercanas

```sql
CREATE OR REPLACE FUNCTION find_nearby_threats(
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE(
  threat_type VARCHAR,
  threat_id BIGINT,
  distance_km DOUBLE PRECISION,
  severity VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  -- Sismos
  SELECT
    'earthquake'::VARCHAR AS threat_type,
    e.id AS threat_id,
    ST_Distance(
      e.geometry,
      ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
    ) / 1000 AS distance_km,
    e.threat_level AS severity
  FROM earthquakes e
  WHERE ST_DWithin(
    e.geometry::geography,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    radius_km * 1000
  )

  UNION ALL

  -- Zonas de incendio
  SELECT
    'fire'::VARCHAR,
    f.id,
    ST_Distance(
      f.geometry,
      ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
    ) / 1000,
    f.risk_level
  FROM fire_risk_zones f
  WHERE ST_DWithin(
    f.geometry::geography,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    radius_km * 1000
  )

  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
```

**Uso:**
```sql
SELECT * FROM find_nearby_threats(-33.4489, -70.6693, 100);
```

## Vistas Predefinidas

### `network_stats_by_region`

Estadísticas de red por región.

```sql
CREATE VIEW network_stats_by_region AS
SELECT
  n.region,
  COUNT(DISTINCT e.id) AS total_edges,
  COUNT(DISTINCT n.id) AS total_nodes,
  ROUND(SUM(e.length) / 1000, 2) AS total_km,
  COUNT(*) FILTER (WHERE e.highway = 'motorway') AS motorways,
  COUNT(*) FILTER (WHERE e.bridge = true) AS bridges,
  COUNT(*) FILTER (WHERE e.tunnel = true) AS tunnels
FROM edges e
LEFT JOIN nodes n ON e.source = n.id OR e.target = n.id
GROUP BY n.region;
```

### `threats_by_region`

Resumen de amenazas por región.

```sql
CREATE VIEW threats_by_region AS
SELECT
  'earthquake' AS threat_type,
  -- (lógica para agrupar por región)
UNION ALL
SELECT
  'fire' AS threat_type,
  -- ...
;
```

## Scripts de Carga

### Cargar Datos de Infraestructura

**Script:** `scripts/data_loading/load_datacenters.js`

```bash
node scripts/data_loading/load_datacenters.js
```

### Calcular Probabilidades

**Script:** `scripts/optimization/calc_prob_batch.py`

```bash
python scripts/optimization/calc_prob_batch.py
```

### Cargar Red Completa

**Script:** `scripts/data_loading/quick_load_data.py`

```bash
python scripts/data_loading/quick_load_data.py
```

## Mantenimiento

### Backup

```bash
# Backup completo
pg_dump -U postgres -d fiber_network -F c -f backup_$(date +%Y%m%d).dump

# Restaurar
pg_restore -U postgres -d fiber_network -c backup_20251111.dump
```

### Vacuum y Analyze

```sql
-- Liberar espacio y actualizar estadísticas
VACUUM ANALYZE edges;
VACUUM ANALYZE nodes;
VACUUM ANALYZE edge_combined_probabilities;
```

### Verificar Integridad

```sql
-- Verificar topología
SELECT COUNT(*) FROM edges WHERE source IS NULL OR target IS NULL;
-- Debe retornar 0

-- Verificar geometrías
SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(geometry);
-- Debe retornar 0

-- Verificar probabilidades
SELECT COUNT(*) FROM edge_combined_probabilities
WHERE total_failure_probability < 0 OR total_failure_probability > 1;
-- Debe retornar 0
```

---

**Última actualización:** 2025-11-11
**Versión:** 1.0.0
