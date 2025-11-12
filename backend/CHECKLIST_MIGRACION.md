# ✅ Checklist de Migración a Supabase

Usa este checklist para asegurarte de completar todos los pasos necesarios.

## 📋 Pre-requisitos

- [ ] Node.js 18+ instalado
- [ ] npm instalado
- [ ] Git configurado
- [ ] Cuenta de Supabase creada (https://supabase.com)

## 🔧 Configuración Inicial

### 1. Preparación del Proyecto

- [ ] Navegar a la carpeta del backend
  ```bash
  cd backend
  ```

- [ ] Instalar dependencias (incluye Supabase)
  ```bash
  npm install
  ```

- [ ] Verificar que `@supabase/supabase-js` esté instalado
  ```bash
  npm list @supabase/supabase-js
  ```

### 2. Crear Proyecto en Supabase

- [ ] Ir a https://supabase.com/dashboard
- [ ] Click en "New Project"
- [ ] Llenar los datos:
  - [ ] Nombre del proyecto: `fiber-network` (o el que prefieras)
  - [ ] Database Password: (usa un password fuerte)
  - [ ] Region: (elige la más cercana)
  - [ ] Pricing Plan: (Free tier es suficiente para desarrollo)
- [ ] Esperar a que el proyecto se cree (2-3 minutos)

### 3. Obtener Credenciales

- [ ] En Supabase Dashboard, ir a **Settings** → **API**
- [ ] Copiar y guardar:
  - [ ] **Project URL** (ej: `https://xxxxx.supabase.co`)
  - [ ] **anon** public key
  - [ ] **service_role** secret key (¡mantenerla segura!)

- [ ] En Supabase Dashboard, ir a **Settings** → **Database**
- [ ] Anotar:
  - [ ] Host (ej: `db.xxxxx.supabase.co`)
  - [ ] Database name: `postgres`
  - [ ] Port: `5432`
  - [ ] User (ej: `postgres.xxxxx`)
  - [ ] Password (el que usaste al crear el proyecto)

### 4. Configurar Variables de Entorno

- [ ] Copiar el archivo de ejemplo
  ```bash
  cp .env.example .env
  ```

- [ ] Editar `.env` con tus credenciales:
  ```bash
  nano .env
  # o
  code .env
  ```

- [ ] Rellenar las variables:
  ```env
  PORT=5001
  NODE_ENV=development

  # Supabase Configuration
  SUPABASE_URL=https://tu-proyecto.supabase.co
  SUPABASE_ANON_KEY=tu-anon-key-aqui
  SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

  # Database Configuration
  DB_HOST=db.tu-proyecto.supabase.co
  DB_PORT=5432
  DB_NAME=postgres
  DB_USER=postgres.tu-proyecto
  DB_PASSWORD=tu-password-aqui
  ```

- [ ] Guardar el archivo `.env`
- [ ] Verificar que `.env` esté en `.gitignore`

## 🗄️ Configuración de Base de Datos

### 5. Habilitar Extensiones

- [ ] En Supabase Dashboard, ir a **Database** → **Extensions**
- [ ] Buscar y habilitar las siguientes extensiones:
  - [ ] `postgis` - Para datos geoespaciales
  - [ ] `pgrouting` - Para algoritmos de ruteo
  - [ ] `uuid-ossp` - Para UUIDs
  - [ ] `pg_trgm` - Para búsquedas de texto (opcional)

### 6. Ejecutar Migraciones SQL

- [ ] En Supabase Dashboard, ir a **SQL Editor**
- [ ] Ejecutar los scripts en orden:

  **Script 1: Inicialización de Supabase**
  - [ ] Copiar contenido de `migrations/000_supabase_init.sql`
  - [ ] Pegar en SQL Editor
  - [ ] Click en "Run"
  - [ ] Verificar que no hay errores

  **Script 2: Crear Tablas**
  - [ ] Copiar contenido de `../schema.sql` (raíz del proyecto)
  - [ ] Pegar en SQL Editor
  - [ ] Click en "Run"
  - [ ] Verificar que las tablas se crearon

  **Script 3: Migraciones adicionales**
  - [ ] Ejecutar `migrations/004_add_probabilities.sql`
  - [ ] Ejecutar `migrations/005_add_simulation.sql`
  - [ ] Ejecutar `migrations/006_fix_routing_functions.sql`

### 7. Verificar Tablas Creadas

- [ ] En Supabase Dashboard, ir a **Table Editor**
- [ ] Verificar que existan las siguientes tablas:
  - [ ] `fiber_nodes`
  - [ ] `fiber_links`
  - [ ] `datacenters`
  - [ ] `earthquakes`
  - [ ] `forest_fires`
  - [ ] `extreme_weather`
  - [ ] `ground_type`
  - [ ] `node_probabilities`
  - [ ] `edge_probabilities`

## 📊 Carga de Datos

### 8. Cargar Datos Iniciales

- [ ] Ir a la carpeta de scripts
  ```bash
  cd ../scripts
  ```

- [ ] Actualizar credenciales en `quick_load_data.py` si es necesario
  
- [ ] Ejecutar script de carga
  ```bash
  python3 quick_load_data.py
  ```

- [ ] Esperar a que termine (puede tomar varios minutos)

- [ ] Verificar en Supabase Table Editor que hay datos

### 9. Verificar Datos en Supabase

- [ ] En Table Editor, revisar cada tabla:
  - [ ] `fiber_nodes` - debe tener nodos
  - [ ] `fiber_links` - debe tener enlaces
  - [ ] `datacenters` - debe tener datacenters
  - [ ] Otras tablas según los datos disponibles

## 🧪 Testing

### 10. Test de Conexión

- [ ] Volver a la carpeta backend
  ```bash
  cd ../backend
  ```

- [ ] Ejecutar el script de test
  ```bash
  npm run test:supabase
  ```

- [ ] Verificar que todos los tests pasen:
  - [ ] ✅ Supabase client connection successful
  - [ ] ✅ PostgreSQL pool connection successful
  - [ ] ✅ PostGIS is available
  - [ ] ✅ pgRouting is available
  - [ ] ✅ Found tables (lista de tablas)

### 11. Ejecutar el Backend

- [ ] Iniciar el servidor en modo desarrollo
  ```bash
  npm run dev
  ```

- [ ] Verificar que inicia sin errores
- [ ] Deberías ver:
  - [ ] `✅ Supabase client initialized`
  - [ ] `✅ PostgreSQL pool connected successfully`
  - [ ] `🚀 Server running on port 5001`

### 12. Probar Endpoints

- [ ] Abrir un navegador o usar curl/Postman

- [ ] Probar endpoint de health check:
  ```bash
  curl http://localhost:5001/health
  ```
  - [ ] Debe retornar `{"status":"OK",...}`

- [ ] Probar endpoint de infraestructura:
  ```bash
  curl http://localhost:5001/api/infrastructure/nodes?limit=5
  ```
  - [ ] Debe retornar GeoJSON con nodos

- [ ] Probar endpoint de datacenters:
  ```bash
  curl http://localhost:5001/api/metadata/datacenters?limit=5
  ```
  - [ ] Debe retornar GeoJSON con datacenters

## 🔍 Verificación Final

### 13. Checklist de Funcionalidad

- [ ] Backend inicia sin errores
- [ ] Conexión a Supabase exitosa
- [ ] PostGIS funciona correctamente
- [ ] pgRouting disponible
- [ ] Endpoints responden correctamente
- [ ] Datos se cargan correctamente

### 14. Documentación

- [ ] Leer `SUPABASE_SETUP.md` completo
- [ ] Revisar `BEST_PRACTICES.md`
- [ ] Guardar credenciales de Supabase en lugar seguro
- [ ] Documentar cualquier problema encontrado

## 🚀 Despliegue (Opcional)

### 15. Preparar para Producción

- [ ] Configurar variables de entorno en plataforma de hosting
- [ ] Usar Connection Pooler en producción:
  ```env
  DB_HOST=aws-0-us-west-1.pooler.supabase.com
  DB_PORT=6543
  ```
- [ ] Configurar políticas RLS apropiadas
- [ ] Habilitar backups automáticos (ya están por defecto)
- [ ] Configurar monitoreo de performance

## ⚠️ Troubleshooting

Si algo falla, revisa:

- [ ] Variables de entorno en `.env` son correctas
- [ ] Extensiones PostGIS y pgRouting están habilitadas
- [ ] Firewall/IP no está bloqueando conexión
- [ ] Password de base de datos es correcto
- [ ] Proyecto de Supabase está activo

## 📚 Recursos Adicionales

- [ ] [Documentación oficial de Supabase](https://supabase.com/docs)
- [ ] [PostGIS + Supabase](https://supabase.com/docs/guides/database/extensions/postgis)
- [ ] Ver ejemplos en `routes/examples-supabase.js`
- [ ] Leer `BEST_PRACTICES.md` para optimización

## ✅ Migración Completada

Cuando todos los checkboxes estén marcados:

- [ ] **MIGRACIÓN EXITOSA** 🎉
- [ ] Backend funciona con Supabase
- [ ] Datos cargados correctamente
- [ ] Listo para desarrollo

---

**Fecha:** _______________  
**Completado por:** _______________  
**Notas adicionales:**

_______________________________________________
_______________________________________________
_______________________________________________
