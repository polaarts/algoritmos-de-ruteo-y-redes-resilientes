# Carga de Datos a Supabase

Este directorio contiene scripts para cargar datos GeoJSON a una base de datos en Supabase.

## Archivos

- `load_to_supabase.py`: Script principal para cargar GeoJSON a Supabase
- `supabase_setup.sql`: Script SQL para configurar las tablas en Supabase

## Pasos de Configuración

### 1. Configurar las Tablas en Supabase

Antes de ejecutar el script de Python, debes crear las tablas en Supabase:

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Abre el **SQL Editor**
3. Copia y pega el contenido de `supabase_setup.sql`
4. Ejecuta el script

Esto creará las siguientes tablas:
- `infrastructure`: Para nodos y aristas de la red (geometrías mixtas)
- `datacenters`: Para ubicaciones de datacenters (puntos)
- `earthquakes`: Para ubicaciones de terremotos (puntos) - Tabla legacy
- `threats`: Tabla unificada para todas las amenazas (terremotos, incendios, clima extremo, etc.)

### 2. Configurar las Credenciales

El script ya contiene las credenciales necesarias. Si necesitas cambiarlas:

1. Abre `load_to_supabase.py`
2. Modifica las variables `api_url` y `api_key` en la función `main()`

### 3. Instalar Dependencias

```bash
pip install requests geopandas pyproj shapely
```

### 4. Ejecutar el Script

```bash
python load_to_supabase.py
```

## Problemas Comunes

### Error: "Geometry has Z dimension but column does not"
**Solución**: El script ahora convierte automáticamente todas las geometrías a 2D.

### Error: "new row violates row-level security policy"
**Solución**: Asegúrate de ejecutar el script SQL que desactiva RLS en las tablas, o configura políticas apropiadas.

### Error: "Geometry type (LineString) does not match column type (Point)"
**Solución**: Usa la tabla `infrastructure` con tipo `GEOMETRY(Geometry, 4326)` que acepta múltiples tipos de geometrías.

## Estructura de los Datos

### Infrastructure
Contiene tanto nodos (Points) como aristas (LineStrings) de la red de infraestructura.

**Campos principales:**
- `osm_id`: ID de OpenStreetMap
- `node_type` / `highway`: Tipo de nodo o vía
- `latitude`, `longitude`: Coordenadas
- `geometry`: Geometría espacial (Point o LineString)
- `length`: Longitud de la arista (metros)
- `surface`, `lanes`, `maxspeed`: Atributos de la vía

### Datacenters
Contiene ubicaciones de datacenters con metadatos adicionales.

**Campos principales:**
- `name`: Nombre del datacenter
- `company_name`: Empresa operadora
- `city`, `state`, `country`: Ubicación
- `capacity_mw`: Capacidad en megavatios
- `tier_level`: Nivel de certificación
- `urban_density`, `population_5km`: Datos demográficos
- `geometry`: Geometría espacial (Point)

### Threats (Amenazas)
Tabla unificada para todas las amenazas naturales.

**Campos principales:**
- `threat_type`: Tipo de amenaza ('earthquake', 'forest_fire', 'extreme_weather')
- `magnitude`: Magnitud del evento
- `depth`: Profundidad (para terremotos)
- `event_date`: Fecha del evento
- `location`: Ubicación descriptiva
- `severity`: Nivel de severidad
- `affected_area_km2`: Área afectada
- `description`: Descripción del evento
- `properties`: JSON con propiedades adicionales
- `geometry`: Geometría espacial (Point, LineString o Polygon)

#### Tipos de amenazas:
1. **earthquake**: Eventos sísmicos
2. **forest_fire**: Incendios forestales
3. **extreme_weather**: Eventos climáticos extremos

### Earthquakes (Legacy)
Contiene ubicaciones históricas de terremotos con información de magnitud. Esta tabla se mantiene por compatibilidad pero se recomienda usar la tabla `threats`.

## Verificación

Después de ejecutar el script, puedes verificar los datos en Supabase:

1. Ve a la sección **Table Editor**
2. Selecciona cada tabla para ver los datos cargados
3. Usa la vista de mapa para visualizar las geometrías
