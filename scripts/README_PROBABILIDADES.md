# Carga de Datos con Probabilidades a Supabase

Este documento explica cómo se cargaron los datos de la red con sus probabilidades calculadas a Supabase.

## 📋 Resumen del Proceso

Se ejecutaron 3 scripts principales para poblar la base de datos con:
1. **Datacenters** (51 nodos)
2. **Metadata geográfica** (tipos de suelo)
3. **Red de fibra óptica** (51 nodos + 1,032 enlaces con probabilidades)

## 🗂️ Estructura de Datos Cargada

### 1. Datacenters (`datacenters` table)
- **Registros**: 51 datacenters en Chile
- **Campos normalizados**:
  - Ubicación geográfica (geometría Point)
  - Capacidad estimada (MW)
  - Tier level (2-3)
  - Año de apertura estimado
  - Densidad urbana
  - Población en radio de 5km

### 2. Metadata Geográfica (`ground_type` table)
- **Registros**: 8 áreas sintéticas
- **Campos**:
  - Tipo de suelo (clay, sandy, rocky, mixed)
  - Estabilidad (stable, moderate, unstable)
  - Dificultad de instalación
  - Permeabilidad
  - Capacidad de carga

### 3. Nodos de Red (`fiber_nodes` table)
- **Registros**: 51 nodos (uno por datacenter)
- **Campos**:
  - Tipo: datacenter
  - Ubicación geográfica
  - Región y ciudad
  - Marcados como críticos
  - Nivel de redundancia: 3

### 4. Enlaces de Red (`fiber_links` table)
- **Registros**: 1,032 enlaces
- **Características**:
  - Conecta nodos hasta 100km de distancia
  - Enlaces bidireccionales
  - Capacidad: 10 Gbps por enlace

## 🎲 Cálculo de Probabilidades

Las probabilidades se calcularon considerando múltiples factores:

### Componentes de Riesgo

#### 1. **Probabilidad Base** (1%)
- Riesgo inherente de cualquier enlace de fibra óptica

#### 2. **Riesgo Ambiental** (variable)
Basado en:
- **Tipo de terreno** (clasificado por latitud):
  - Norte (> -24°): Desierto (4%)
  - Norte Chico (-24° a -32°): Mixto (2%)
  - Metropolitana (-32° a -34°): Urbano (1%)
  - Centro (-34° a -38°): Mixto (2%)
  - Sur (-38° a -42°): Bosque (3%)
  - Extremo sur (< -42°): Montañas (5%)

- **Estabilidad del suelo**:
  - Estable: 0%
  - Moderado: 2%
  - Inestable: 5%
  - Muy inestable: 10%

- **Distancia**: +1% por cada 200km

**Cap máximo**: 20%

#### 3. **Riesgo de Infraestructura** (variable)
Basado en:
- **Soporte de infraestructura**:
  - Alto: -1% (reduce riesgo)
  - Medio: 0%
  - Bajo: 2%
  - Ninguno: 5%

- **Cobertura/densidad urbana**:
  - Alta: -1% (reduce riesgo)
  - Media: 0%
  - Baja: 2%

### Fórmula Final

```
Riesgo Total = Base + Riesgo Ambiental + Riesgo Infraestructura
Costo del Enlace = Distancia (m) × (1 + Riesgo Total)
```

## 📊 Resultados Finales

### Estadísticas de la Red

```
✅ Red generada exitosamente

📊 Estadísticas:
   • Total de nodos: 51
   • Total de enlaces: 1,032
   
📍 Distribución geográfica:
   • Región Metropolitana: 1,032 enlaces (todos concentrados)
   
🔗 Tipos de enlaces:
   • Locales (<50km): 938 enlaces (91%)
   • Regionales (>50km): 94 enlaces (9%)
   
📏 Distancias:
   • Promedio: 17.51 km
   • Mínima: 0.00 km (nodos colocalizados)
   • Máxima: 98.08 km
```

## 🛠️ Scripts Ejecutados

### 1. Cargar Datacenters
```bash
node scripts/load_datacenters.js
```
- Normaliza y carga 51 datacenters
- Estima campos faltantes (capacity, tier_level, etc.)

### 2. Cargar Metadata Geográfica
```bash
node scripts/load_metadata_to_supabase.js
```
- Carga tipos de suelo (ground_type)
- Genera datos sintéticos si no hay datos reales con geometría

### 3. Generar Red con Probabilidades
```bash
node scripts/generate_network_with_probabilities.js
```
- Crea nodos desde datacenters
- Genera enlaces entre nodos cercanos (<100km)
- Calcula probabilidades de falla
- Asigna costos basados en distancia y riesgo

## 🚀 Cómo Ejecutar Todo

### Opción 1: Scripts individuales
```bash
# 1. Cargar datacenters
node scripts/load_datacenters.js

# 2. Cargar metadata
node scripts/load_metadata_to_supabase.js

# 3. Generar red
node scripts/generate_network_with_probabilities.js
```

### Opción 2: Script completo (desde package.json)
```bash
cd scripts
npm run setup-all
```

## 📝 Notas Importantes

1. **Probabilidades almacenadas**: Como la tabla `fiber_links` no tiene columnas específicas para probabilidades, estas se almacenan en el campo `recubrimiento_estim` como metadata.

2. **Tabla edge_probabilities**: El schema tiene una tabla separada `edge_probabilities` para almacenar probabilidades detalladas. Se puede popular posteriormente si es necesario.

3. **Datos sintéticos**: La metadata geográfica usa datos sintéticos porque los archivos GeoJSON originales no tienen geometrías válidas.

4. **Conectividad**: Los nodos se conectan si están a menos de 100km de distancia, resultando en una red altamente conectada.

## 🔄 Actualizar Datos

Para regenerar la red:

```bash
# Esto limpiará y regenerará todo
node scripts/generate_network_with_probabilities.js
```

**⚠️ Advertencia**: Esto eliminará todos los nodos y enlaces existentes.

## 📚 Próximos Pasos

Para usar estas probabilidades en los algoritmos de ruteo:

1. **Consultar probabilidades** desde `recubrimiento_estim`
2. **Poblar `edge_probabilities`** con datos detallados
3. **Usar en pgRouting** ajustando costos por probabilidad:
   ```sql
   cost * (1 / (1 - total_failure_probability))
   ```

## 🆘 Solución de Problemas

### Error: "relation does not exist"
Asegúrate de que el schema está aplicado:
```bash
psql -d postgres -f schema.sql
```

### Error: "Invalid endian flag"
Actualizado en el script - usa `geometry::geography` en las consultas.

### No se insertan datos
Verifica la conexión en `backend/.env`:
```env
DB_HOST=your-host.supabase.co
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password
```
