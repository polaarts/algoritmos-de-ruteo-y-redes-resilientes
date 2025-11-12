# Configuración de Supabase

Este proyecto ahora utiliza Supabase como base de datos PostgreSQL con soporte para PostGIS y pgRouting.

## Pasos para configurar Supabase

### 1. Crear un proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Guarda las credenciales que te proporciona Supabase:
   - URL del proyecto (ej: `https://xxxxxxxxxxxx.supabase.co`)
   - `anon` key (clave pública)
   - `service_role` key (clave privada - ¡mantenla segura!)

### 2. Habilitar extensiones necesarias

En el panel de Supabase, ve a **Database** > **Extensions** y habilita:

- ✅ `postgis` - Para datos geoespaciales
- ✅ `pgrouting` - Para algoritmos de ruteo
- ✅ `pg_trgm` - Para búsquedas de texto (opcional)

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales de Supabase:

```bash
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Database Configuration
DB_HOST=db.tu-proyecto.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.tu-proyecto
DB_PASSWORD=tu-password-de-supabase
```

### 4. Encontrar tus credenciales

En Supabase, ve a **Settings** > **API**:
- **Project URL**: Tu SUPABASE_URL
- **Project API keys**: 
  - `anon` `public`: SUPABASE_ANON_KEY
  - `service_role` `secret`: SUPABASE_SERVICE_ROLE_KEY

En Supabase, ve a **Settings** > **Database**:
- **Host**: DB_HOST
- **Database name**: postgres
- **Port**: 5432
- **User**: postgres
- **Password**: (usa el password que estableciste al crear el proyecto)

### 5. Connection Pooler (Recomendado para producción)

Para mejor rendimiento en producción, usa el connection pooler de Supabase:

```bash
DB_HOST=aws-0-us-west-1.pooler.supabase.com
DB_PORT=6543
```

### 6. Instalar dependencias

```bash
npm install
```

### 7. Migrar el esquema de base de datos

Ejecuta los scripts SQL de migración en Supabase:
1. Ve a **SQL Editor** en Supabase
2. Ejecuta el archivo `schema.sql` del proyecto
3. Ejecuta las migraciones en orden desde la carpeta `migrations/`

### 8. Cargar datos iniciales

Usa los scripts de Python para cargar datos:

```bash
cd ../scripts
python3 quick_load_data.py
```

### 9. Ejecutar el backend

```bash
npm run dev
```

## Funcionalidades de Supabase implementadas

### Conexión Dual

El backend ahora soporta dos métodos de conexión:

1. **Cliente Supabase** (`@supabase/supabase-js`):
   - Para operaciones CRUD simples
   - Autenticación y autorización de Supabase
   - Realtime subscriptions (futuro)

2. **Pool de PostgreSQL** (`pg`):
   - Para consultas complejas con PostGIS
   - Operaciones con pgRouting
   - Funciones SQL personalizadas

### Ventajas de usar Supabase

- ✅ **Hosting gestionado**: No necesitas mantener un servidor PostgreSQL
- ✅ **Backups automáticos**: Respaldos diarios de tu base de datos
- ✅ **SSL por defecto**: Conexiones seguras automáticas
- ✅ **API REST automática**: Supabase genera automáticamente una API REST
- ✅ **Dashboard visual**: Interfaz web para ver y editar datos
- ✅ **Escalabilidad**: Fácil de escalar según tus necesidades
- ✅ **Storage**: Puedes almacenar archivos si lo necesitas en el futuro

## Troubleshooting

### Error: "No rows were returned"
Asegúrate de que las extensiones PostGIS y pgRouting estén habilitadas.

### Error: "Connection timeout"
Verifica que tu IP esté en la whitelist de Supabase (Settings > Database > Connection pooling).

### Error: "SSL required"
Supabase requiere SSL por defecto. El código ya está configurado para esto.

### Permisos de Row Level Security (RLS)

Si obtienes errores de permisos, puedes desactivar RLS temporalmente para desarrollo:

```sql
ALTER TABLE datacenters DISABLE ROW LEVEL SECURITY;
ALTER TABLE fiber_links DISABLE ROW LEVEL SECURITY;
-- Repite para todas las tablas necesarias
```

## Recursos adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [PostGIS con Supabase](https://supabase.com/docs/guides/database/extensions/postgis)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Migración desde PostgreSQL local

Si tenías una base de datos PostgreSQL local, puedes exportar los datos:

```bash
pg_dump -h localhost -U postgres fiber_network > backup.sql
```

Y luego importarlos en Supabase usando el SQL Editor o la CLI.
