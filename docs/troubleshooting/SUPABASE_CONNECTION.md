# 🔧 Solución: Error de Conexión a Supabase (ENETUNREACH IPv6)

## Problema

Al intentar conectar con Supabase, el backend falla con:

```
Error: connect ENETUNREACH 2600:1f18:2357:...:443
```

## Causa

Node.js intenta conectarse usando **IPv6**, pero:
1. Tu red local no soporta IPv6
2. O Docker no tiene IPv6 configurado correctamente
3. La URL de conexión directa usa IPv6

## Solución

### Usar Connection Pooler en lugar de Conexión Directa

El **Connection Pooler** de Supabase usa IPv4 y es más estable.

#### ❌ Antes (Conexión Directa - IPv6)
```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

#### ✅ Después (Connection Pooler - IPv4)
```bash
DATABASE_URL=postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Pasos para Aplicar

### 1. Obtener tu Connection String del Pooler

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **Settings** > **Database**
3. Busca la sección **Connection Pooler**
4. Copia la **Connection String** (Transaction Mode)

### 2. Actualizar `.env`

```bash
# Reemplazar
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# Por (ajusta según tu proyecto)
DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 3. Reiniciar Docker

```bash
# Detener servicios
docker compose down

# Levantar nuevamente
docker compose up -d

# Verificar logs
docker compose logs -f backend
```

### 4. Verificar Conexión

```bash
# Ver logs del backend
docker compose logs backend

# Deberías ver:
# ✅ Supabase client initialized
# 🗄️  Database: aws-0-us-east-1.pooler.supabase.com

# Probar endpoint de salud
curl http://localhost:3000/api/health
```

## Connection Pooler por Región

Supabase usa diferentes dominios según la región:

| Región | Pooler Domain |
|--------|---------------|
| US East | `aws-0-us-east-1.pooler.supabase.com` |
| EU West | `aws-0-eu-west-1.pooler.supabase.com` |
| Southeast Asia | `aws-0-ap-southeast-1.pooler.supabase.com` |

## ¿Qué es el Connection Pooler?

El **Connection Pooler** es un proxy que:
- ✅ Gestiona un pool de conexiones reutilizables
- ✅ Usa IPv4 (más compatible)
- ✅ Soporta más conexiones concurrentes (200 vs 60)
- ✅ Mejor rendimiento para aplicaciones escalables

### Transaction Mode vs Session Mode

**Transaction Mode** (Puerto 6543):
- Una conexión por transacción
- Más eficiente para APIs REST
- **Recomendado para este proyecto**

**Session Mode** (Puerto 5432):
- Conexión persistente
- Necesario para transacciones largas
- Usa más recursos

## Alternativas si el Problema Persiste

### Opción 1: Forzar IPv4 en Node.js

Agregar en `backend/config/database.js`:

```javascript
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
```

### Opción 2: Usar Supabase-js Client

En lugar de conexión PostgreSQL directa, usar el cliente de Supabase:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
```

### Opción 3: Configurar IPv6 en Docker

Editar `docker-compose.yml`:

```yaml
services:
  backend:
    # ... resto de la configuración
    sysctls:
      - net.ipv6.conf.all.disable_ipv6=1
```

## Verificación Final

Una vez aplicada la solución, deberías poder:

```bash
# 1. Conectar desde el backend
curl http://localhost:3000/api/health
# Response: {"status":"ok","database":"connected"}

# 2. Ver logs exitosos
docker compose logs backend | grep "Database:"
# Output: 🗄️  Database: aws-0-us-east-1.pooler.supabase.com

# 3. Ejecutar consultas
curl http://localhost:3000/api/nodes?limit=1
```

## Recursos Adicionales

- [Supabase Connection Pooler Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [IPv6 Docker Issues](https://docs.docker.com/config/daemon/ipv6/)
- [Node.js DNS Resolution](https://nodejs.org/api/dns.html)

## Próximos Pasos

- [Configuración de Supabase](../setup/SUPABASE_SETUP.md)
- [Desarrollo Local](../development/LOCAL_DEVELOPMENT.md)
