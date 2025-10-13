# Trabajo Grupal Fase 2: ETL y Visualización con Leaflet

## Enunciado

Se debe crear un repositorio en github el cual debe contener: 

0.- Imagen con el diagrama de su BD para dimensionar las capacidades que tendrá y un mejor entendimiento de ésta. Debe estar acompañada de un archivo .sql que permita crear la BD desde cero con la estructura que utilizará.

1.- Carpeta Infraestructura: Archivo que automatiza la extracción y transformación de la infraestructura (nodos y aristas) a un *json.

2.- Carpeta Metadata: N archivos, donde cada uno automatiza la extracción y transformación de una API o BD de la metadata a un *json.

3.- Carpeta Amenazas: N archivos, donde cada uno automatiza la extracción y transformación de una API o BD de la amenaza a un *json.

4.- Cada archivo json o geojson debe tener un un archivo asociado que explique la estructura del archivo y a qué corresponde cada valor del *json para facilitar su entendimiento.

6.- Por cada archivo *json, deberá generar un archivo que permita cargar esa información a su BD en base al diseño de ésta.

7.- Carpeta Sitio Web: Archivo que permita crear un sitio con leaftlet para visualizar la infraestructura, la información de la metadata y de las amenazas.

8.- El sitio deberá mostrar una ruta generada con pgr_dijkstra, utilizando la longitud de la ruta como costo, que muestre a modo de ejemplo una ruta que sea una posible solución a su problema planteado. Esta ruta será el peor caso que podría resolver su problemática, ya que no considerará la metadata ni las posibles amenazas (eso será parte de la fase3).

9.- Deberá crear un archivo main (en la carpeta raíz de su github) que permita ejecutar los procesos anteriores de forma automatizada, desde la descarga de toda la información, su importación en la bd y habilitación del sitio web.

Para asegurar que todas sus implementaciones funcionen correctamente, estas DEBEN correr en contendores DOCKER para asegurar compatibilidad de librerías y versiones de software.

# Checklist y Progreso del Proyecto

**Progreso General: ~20%**

## Repositorio GitHub

### 0. (Samuel) Diseño de Base de Datos
- [ ] Imagen con diagrama de la BD (muestra dimensiones y estructura)
- [ ] Archivo `.sql` para crear la BD desde cero

**Estado:** ❌ No implementado

**Cómo hacerlo:**
1. Diseñar esquema con tablas principales:
   - `nodes` (id, lat, lon, geometry, tipo)
   - `edges` (id, source, target, length, geometry)
   - `datacenters` (id, nombre, lat, lon, geometry)
   - `earthquakes` (id, magnitude, depth, time, geometry)
   - `fire_risk_zones` (id, risk_level, geometry)
   - `weather_events` (id, type, severity, date, geometry)
   - `routes` (id, start_node, end_node, path, total_cost)
2. Instalar PostGIS y pgRouting en PostgreSQL
3. Crear archivo `schema.sql` con CREATE TABLE statements
4. Agregar índices espaciales: `CREATE INDEX idx_nodes_geom ON nodes USING GIST(geometry)`
5. Habilitar extensiones: `CREATE EXTENSION postgis; CREATE EXTENSION pgrouting;`
6. Crear diagrama con herramientas como dbdiagram.io o draw.io

### 1. (Agustín) Carpeta Infraestructura
- [x] Archivo GeoJSON de infraestructura (`infraestructura/mapa_completo_v2.geojson`)
- [ ] Archivo que automatiza extracción de nodos y aristas
- [ ] Archivo que transforma nodos y aristas a JSON

**Estado:** ⚠️ Parcialmente implementado (30%)

**Lo que tienes:**
- `infraestructura/mapa_completo_v2.geojson` (33MB) - GeoJSON completo de la red

**Lo que falta:**
Script de automatización para generar este archivo. Crear `infraestructura/extract_infrastructure.py`:

```python
import osmnx as ox
import geopandas as gpd
import json

def extract_chile_fiber_network():
    # Descargar red de Chile desde OSM
    place = "Chile"
    G = ox.graph_from_place(place, network_type='all')

    # Convertir a GeoDataFrames
    nodes_gdf = ox.graph_to_gdfs(G, edges=False, nodes=True)
    edges_gdf = ox.graph_to_gdfs(G, nodes=False, edges=True)

    # Exportar a GeoJSON
    nodes_gdf.to_file("infraestructura/nodes.geojson", driver="GeoJSON")
    edges_gdf.to_file("infraestructura/edges.geojson", driver="GeoJSON")

    # Combinar en un solo archivo si es necesario
    # ... lógica adicional

if __name__ == "__main__":
    extract_chile_fiber_network()
```

### 2. (Agustín) Carpeta Metadata
- [x] Scripts de prueba de APIs (`metadata/api-tests/*.py`)
- [x] GeoJSON de datacenters (`metadata/datacenters_fixed.geojson`)
- [ ] Script completo de automatización ETL
- [ ] Todos los archivos JSON de metadata generados con automatización

**Estado:** ⚠️ Parcialmente implementado (40%)

**Lo que tienes:**
- `metadata/api-tests/urban_density.py` - Consulta WorldPop API para densidad poblacional
- `metadata/api-tests/ground_type.py` - Script para tipo de suelo
- `metadata/api-tests/infraestructure_support.py` - Script para soporte de infraestructura
- `metadata/datacenters_fixed.geojson` - Ubicación de datacenters

**Cómo se hizo:**
El script `urban_density.py` usa la API de WorldPop para obtener estadísticas de población:
```python
# Consulta asíncrona con taskid para regiones grandes
params = {"dataset": "wpgppop", "year": 2020, "geojson": region}
# Monitorea el estado hasta que termine: "created" → "finished"
```

**Lo que falta:**
Crear `metadata/extract_all_metadata.py` que consolide todo:
```python
import json
from api_tests.urban_density import get_worldpop_stats_for_region
from api_tests.ground_type import get_ground_type_data
import geopandas as gpd

def extract_all_metadata():
    # 1. Cargar regiones de Chile
    regions = load_chile_regions()

    # 2. Para cada región, obtener metadata
    metadata = []
    for region in regions:
        pop_data = get_worldpop_stats_for_region(region)
        ground_data = get_ground_type_data(region)
        metadata.append({
            "region": region["name"],
            "population": pop_data,
            "ground_type": ground_data
        })

    # 3. Exportar a JSON
    with open("metadata/all_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

if __name__ == "__main__":
    extract_all_metadata()
```

### 3. (Agustín) Carpeta Amenazas
- [x] Scripts de prueba de APIs (`amenazas/*.py`)
- [x] GeoJSON de vías con recubrimiento (`amenazas/vias_con_recubrimiento_estim.geojson`, `amenazas/vias_osmnx_cubierta.geojson`)
- [ ] Script completo de automatización ETL
- [ ] Todos los archivos JSON de amenazas consolidados

**Estado:** ⚠️ Parcialmente implementado (40%)

**Lo que tienes:**
- `amenazas/seismicidad.py` - Consulta USGS Earthquake API
- `amenazas/incendios_forestales.py` - Script para incendios
- `amenazas/extreme_weather.py` - Script para clima extremo
- `amenazas/clima_extremo.py` - Alternativa para clima
- `amenazas/test.py` - Estimación de recubrimiento de fibra con OSMnx
- `amenazas/vias_con_recubrimiento_estim.geojson` (2.6MB) - Vías con tipo de recubrimiento
- `amenazas/vias_osmnx_cubierta.geojson` (2.5MB) - Red vial con metadata

**Cómo se hizo:**
`seismicidad.py` consulta la API de USGS para obtener sismos en Chile:
```python
url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
params = {
    "format": "geojson",
    "starttime": "2023-09-01",
    "endtime": "2023-10-01",
    "minlatitude": -56, "maxlatitude": -17,  # Bounding box de Chile
    "minlongitude": -75, "maxlongitude": -66
}
resp = requests.get(url, params=params).json()
```

`test.py` usa OSMnx para estimar tipo de recubrimiento de fibra según tipo de vía:
```python
def estimar_recubrimiento(highway, surface=None):
    if hw in ("motorway", "trunk", "primary"):
        return "armored / PE exterior"
    elif hw in ("secondary", "tertiary"):
        return "outdoor robust"
    # ... más lógica heurística
```

**Lo que falta:**
Crear `amenazas/extract_all_threats.py`:
```python
import requests
import json
from datetime import datetime, timedelta

def extract_all_threats():
    threats = {}

    # 1. Sismos recientes
    earthquakes = get_recent_earthquakes()
    threats["earthquakes"] = earthquakes

    # 2. Zonas de incendios
    fire_zones = get_fire_risk_zones()
    threats["fire_zones"] = fire_zones

    # 3. Eventos climáticos extremos
    weather = get_extreme_weather_events()
    threats["weather_events"] = weather

    # 4. Exportar
    with open("amenazas/all_threats.geojson", "w") as f:
        json.dump(threats, f, indent=2)

if __name__ == "__main__":
    extract_all_threats()
```

### 4. Documentación de JSON/GeoJSON
- [ ] Archivo de documentación para cada JSON generado
- [ ] Explicación de estructura de cada archivo
- [ ] Descripción del significado de cada valor

**Estado:** ❌ No implementado

**Cómo hacerlo:**
Para cada archivo JSON/GeoJSON, crear un archivo `nombre_archivo.README.md`:

**Ejemplo: `infraestructura/mapa_completo_v2.README.md`**
```markdown
# Estructura de mapa_completo_v2.geojson

## Tipo de archivo
GeoJSON FeatureCollection

## Estructura
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",  // Representa enlaces de fibra
        "coordinates": [[lon, lat], ...]
      },
      "properties": {
        "id": "string",           // ID único del enlace
        "source": "number",       // Nodo origen
        "target": "number",       // Nodo destino
        "length": "number",       // Longitud en metros
        "highway": "string",      // Tipo de vía (motorway, primary, etc.)
        "surface": "string"       // Tipo de superficie (paved, unpaved, etc.)
      }
    }
  ]
}

## Descripción de campos
- **id**: Identificador único del enlace de red
- **source/target**: IDs de nodos que conecta este enlace
- **length**: Distancia física del enlace en metros
- **highway**: Clasificación OSM de la vía (afecta tipo de recubrimiento de fibra)
- **surface**: Estado del pavimento (afecta dificultad de instalación)

## Fuente de datos
OpenStreetMap vía OSMnx - Red vial de Chile
```

**Ejemplo: `amenazas/all_threats.README.md`**
```markdown
# Estructura de all_threats.geojson

## Campos de earthquakes
- **magnitude**: Magnitud en escala Richter (float)
- **depth**: Profundidad en km (float)
- **time**: Timestamp ISO 8601
- **place**: Descripción de ubicación

## Campos de fire_zones
- **risk_level**: Alto/Medio/Bajo
- **area_km2**: Superficie en km²

## Fuentes
- Sismos: USGS Earthquake API
- Incendios: [Indicar fuente]
```

### 5. (Samuel) Carga a Base de Datos
- [ ] Script de carga para JSON de infraestructura
- [ ] Script(s) de carga para JSON(s) de metadata
- [ ] Script(s) de carga para JSON(s) de amenazas
- [ ] Todos los scripts siguen el diseño de BD establecido

**Estado:** ❌ No implementado

**Cómo hacerlo:**
Crear scripts de carga usando `psycopg2` o `geopandas` con PostGIS:

**Ejemplo: `infraestructura/load_to_db.py`**
```python
import geopandas as gpd
from sqlalchemy import create_engine

def load_infrastructure_to_db():
    # Conectar a PostgreSQL
    engine = create_engine('postgresql://user:password@localhost:5432/fiber_network')

    # Leer GeoJSON
    gdf = gpd.read_file('infraestructura/mapa_completo_v2.geojson')

    # Separar nodos y aristas si están combinados
    nodes_gdf = extract_nodes(gdf)
    edges_gdf = extract_edges(gdf)

    # Cargar a BD (PostGIS automáticamente maneja geometrías)
    nodes_gdf.to_postgis('nodes', engine, if_exists='replace', index=False)
    edges_gdf.to_postgis('edges', engine, if_exists='replace', index=False)

    print(f"Cargados {len(nodes_gdf)} nodos y {len(edges_gdf)} aristas")

if __name__ == "__main__":
    load_infrastructure_to_db()
```

**Ejemplo: `metadata/load_to_db.py`**
```python
import json
import psycopg2

def load_metadata_to_db():
    conn = psycopg2.connect("dbname=fiber_network user=postgres")
    cur = conn.cursor()

    # Leer JSON
    with open('metadata/datacenters_fixed.geojson') as f:
        data = json.load(f)

    # Insertar cada datacenter
    for feature in data['features']:
        props = feature['properties']
        geom = feature['geometry']
        cur.execute("""
            INSERT INTO datacenters (nombre, geometry)
            VALUES (%s, ST_GeomFromGeoJSON(%s))
        """, (props['nombre'], json.dumps(geom)))

    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    load_metadata_to_db()
```

**Ejemplo: `amenazas/load_to_db.py`**
```python
import geopandas as gpd
from sqlalchemy import create_engine

def load_threats_to_db():
    engine = create_engine('postgresql://user:password@localhost:5432/fiber_network')

    # Cargar sismos
    earthquakes = gpd.read_file('amenazas/earthquakes.geojson')
    earthquakes.to_postgis('earthquakes', engine, if_exists='replace')

    # Cargar zonas de incendio
    fire_zones = gpd.read_file('amenazas/fire_zones.geojson')
    fire_zones.to_postgis('fire_risk_zones', engine, if_exists='replace')

if __name__ == "__main__":
    load_threats_to_db()
```

### 6. (Samuel) Carpeta Sitio Web
- [ ] Archivo que crea sitio web con Leaflet
- [ ] Visualización de infraestructura
- [ ] Visualización de metadata
- [ ] Visualización de amenazas

**Estado:** ❌ No implementado (carpetas `frontend/` y `backend/` existen pero están vacías)

**Cómo hacerlo:**
Crear un sitio web básico con Leaflet para visualizar los datos:

**Estructura sugerida:**
```
frontend/
  ├── index.html
  ├── css/
  │   └── style.css
  ├── js/
  │   ├── map.js
  │   ├── layers.js
  │   └── routing.js
  └── Dockerfile

backend/
  ├── app.py (Flask/FastAPI)
  ├── requirements.txt
  ├── routes/
  │   ├── infrastructure.py
  │   ├── metadata.py
  │   └── threats.py
  └── Dockerfile
```

**Ejemplo: `frontend/index.html`**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Red de Fibra Óptica - Chile</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        #map { height: 100vh; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="js/map.js"></script>
</body>
</html>
```

**Ejemplo: `frontend/js/map.js`**
```javascript
// Inicializar mapa centrado en Chile
const map = L.map('map').setView([-33.4489, -70.6693], 6);

// Agregar capa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Cargar infraestructura
fetch('/api/infrastructure')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: { color: 'blue', weight: 2 }
        }).addTo(map).bindPopup(layer => {
            return `Enlace: ${layer.feature.properties.id}<br>
                    Longitud: ${layer.feature.properties.length}m`;
        });
    });

// Cargar datacenters (metadata)
fetch('/api/datacenters')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                return L.marker(latlng);
            }
        }).addTo(map).bindPopup(layer => {
            return `Datacenter: ${layer.feature.properties.nombre}`;
        });
    });

// Cargar amenazas (sismos)
fetch('/api/earthquakes')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: feature.properties.magnitude * 2,
                    color: 'red',
                    fillOpacity: 0.5
                });
            }
        }).addTo(map).bindPopup(layer => {
            return `Magnitud: ${layer.feature.properties.magnitude}<br>
                    Profundidad: ${layer.feature.properties.depth}km`;
        });
    });
```

**Ejemplo: `backend/app.py`**
```python
from flask import Flask, jsonify
import geopandas as gpd
from sqlalchemy import create_engine

app = Flask(__name__)
engine = create_engine('postgresql://user:password@db:5432/fiber_network')

@app.route('/api/infrastructure')
def get_infrastructure():
    gdf = gpd.read_postgis("SELECT * FROM edges", engine, geom_col='geometry')
    return jsonify(gdf.__geo_interface__)

@app.route('/api/datacenters')
def get_datacenters():
    gdf = gpd.read_postgis("SELECT * FROM datacenters", engine, geom_col='geometry')
    return jsonify(gdf.__geo_interface__)

@app.route('/api/earthquakes')
def get_earthquakes():
    gdf = gpd.read_postgis("SELECT * FROM earthquakes", engine, geom_col='geometry')
    return jsonify(gdf.__geo_interface__)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### 7. Implementación de Ruta
- [ ] Ruta generada con `pgr_dijkstra`
- [ ] Uso de longitud como costo
- [ ] Muestra ejemplo de solución al problema
- [ ] Representa peor caso (sin metadata ni amenazas)

**Estado:** ❌ No implementado

**Cómo hacerlo:**
Implementar ruteo con pgRouting en PostgreSQL/PostGIS:

**Paso 1: Preparar la topología de la red**
```sql
-- Crear topología de la red
SELECT pgr_createTopology('edges', 0.0001, 'geometry', 'id');

-- Verificar que source y target están poblados
SELECT COUNT(*) FROM edges WHERE source IS NULL OR target IS NULL;
```

**Paso 2: Crear función para calcular ruta**
```sql
-- Función para calcular ruta más corta
CREATE OR REPLACE FUNCTION calculate_shortest_path(
    start_lat FLOAT,
    start_lon FLOAT,
    end_lat FLOAT,
    end_lon FLOAT
)
RETURNS TABLE (
    seq INTEGER,
    path_seq INTEGER,
    node BIGINT,
    edge BIGINT,
    cost FLOAT,
    agg_cost FLOAT,
    geom GEOMETRY
) AS $$
BEGIN
    RETURN QUERY
    WITH start_node AS (
        SELECT id FROM nodes
        ORDER BY ST_Distance(geometry, ST_SetSRID(ST_MakePoint(start_lon, start_lat), 4326))
        LIMIT 1
    ),
    end_node AS (
        SELECT id FROM nodes
        ORDER BY ST_Distance(geometry, ST_SetSRID(ST_MakePoint(end_lon, end_lat), 4326))
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
        'SELECT id, source, target, length as cost FROM edges',
        (SELECT id FROM start_node),
        (SELECT id FROM end_node),
        directed := false
    ) r
    LEFT JOIN edges e ON r.edge = e.id;
END;
$$ LANGUAGE plpgsql;
```

**Paso 3: API endpoint para calcular ruta**
Agregar en `backend/app.py`:
```python
@app.route('/api/route')
def calculate_route():
    # Ejemplo: Santiago a Concepción
    start_lat = -33.4489
    start_lon = -70.6693
    end_lat = -36.8270
    end_lon = -73.0498

    query = """
        SELECT * FROM calculate_shortest_path(%s, %s, %s, %s)
    """

    gdf = gpd.read_postgis(
        query,
        engine,
        params=(start_lat, start_lon, end_lat, end_lon),
        geom_col='geom'
    )

    return jsonify({
        'type': 'FeatureCollection',
        'features': json.loads(gdf.to_json())['features'],
        'total_cost_km': gdf['agg_cost'].max() / 1000
    })
```

**Paso 4: Visualizar en Leaflet**
Agregar en `frontend/js/map.js`:
```javascript
// Cargar y visualizar ruta de ejemplo
fetch('/api/route')
    .then(res => res.json())
    .then(data => {
        // Dibujar ruta en el mapa
        L.geoJSON(data.features, {
            style: {
                color: 'green',
                weight: 4,
                opacity: 0.7
            }
        }).addTo(map).bindPopup(`
            Ruta más corta (sin considerar amenazas)<br>
            Distancia total: ${data.total_cost_km.toFixed(2)} km
        `);

        // Agregar marcadores de inicio y fin
        const route = data.features;
        if (route.length > 0) {
            const start = route[0].geometry.coordinates[0];
            const end = route[route.length - 1].geometry.coordinates[
                route[route.length - 1].geometry.coordinates.length - 1
            ];

            L.marker([start[1], start[0]]).addTo(map)
                .bindPopup('Inicio: Santiago');
            L.marker([end[1], end[0]]).addTo(map)
                .bindPopup('Fin: Concepción');
        }
    });
```

**Explicación:**
Esta implementación usa `length` (metros) como costo, calculando la ruta físicamente más corta. Es el "peor caso" porque NO considera:
- Amenazas sísmicas
- Zonas de incendio
- Terreno difícil
- Densidad poblacional

En la Fase 3 se agregarán pesos adicionales basados en metadata y amenazas.

### 8. Archivo Main
- [ ] Archivo `main` en carpeta raíz
- [ ] Automatiza descarga de información
- [ ] Automatiza importación a BD
- [ ] Automatiza habilitación de sitio web
- [ ] Ejecuta todo el proceso de forma automática

**Estado:** ❌ No implementado

**Cómo hacerlo:**
Crear un script orquestador que ejecute todo el pipeline ETL:

**Ejemplo: `main.py` (Python)**
```python
#!/usr/bin/env python3
"""
Script principal para ejecutar todo el pipeline ETL
y levantar el sitio web de visualización.
"""
import subprocess
import sys
import time

def run_command(cmd, description):
    """Ejecuta un comando y maneja errores."""
    print(f"\n{'='*60}")
    print(f"📍 {description}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"❌ Error en: {description}")
        sys.exit(1)
    print(f"✅ Completado: {description}")

def main():
    print("\n🚀 Iniciando pipeline ETL completo\n")

    # 1. Extraer datos
    run_command(
        "python infraestructura/extract_infrastructure.py",
        "Extrayendo infraestructura de red"
    )
    run_command(
        "python metadata/extract_all_metadata.py",
        "Extrayendo metadata (datacenters, densidad poblacional)"
    )
    run_command(
        "python amenazas/extract_all_threats.py",
        "Extrayendo amenazas (sismos, incendios, clima)"
    )

    # 2. Iniciar base de datos (Docker)
    run_command(
        "docker-compose up -d db",
        "Levantando base de datos PostgreSQL/PostGIS"
    )
    time.sleep(10)  # Esperar que DB esté lista

    # 3. Crear esquema de BD
    run_command(
        "docker exec -i db psql -U postgres -d fiber_network < schema.sql",
        "Creando esquema de base de datos"
    )

    # 4. Cargar datos a BD
    run_command(
        "python infraestructura/load_to_db.py",
        "Cargando infraestructura a BD"
    )
    run_command(
        "python metadata/load_to_db.py",
        "Cargando metadata a BD"
    )
    run_command(
        "python amenazas/load_to_db.py",
        "Cargando amenazas a BD"
    )

    # 5. Crear topología de red para pgRouting
    run_command(
        "docker exec -i db psql -U postgres -d fiber_network -c \"SELECT pgr_createTopology('edges', 0.0001, 'geometry', 'id');\"",
        "Creando topología de red para pgRouting"
    )

    # 6. Levantar backend y frontend
    run_command(
        "docker-compose up -d backend frontend",
        "Levantando servicios web (backend + frontend)"
    )

    print("\n" + "="*60)
    print("🎉 Pipeline completado exitosamente!")
    print("="*60)
    print("\n📊 Servicios disponibles:")
    print("   - Frontend: http://localhost:8080")
    print("   - Backend API: http://localhost:5000")
    print("   - Base de datos: localhost:5432")
    print("\n💡 Para ver logs: docker-compose logs -f")
    print("💡 Para detener: docker-compose down\n")

if __name__ == "__main__":
    main()
```

**Alternativa: `main.sh` (Bash)**
```bash
#!/bin/bash
set -e  # Detener en caso de error

echo "🚀 Iniciando pipeline ETL completo"

# 1. Extraer datos
echo "📍 Extrayendo infraestructura..."
python infraestructura/extract_infrastructure.py

echo "📍 Extrayendo metadata..."
python metadata/extract_all_metadata.py

echo "📍 Extrayendo amenazas..."
python amenazas/extract_all_threats.py

# 2. Levantar base de datos
echo "📍 Levantando base de datos..."
docker-compose up -d db
sleep 10

# 3. Crear esquema
echo "📍 Creando esquema de BD..."
docker exec -i fiber_network_db psql -U postgres -d fiber_network < schema.sql

# 4. Cargar datos
echo "📍 Cargando datos a BD..."
python infraestructura/load_to_db.py
python metadata/load_to_db.py
python amenazas/load_to_db.py

# 5. Crear topología
echo "📍 Creando topología para pgRouting..."
docker exec fiber_network_db psql -U postgres -d fiber_network \
    -c "SELECT pgr_createTopology('edges', 0.0001, 'geometry', 'id');"

# 6. Levantar servicios web
echo "📍 Levantando servicios web..."
docker-compose up -d backend frontend

echo "🎉 Pipeline completado!"
echo "Frontend: http://localhost:8080"
echo "Backend: http://localhost:5000"
```

**Hacerlo ejecutable:**
```bash
chmod +x main.py
# o
chmod +x main.sh
```

**Ejecutar:**
```bash
./main.py
# o
./main.sh
```

### 9. Docker
- [x] Dockerfiles creados (aunque vacíos)
- [x] docker-compose.yml creado (aunque vacío)
- [ ] Dockerfiles configurados correctamente
- [ ] docker-compose.yml funcional
- [ ] Todas las implementaciones corren en contenedores Docker
- [ ] Compatibilidad de librerías asegurada
- [ ] Versiones de software compatibles

**Estado:** ⚠️ Parcialmente implementado (10% - solo archivos vacíos creados)

**Lo que tienes:**
- `frontend/Dockerfile` (vacío)
- `backend/Dockerfile` (vacío)
- `docker-compose.yml` (vacío en raíz)

**Cómo completarlo:**

**1. `docker-compose.yml` completo:**
```yaml
version: '3.8'

services:
  db:
    image: postgis/postgis:15-3.3
    container_name: fiber_network_db
    environment:
      POSTGRES_DB: fiber_network
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fiber_network_backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/fiber_network
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - ./infraestructura:/app/infraestructura
      - ./metadata:/app/metadata
      - ./amenazas:/app/amenazas

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: fiber_network_frontend
    ports:
      - "8080:80"
    depends_on:
      - backend
    volumes:
      - ./frontend:/usr/share/nginx/html

volumes:
  postgres_data:
```

**2. `backend/Dockerfile`:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema para GeoPandas
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    postgresql-client \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```

**3. `backend/requirements.txt`:**
```txt
flask==3.0.0
flask-cors==4.0.0
geopandas==0.14.1
psycopg2-binary==2.9.9
sqlalchemy==2.0.23
requests==2.31.0
```

**4. `frontend/Dockerfile`:**
```dockerfile
FROM nginx:alpine

# Copiar archivos del sitio web
COPY . /usr/share/nginx/html

# Configurar nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**5. `frontend/nginx.conf`:**
```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para el backend
    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**6. Verificar que funciona:**
```bash
# Construir e iniciar todos los servicios
docker-compose up --build

# En otra terminal, verificar que todo está corriendo
docker-compose ps

# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Limpiar volúmenes (cuidado, borra la BD)
docker-compose down -v
```

**Beneficios de esta configuración:**
- ✅ Aislamiento completo de dependencias
- ✅ Reproducibilidad garantizada
- ✅ Versiones de software fijas
- ✅ Fácil deployment en cualquier máquina
- ✅ Health checks para asegurar que DB está lista antes de iniciar backend

## Presentación

### Entrega en Canvas
- [ ] Presentación creada
- [ ] Evidencia del proceso ETL (Extract, Transform, Load)
- [ ] Todos los puntos de la rúbrica incluidos
- [ ] Capturas de pantalla o diagramas de cada componente
- [ ] Link al repositorio GitHub
- [ ] Presentación subida a Canvas

### Contenido de la Presentación
- [ ] Diagrama de BD explicado
- [ ] Proceso de extracción demostrado
- [ ] Proceso de transformación demostrado
- [ ] Proceso de carga demostrado
- [ ] Sitio web funcionando
- [ ] Ruta con pgr_dijkstra visualizada
- [ ] Automatización con archivo main demostrada
- [ ] Implementación en Docker explicada

---

## 📋 Resumen de Progreso

### ✅ Completado
1. **Scripts de exploración** - Tienes scripts funcionales para consultar APIs de amenazas y metadata
2. **Archivos GeoJSON** - Datos de infraestructura, vías con recubrimiento, y datacenters
3. **Estructura de carpetas** - Organización básica del proyecto
4. **Archivos Docker vacíos** - Plantillas creadas para Dockerfiles

### ⚠️ En progreso / Parcial
1. **Automatización ETL** - Scripts existen pero falta consolidación
2. **Metadata** - APIs funcionan pero falta integración completa
3. **Amenazas** - Datos de prueba disponibles, falta automatización

### ❌ Falta implementar
1. **Base de datos** (CRÍTICO)
   - Diseño del esquema
   - Archivo schema.sql
   - Scripts de carga

2. **Sitio web** (CRÍTICO)
   - Frontend con Leaflet
   - Backend API
   - Visualización de datos

3. **Ruteo** (CRÍTICO)
   - Implementación pgr_dijkstra
   - Endpoint de API
   - Visualización en mapa

4. **Automatización** (CRÍTICO)
   - Script main.py/main.sh
   - Integración completa

5. **Docker funcional** (CRÍTICO)
   - Configurar Dockerfiles
   - docker-compose.yml completo

6. **Documentación** (IMPORTANTE)
   - README para cada JSON
   - Explicación de estructuras

---

## 🎯 Plan de Acción Recomendado

### Prioridad ALTA (Sin esto no funciona nada)
1. **Base de datos** (2-3 horas)
   - Crear `schema.sql` con diseño de tablas
   - Configurar PostgreSQL/PostGIS en Docker

2. **Scripts de carga** (2-3 horas)
   - `infraestructura/load_to_db.py`
   - `metadata/load_to_db.py`
   - `amenazas/load_to_db.py`

3. **Backend básico** (3-4 horas)
   - API Flask con endpoints mínimos
   - Conexión a base de datos
   - Endpoints para infraestructura, metadata, amenazas

4. **Frontend básico** (2-3 horas)
   - HTML con mapa Leaflet
   - Cargar capas desde API
   - Visualización básica

### Prioridad MEDIA (Necesario para cumplir requisitos)
5. **pgRouting** (3-4 horas)
   - Crear topología de red
   - Implementar función de ruteo
   - Endpoint API para calcular rutas
   - Visualizar ruta en frontend

6. **Docker completo** (2-3 horas)
   - Configurar Dockerfiles
   - docker-compose.yml funcional
   - Probar que todo funcione

7. **Script main** (1-2 horas)
   - Orquestador del pipeline
   - Automatización completa

### Prioridad BAJA (Mejoras de calidad)
8. **Documentación** (1-2 horas)
   - README para cada JSON
   - Comentarios en código

9. **Scripts ETL consolidados** (2-3 horas)
   - Unificar scripts de extracción
   - Manejo de errores robusto

**Tiempo total estimado: 20-30 horas**

---

## 💡 Consejos para avanzar rápido

1. **Empieza por la BD** - Todo depende de esto
2. **Usa datos existentes** - Ya tienes GeoJSON, cárgalos primero
3. **Mínimo viable primero** - Funcionalidad básica antes que perfección
4. **Prueba incremental** - Verifica cada componente antes de continuar
5. **Docker al final** - Desarrolla local, dockeriza cuando funcione
6. **Commits frecuentes** - Guarda progreso constantemente

---

## 📚 Recursos útiles

- **PostGIS/pgRouting**: https://docs.pgrouting.org/
- **Leaflet**: https://leafletjs.com/examples.html
- **GeoPandas**: https://geopandas.org/en/stable/docs/user_guide.html
- **Flask**: https://flask.palletsprojects.com/
- **Docker Compose**: https://docs.docker.com/compose/