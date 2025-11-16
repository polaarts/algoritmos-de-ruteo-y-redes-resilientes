# Integración OSRM - Enlaces de Fibra Realistas

Este módulo integra OSRM (Open Source Routing Machine) para generar enlaces de fibra óptica que siguen carreteras reales en lugar de líneas rectas.

## 🎯 Objetivo

Generar rutas realistas entre datacenters de la Región del Biobío que sigan la red de carreteras de Chile, proporcionando:
- Distancias más precisas
- Visualización realista en el mapa
- Rutas que consideran la topología real de las carreteras

## 📋 Requisitos

- Docker y Docker Compose
- ~2GB de espacio en disco para datos de OSM de Chile
- Conexión a internet para descargar datos
- Node.js para ejecutar scripts

## 🚀 Instalación y Configuración

### Paso 1: Descargar y procesar datos de OSM

Ejecuta el script de configuración:

**En Windows:**
```bash
cd scripts
./setup-osrm.bat
```

**En Linux/Mac:**
```bash
cd scripts
chmod +x setup-osrm.sh
./setup-osrm.sh
```

Este script:
1. Descarga datos de OpenStreetMap de Chile (~300MB)
2. Procesa los datos con OSRM (extract, partition, customize)
3. Deja los archivos listos en `osrm-data/`

⏱️ **Tiempo estimado:** 10-20 minutos dependiendo de tu conexión y CPU

### Paso 2: Aplicar migración de base de datos

```bash
docker compose exec -i fiber_network_db psql -U postgres -d fiber_network < database/migrations/007_add_osrm_flag.sql
```

**Nota:** Ejecuta este comando desde el directorio raíz del proyecto.

### Paso 3: Iniciar servicio OSRM

Primero, asegúrate de que tu `docker-compose.yml` incluya el servicio OSRM (ya está configurado en `config/docker-compose.yml`).

```bash
cd config
docker-compose up -d osrm
```

**Alternativa:** Si los contenedores fueron levantados desde otro directorio, usa:
```bash
docker run -d --name fiber_network_osrm \
  --network fiber_network \
  -p 5001:5000 \
  -v "$(pwd)/osrm-data:/data" \
  ghcr.io/project-osrm/osrm-backend:latest \
  osrm-routed --algorithm mld /data/chile-latest.osrm
```

Espera ~30 segundos a que OSRM cargue los datos.

### Paso 4: Verificar que OSRM está funcionando

```bash
curl "http://localhost:5001/route/v1/driving/-73.0444,-36.8201;-72.5904,-38.7359?overview=full&geometries=geojson"
```

Deberías ver un JSON con información de la ruta.

### Paso 5: Generar enlaces de fibra

```bash
cd scripts
node generate-biobio-fiber-links.js
```

Este script:
- Obtiene todos los datacenters de la Región del Biobío (9 datacenters)
- Crea nodos de fibra para cada datacenter
- Genera rutas realistas entre todos los pares usando OSRM
- Inserta los enlaces en la base de datos

⏱️ **Tiempo estimado:** 1-2 minutos (36 pares de conexiones)

## 🔍 Verificación

### Ver enlaces creados con OSRM

```sql
SELECT 
  fl.id,
  fn1.name as source_name,
  fn2.name as target_name,
  ROUND(fl.length::numeric, 2) as length_km,
  fl.capacity_gbps,
  fl.created_with_osrm
FROM fiber_links fl
JOIN fiber_nodes fn1 ON fl.source_node_id = fn1.id
JOIN fiber_nodes fn2 ON fl.target_node_id = fn2.id
WHERE fl.created_with_osrm = true
ORDER BY fl.id;
```

### Estadísticas

```sql
SELECT 
  COUNT(*) as total_enlaces,
  SUM(CASE WHEN created_with_osrm THEN 1 ELSE 0 END) as enlaces_osrm,
  ROUND(AVG(length)::numeric, 2) as longitud_promedio_km,
  ROUND(SUM(length)::numeric, 2) as longitud_total_km
FROM fiber_links;
```

## 🌐 API Endpoints

### GET /api/osrm/health
Verifica el estado del servicio OSRM

**Ejemplo:**
```bash
curl http://localhost:5000/api/osrm/health
```

### GET /api/osrm/route
Obtiene una ruta entre dos puntos

**Parámetros:**
- `start`: "lon,lat" (ej: "-73.0444,-36.8201")
- `end`: "lon,lat" (ej: "-72.5904,-38.7359")
- `geometries`: "geojson" | "polyline" (default: "geojson")
- `overview`: "full" | "simplified" | "false" (default: "full")

**Ejemplo:**
```bash
curl "http://localhost:5000/api/osrm/route?start=-73.0444,-36.8201&end=-72.5904,-38.7359"
```

**Respuesta:**
```json
{
  "distance": 234567,
  "duration": 8234,
  "geometry": {
    "type": "LineString",
    "coordinates": [[...], [...], ...]
  },
  "legs": [...]
}
```

### POST /api/osrm/batch-routes
Obtiene múltiples rutas en una sola petición

**Body:**
```json
{
  "routes": [
    { "start": [-73.0444, -36.8201], "end": [-72.5904, -38.7359] },
    { "start": [-72.5904, -38.7359], "end": [-73.4118, -37.6272] }
  ]
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:5000/api/osrm/batch-routes \
  -H "Content-Type: application/json" \
  -d '{"routes":[{"start":[-73.0444,-36.8201],"end":[-72.5904,-38.7359]}]}'
```

## 🗺️ Datacenters en Región del Biobío

| ID | Ciudad | Empresa | Coordenadas |
|----|--------|---------|-------------|
| 3 | Concepción | Movistar | -73.0444, -36.8201 |
| 11 | Los Álamos | Claro | -73.4118, -37.6272 |
| 12 | Chillán | Entel | -72.1033, -36.6067 |
| 13 | Los Ángeles | GTD | -72.3536, -37.4695 |
| 14 | Coronel | Telefónica | -73.1605, -37.0330 |
| 15 | Talcahuano | VTR | -73.1165, -36.7249 |
| 16 | Tomé | WOM | -72.9570, -36.6181 |
| 17 | Lota | Claro | -73.1584, -37.0895 |
| 18 | Mulchén | Entel | -72.2396, -37.7191 |

Total: **9 datacenters** → **36 enlaces** (conexión completa)

## 🔧 Troubleshooting

### OSRM no responde
```bash
docker-compose ps osrm
docker-compose logs osrm
```

### Error "No route found"
- Verifica que las coordenadas estén en Chile
- Algunas ubicaciones remotas pueden no tener conexión por carretera

### Error de memoria durante procesamiento
- El procesamiento de datos de OSM requiere ~2GB RAM
- Considera usar datos de una región más pequeña si es necesario

### Reiniciar OSRM
```bash
docker-compose restart osrm
```

## 📊 Visualización en el Frontend

Los enlaces generados con OSRM ya son compatibles con el frontend existente:

- `InfrastructureLayer.jsx` muestra todos los fiber_links
- Las geometrías GeoJSON se renderizan automáticamente en el mapa
- Puedes filtrar por `created_with_osrm` para mostrar solo rutas realistas

## 🔄 Regenerar Enlaces

Para regenerar todos los enlaces con nuevas rutas:

```bash
# 1. Eliminar enlaces anteriores (opcional)
docker compose exec -i fiber_network_db psql -U postgres -d fiber_network -c "DELETE FROM fiber_links WHERE created_with_osrm = true;"

# 2. Regenerar
cd scripts
node generate-biobio-fiber-links.js
```

## 📝 Notas Técnicas

- **OSRM usa algoritmo MLD** (Multi-Level Dijkstra) para búsquedas rápidas
- **Puerto 5001** para evitar conflicto con backend en puerto 5000
- **Datos actualizados:** Chile OSM snapshot más reciente de Geofabrik
- **Perfil de routing:** `car.lua` (optimizado para carreteras)

## 🌟 Próximos Pasos

1. ✅ Enlaces realistas generados
2. 🔄 Visualización en frontend con toggle OSRM/Directo
3. 📊 Análisis de diferencias entre rutas directas vs realistas
4. 🎨 Estilos diferentes para enlaces OSRM
5. 🔍 Búsqueda de rutas alternativas
6. ⚡ Cache de rutas frecuentes

## 📚 Referencias

- [OSRM Documentation](http://project-osrm.org/)
- [Geofabrik Downloads](https://download.geofabrik.de/south-america/chile.html)
- [OpenStreetMap Chile](https://www.openstreetmap.org/relation/167454)
