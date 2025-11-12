# Backend API - Fiber Optic Network Resilience

Backend API REST desarrollado con Node.js y Express para el análisis de resiliencia de redes de fibra óptica en Chile.

## Tecnologías

- **Node.js 18+**
- **Express.js** - Framework web
- **Supabase** - PostgreSQL gestionado en la nube con PostGIS y pgRouting
- **@supabase/supabase-js** - Cliente oficial de Supabase
- **node-postgres (pg)** - Cliente PostgreSQL para consultas avanzadas

## Estructura del Proyecto

```
backend/
├── server.js              # Punto de entrada principal
├── package.json           # Dependencias
├── Dockerfile            # Imagen Docker
├── .env.example          # Variables de entorno ejemplo
├── config/
│   └── database.js       # Configuración de BD
└── routes/
    ├── infrastructure.js # Rutas de infraestructura (nodes, edges)
    ├── metadata.js       # Rutas de metadata (datacenters)
    ├── threats.js        # Rutas de amenazas (earthquakes, fire, weather)
    └── routing.js        # Rutas de cálculo con pgr_dijkstra
```

## Instalación

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase:

```env
PORT=5001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database credentials
DB_HOST=db.your-project.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.your-project
DB_PASSWORD=your-password
```

**📚 Para instrucciones detalladas de configuración de Supabase, ver [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

### 3. Ejecutar el servidor

**Desarrollo:**
```bash
npm run dev
```

**Producción:**
```bash
npm start
```

El servidor estará disponible en `http://localhost:5000`

## Endpoints Disponibles

### Health Check
- `GET /health` - Verificar estado del servidor

### Infrastructure
- `GET /api/infrastructure/edges` - Obtener enlaces (edges) como GeoJSON
  - Query params: `region`, `limit`, `offset`
- `GET /api/infrastructure/edges/:id` - Obtener edge específico
- `GET /api/infrastructure/nodes` - Obtener nodos como GeoJSON
  - Query params: `region`, `node_type`, `limit`, `offset`
- `GET /api/infrastructure/stats` - Estadísticas de la red por región
- `GET /api/infrastructure/regions` - Lista de regiones disponibles

### Metadata
- `GET /api/metadata/datacenters` - Obtener datacenters como GeoJSON
  - Query params: `city`, `state`, `tier_level`, `limit`, `offset`
- `GET /api/metadata/datacenters/:id` - Obtener datacenter específico
- `GET /api/metadata/datacenters/nearby/:lat/:lon` - Datacenters cercanos
  - Query params: `radius_km`
- `GET /api/metadata/ground-type` - Tipos de suelo
- `GET /api/metadata/cities` - Lista de ciudades con datacenters

### Threats (Amenazas)
- `GET /api/threats/earthquakes` - Obtener sismos como GeoJSON
  - Query params: `min_magnitude`, `threat_level`, `start_date`, `end_date`, `limit`, `offset`
- `GET /api/threats/earthquakes/nearby/:lat/:lon` - Sismos cercanos
  - Query params: `radius_km`, `min_magnitude`
- `GET /api/threats/fire-zones` - Zonas de riesgo de incendio
  - Query params: `risk_level`, `limit`, `offset`
- `GET /api/threats/weather-events` - Eventos climáticos extremos
  - Query params: `event_type`, `severity`, `start_date`, `end_date`, `limit`, `offset`
- `GET /api/threats/nearby/:lat/:lon` - Todas las amenazas cercanas
  - Query params: `radius_km`
- `GET /api/threats/statistics` - Estadísticas de amenazas

### Routing (pgr_dijkstra)
- `GET /api/routing/calculate` - Calcular ruta más corta
  - Query params: `start_lat`, `start_lon`, `end_lat`, `end_lon`
- `POST /api/routing/calculate` - Calcular ruta (versión POST)
  - Body: `{ start_lat, start_lon, end_lat, end_lon }`
- `GET /api/routing/example` - Ruta de ejemplo (Santiago → Concepción)
- `GET /api/routing/nearest-node/:lat/:lon` - Nodo más cercano a una coordenada
- `GET /api/routing/topology-status` - Estado de la topología de red

## Ejemplos de Uso

### Calcular ruta con pgr_dijkstra

**GET Request:**
```bash
curl "http://localhost:5000/api/routing/calculate?start_lat=-33.4489&start_lon=-70.6693&end_lat=-36.8270&end_lon=-73.0498"
```

**POST Request:**
```bash
curl -X POST http://localhost:5000/api/routing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "start_lat": -33.4489,
    "start_lon": -70.6693,
    "end_lat": -36.8270,
    "end_lon": -73.0498
  }'
```

**Respuesta:**
```json
{
  "type": "FeatureCollection",
  "features": [...],
  "route_info": {
    "start": { "lat": -33.4489, "lon": -70.6693 },
    "end": { "lat": -36.8270, "lon": -73.0498 },
    "total_cost_meters": 502341.5,
    "total_cost_km": "502.34",
    "total_edges": 145,
    "algorithm": "pgr_dijkstra",
    "considers_threats": false
  }
}
```

### Obtener ruta de ejemplo

```bash
curl http://localhost:5000/api/routing/example
```

### Verificar estado de topología

```bash
curl http://localhost:5000/api/routing/topology-status
```

### Obtener edges por región

```bash
curl "http://localhost:5000/api/infrastructure/edges?region=Región%20Metropolitana&limit=50"
```

### Buscar amenazas cercanas

```bash
curl "http://localhost:5000/api/threats/nearby/-33.4489/-70.6693?radius_km=100"
```

## Docker

### Construir imagen

```bash
docker build -t fiber-network-backend .
```

### Ejecutar contenedor

```bash
docker run -p 5000:5000 \
  -e DB_HOST=your-host \
  -e DB_PASSWORD=your-password \
  fiber-network-backend
```

### Con docker-compose

Desde la raíz del proyecto:

```bash
docker-compose up backend
```

## Desarrollo

### Instalar nodemon para auto-reload

```bash
npm install -D nodemon
```

### Ejecutar en modo desarrollo

```bash
npm run dev
```

### Logs

El servidor usa `morgan` para logging. En desarrollo se muestran todos los requests.

## Troubleshooting

### Error: "no pg_hba.conf entry for host"

Asegúrate de que:
1. Tu IP está permitida en Supabase (Settings → Database → Connection Pooling)
2. Tienes `DB_SSL=true` en tu `.env`

### Error: "relation edges_vertices_pgr does not exist"

La topología de red no está creada. Ejecuta el script:

```bash
psql -h your-host -U postgres -d fiber_network < ../create-topology.sql
```

O desde Supabase SQL Editor, copia y pega el contenido de `create-topology.sql`.

### Error: "No route found between these points"

Verifica que:
1. Los datos estén cargados en las tablas `nodes` y `edges`
2. La topología esté creada (usa `/api/routing/topology-status`)
3. Los puntos estén dentro de Chile

## Testing

```bash
# Verificar que el servidor funciona
curl http://localhost:5000/health

# Verificar conexión a BD
curl http://localhost:5000/api/routing/topology-status

# Probar ruta de ejemplo
curl http://localhost:5000/api/routing/example
```

## Contribución

Ver `../README.md` para información del proyecto completo.

## Licencia

MIT

## Autores

- Samuel
- Agustín
