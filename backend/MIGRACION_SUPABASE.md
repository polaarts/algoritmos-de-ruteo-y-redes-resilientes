# Guía Rápida de Migración a Supabase

## ✅ Cambios Implementados

1. **Dependencias actualizadas**
   - Agregado `@supabase/supabase-js` para el cliente de Supabase
   - Mantenido `pg` para consultas PostgreSQL directas

2. **Configuración de base de datos actualizada**
   - `config/database.js` ahora soporta conexión dual:
     - Cliente Supabase para operaciones simples
     - Pool PostgreSQL para consultas complejas con PostGIS/pgRouting

3. **Variables de entorno actualizadas**
   - `.env.example` actualizado con credenciales de Supabase
   - Agregadas: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

4. **Documentación creada**
   - `SUPABASE_SETUP.md` - Guía completa de configuración
   - `test-supabase.js` - Script de verificación de conexión

## 🚀 Pasos para Completar la Migración

### 1. Crear proyecto en Supabase

```bash
# 1. Ve a https://supabase.com y crea un proyecto
# 2. Anota tus credenciales (URL, anon key, service_role key)
```

### 2. Configurar variables de entorno

```bash
cd backend
cp .env.example .env
# Edita .env con tus credenciales de Supabase
```

### 3. Habilitar extensiones en Supabase

En tu proyecto de Supabase:
1. Ve a **Database** > **Extensions**
2. Busca y habilita:
   - `postgis`
   - `pgrouting`
   - `uuid-ossp`
   - `pg_trgm`

### 4. Ejecutar migraciones

```bash
# En Supabase SQL Editor, ejecuta en orden:
# 1. migrations/000_supabase_init.sql
# 2. schema.sql (desde la raíz del proyecto)
# 3. migrations/004_add_probabilities.sql
# 4. migrations/005_add_simulation.sql
# 5. migrations/006_fix_routing_functions.sql
```

### 5. Cargar datos iniciales

```bash
cd ../scripts
python3 quick_load_data.py
```

### 6. Probar la conexión

```bash
cd backend
npm run test:supabase
```

Si todo está correcto, deberías ver:
```
✅ Supabase client connection successful
✅ PostgreSQL pool connection successful
✅ PostGIS is available
✅ pgRouting is available
```

### 7. Ejecutar el backend

```bash
npm run dev
```

## 🔧 Solución de Problemas

### Error: "Extension postgis not found"
**Solución:** Habilita PostGIS en Supabase Dashboard > Database > Extensions

### Error: "Connection timeout"
**Solución:** 
1. Verifica que las credenciales en `.env` sean correctas
2. Comprueba que tu IP esté permitida (Supabase permite todas por defecto)

### Error: "SSL required"
**Solución:** La configuración ya incluye SSL automáticamente para Supabase

### Error: "Row Level Security policy violation"
**Solución:** Ejecuta `migrations/000_supabase_init.sql` para configurar las políticas

## 📊 Estructura de Conexión

El backend ahora usa dos métodos de conexión:

```javascript
// 1. Cliente Supabase (para CRUD simple)
const { data, error } = await supabase
  .from('datacenters')
  .select('*')
  .limit(10);

// 2. Pool PostgreSQL (para consultas complejas)
const result = await pool.query(`
  SELECT ST_AsGeoJSON(geometry) 
  FROM fiber_links 
  WHERE region = $1
`, ['Metropolitana']);
```

## 🎯 Próximos Pasos Opcionales

1. **Configurar Row Level Security (RLS)**
   - Define políticas de seguridad granulares
   - Implementa autenticación de usuarios

2. **Usar Supabase Realtime**
   - Subscripciones en tiempo real a cambios en datos
   - Útil para dashboards en vivo

3. **Integrar Supabase Storage**
   - Almacenar archivos GeoJSON
   - Backups automáticos de datos

4. **Desplegar backend**
   - Vercel, Railway, Render, etc.
   - Las credenciales de Supabase funcionan desde cualquier lugar

## 📚 Recursos

- [Documentación completa](./SUPABASE_SETUP.md)
- [Supabase Docs](https://supabase.com/docs)
- [PostGIS + Supabase](https://supabase.com/docs/guides/database/extensions/postgis)

## ✨ Diferencias con PostgreSQL Local

| Aspecto | PostgreSQL Local | Supabase |
|---------|------------------|----------|
| Hosting | Tu servidor | Cloud gestionado |
| SSL | Opcional | Requerido (incluido) |
| Backups | Manual | Automático |
| Escalabilidad | Manual | Automática |
| API REST | No incluida | Generada automáticamente |
| Dashboard | pgAdmin | Supabase Dashboard |
| Costo | Servidor propio | Free tier + pay-as-you-go |

¡Listo! Tu backend ahora está configurado para usar Supabase. 🎉
