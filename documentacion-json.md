# 📋 Documentación de Archivos JSON/GeoJSON

Este documento describe la estructura, formato y significado de cada archivo JSON/GeoJSON generado en el proyecto de Resiliencia de Redes de Fibra Óptica en Chile.

---

## 📑 Tabla de Contenidos

1. [Infraestructura](#infraestructura)
   - [mapa_completo_v2.geojson](#mapa_completo_v2geojson)
   - [vias_con_recubrimiento_estim.geojson](#vias_con_recubrimiento_estimgeojson)
   - [vias_osmnx_cubierta.geojson](#vias_osmnx_cubiertageojson)
2. [Metadata](#metadata)
   - [datacenters_fixed.geojson](#datacenters_fixedgeojson)
   - [datacenters_normalized.geojson](#datacenters_normalizedgeojson)
3. [Amenazas](#amenazas)
   - [earthquakes.geojson](#earthquakesgeojson)

---

## 🏗️ Infraestructura

### mapa_completo_v2.geojson

**Ubicación:** `infraestructura/mapa_completo_v2.geojson`

**Descripción:** Contiene la red completa de fibra óptica en Chile, representando enlaces (edges) y nodos (nodes) de la infraestructura de telecomunicaciones.

#### Formato GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-73.488519, -38.338263],
          [-73.488821, -38.338391]
        ]
      },
      "properties": {
        "osm_id": "123456789",
        "highway": "primary",
        "name": "Ruta 5 Sur",
        "surface": "paved",
        "lanes": 2,
        "maxspeed": "100",
        "oneway": false,
        "bridge": false,
        "tunnel": false,
        "region": "REGIÓN DEL BIOBÍO",
        "link_type": "national",
        "recubrimiento_estim": "subterráneo",
        "length": 118.97
      }
    }
  ]
}
```

#### Estructura de Geometría

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | String | Tipo de geometría: "LineString" para enlaces, "Point" para nodos |
| `coordinates` | Array | Array de coordenadas `[longitud, latitud]` en formato WGS84 (EPSG:4326) |

**Nota importante:** Las coordenadas están en formato `[longitud, latitud]`, no `[latitud, longitud]`.

#### Propiedades de Enlaces (LineString)

| Campo | Tipo | Descripción | Valores Posibles | Ejemplo |
|-------|------|-------------|------------------|---------|
| `osm_id` | String/Number | ID de OpenStreetMap | Cualquier número | "123456789" |
| `highway` | String | Tipo de vía según OSM | "motorway", "trunk", "primary", "secondary", "tertiary", "residential" | "primary" |
| `name` | String | Nombre de la ruta o calle | Texto libre | "Ruta 5 Sur" |
| `surface` | String | Tipo de superficie | "paved", "unpaved", "asphalt", "concrete" | "paved" |
| `lanes` | Number | Número de carriles | 1-8 | 2 |
| `maxspeed` | String | Velocidad máxima (km/h) | "50", "80", "100", "120" | "100" |
| `oneway` | Boolean | Si es de un solo sentido | true, false | false |
| `bridge` | Boolean | Si es un puente | true, false | false |
| `tunnel` | Boolean | Si es un túnel | true, false | false |
| `region` | String | Región de Chile | Nombres de regiones | "REGIÓN DEL BIOBÍO" |
| `link_type` | String | Tipo de enlace | "local", "regional", "national", "international" | "national" |
| `recubrimiento_estim` | String | Tipo de recubrimiento estimado | "aéreo", "subterráneo", "mixto" | "subterráneo" |
| `length` | Number | Longitud en metros | > 0 | 118.97 |

#### Propiedades de Nodos (Point)

| Campo | Tipo | Descripción | Valores Posibles | Ejemplo |
|-------|------|-------------|------------------|---------|
| `osm_id` | String/Number | ID de OpenStreetMap | Cualquier número | "1" |
| `node_type` | String | Tipo de nodo | "intersection", "datacenter", "endpoint" | "datacenter" |
| `latitude` | Number | Latitud | -90 a 90 | -33.4489 |
| `longitude` | Number | Longitud | -180 a 180 | -70.6693 |
| `region` | String | Región de Chile | Nombres de regiones | "Región Metropolitana" |
| `city` | String | Ciudad | Nombres de ciudades | "Santiago" |
| `elevation` | Number | Elevación en metros | Cualquier número | 570 |

#### Uso en Base de Datos

Este archivo se carga en las tablas:
- **`edges`**: Para enlaces (LineString)
- **`nodes`**: Para nodos (Point)

```sql
-- Ejemplo de consulta
SELECT id, name, region, length/1000 as km
FROM edges
WHERE region = 'REGIÓN DEL BIOBÍO'
ORDER BY length DESC
LIMIT 10;
```

---

### vias_con_recubrimiento_estim.geojson

**Ubicación:** `amenazas/vias_con_recubrimiento_estim.geojson`

**Descripción:** Vías de comunicación con estimación del tipo de recubrimiento de fibra óptica (aéreo, subterráneo, mixto).

#### Estructura Específica

Similar a `mapa_completo_v2.geojson`, pero con énfasis en el campo:

| Campo | Tipo | Descripción | Valores |
|-------|------|-------------|---------|
| `recubrimiento_estim` | String | Estimación del tipo de instalación | "aéreo", "subterráneo", "mixto", "desconocido" |

**Significado de valores:**
- **"aéreo"**: Fibra óptica instalada en postes o torres
- **"subterráneo"**: Fibra óptica instalada en ductos subterráneos
- **"mixto"**: Combinación de instalación aérea y subterránea
- **"desconocido"**: No se tiene información del tipo de instalación

#### Uso en Análisis de Amenazas

Este campo es crucial para:
- Evaluar vulnerabilidad ante eventos climáticos (aéreas más vulnerables a vientos)
- Analizar riesgo sísmico (subterráneas pueden verse afectadas por movimientos de tierra)
- Planificar mantenimiento preventivo

---

### vias_osmnx_cubierta.geojson

**Ubicación:** `amenazas/vias_osmnx_cubierta.geojson`

**Descripción:** Vías extraídas usando OSMnx (OpenStreetMap Network X) con cobertura de fibra óptica.

#### Propiedades Adicionales OSMnx

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `osmid` | String | ID único de OSM | "123456789" |
| `u` | Number | Nodo origen (para grafos) | 1001 |
| `v` | Number | Nodo destino (para grafos) | 1002 |
| `key` | Number | Clave de arista (para aristas múltiples) | 0 |
| `geometry` | Object | Geometría LineString | {...} |
| `length` | Number | Longitud calculada por OSMnx (metros) | 250.5 |

#### Uso en Análisis de Red

Este formato es compatible con NetworkX para análisis de grafos:

```python
import osmnx as ox
import geopandas as gpd

# Cargar el archivo
gdf = gpd.read_file('vias_osmnx_cubierta.geojson')

# Convertir a grafo de NetworkX
G = ox.graph_from_gdfs(gdf_nodes, gdf)
```

---

## 🏢 Metadata

### datacenters_fixed.geojson

**Ubicación:** `metadata/datacenters_fixed.geojson`

**Descripción:** Ubicación y características de datacenters y centros de datos en Chile. Versión corregida con validación de coordenadas y datos normalizados.

#### Formato GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-70.6693, -33.4489]
      },
      "properties": {
        "name": "Datacenter Santiago Centro",
        "company_name": "Telefónica Chile",
        "address": "Av. Providencia 1234",
        "city": "Santiago",
        "state": "Región Metropolitana",
        "country": "Chile",
        "capacity_mw": 5.5,
        "tier_level": 3,
        "year_opened": 2015,
        "urban_density": "Alta",
        "population_5km": 250000
      }
    }
  ]
}
```

#### Propiedades de Datacenters

| Campo | Tipo | Descripción | Valores Posibles | Ejemplo |
|-------|------|-------------|------------------|---------|
| `name` | String | Nombre del datacenter | Texto libre | "Datacenter Santiago Centro" |
| `company_name` | String | Empresa operadora | Texto libre | "Telefónica Chile" |
| `address` | String | Dirección física | Texto libre | "Av. Providencia 1234" |
| `city` | String | Ciudad | Nombres de ciudades chilenas | "Santiago" |
| `state` | String | Región | Nombres de regiones | "Región Metropolitana" |
| `country` | String | País | "Chile" | "Chile" |
| `capacity_mw` | Number | Capacidad eléctrica en MW | 0.5 - 100 | 5.5 |
| `tier_level` | Number | Nivel de certificación Tier | 1, 2, 3, 4 | 3 |
| `year_opened` | Number | Año de inauguración | 1990-2025 | 2015 |
| `urban_density` | String | Densidad urbana del área | "Alta", "Media", "Baja" | "Alta" |
| `population_5km` | Number | Población en radio de 5km | > 0 | 250000 |

#### Niveles Tier

| Tier | Disponibilidad | Redundancia | Descripción |
|------|----------------|-------------|-------------|
| 1 | 99.671% | Ninguna | Infraestructura básica sin redundancia |
| 2 | 99.741% | Componentes | Algunos componentes redundantes |
| 3 | 99.982% | N+1 | Todos los componentes con redundancia N+1 |
| 4 | 99.995% | 2N | Redundancia completa y tolerancia a fallos |

#### Uso en Análisis

```sql
-- Datacenters Tier 3 o superior en Santiago
SELECT name, company_name, tier_level, capacity_mw
FROM datacenters
WHERE city = 'Santiago' AND tier_level >= 3
ORDER BY capacity_mw DESC;
```

---

### datacenters_normalized.geojson

**Ubicación:** `metadata/datacenters_normalized.geojson`

**Descripción:** Versión normalizada de los datos de datacenters, con campos estandarizados y validados.

#### Diferencias con datacenters_fixed.geojson

1. **Normalización de nombres**: Empresas y ciudades con nombres consistentes
2. **Validación de coordenadas**: Verificadas contra servicios de geocodificación
3. **Datos completos**: Campos faltantes completados con valores por defecto o investigación
4. **Formato consistente**: Todos los campos siguen el mismo estándar

#### Campos Adicionales de Normalización

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `normalized_name` | String | Nombre normalizado | "DATACENTER_SANTIAGO_CENTRO" |
| `validated` | Boolean | Si los datos fueron validados | true |
| `data_source` | String | Fuente de los datos | "Subtel", "Manual", "OSM" |
| `last_updated` | String | Fecha de última actualización | "2025-10-12" |

---

## 🔴 Amenazas

### earthquakes.geojson

**Ubicación:** `amenazas/earthquakes.geojson`

**Descripción:** Registro de eventos sísmicos en Chile obtenidos del servicio USGS (United States Geological Survey).

#### Formato GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-71.5, -33.0, 10]
      },
      "properties": {
        "id": "us7000abcd",
        "mag": 6.5,
        "place": "25 km NW of Valparaíso, Chile",
        "time": 1697155200000,
        "depth": 10.0,
        "magType": "Mww",
        "type": "earthquake",
        "status": "reviewed",
        "tsunami": 0,
        "sig": 650,
        "alert": "orange",
        "title": "M 6.5 - 25km NW of Valparaíso, Chile"
      }
    }
  ]
}
```

#### Estructura de Coordenadas

Las coordenadas de sismos incluyen **tres dimensiones**:
```javascript
[longitud, latitud, profundidad]
// Ejemplo: [-71.5, -33.0, 10]
```

| Posición | Significado | Rango | Ejemplo |
|----------|-------------|-------|---------|
| 0 | Longitud | -180 a 180 | -71.5 |
| 1 | Latitud | -90 a 90 | -33.0 |
| 2 | Profundidad (km) | 0 a 700 | 10 |

#### Propiedades de Sismos

| Campo | Tipo | Descripción | Valores Posibles | Ejemplo |
|-------|------|-------------|------------------|---------|
| `id` | String | ID único de USGS | Texto alfanumérico | "us7000abcd" |
| `mag` | Number | Magnitud del sismo | 0.0 - 10.0 | 6.5 |
| `place` | String | Descripción de la ubicación | Texto libre | "25 km NW of Valparaíso, Chile" |
| `time` | Number | Timestamp Unix (milisegundos) | > 0 | 1697155200000 |
| `depth` | Number | Profundidad del hipocentro (km) | 0 - 700 | 10.0 |
| `magType` | String | Tipo de magnitud | "Mww", "Mw", "ML", "Ms" | "Mww" |
| `type` | String | Tipo de evento | "earthquake" | "earthquake" |
| `status` | String | Estado de la revisión | "automatic", "reviewed" | "reviewed" |
| `tsunami` | Number | Indicador de tsunami | 0 (no), 1 (sí) | 0 |
| `sig` | Number | Significancia del evento | 0 - 1000 | 650 |
| `alert` | String | Nivel de alerta | "green", "yellow", "orange", "red" | "orange" |
| `title` | String | Título descriptivo | Texto libre | "M 6.5 - 25km NW of Valparaíso, Chile" |

#### Tipos de Magnitud

| Tipo | Nombre | Descripción |
|------|--------|-------------|
| Mww | Moment Magnitude W-phase | Magnitud momento calculada con onda W |
| Mw | Moment Magnitude | Magnitud momento estándar |
| ML | Local Magnitude | Magnitud local (Richter) |
| Ms | Surface Wave Magnitude | Magnitud de ondas superficiales |

#### Niveles de Alerta

| Color | Rango de Magnitud | Descripción | Acción Recomendada |
|-------|-------------------|-------------|-------------------|
| 🟢 Green | < 5.0 | Impacto mínimo | Ninguna |
| 🟡 Yellow | 5.0 - 5.9 | Impacto bajo | Monitoreo |
| 🟠 Orange | 6.0 - 6.9 | Impacto moderado | Alerta y revisión |
| 🔴 Red | ≥ 7.0 | Impacto alto | Acción inmediata |

#### Cálculo de Threat Level

El sistema calcula automáticamente el nivel de amenaza basándose en la magnitud:

```sql
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
```

#### Conversión de Timestamp

El campo `time` está en formato Unix timestamp (milisegundos desde 1970-01-01):

```javascript
// JavaScript
const date = new Date(earthquake.properties.time);
console.log(date.toISOString());
// Output: "2023-10-13T06:40:00.000Z"
```

```python
# Python
from datetime import datetime
timestamp_ms = 1697155200000
date = datetime.fromtimestamp(timestamp_ms / 1000.0)
print(date.isoformat())
# Output: "2023-10-13T06:40:00"
```

```sql
-- SQL (PostgreSQL)
SELECT to_timestamp(1697155200000/1000.0) AS fecha;
-- Output: 2023-10-13 06:40:00
```

#### Uso en Análisis de Riesgo

```sql
-- Sismos de alta magnitud cerca de infraestructura crítica
SELECT 
    e.id,
    e.magnitude,
    e.place,
    ST_Distance(e.geometry::geography, edges.geometry::geography) / 1000 as distance_km
FROM earthquakes e
CROSS JOIN edges
WHERE e.magnitude >= 6.0
  AND ST_DWithin(e.geometry::geography, edges.geometry::geography, 50000)
ORDER BY e.magnitude DESC, distance_km ASC;
```

---

## 📐 Estándares y Convenciones

### Sistema de Coordenadas

Todos los archivos GeoJSON utilizan el sistema de referencia:
- **SRID**: 4326
- **Datum**: WGS84
- **Formato**: `[longitud, latitud]` o `[longitud, latitud, elevación/profundidad]`

### Codificación de Archivos

- **Encoding**: UTF-8
- **Line Endings**: LF (Unix)
- **Formato de Fecha**: ISO 8601 o Unix timestamp

### Nombres de Campos

- **Estilo**: snake_case
- **Idioma**: Mezcla de inglés (estándares GIS) y español (datos locales)
- **Nulos**: Los campos vacíos se representan como `null`, no como cadenas vacías

### Validación de Datos

Todos los archivos deben cumplir con:
1. ✅ **Sintaxis GeoJSON válida**: Verificable con herramientas como `geojsonlint`
2. ✅ **Coordenadas válidas**: Longitud entre -180 y 180, latitud entre -90 y 90
3. ✅ **Tipos de geometría correctos**: Point, LineString, Polygon según corresponda
4. ✅ **Propiedades requeridas**: Los campos marcados como obligatorios deben estar presentes

---

## 🔧 Herramientas Recomendadas

### Visualización
- **QGIS**: Software GIS de código abierto
- **Leaflet**: Biblioteca JavaScript para mapas interactivos
- **geojson.io**: Visualizador web de GeoJSON

### Validación
- **geojsonlint**: Validador de sintaxis GeoJSON
- **GDAL/OGR**: Suite de herramientas GIS
- **PostGIS**: Para consultas espaciales en PostgreSQL

### Conversión
- **ogr2ogr**: Conversión entre formatos GIS
- **geojson-to-csv**: Conversión a formato tabular
- **topojson**: Optimización de archivos GeoJSON

---

## 📚 Referencias

- **GeoJSON Specification**: https://geojson.org/
- **USGS Earthquake API**: https://earthquake.usgs.gov/fdsnws/event/1/
- **OpenStreetMap**: https://www.openstreetmap.org/
- **PostGIS Documentation**: https://postgis.net/docs/
- **Leaflet Documentation**: https://leafletjs.com/reference.html

---

**Proyecto**: Resiliencia de Redes de Fibra Óptica en Chile
**Universidad**: Análisis de Algoritmos de Ruteo y Redes Resilientes  
**Fecha**: Octubre 2025
