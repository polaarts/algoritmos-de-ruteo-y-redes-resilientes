# 🐳 Configuración con Docker

Esta guía te ayudará a ejecutar el proyecto usando Docker y Docker Compose.

## Requisitos Previos

- Docker Desktop 20.10+
- Docker Compose 2.0+
- 4GB RAM mínimo
- 10GB espacio en disco

### Instalación de Docker

#### Windows
```bash
# Descargar Docker Desktop desde:
https://docs.docker.com/desktop/install/windows-install/
```

#### Linux
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Cerrar sesión y volver a entrar
```

#### macOS
```bash
# Descargar Docker Desktop desde:
https://docs.docker.com/desktop/install/mac-install/
```

## Inicio Rápido

### 1. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.docker.example .env

# Editar .env con tus credenciales de Supabase
# Obtener credenciales desde: https://supabase.com/dashboard
```

### 2. Levantar los servicios

```bash
# En la raíz del proyecto
docker compose up -d

# Ver logs
docker compose logs -f
```

### 3. Verificar servicios

```bash
docker compose ps
```

Deberías ver:
- **backend**: API REST (Puerto 3000)
- **frontend**: Aplicación web (Puerto 5173)
- **osrm**: Servicio de routing (Puerto 5000)

### 4. Acceder a la aplicación

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- OSRM API: http://localhost:5000

## Estructura de Servicios

### 🗄️ Base de Datos (Supabase Cloud)
- Gestión en: https://supabase.com/dashboard
- PostgreSQL 15 con PostGIS

### 🔧 Backend (Node.js + Express)
- Puerto: 3000
- API REST para algoritmos de ruteo
- Conecta con Supabase y OSRM

### 🎨 Frontend (React + Vite)
- Puerto: 5173
- Interfaz web con Leaflet
- Hot reload activado

### 🗺️ OSRM (Open Source Routing Machine)
- Puerto: 5000
- Motor de routing con datos de Chile
- Algoritmo MLD (Multi-Level Dijkstra)

## Comandos Útiles

```bash
# Reiniciar todos los servicios
docker compose restart

# Ver logs de un servicio específico
docker compose logs -f backend

# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes
docker compose down -v

# Reconstruir imágenes
docker compose build --no-cache

# Ejecutar comandos dentro de un contenedor
docker compose exec backend npm run test
```

## Troubleshooting

### Error de conexión a Supabase

Ver: [docs/troubleshooting/SUPABASE_CONNECTION.md](../troubleshooting/SUPABASE_CONNECTION.md)

### OSRM no responde

```bash
# Verificar que los datos de Chile estén disponibles
ls -lh osrm-data/

# Reiniciar servicio OSRM
docker compose restart osrm
```

### Puertos en uso

Si los puertos 3000, 5000 o 5173 están en uso:

```bash
# Detener servicios que usen esos puertos
# O modificar docker-compose.yml con otros puertos
```

## Próximos Pasos

- [Guía de Desarrollo Local](../development/LOCAL_DEVELOPMENT.md)
- [Mejores Prácticas Docker](DOCKER_BEST_PRACTICES.md)
- [Configuración de Supabase](SUPABASE_SETUP.md)

## Referencias

- [Documentación de Docker](https://docs.docker.com/)
- [Docker Compose CLI](https://docs.docker.com/compose/reference/)
- [OSRM Documentation](http://project-osrm.org/)
