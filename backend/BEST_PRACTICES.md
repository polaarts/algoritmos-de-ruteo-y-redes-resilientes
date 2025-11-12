# Mejores Prácticas con Supabase

## 🎯 Cuándo usar cada método de conexión

### Cliente Supabase (`@supabase/supabase-js`)

**✅ Usar para:**
- Operaciones CRUD simples (SELECT, INSERT, UPDATE, DELETE)
- Autenticación y autorización de usuarios
- Row Level Security (RLS) policies
- Realtime subscriptions
- Storage de archivos
- Consultas sin funciones espaciales complejas

**Ejemplo:**
```javascript
const { data, error } = await supabase
  .from('datacenters')
  .select('*')
  .eq('city', 'Santiago')
  .limit(10);
```

### Pool PostgreSQL (`pg`)

**✅ Usar para:**
- Consultas con PostGIS (ST_Distance, ST_DWithin, ST_AsGeoJSON)
- Operaciones con pgRouting (pgr_dijkstra, pgr_astar)
- Funciones SQL personalizadas
- Transacciones complejas
- JOINs espaciales múltiples
- Consultas con parámetros posicionales ($1, $2)

**Ejemplo:**
```javascript
const result = await query(`
  SELECT 
    ST_AsGeoJSON(geometry) as geometry,
    ST_Distance(geometry::geography, $1::geography) as distance
  FROM fiber_links
  WHERE region = $2
`, [point, 'Metropolitana']);
```

## 🔒 Seguridad

### Row Level Security (RLS)

Supabase habilita RLS por defecto. Para desarrollo:

```sql
-- Desactivar RLS (solo para desarrollo)
ALTER TABLE datacenters DISABLE ROW LEVEL SECURITY;

-- Política de lectura pública
CREATE POLICY "Allow public read" 
ON datacenters FOR SELECT 
USING (true);

-- Política de escritura solo para service_role
CREATE POLICY "Allow service role all" 
ON datacenters FOR ALL 
USING (auth.role() = 'service_role');
```

### Variables de Entorno

**❌ NUNCA** commitees el archivo `.env` con credenciales reales:

```bash
# .gitignore
.env
.env.local
.env.production
```

**✅ Usar:**
- `SUPABASE_SERVICE_ROLE_KEY` para backend (tiene todos los permisos)
- `SUPABASE_ANON_KEY` para frontend (respeta RLS)

## ⚡ Performance

### 1. Connection Pooler

Para producción, usa el connection pooler de Supabase:

```bash
# En .env
DB_HOST=aws-0-us-west-1.pooler.supabase.com
DB_PORT=6543  # Nota: puerto diferente
```

### 2. Índices

Crea índices para columnas frecuentemente consultadas:

```sql
-- Índice espacial
CREATE INDEX idx_datacenters_geometry 
ON datacenters USING GIST(geometry);

-- Índice en ciudad
CREATE INDEX idx_datacenters_city 
ON datacenters(city);

-- Índice compuesto
CREATE INDEX idx_datacenters_city_tier 
ON datacenters(city, tier_level);
```

### 3. Limitar resultados

Siempre usa LIMIT en consultas que pueden devolver muchos resultados:

```javascript
// ✅ Bueno
const { data } = await supabase
  .from('fiber_links')
  .select('*')
  .limit(100);

// ❌ Malo (puede devolver millones de filas)
const { data } = await supabase
  .from('fiber_links')
  .select('*');
```

### 4. Selección de columnas

Solo selecciona las columnas que necesitas:

```javascript
// ✅ Bueno
const { data } = await supabase
  .from('datacenters')
  .select('id, name, city');

// ❌ Malo (trae todas las columnas)
const { data } = await supabase
  .from('datacenters')
  .select('*');
```

## 🗄️ Migraciones

### Estructura recomendada

```
migrations/
├── 000_supabase_init.sql      # Configuración inicial
├── 001_create_tables.sql       # Crear tablas base
├── 002_create_indexes.sql      # Crear índices
├── 003_create_functions.sql    # Funciones personalizadas
├── 004_create_triggers.sql     # Triggers
└── 005_seed_data.sql           # Datos iniciales
```

### Orden de ejecución

1. Habilitar extensiones (PostGIS, pgRouting)
2. Crear tablas
3. Crear índices
4. Crear funciones y procedimientos
5. Configurar RLS
6. Cargar datos iniciales

## 🔄 Backup y Restore

### Backup automático

Supabase hace backups diarios automáticamente. Puedes:
- Ver backups en Dashboard > Database > Backups
- Descargar backup manual cuando quieras

### Backup programático

```bash
# Backup completo
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" > backup.sql

# Backup de una tabla
pg_dump -t datacenters "postgresql://..." > datacenters_backup.sql

# Restore
psql "postgresql://..." < backup.sql
```

## 📊 Monitoreo

### Logs en Supabase

Dashboard > Database > Logs muestra:
- Consultas lentas
- Errores
- Uso de recursos

### Logging en el código

```javascript
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log consultas lentas
    if (duration > 1000) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text);
    }
    
    return res;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
};
```

## 🌍 Consultas Geoespaciales

### PostGIS con Supabase

```javascript
// Distancia entre puntos
const result = await query(`
  SELECT 
    id,
    name,
    ST_Distance(
      geometry::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    ) / 1000 as distance_km
  FROM datacenters
  ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
  LIMIT 10
`, [lon, lat]);

// Puntos dentro de un polígono
const result = await query(`
  SELECT id, name
  FROM datacenters
  WHERE ST_Within(
    geometry,
    ST_GeomFromGeoJSON($1)
  )
`, [polygonGeoJSON]);

// Buffer alrededor de un punto
const result = await query(`
  SELECT 
    ST_AsGeoJSON(
      ST_Buffer(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3 * 1000
      )::geometry
    ) as buffer_geometry
`, [lon, lat, radiusKm]);
```

## 🚀 Despliegue

### Variables de entorno en producción

```bash
# Railway, Render, Vercel, etc.
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DB_HOST=db.xxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.xxxx
DB_PASSWORD=your-password
NODE_ENV=production
```

### Health checks

```javascript
app.get('/health', async (req, res) => {
  try {
    // Verificar Supabase
    const { error: supabaseError } = await supabase
      .from('datacenters')
      .select('count', { count: 'exact', head: true });
    
    // Verificar PostgreSQL
    await pool.query('SELECT 1');
    
    res.json({
      status: 'OK',
      database: {
        supabase: !supabaseError,
        postgresql: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      error: error.message
    });
  }
});
```

## 📝 Testing

### Test de conexión

```javascript
// test-connection.js
const { supabase, pool } = require('./config/database');

async function test() {
  // Test Supabase
  const { data, error } = await supabase
    .from('datacenters')
    .select('count', { count: 'exact', head: true });
  
  console.log('Supabase:', !error ? '✅' : '❌');
  
  // Test PostgreSQL
  const result = await pool.query('SELECT NOW()');
  console.log('PostgreSQL:', result.rows.length > 0 ? '✅' : '❌');
  
  await pool.end();
}

test();
```

## 🔍 Debugging

### Habilitar logs detallados

```javascript
// En database.js
const pool = new Pool({
  // ...config
  log: (msg) => console.log('PG LOG:', msg)
});

// En .env
DEBUG=*
NODE_ENV=development
```

### Ver queries ejecutadas

Supabase Dashboard > Database > Query Performance muestra:
- Queries más lentas
- Queries más frecuentes
- Uso de índices

## 📚 Recursos Útiles

- [Supabase Docs](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [pgRouting Documentation](https://docs.pgrouting.org/)
- [node-postgres (pg)](https://node-postgres.com/)

## 🎓 Ejemplos Completos

Ver archivo `routes/examples-supabase.js` para ejemplos prácticos de cada método.
