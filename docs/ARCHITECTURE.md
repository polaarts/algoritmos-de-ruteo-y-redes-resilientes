# Arquitectura del Sistema

## Visión General

Sistema distribuido en 3 capas para análisis y visualización de resiliencia en redes de fibra óptica.

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
│                    React + Leaflet + Vite                    │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐      │
│  │    Map     │  │   Route    │  │   Simulation     │      │
│  │  Viewer    │  │ Comparison │  │    Controls      │      │
│  └────────────┘  └────────────┘  └──────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                            │ HTTP/REST (JSON)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                        BACKEND LAYER                         │
│                    Node.js + Express API                     │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Routing   │  │Infrastructure│ │ Simulation │            │
│  │   API      │  │   & Threats  │  │    API     │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │  Python Optimization Workers (MIP, GA)     │            │
│  └────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
                            │ SQL + PostGIS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                         │
│           PostgreSQL 15 + PostGIS 3.3 + pgRouting 3.4        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │  nodes   │  │  edges   │  │datacenters │  │earthquakes│ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
│  ┌──────────────────────┐  ┌──────────────────────┐       │
│  │edge_failure_probs    │  │ simulation_failures  │       │
│  └──────────────────────┘  └──────────────────────┘       │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │  pgRouting Functions (pgr_dijkstra, etc.)  │            │
│  └────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

## Componentes Principales

### 1. Frontend (React + Leaflet)

#### Responsabilidades
- Renderizar mapa interactivo de Chile
- Visualizar capas: infraestructura, amenazas, rutas
- Proveer interfaz para configurar y ejecutar algoritmos
- Mostrar resultados comparativos

#### Tecnologías
- **React 18**: Framework de UI
- **Vite**: Build tool y dev server
- **Leaflet**: Biblioteca de mapas
- **React-Leaflet**: Bindings de React para Leaflet
- **Axios**: Cliente HTTP

#### Componentes Clave

```
src/
├── components/
│   ├── Map.jsx                    # Contenedor principal del mapa
│   ├── InfrastructureLayer.jsx    # Capa de nodos/enlaces
│   ├── ThreatsLayer.jsx           # Sismos, incendios, clima
│   ├── RouteCalculator.jsx        # Modo simple (1 ruta)
│   ├── RouteComparison.jsx        # Comparación de 4 rutas
│   └── SimulationControls.jsx     # Simulación Monte Carlo
├── services/
│   └── api.js                     # Clientes de API
└── styles/
    └── *.css                      # Estilos por componente
```

#### Flujo de Datos

```
User Action (click en mapa)
    │
    ▼
Component State Update (useState)
    │
    ▼
API Call (services/api.js)
    │
    ▼
Backend Processing
    │
    ▼
Response (JSON)
    │
    ▼
Update Map (GeoJSON layers)
```

### 2. Backend (Node.js + Express)

#### Responsabilidades
- Exponer API REST para frontend
- Ejecutar consultas a PostgreSQL/PostGIS
- Coordinar llamadas a optimizadores Python
- Gestionar simulaciones de fallas

#### Tecnologías
- **Express 4**: Framework HTTP
- **pg**: Cliente de PostgreSQL
- **@supabase/supabase-js**: Cliente de Supabase
- **child_process**: Para ejecutar scripts Python

#### Módulos de Rutas

```
backend/routes/
├── infrastructure.js    # GET /api/infrastructure/*
│   ├── /nodes           # Nodos de la red
│   ├── /edges           # Enlaces de fibra
│   └── /stats           # Estadísticas de red
│
├── metadata.js          # GET /api/metadata/*
│   └── /datacenters     # Centros de datos
│
├── threats.js           # GET /api/threats/*
│   ├── /earthquakes     # Sismos históricos
│   ├── /fire-zones      # Zonas de incendio
│   └── /weather-events  # Eventos climáticos
│
├── routing.js           # POST /api/routing/*
│   ├── /calculate                  # Dijkstra simple
│   ├── /calculate-resilient        # Dijkstra ponderado
│   ├── /genetic                    # Algoritmo Genético
│   └── /mip                        # Optimización MIP
│
├── probabilities.js     # GET|POST /api/probabilities/*
│   ├── /edges           # Probabilidades por enlace
│   ├── /nodes           # Probabilidades por nodo
│   └── /calculate       # Recalcular probabilidades
│
└── simulation.js        # POST /api/simulation/*
    ├── /run             # Ejecutar simulación
    ├── /:id/failures    # Obtener fallas
    └── /:id/clear       # Limpiar simulación
```

#### Algoritmos de Optimización

**Dijkstra Simple** (SQL puro)
```javascript
// routing.js
const query = `
  SELECT * FROM pgr_dijkstra(
    'SELECT id, source, target, cost FROM edges',
    ${startNodeId},
    ${endNodeId},
    directed := false
  )
`;
```

**Dijkstra Resiliente** (SQL con ponderación)
```javascript
// routing.js
const query = `
  SELECT * FROM calculate_resilient_path(
    ${startLat}, ${startLon},
    ${endLat}, ${endLon},
    ${maxFailureProb}, ${riskWeight}
  )
`;
// Función SQL que ajusta cost por probabilidad
```

**MIP** (Python + python-mip)
```javascript
// algorithms/mip_routing.js (wrapper)
const { spawn } = require('child_process');
const python = spawn('python', ['scripts/optimization/mip_optimizer.py', ...args]);
// Ejecuta script Python, parsea resultado JSON
```

**Algoritmo Genético** (Python + DEAP)
```javascript
// algorithms/genetic_routing.js (wrapper)
const { spawn } = require('child_process');
const python = spawn('python', ['scripts/optimization/genetic_algorithm.py', ...args]);
```

### 3. Base de Datos (PostgreSQL + PostGIS + pgRouting)

#### Extensiones Requeridas
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

#### Tablas Principales

**nodes** - Nodos de la red
```sql
CREATE TABLE nodes (
  id BIGSERIAL PRIMARY KEY,
  osm_id BIGINT UNIQUE,
  node_type VARCHAR(50),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geometry GEOMETRY(Point, 4326),
  region VARCHAR(100)
);
```

**edges** - Enlaces de fibra óptica
```sql
CREATE TABLE edges (
  id BIGSERIAL PRIMARY KEY,
  source BIGINT,  -- ID de nodo origen
  target BIGINT,  -- ID de nodo destino
  cost DOUBLE PRECISION,  -- Longitud en metros
  reverse_cost DOUBLE PRECISION,
  length DOUBLE PRECISION,
  geometry GEOMETRY(LineString, 4326),
  highway VARCHAR(50),
  surface VARCHAR(50)
);
```

**edge_combined_probabilities** - Probabilidades de falla
```sql
CREATE TABLE edge_combined_probabilities (
  edge_id BIGINT PRIMARY KEY REFERENCES edges(id),
  earthquake_prob DOUBLE PRECISION DEFAULT 0,
  fire_prob DOUBLE PRECISION DEFAULT 0,
  flood_prob DOUBLE PRECISION DEFAULT 0,
  weather_prob DOUBLE PRECISION DEFAULT 0,
  landslide_prob DOUBLE PRECISION DEFAULT 0,
  total_failure_probability DOUBLE PRECISION,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**simulation_failures** - Simulaciones de Monte Carlo
```sql
CREATE TABLE simulation_failures (
  id BIGSERIAL PRIMARY KEY,
  simulation_id UUID NOT NULL,
  element_type VARCHAR(10) CHECK (element_type IN ('node', 'edge')),
  element_id BIGINT NOT NULL,
  failed BOOLEAN DEFAULT true,
  random_value DOUBLE PRECISION,
  probability DOUBLE PRECISION,
  dominant_threat VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Funciones pgRouting

**calculate_shortest_path** - Dijkstra simple
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
BEGIN
  -- 1. Encontrar nodos más cercanos
  -- 2. Ejecutar pgr_dijkstra
  -- 3. Unir con geometrías
  -- 4. Retornar resultado
END;
$$ LANGUAGE plpgsql;
```

**calculate_resilient_path** - Dijkstra ponderado
```sql
CREATE OR REPLACE FUNCTION calculate_resilient_path(
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  max_failure_prob DOUBLE PRECISION DEFAULT 1.0,
  risk_weight DOUBLE PRECISION DEFAULT 1.0
)
RETURNS TABLE(...) AS $$
BEGIN
  -- Ajusta cost: distance * (1 + risk_weight * failure_prob)
  -- Filtra enlaces con prob > max_failure_prob
  -- Ejecuta pgr_dijkstra con cost ajustado
END;
$$ LANGUAGE plpgsql;
```

**simulate_failures** - Simulación Monte Carlo
```sql
CREATE OR REPLACE FUNCTION simulate_failures(
  sim_name VARCHAR,
  threshold DOUBLE PRECISION DEFAULT 0.5
)
RETURNS UUID AS $$
DECLARE
  sim_id UUID;
BEGIN
  sim_id := gen_random_uuid();

  -- Para cada enlace:
  INSERT INTO simulation_failures (simulation_id, element_type, element_id, ...)
  SELECT
    sim_id,
    'edge',
    e.id,
    (random() * 100) < (p.total_failure_probability * 100) AS failed,
    random() * 100 AS random_value,
    p.total_failure_probability,
    CASE
      WHEN p.earthquake_prob = GREATEST(...) THEN 'earthquake'
      WHEN p.fire_prob = GREATEST(...) THEN 'fire'
      -- etc.
    END AS dominant_threat
  FROM edges e
  LEFT JOIN edge_combined_probabilities p ON e.id = p.edge_id
  WHERE p.total_failure_probability <= threshold;

  RETURN sim_id;
END;
$$ LANGUAGE plpgsql;
```

### 4. Scripts de Optimización (Python)

#### MIP Optimizer (python-mip)

**Ubicación:** `scripts/optimization/mip_optimizer.py`

**Modelo Matemático:**
```
Variables de Decisión:
  x[i,j] ∈ {0,1}  : uso del enlace (i,j)
  y[i] ∈ {0,1}    : uso del nodo i

Función Objetivo (minimizar):
  Z = w_d × Σ distance[i,j] × x[i,j] +
      w_r × Σ (prob_edge[i,j] + prob_node[i] + prob_node[j]) × x[i,j]

Restricciones:
  1. Conservación de flujo:
     Σ x[s,j] - Σ x[j,s] = 1   (nodo origen s)
     Σ x[i,t] - Σ x[t,i] = -1  (nodo destino t)
     Σ x[i,k] - Σ x[k,i] = 0   (nodos intermedios k)

  2. Acoplamiento nodo-enlace:
     x[i,j] ≤ y[i]
     x[i,j] ≤ y[j]

  3. Distancia máxima (opcional):
     Σ distance[i,j] × x[i,j] ≤ max_distance

  4. Evitar alto riesgo (opcional):
     prob_edge[i,j] ≤ threshold, ∀ x[i,j] = 1
```

#### Algoritmo Genético (DEAP)

**Ubicación:** `scripts/optimization/genetic_algorithm.py`

**Representación:**
- **Cromosoma:** Lista de IDs de nodos [n1, n2, ..., nk]
- **Fitness:** `f = w_d × distance + w_r × risk + w_h × hops`

**Operadores:**
```python
# Inicialización
population = [random_path(start, end) for _ in range(pop_size)]

# Selección por torneo
def tournament(pop, k=3):
    return min(random.sample(pop, k), key=fitness)

# Crossover (punto de cruce en nodo común)
def crossover(path1, path2):
    common_nodes = set(path1) & set(path2)
    if not common_nodes:
        return path1, path2
    split_node = random.choice(list(common_nodes))
    # Combinar segmentos...

# Mutación (reemplazo de segmento)
def mutate(path, rate=0.15):
    if random.random() < rate:
        i, j = sorted(random.sample(range(len(path)), 2))
        path[i:j] = find_alternative_path(path[i], path[j])
```

## Flujo de Datos Completo

### Ejemplo: Calcular Ruta Resiliente

```
1. Usuario ingresa puntos A y B en mapa
   │
   ▼
2. Frontend: RouteComparison.jsx
   │ calculateDijkstraResilientRoute()
   │
   ▼
3. API Call: POST /api/routing/calculate-resilient
   │ Body: { start_lat, start_lon, end_lat, end_lon, riskWeight: 5.0 }
   │
   ▼
4. Backend: routes/routing.js
   │ Valida parámetros
   │ Conecta a BD
   │
   ▼
5. PostgreSQL: functions/resilient_routing.sql
   │ calculate_resilient_path(...)
   │   ├─ Encuentra nodos cercanos a coordenadas
   │   ├─ Consulta probabilidades de edge_combined_probabilities
   │   ├─ Ajusta cost: distance × (1 + 5.0 × failure_prob)
   │   ├─ pgr_dijkstra con cost ajustado
   │   └─ Une con geometrías
   │
   ▼
6. Backend: Procesa resultado
   │ Calcula métricas agregadas:
   │   - total_distance
   │   - avg_failure_prob
   │   - max_failure_prob
   │   - computation_time_ms
   │
   ▼
7. Response JSON:
   {
     "success": true,
     "route": {
       "geojson": { ... },
       "distance": 532.4,
       "avg_risk": 0.087,
       "max_risk": 0.23,
       "num_edges": 47,
       "compute_time_ms": 145
     }
   }
   │
   ▼
8. Frontend: Renderiza ruta en mapa (color naranja)
   │ Actualiza tabla comparativa
   │ Muestra métricas
```

## Seguridad y Performance

### Seguridad

**Frontend:**
- Input validation en formularios
- Sanitización de coordenadas (rangos lat/lon válidos)

**Backend:**
- CORS habilitado solo para origen frontend
- Helmet.js para headers de seguridad
- Rate limiting (express-rate-limit)
- Validación de parámetros con Joi
- Queries parametrizadas (previene SQL injection)

**Base de Datos:**
- Usuario con privilegios limitados (solo SELECT/INSERT en tablas necesarias)
- Índices en columnas frecuentemente consultadas
- Timeout en queries (30s máximo)

### Performance

**Frontend:**
- Lazy loading de componentes
- Memoización de cálculos costosos (useMemo, useCallback)
- Debouncing en inputs
- Virtualización de listas largas

**Backend:**
- Pool de conexiones a BD (max 20)
- Compresión de respuestas (gzip)
- Caché de resultados frecuentes (Redis, opcional)
- Timeout en ejecución de Python (300s máximo)

**Base de Datos:**
- Índices espaciales GIST en columnas geometry
- Índices B-tree en source/target de edges
- VACUUM y ANALYZE periódicos
- Particionamiento de tablas grandes (si > 1M filas)

## Escalabilidad

### Escenarios de Carga

**Baja:** 1-10 usuarios concurrentes
- Stack actual (1 instancia de cada componente)
- PostgreSQL single instance
- OK

**Media:** 10-100 usuarios concurrentes
- Frontend: CDN (Vercel, Netlify)
- Backend: 2-3 instancias detrás de load balancer
- BD: PostgreSQL con réplicas de lectura
- Workers Python: Queue (Redis + Bull)

**Alta:** 100+ usuarios concurrentes
- Frontend: CDN global
- Backend: Kubernetes cluster (auto-scaling)
- BD: PostgreSQL cluster (Citus) o sharding
- Workers: Pool de workers Python con Celery

## Monitoreo y Logging

### Logs

**Backend:**
```javascript
// morgan middleware
app.use(morgan('combined'));

// Custom logger
logger.info('Route calculated', {
  algorithm: 'dijkstra_resilient',
  distance: 532.4,
  compute_time_ms: 145,
  user_ip: req.ip
});
```

**Base de Datos:**
```sql
-- Logging de queries lentas (> 1s)
ALTER DATABASE fiber_network SET log_min_duration_statement = 1000;
```

### Métricas

- Tiempo de respuesta de API (p50, p95, p99)
- Tasa de errores (5xx)
- Tiempo de cómputo de algoritmos
- Uso de CPU/memoria de workers Python
- Conexiones activas a BD

## Deployment

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones completas de producción.

---

**Última actualización:** 2025-11-11
**Versión:** 1.0.0
