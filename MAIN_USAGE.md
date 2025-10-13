# Guía de Uso de main.sh

## Descripción

`main.sh` es el script de automatización completo que ejecuta todo el pipeline ETL (Extract, Transform, Load) del proyecto y levanta todos los servicios necesarios.

## ¿Qué hace main.sh?

El script automatiza los siguientes pasos:

1. **Extracción de Datos (Extract)**
   - Ejecuta scripts de extracción de infraestructura
   - Ejecuta scripts de extracción de metadata
   - Ejecuta scripts de extracción de amenazas

2. **Levantamiento de Base de Datos**
   - Inicia contenedor Docker de PostgreSQL/PostGIS/pgRouting
   - Espera a que la BD esté lista

3. **Creación de Esquema**
   - Ejecuta `schema.sql` para crear todas las tablas
   - Verifica que PostGIS y pgRouting estén instalados

4. **Carga de Datos**
   - Ejecuta scripts `load_to_db.py` (cuando estén implementados)

5. **Creación de Topología**
   - Ejecuta `create-topology.sql` para preparar la red para pgRouting

6. **Levantamiento de Servicios**
   - Inicia backend (Node.js/Express)
   - Inicia frontend (Vite/React)

## Requisitos Previos

### Software Necesario

- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Python 3** (v3.8+)
- **Node.js** (v18+) - opcional, solo para desarrollo local
- **Bash** - incluido en Linux/Mac, en Windows usar Git Bash o WSL

### Verificar Instalación

```bash
docker --version
docker-compose --version
python3 --version
```

## Uso

### Opción 1: Ejecución Interactiva (Recomendada)

```bash
./main.sh
```

El script mostrará un menú interactivo:

```
╔═══════════════════════════════════════════════════════════════╗
║  Pipeline ETL - Red de Fibra Óptica en Chile                 ║
╚═══════════════════════════════════════════════════════════════╝

Opciones:
  1) Ejecutar pipeline completo (Recomendado)
  2) Solo extraer datos (ETL - Extract)
  3) Solo levantar servicios (Docker)
  4) Ver logs de servicios
  5) Detener todos los servicios
  6) Verificar estado de servicios
  0) Salir

Selecciona una opción:
```

### Opción 2: Ejecución Directa

Para ejecutar el pipeline completo sin menú:

```bash
./main.sh
# Luego selecciona opción 1
```

## Opciones del Menú

### 1) Pipeline Completo (Recomendado)

Ejecuta todos los pasos del ETL de principio a fin:

```bash
./main.sh
# Selecciona: 1
```

**Pasos que ejecuta:**
- ✓ Extracción de datos
- ✓ Levantamiento de BD
- ✓ Creación de esquema
- ✓ Carga de datos
- ✓ Creación de topología
- ✓ Levantamiento de servicios
- ✓ Verificación final

**Tiempo estimado:** 5-15 minutos (dependiendo de la descarga de imágenes Docker)

### 2) Solo Extraer Datos

Ejecuta únicamente los scripts de extracción de datos:

```bash
./main.sh
# Selecciona: 2
```

Útil cuando:
- Solo quieres actualizar los datos
- Estás probando los scripts de extracción
- Quieres re-extraer datos sin reiniciar servicios

### 3) Solo Levantar Servicios

Levanta solo los contenedores Docker (sin extracción):

```bash
./main.sh
# Selecciona: 3
```

Útil cuando:
- Los datos ya están extraídos
- Solo quieres levantar los servicios
- Reiniciaste la máquina y necesitas los servicios

### 4) Ver Logs

Muestra los logs en tiempo real de todos los servicios:

```bash
./main.sh
# Selecciona: 4
```

Presiona `Ctrl+C` para salir de los logs.

### 5) Detener Servicios

Detiene todos los contenedores Docker:

```bash
./main.sh
# Selecciona: 5
```

**Nota:** Esto NO elimina los datos de la BD (están en un volumen Docker persistente).

### 6) Verificar Estado

Muestra el estado de todos los servicios:

```bash
./main.sh
# Selecciona: 6
```

## Verificación de Servicios

Después de ejecutar el pipeline, los servicios estarán disponibles en:

| Servicio | URL | Puerto |
|----------|-----|--------|
| **Frontend** | http://localhost:8080 | 8080 |
| **Backend** | http://localhost:5000 | 5000 |
| **Base de Datos** | localhost:5432 | 5432 |

### Probar que funciona:

```bash
# Verificar frontend
curl http://localhost:8080

# Verificar backend
curl http://localhost:5000/health

# Verificar base de datos
docker exec -it fiber_network_db psql -U postgres -c "SELECT version();"
```

## Logs y Debugging

### Ver logs del script

El script guarda logs en `main.log`:

```bash
tail -f main.log
```

### Ver logs de Docker Compose

```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend

# Solo base de datos
docker-compose logs -f db
```

### Ver logs de un contenedor específico

```bash
docker logs fiber_network_backend
docker logs fiber_network_frontend
docker logs fiber_network_db
```

## Troubleshooting

### Error: "Docker no está instalado"

Instala Docker:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Mac
brew install docker docker-compose

# Windows
# Descarga Docker Desktop desde https://www.docker.com/products/docker-desktop
```

### Error: "Permission denied"

Dale permisos de ejecución al script:

```bash
chmod +x main.sh
```

### Error: "La base de datos no respondió a tiempo"

Espera un poco más y verifica manualmente:

```bash
docker ps
docker logs fiber_network_db
```

### Error: "Puerto ya en uso"

Otro servicio está usando el puerto. Opciones:

1. Detén el servicio que usa el puerto
2. Cambia el puerto en `docker-compose.yml`

```bash
# Ver qué está usando el puerto 5432
sudo lsof -i :5432

# Ver qué está usando el puerto 8080
sudo lsof -i :8080
```

### Los scripts de extracción fallan

Verifica que las dependencias de Python estén instaladas:

```bash
# Instalar dependencias (ejemplo)
pip install requests geopandas osmnx
```

### La topología no se crea

Si estás usando **Supabase**, la topología debe crearse manualmente:

1. Ve a Supabase SQL Editor
2. Copia y pega el contenido de `create-topology.sql`
3. Ejecuta el script

## Comandos Útiles

### Reiniciar todo desde cero

```bash
# Detener y eliminar todo (incluyendo volúmenes)
docker-compose down -v

# Ejecutar pipeline completo
./main.sh
# Selecciona: 1
```

### Ver contenedores activos

```bash
docker ps
```

### Entrar a un contenedor

```bash
# Backend
docker exec -it fiber_network_backend sh

# Base de datos
docker exec -it fiber_network_db psql -U postgres

# Frontend
docker exec -it fiber_network_frontend sh
```

### Reconstruir imágenes

```bash
docker-compose build --no-cache
```

## Modo de Desarrollo

Si estás desarrollando, puedes ejecutar los servicios localmente en lugar de Docker:

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Terminal 3: Base de datos (Docker)
docker-compose up db
```

## Estructura de Archivos Relacionados

```
.
├── main.sh                    # Este script
├── docker-compose.yml         # Configuración de servicios Docker
├── schema.sql                 # Esquema de base de datos
├── create-topology.sql        # Script de topología pgRouting
├── main.log                   # Log del script (generado)
├── backend/
│   ├── Dockerfile
│   └── ...
├── frontend/
│   ├── Dockerfile
│   └── ...
├── infraestructura/
│   └── extract_infrastructure.py
├── metadata/
│   └── extract_all_metadata.py
└── amenazas/
    └── extract_all_threats.py
```

## Próximos Pasos

Después de ejecutar `main.sh`:

1. **Abre el frontend**: http://localhost:8080
2. **Verifica que las capas se carguen** (puede tardar si hay muchos datos)
3. **Prueba la ruta de ejemplo** (Santiago → Concepción)
4. **Explora las diferentes capas** (infraestructura, amenazas, etc.)

## Soporte

Si tienes problemas:

1. Revisa `main.log` para ver errores
2. Revisa logs de Docker: `docker-compose logs -f`
3. Verifica que todos los requisitos estén instalados
4. Consulta el README principal del proyecto

## Autores

- Samuel
- Agustín

## Licencia

MIT
