# 🚀 Inicio Rápido

Esta guía te permite ejecutar el proyecto en **menos de 5 minutos**.

## Requisitos Mínimos

- Docker Desktop instalado
- Cuenta en [Supabase](https://supabase.com) (gratis)
- 4GB RAM disponible

## Pasos

### 1. Clonar el repositorio

```bash
git clone https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes.git
cd algoritmos-de-ruteo-y-redes-resilientes
```

### 2. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. En **Settings** > **Database**, copia el **Connection String** del **Connection Pooler**:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
3. En **Settings** > **API**, copia:
   - Project URL
   - anon key
   - service_role key

### 3. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.docker.example .env

# Editar .env con tus credenciales
nano .env  # o usa tu editor favorito
```

Contenido del `.env`:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 4. Inicializar base de datos

```bash
# Opción 1: Desde SQL Editor en Supabase Dashboard
# - Ve a SQL Editor
# - Copia el contenido de database/schema.sql
# - Ejecuta

# Opción 2: Desde terminal
psql "$DATABASE_URL" < database/schema.sql
```

### 5. Levantar servicios

```bash
docker compose up -d
```

### 6. Verificar

```bash
# Ver estado de servicios
docker compose ps

# Ver logs
docker compose logs -f
```

### 7. Abrir aplicación

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **OSRM**: http://localhost:5000

## ✅ Verificación

Si todo está correcto, deberías ver:

1. **Frontend**: Mapa de Chile con opciones de visualización
2. **Backend** (http://localhost:3000/api/health):
   ```json
   {"status":"ok","database":"connected"}
   ```
3. **OSRM** (http://localhost:5000/route/v1/driving/-70.6693,-33.4489;-70.6506,-33.4372):
   ```json
   {"code":"Ok","routes":[...]}
   ```

## 🔧 Troubleshooting Rápido

### Error de conexión a Supabase
Asegúrate de usar el **Connection Pooler** (puerto 6543) y no la conexión directa.
Ver: [docs/troubleshooting/SUPABASE_CONNECTION.md](docs/troubleshooting/SUPABASE_CONNECTION.md)

### Puerto en uso
```bash
# Cambiar puertos en docker-compose.yml
# O detener servicios que usen 3000, 5000, 5173
```

### Servicios no levantan
```bash
# Ver logs detallados
docker compose logs backend
docker compose logs frontend
docker compose logs osrm

# Reintentar
docker compose down
docker compose up -d
```

## 📚 Próximos Pasos

Una vez que tengas todo funcionando:

1. **Explorar la aplicación**
   - Activar capas de visualización (sidebar izquierdo)
   - Calcular rutas entre datacenters
   - Ver amenazas naturales (sismos, incendios)

2. **Leer documentación**
   - [Arquitectura del Sistema](docs/architecture/ARCHITECTURE.md)
   - [Guía de Desarrollo](docs/development/LOCAL_DEVELOPMENT.md)
   - [API Documentation](docs/api/API.md)

3. **Contribuir**
   - [Guía de Contribución](CONTRIBUTING.md)
   - [Mejores Prácticas](docs/development/BEST_PRACTICES.md)

## 🆘 Ayuda

Si tienes problemas:

1. Revisa [Troubleshooting](docs/troubleshooting/)
2. Busca en [Issues de GitHub](https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes/issues)
3. Crea un nuevo issue con:
   - Tu sistema operativo
   - Logs de Docker (`docker compose logs`)
   - Pasos para reproducir el problema

## Comandos Útiles

```bash
# Detener servicios
docker compose down

# Ver logs en tiempo real
docker compose logs -f

# Reiniciar un servicio
docker compose restart backend

# Reconstruir imágenes
docker compose build --no-cache

# Limpiar todo
docker compose down -v
docker system prune -a
```

---

**¿Todo funcionando?** 🎉 ¡Excelente! Ahora puedes empezar a explorar el código y contribuir al proyecto.
