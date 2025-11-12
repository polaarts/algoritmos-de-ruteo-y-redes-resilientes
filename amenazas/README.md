# Extracción y Carga de Datos - Amenazas y Metadata

Este documento describe cómo extraer datos de amenazas y metadata desde APIs públicas y cargarlos en la base de datos Supabase.

## 📁 Estructura

```
amenazas/
├── clima_extremo.js              # Extrae datos meteorológicos (OpenWeatherMap)
├── incendios_forestales.js       # Extrae incendios forestales (CIREN)
├── seismicidad.js                # Extrae sismos (USGS)
├── extract_all_threats.js        # Integra todas las amenazas
├── adaptar_para_supabase.js      # Adapta al formato de BD
└── amenazas_para_supabase.json   # Salida lista para insertar

metadata/
├── ground_type.js                # Extrae uso de suelo (OpenStreetMap)
├── infraestructure_support.js    # Extrae vías (OpenStreetMap)
├── recubrimiento_estimado.js     # Estima tipo de recubrimiento
├── extract_all_metadata.js       # Integra toda la metadata
├── adaptar_para_supabase.js      # Adapta al formato de BD
└── metadata_para_supabase.json   # Salida lista para insertar

scripts/
└── cargar_datos_supabase.js      # Carga datos a Supabase
```

## 🚀 Uso Rápido

### 1. Extraer y Adaptar Amenazas

```bash
cd amenazas
npm install
npm run all  # Extrae datos de APIs y los adapta para Supabase
```

**Resultado:**
- `datos_integrados.json` - Datos crudos de las APIs
- `amenazas_para_supabase.json` - Datos adaptados para insertar

### 2. Extraer y Adaptar Metadata

```bash
cd metadata
npm install
npm run all  # Extrae datos de OSM y los adapta para Supabase
```

**Resultado:**
- `metadata_infraestructura_final.json` - Datos crudos de OSM
- `metadata_para_supabase.json` - Datos adaptados para insertar

### 3. Cargar a Supabase

```bash
cd scripts
node cargar_datos_supabase.js
```

## 📊 Datos Extraídos

### Amenazas

#### 1. **Sismos** (`earthquakes`)
- **Fuente:** USGS Earthquake API
- **Periodo:** Últimos 30 días (configurable)
- **Área:** Chile completo (-56° a -17° lat)
- **Campos:**
  - `usgs_id`: ID único del USGS
  - `magnitude`: Magnitud del sismo
  - `time`: Fecha/hora
  - `place`: Ubicación descriptiva
  - `geometry`: Punto del epicentro
  - `threat_level`: Calculado automáticamente según magnitud

#### 2. **Zonas de Riesgo de Incendio** (`fire_risk_zones`)
- **Fuente:** CIREN (MapServer)
- **Cobertura:** Incendios forestales históricos en Chile
- **Procesamiento:** Agrupa incendios por comuna para crear zonas
- **Campos:**
  - `zone_name`: Comuna, Región
  - `risk_level`: low, medium, high, extreme
  - `area_km2`: Superficie afectada
  - `fire_frequency`: Frecuencia de incendios
  - `high_risk_months`: Meses de alto riesgo
  - `geometry`: Punto representativo

#### 3. **Eventos Climáticos** (`weather_events`)
- **Fuente:** OpenWeatherMap API
- **Datos:** Condiciones actuales
- **Condiciones detectadas:**
  - Precipitación extrema (>50mm = extreme)
  - Vientos fuertes (>60 km/h = high)
  - Temperaturas extremas (<0°C o >35°C)
- **Campos:**
  - `event_type`: storm, wind, heatwave, cold
  - `severity`: low, medium, high, extreme
  - `max_wind_speed`, `precipitation_mm`, `temperature_c`
  - `geometry`: Punto de medición

### Metadata

#### 1. **Tipo de Suelo** (`ground_type`)
- **Fuente:** OpenStreetMap (landuse tags)
- **Área:** Centro de Concepción (~2km x 2km)
- **Clasificación:** 404 áreas
- **Mapeo:**
  - `residential/commercial` → urban_developed, stable
  - `industrial` → compacted, difficult
  - `forest` → organic, moderate
  - `farmland/grass` → agricultural, easy
  - `wetland` → saturated, unstable
- **Campos:**
  - `soil_type`: Tipo de suelo
  - `stability`: stable, moderate, unstable
  - `installation_difficulty`: easy, moderate, difficult, very_difficult
  - `permeability`: high, medium, low
  - `bearing_capacity`: Capacidad de carga (kg/cm²)

#### 2. **Vías de Infraestructura** (`fiber_links` metadata)
- **Fuente:** OpenStreetMap (highway tags)
- **Filtro:** Solo vías principales (motorway, trunk, primary, secondary, tertiary)
- **Cantidad:** 345 vías
- **Campos:**
  - `highway`: Tipo de vía
  - `name`: Nombre de la calle/ruta
  - `surface`: paved, unpaved, asphalt, concrete, etc.
  - `lanes`: Número de carriles
  - `maxspeed`: Velocidad máxima
  - `oneway`: Dirección única
  - `bridge`, `tunnel`: Características especiales

#### 3. **Recubrimiento Estimado**
- **Lógica:** Estimación heurística según tipo de vía
- **Clasificación:**
  - Autopistas/rutas principales → "armored / PE exterior"
  - Vías secundarias → "outdoor robust (PE o con armadura parcial)"
  - Calles locales pavimentadas → "LSZH / interior / estándar"
  - Calles no pavimentadas → "armored / robust"

## 🔧 Configuración

### Variables de Entorno

Asegúrate de configurar las credenciales en `backend/config/database.js`:

```javascript
SUPABASE_URL=tu_url_de_supabase
SUPABASE_KEY=tu_clave_de_supabase
```

### API Keys

Para extraer datos necesitas:

1. **OpenWeatherMap API Key** (amenazas/clima_extremo.js)
   - Obtener en: https://openweathermap.org/api
   - Reemplazar en el código

## 📝 Scripts Disponibles

### Amenazas

```bash
npm run extract    # Solo extraer datos de APIs
npm run adaptar    # Solo adaptar datos existentes
npm run all        # Extraer + adaptar
npm run clima      # Solo datos de clima
npm run incendios  # Solo incendios
npm run sismos     # Solo sismos
```

### Metadata

```bash
npm run extract         # Solo extraer datos de OSM
npm run adaptar         # Solo adaptar datos existentes
npm run all             # Extraer + adaptar
npm run ground          # Solo uso de suelo
npm run infrastructure  # Solo vías
npm run recubrimiento   # Solo recubrimiento
```

## ⚠️ Limitaciones y Consideraciones

### Overpass API (OpenStreetMap)
- **Timeout:** 180 segundos máximo por consulta
- **Área:** Limitada a ~2km x 2km para evitar timeouts
- **Rate Limit:** No hacer consultas muy frecuentes
- **Solución:** Para áreas más grandes, dividir en tiles o usar Planet OSM

### OpenWeatherMap
- **Plan gratuito:** 60 llamadas/minuto, 1,000,000 llamadas/mes
- **Datos actuales:** Solo condiciones presentes
- **Históricos:** Requiere plan de pago

### CIREN (Incendios)
- **Datos públicos:** Sin autenticación
- **Actualización:** Dataset histórico, no tiempo real
- **Tamaño:** ~2000 registros actuales

### USGS (Sismos)
- **Datos públicos:** Sin autenticación
- **Cobertura:** Mundial, filtrado por Chile
- **Periodo:** Configurable en la consulta

## 🗺️ Área de Cobertura Actual

**Coordenadas:** Centro de Concepción
- Latitud: -36.83 a -36.81 (0.02°)
- Longitud: -73.06 a -73.04 (0.02°)
- Tamaño: ~2km x 2km

**Para cambiar el área:** Editar las coordenadas en:
- `metadata/extract_all_metadata.js`
- `metadata/ground_type.js`
- `metadata/infraestructure_support.js`

## 🔄 Flujo de Datos

```
APIs Externas
    ↓
extract_all_*.js (Integración)
    ↓
datos_integrados.json / metadata_infraestructura_final.json
    ↓
adaptar_para_supabase.js (Transformación)
    ↓
*_para_supabase.json (Formato BD)
    ↓
cargar_datos_supabase.js (Inserción)
    ↓
Supabase (Base de Datos)
```

## 📚 Referencias

- **Schema BD:** `schema.sql`
- **Documentación Overpass:** https://wiki.openstreetmap.org/wiki/Overpass_API
- **USGS Earthquake API:** https://earthquake.usgs.gov/fdsnws/event/1/
- **OpenWeatherMap:** https://openweathermap.org/api
- **CIREN:** https://www.ciren.cl/

## 🐛 Troubleshooting

### Error 504 (Timeout) en Overpass
**Problema:** El área de consulta es muy grande
**Solución:** Reducir el bounding box en los scripts de metadata

### Error ENOENT al adaptar
**Problema:** No se han extraído los datos primero
**Solución:** Ejecutar `npm run extract` antes de `npm run adaptar`

### Error de conexión a Supabase
**Problema:** Credenciales incorrectas o no configuradas
**Solución:** Verificar `backend/config/database.js` y variables de entorno

### Datos duplicados en BD
**Problema:** Ejecutar la carga múltiples veces
**Solución:** Limpiar las tablas antes o verificar `usgs_id` (unique constraint)

## 📈 Próximos Pasos

1. **Automatización:** Crear cron jobs para actualización periódica
2. **Cobertura:** Expandir área geográfica con procesamiento por tiles
3. **Validación:** Agregar más validaciones de calidad de datos
4. **Históricos:** Integrar datos históricos de clima
5. **Tiempo Real:** Webhooks para eventos sísmicos en tiempo real
