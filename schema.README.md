# Documentación del Esquema de Base de Datos

## Resumen General

Base de datos geoespacial diseñada para analizar la resiliencia de redes de fibra óptica en Chile, utilizando **PostgreSQL** con las extensiones **PostGIS** y **pgRouting**.

---

## Diagrama de Relaciones (Conceptual)

```
┌─────────────────┐
│     nodes       │────┐
│  (Nodos de red) │    │
└─────────────────┘    │
         │             │
         │ (1)         │ (1)
         │             │
         │ (N)         │ (N)
         ▼             ▼
┌─────────────────┐   ┌──────────────────┐
│     edges       │   │     routes       │
│   (Enlaces)     │   │ (Rutas calculadas)│
└─────────────────┘   └──────────────────┘
         │
         │ Analiza amenazas cercanas
         ▼
┌─────────────────────────────────────────────┐
│           AMENAZAS (Threats)                │
├─────────────────┬──────────────┬───────────┤
│  earthquakes    │fire_risk_zones│ weather   │
│   (Sismos)      │  (Incendios)  │ _events   │
└─────────────────┴──────────────┴───────────┘

┌─────────────────────────────────────────────┐
│           METADATA                          │
├─────────────────┬──────────────────────────┤
│  datacenters    │    ground_type           │
│                 │   (Tipo de suelo)         │
└─────────────────┴──────────────────────────┘
```

---

## Tablas Principales

### 1. **nodes** - Nodos de la Red
Puntos de conexión (intersecciones, datacenters, endpoints).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BIGSERIAL | Identificador único |
| `osm_id` | BIGINT | ID de OpenStreetMap |
| `node_type` | VARCHAR(50) | Tipo: intersection, datacenter, endpoint |
| `latitude` | DOUBLE PRECISION | Latitud (coordenada) |
| `longitude` | DOUBLE PRECISION | Longitud (coordenada) |
| `region` | VARCHAR(100) | Región de Chile |
| `city` | VARCHAR(100) | Ciudad |
| `geometry` | GEOMETRY(Point, 4326) | Geometría espacial |

**Índices:**
- `idx_nodes_geometry` (GIST)
- `idx_nodes_region`
- `idx_nodes_type`

---

### 2. **edges** - Enlaces de Fibra Óptica
Conexiones físicas entre nodos (cables sobre vías).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BIGSERIAL | Identificador único |
| `source` | BIGINT | ID del nodo origen |
| `target` | BIGINT | ID del nodo destino |
| `length` | DOUBLE PRECISION | Longitud en metros |
| `geometry` | GEOMETRY(LineString, 4326) | Trazado del enlace |
| `highway` | VARCHAR(50) | Tipo de vía (motorway, primary, etc.) |
| `name` | VARCHAR(255) | Nombre de la calle/ruta |
| `surface` | VARCHAR(50) | Tipo de superficie (paved/unpaved) |
| `lanes` | INTEGER | Número de carriles |
| `oneway` | BOOLEAN | Si es de un solo sentido |
| `bridge` | BOOLEAN | Si es un puente |
| `tunnel` | BOOLEAN | Si es un túnel |
| `recubrimiento_estim` | VARCHAR(100) | Tipo de recubrimiento de fibra |
| `cost` | DOUBLE PRECISION | Costo para pgRouting |
| `reverse_cost` | DOUBLE PRECISION | Costo inverso (bidireccional) |

**Índices:**
- `idx_edges_geometry` (GIST)
- `idx_edges_source`, `idx_edges_target`
- `idx_edges_highway`

**Trigger automático:**
- `trigger_update_edge_cost`: Calcula automáticamente `cost` y `reverse_cost`

---

### 3. **datacenters** - Centros de Datos
Ubicación de datacenters en Chile.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `name` | VARCHAR(255) | Nombre del datacenter |
| `company_name` | VARCHAR(255) | Empresa operadora |
| `address` | VARCHAR(500) | Dirección completa |
| `city` | VARCHAR(100) | Ciudad |
| `state` | VARCHAR(100) | Región |
| `capacity_mw` | DOUBLE PRECISION | Capacidad en MW (opcional) |
| `tier_level` | INTEGER | Tier level (1-4) |
| `urban_density` | VARCHAR(50) | Densidad urbana cercana |
| `geometry` | GEOMETRY(Point, 4326) | Ubicación |

**Fuente de datos:** `metadata/datacenters_fixed.geojson`

---

## Tablas de Amenazas

### 4. **earthquakes** - Sismos
Registro de sismos históricos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `usgs_id` | VARCHAR(100) | ID único de USGS |
| `magnitude` | DOUBLE PRECISION | Magnitud Richter |
| `depth` | DOUBLE PRECISION | Profundidad en km |
| `time` | TIMESTAMP | Fecha y hora |
| `place` | VARCHAR(255) | Descripción del lugar |
| `threat_level` | VARCHAR(20) | low, medium, high, critical |
| `geometry` | GEOMETRY(Point, 4326) | Epicentro |

**Fuente de datos:** USGS Earthquake API (`amenazas/seismicidad.py`)

**Trigger automático:**
- `trigger_earthquake_threat`: Calcula `threat_level` basado en magnitud:
  - ≥ 7.0 → critical
  - ≥ 6.0 → high
  - ≥ 4.5 → medium
  - < 4.5 → low

---

### 5. **fire_risk_zones** - Zonas de Riesgo de Incendio

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `zone_name` | VARCHAR(255) | Nombre de la zona |
| `risk_level` | VARCHAR(20) | low, medium, high, extreme |
| `vegetation_type` | VARCHAR(100) | Tipo de vegetación |
| `area_km2` | DOUBLE PRECISION | Área en km² |
| `high_risk_months` | INTEGER[] | Meses de alto riesgo (1-12) |
| `last_fire_date` | DATE | Fecha del último incendio |
| `geometry` | GEOMETRY(Polygon, 4326) | Polígono del área |

**Fuente de datos:** `amenazas/incendios_forestales.py`

---

### 6. **weather_events** - Eventos Climáticos Extremos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `event_type` | VARCHAR(50) | storm, flood, snow, wind |
| `severity` | VARCHAR(20) | low, medium, high, extreme |
| `event_date` | DATE | Fecha del evento |
| `max_wind_speed` | DOUBLE PRECISION | Velocidad máxima viento (km/h) |
| `precipitation_mm` | DOUBLE PRECISION | Precipitación (mm) |
| `affected_population` | INTEGER | Población afectada |
| `geometry` | GEOMETRY(Polygon, 4326) | Área afectada |

**Fuente de datos:** `amenazas/extreme_weather.py`

---

### 7. **ground_type** - Tipo de Suelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `soil_type` | VARCHAR(100) | rock, clay, sand, mixed |
| `stability` | VARCHAR(20) | stable, moderate, unstable |
| `installation_difficulty` | VARCHAR(20) | easy, moderate, difficult |
| `permeability` | VARCHAR(20) | high, medium, low |
| `bearing_capacity` | DOUBLE PRECISION | Capacidad de carga (kg/cm²) |
| `geometry` | GEOMETRY(Polygon, 4326) | Área |

**Fuente de datos:** `metadata/api-tests/ground_type.py`

---

### 8. **routes** - Rutas Calculadas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `route_name` | VARCHAR(255) | Nombre descriptivo |
| `start_node_id` | BIGINT | Nodo de inicio (FK) |
| `end_node_id` | BIGINT | Nodo de fin (FK) |
| `total_cost` | DOUBLE PRECISION | Costo total |
| `total_length_km` | DOUBLE PRECISION | Longitud en km |
| `edge_sequence` | BIGINT[] | Array de IDs de edges |
| `node_sequence` | BIGINT[] | Array de IDs de nodes |
| `route_type` | VARCHAR(50) | shortest, safest, balanced |
| `considers_threats` | BOOLEAN | Si considera amenazas |
| `algorithm` | VARCHAR(50) | dijkstra, astar |
| `geometry` | GEOMETRY(LineString, 4326) | Geometría de la ruta |

---

## Funciones SQL Útiles

### 🔍 `calculate_shortest_path()`
Calcula la ruta más corta entre dos coordenadas usando pgr_dijkstra.

```sql
SELECT * FROM calculate_shortest_path(
    -33.4489,  -- lat inicio (Santiago)
    -70.6693,  -- lon inicio
    -36.8270,  -- lat fin (Concepción)
    -73.0498   -- lon fin
);
```

**Retorna:**
- `seq`: Secuencia de pasos
- `node`: ID del nodo
- `edge`: ID del enlace
- `cost`: Costo del segmento
- `agg_cost`: Costo acumulado
- `geom`: Geometría del segmento

---

### 🎯 `find_nearby_threats()`
Encuentra amenazas cercanas a un punto dado.

```sql
SELECT * FROM find_nearby_threats(
    -33.4489,  -- latitud
    -70.6693,  -- longitud
    50         -- radio en km
);
```

**Retorna:**
- `threat_type`: earthquake, fire_zone
- `threat_id`: ID de la amenaza
- `distance_km`: Distancia en km
- `severity`: Nivel de severidad

---

## Vistas Predefinidas

### 📊 `network_stats_by_region`
Estadísticas de la red agrupadas por región.

```sql
SELECT * FROM network_stats_by_region;
```

**Columnas:**
- `region`: Nombre de la región
- `total_edges`: Total de enlaces
- `total_nodes`: Total de nodos
- `total_km`: Kilómetros totales
- `avg_edge_length`: Longitud promedio de enlaces
- `motorways`, `primary_roads`: Conteo por tipo
- `bridges`, `tunnels`: Conteo de puentes y túneles

---

### ⚠️ `threats_by_region`
Resumen de amenazas por tipo.

```sql
SELECT * FROM threats_by_region;
```

---

## Cómo Usar

### 1. Crear la base de datos

```bash
# Crear base de datos
createdb fiber_network

# Ejecutar schema
psql -d fiber_network -f schema.sql
```

### 2. Verificar instalación

```sql
SELECT * FROM pg_available_extensions WHERE name IN ('postgis', 'pgrouting');
```

### 3. Cargar datos desde GeoJSON

Usar scripts de carga en:
- `infraestructura/load_to_db.py`
- `metadata/load_to_db.py`
- `amenazas/load_to_db.py`

---

## Dimensiones Esperadas

Basado en los archivos GeoJSON existentes:

| Tabla | Registros Estimados | Tamaño |
|-------|---------------------|--------|
| `nodes` | ~100,000 - 500,000 | ~50-200 MB |
| `edges` | ~200,000 - 1,000,000 | ~500 MB - 2 GB |
| `datacenters` | ~20-50 | < 1 MB |
| `earthquakes` | ~10,000 - 50,000 | ~5-20 MB |
| `fire_risk_zones` | ~100 - 500 | ~2-10 MB |
| `weather_events` | ~1,000 - 5,000 | ~1-5 MB |
| **TOTAL** | | **~1-3 GB** |

---

## Extensiones Requeridas

- **PostGIS 3.3+**: Funcionalidad geoespacial
- **pgRouting 3.4+**: Algoritmos de ruteo
- **PostgreSQL 15+**: Base de datos principal

---

## Referencias

- [PostGIS Documentation](https://postgis.net/documentation/)
- [pgRouting Documentation](https://docs.pgrouting.org/)
- [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/)
- [OpenStreetMap](https://www.openstreetmap.org/)
