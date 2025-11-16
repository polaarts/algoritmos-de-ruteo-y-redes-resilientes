# 🗄️ Configuración de Supabase

Guía completa para configurar Supabase como base de datos del proyecto.

## ¿Qué es Supabase?

Supabase es una alternativa open-source a Firebase que proporciona:
- PostgreSQL con extensión PostGIS para datos geoespaciales
- API REST automática
- Autenticación
- Storage para archivos

## Configuración Inicial

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Espera ~2 minutos a que el proyecto esté listo

### 2. Obtener Credenciales

En el dashboard de tu proyecto:

1. Ve a **Settings** > **API**
2. Copia los siguientes valores:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **API Key (anon/public)**: `eyJhbG...`
   - **API Key (service_role)**: `eyJhbG...`

3. Ve a **Settings** > **Database**
4. Copia el **Connection String** del **Connection Pooler**:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

### 3. Configurar Variables de Entorno

Crea o edita el archivo `.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

⚠️ **Importante**: Usa siempre el **Connection Pooler** para evitar problemas de IPv6.

### 4. Ejecutar Migraciones

```bash
# Opción 1: Usando el SQL Editor de Supabase
# 1. Ve a SQL Editor en el dashboard
# 2. Copia y pega el contenido de database/schema.sql
# 3. Ejecuta

# Opción 2: Usando psql local
psql "$DATABASE_URL" < database/schema.sql

# Opción 3: Usando el script de inicialización
npm run db:init
```

## Estructura de la Base de Datos

### Tablas Principales

#### `nodes` - Nodos de la red
```sql
- id: SERIAL PRIMARY KEY
- osm_id: BIGINT
- geom: GEOMETRY(Point, 4326)
- city: VARCHAR
- region: VARCHAR
- node_type: VARCHAR
```

#### `edges` - Enlaces de fibra óptica
```sql
- id: SERIAL PRIMARY KEY
- source: INTEGER (FK → nodes)
- target: INTEGER (FK → nodes)
- geom: GEOMETRY(LineString, 4326)
- length_km: NUMERIC
- probability_failure: NUMERIC
- fiber_type: VARCHAR
```

#### `datacenters` - Centros de datos
```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR
- geom: GEOMETRY(Point, 4326)
- capacity: VARCHAR
- operator: VARCHAR
```

#### `threats` - Amenazas naturales
```sql
- id: SERIAL PRIMARY KEY
- threat_type: VARCHAR (earthquake, fire, weather)
- geom: GEOMETRY
- magnitude: NUMERIC
- date: TIMESTAMP
- affected_area_km2: NUMERIC
```

### Funciones PostGIS

El proyecto usa extensiones de PostGIS para:
- Cálculo de distancias: `ST_Distance`
- Intersecciones: `ST_Intersects`
- Buffers: `ST_Buffer`
- Análisis de proximidad: `ST_DWithin`

## Gestión de la Base de Datos

### Conectarse desde línea de comandos

```bash
# Usando psql
psql "$DATABASE_URL"

# Listar tablas
\dt

# Describir tabla
\d nodes

# Ejecutar consulta
SELECT COUNT(*) FROM nodes;
```

### Backups

```bash
# Crear backup
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql "$DATABASE_URL" < backup_20240101.sql
```

### Consultas Útiles

```sql
-- Verificar extensiones instaladas
SELECT * FROM pg_extension;

-- Contar registros por tabla
SELECT 
  schemaname,
  tablename,
  n_tup_ins - n_tup_del as row_count
FROM pg_stat_user_tables;

-- Ver tamaño de tablas
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables
WHERE schemaname = 'public';
```

## Troubleshooting

### Error ENETUNREACH (IPv6)

Si ves este error:
```
Error: connect ENETUNREACH 2600:1f18:...
```

**Solución**: Asegúrate de usar el **Connection Pooler** en lugar de la conexión directa.

Ver: [docs/troubleshooting/SUPABASE_CONNECTION.md](../troubleshooting/SUPABASE_CONNECTION.md)

### Límite de conexiones

Supabase Free tier tiene límites:
- **Conexiones directas**: 60
- **Connection Pooler**: 200

**Recomendación**: Usa siempre el Connection Pooler.

### Permisos insuficientes

Si no puedes crear tablas, verifica que estés usando `SUPABASE_SERVICE_KEY` en lugar de `SUPABASE_ANON_KEY`.

## Migraciones

### Crear una nueva migración

```bash
# Crear archivo de migración
npm run migrate:create nombre_migracion

# Aplicar migraciones pendientes
npm run migrate:up

# Revertir última migración
npm run migrate:down
```

### Estructura de migraciones

Las migraciones están en `database/migrations/`:
```
database/
  migrations/
    001_initial_schema.sql
    002_add_threats_table.sql
    003_add_indexes.sql
```

## Próximos Pasos

- [Configuración con Docker](DOCKER_SETUP.md)
- [Desarrollo Local](../development/LOCAL_DEVELOPMENT.md)
- [Esquema de Base de Datos](../DATABASE.md)

## Referencias

- [Supabase Docs](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
