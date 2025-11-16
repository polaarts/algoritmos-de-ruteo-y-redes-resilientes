# 🐳 Guía de Docker - Fiber Optic Network Resilience

Esta guía explica cómo ejecutar el proyecto completo usando Docker y Docker Compose.

## 📋 Requisitos Previos

- Docker Engine 20.10+
- Docker Compose 2.0+
- Cuenta en [Supabase](https://supabase.com) (gratis)
- Al menos 2GB de RAM disponible
- 5GB de espacio en disco

### Instalación de Docker

**Windows:**
```bash
# Descargar Docker Desktop desde:
https://www.docker.com/products/docker-desktop
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Cerrar sesión y volver a entrar
```

**macOS:**
```bash
# Descargar Docker Desktop desde:
https://www.docker.com/products/docker-desktop
```

## 🚀 Inicio Rápido

### 0. Configurar Supabase (Solo primera vez)

**Este proyecto usa Supabase como base de datos** (PostgreSQL con PostGIS en la nube).

Ver la guía completa: [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

Resumen rápido:
```bash
# 1. Crear proyecto en https://supabase.com
# 2. Obtener credenciales del dashboard
# 3. Configurar variables de entorno
cp .env.docker.example .env
# Editar .env con tus credenciales
```

### 1. Levantar todos los servicios

```bash
# En la raíz del proyecto
docker-compose up -d
```

Este comando:
- ✅ Construye las imágenes de backend y frontend
- ✅ Crea y configura la red `fiber_network_net`
- ✅ Conecta al backend con Supabase (base de datos en la nube)
- ✅ Inicia el backend API en puerto 5001
- ✅ Inicia el frontend en puerto 8080

### 2. Verificar que todo está corriendo

```bash
docker-compose ps
```

Deberías ver dos servicios `Up`:
```
NAME                        STATUS              PORTS
fiber_network_backend       Up (healthy)        0.0.0.0:5001->5001/tcp
fiber_network_frontend      Up (healthy)        0.0.0.0:8080->80/tcp
```

**Nota:** La base de datos NO aparece aquí porque está en Supabase (cloud).

### 3. Acceder a la aplicación

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:5001/api
- **Health Check:** http://localhost:5001/health
- **Base de datos:** Supabase Cloud (acceso vía dashboard o psql)

## 📊 Estructura de Servicios

### 🗄️ Base de Datos (Supabase Cloud)

```yaml
Servicio: Supabase PostgreSQL 15+
Extensiones: PostGIS 3.3, pgRouting 3.4, PostGIS Topology
Acceso: Via dashboard o psql remoto
```

**Conexión directa con psql:**
```bash
# Usando la URL de conexión de Supabase
psql "postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# O con SQL Editor en el dashboard de Supabase
# https://supabase.com/dashboard/project/xxxxx/editor
```

### ⚙️ Backend (Node.js + Express)

```yaml
Puerto: 5001
Framework: Express.js
Base: node:18-alpine
```

**Ver logs:**
```bash
docker-compose logs -f backend
```

**Ejecutar comando en el contenedor:**
```bash
docker-compose exec backend npm test
```

### 🎨 Frontend (React + Vite + Nginx)

```yaml
Puerto: 8080
Framework: React 18 + Vite 5
Servidor: Nginx Alpine
```

**Ver logs:**
```bash
docker-compose logs -f frontend
```

## 🛠️ Comandos Útiles

### Gestión de Contenedores

```bash
# Iniciar servicios
docker-compose up -d

# Detener servicios (mantiene datos)
docker-compose stop

# Detener y eliminar contenedores (mantiene volúmenes)
docker-compose down

# Eliminar TODO (contenedores + volúmenes + red)
docker-compose down -v

# Reiniciar un servicio específico
docker-compose restart backend

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend
```

### Construcción de Imágenes

```bash
# Reconstruir todas las imágenes
docker-compose build

# Reconstruir sin usar caché
docker-compose build --no-cache

# Reconstruir un servicio específico
docker-compose build backend

# Reconstruir y reiniciar
docker-compose up -d --build
```

### Inspección y Debug

```bash
# Entrar al contenedor de backend
docker-compose exec backend sh

# Entrar al contenedor de base de datos
docker-compose exec db bash

# Ver estadísticas de recursos
docker stats

# Inspeccionar la red
docker network inspect fiber_network_net

# Verificar volúmenes
docker volume ls | grep fiber_network
```

### Base de Datos

```bash
# Conectarse a PostgreSQL
docker-compose exec db psql -U postgres -d fiber_network

# Ejecutar un script SQL
docker-compose exec -T db psql -U postgres -d fiber_network < script.sql

# Backup de la base de datos
docker-compose exec -T db pg_dump -U postgres fiber_network > backup.sql

# Restaurar backup
docker-compose exec -T db psql -U postgres -d fiber_network < backup.sql

# Ver tablas
docker-compose exec db psql -U postgres -d fiber_network -c "\dt"
```

## 🔧 Configuración Avanzada

### Variables de Entorno

Puedes crear un archivo `.env` en la raíz para sobrescribir valores:

```bash
# .env
POSTGRES_PASSWORD=mi_password_seguro
BACKEND_PORT=3000
FRONTEND_PORT=8080
DB_NAME=fiber_network_prod
```

Luego modifica `docker-compose.yml` para usar estas variables:

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
```

### Desarrollo con Hot Reload

Para desarrollo, puedes montar el código fuente como volumen:

```yaml
# Agregar en el servicio backend:
volumes:
  - ./backend:/app
  - /app/node_modules

# Cambiar el comando:
command: npm run dev
```

### Producción

Para producción, asegúrate de:

1. **Cambiar passwords por defecto**
2. **Usar variables de entorno seguras**
3. **Configurar CORS apropiadamente**
4. **Habilitar SSL en Nginx**
5. **Usar volúmenes nombrados para persistencia**

## 🐛 Troubleshooting

### Error: Puerto ya en uso

```bash
# Verificar qué está usando el puerto
sudo lsof -i :5432  # o :5001, :8080

# Cambiar el puerto en docker-compose.yml
ports:
  - "15432:5432"  # Usa 15432 externamente
```

### Error: La base de datos no se inicializa

```bash
# Ver logs detallados
docker-compose logs db

# Eliminar volumen y reiniciar
docker-compose down -v
docker-compose up -d
```

### Error: Backend no puede conectarse a la base de datos

```bash
# Verificar que el servicio db esté saludable
docker-compose ps

# Verificar conectividad de red
docker-compose exec backend ping db

# Verificar variables de entorno
docker-compose exec backend env | grep DB_
```

### Error: Frontend no se construye

```bash
# Limpiar y reconstruir
docker-compose down
docker system prune -a
docker-compose build --no-cache frontend
docker-compose up -d
```

### Contenedor se reinicia constantemente

```bash
# Ver logs para identificar el error
docker-compose logs --tail=100 backend

# Verificar health check
docker inspect fiber_network_backend | grep -A 10 Health
```

## 📈 Monitoreo

### Ver uso de recursos en tiempo real

```bash
docker stats fiber_network_db fiber_network_backend fiber_network_frontend
```

### Inspeccionar health checks

```bash
# Ver estado de salud de todos los contenedores
docker-compose ps

# Inspeccionar health check específico
docker inspect --format='{{json .State.Health}}' fiber_network_backend | jq
```

## 🧹 Limpieza

```bash
# Detener y eliminar contenedores
docker-compose down

# Eliminar volúmenes (¡CUIDADO! Borra todos los datos)
docker-compose down -v

# Limpiar imágenes no usadas
docker image prune -a

# Limpiar todo el sistema Docker
docker system prune -a --volumes
```

## 📚 Recursos Adicionales

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostGIS Docker](https://registry.hub.docker.com/r/postgis/postgis/)
- [Node.js Best Practices for Docker](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs -f`
2. Verifica el estado: `docker-compose ps`
3. Consulta la sección de Troubleshooting arriba
4. Revisa los issues en GitHub

---

**Nota:** La primera vez que ejecutes `docker-compose up`, la descarga de imágenes y construcción puede tomar varios minutos dependiendo de tu conexión a internet.
