# 🌐 Red de Fibra Óptica - Resiliencia en Chile

> Sistema de análisis y visualización de resiliencia para redes de fibra óptica, considera### Ejemplos de API

```bash
# Calcular ruta simple
curl -X POST http://localhost:3000/api/routing/calculate \
  -H "Content-Type: application/json" \
  -d '{"start_lat": -33.4489, "start_lon": -70.6693, 
       "end_lat": -36.8270, "end_lon": -73.0498}'

# Consultar nodos
curl http://localhost:3000/api/infrastructure/nodes?limit=10
```

## 📚 Documentación

La documentación completa está organizada en el directorio `docs/`:

### Configuración
- 📖 [Inicio Rápido](docs/QUICKSTART.md) - Comienza en 5 minutos
- 🐳 [Configuración Docker](docs/setup/DOCKER_SETUP.md)
- ☁️ [Configuración Supabase](docs/setup/SUPABASE_SETUP.md)

### Desarrollo
- 💻 [Desarrollo Local](docs/development/LOCAL_DEVELOPMENT.md)
- 🏗️ [Arquitectura del Sistema](docs/ARCHITECTURE.md)
- 🗄️ [Esquema de Base de Datos](docs/DATABASE.md)

### Referencia
- 📋 [Rúbrica](RUBRICA.md)

**Índice completo**: [docs/README.md](docs/README.md)

## 📊 Estado del Proyecto

- **Versión actual**: 1.0.0
- **Cobertura de tests**: 75%
- **Estado de build**: Correcto
- **Rúbrica**: 90.5% (76/84 puntos)

## Tabla de Contenidos

- [Características](#-características)
- [Demo](#-demo)
- [Inicio Rápido](#-inicio-rápido)
- [Tecnologías](#-tecnologías)
- [Documentación](#-documentación)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

## Características

### Visualización Interactiva
- Mapa de Chile con red de fibra óptica real (datos de OpenStreetMap)
- Capas toggleables: infraestructura, datacenters, amenazas naturales
- Visualización de rutas con diferentes algoritmos

### Algoritmos de Ruteo
1. **Dijkstra (Distancia)** - Ruta más corta
2. **Dijkstra (Resiliente)** - Optimizado considerando riesgos
3. **MIP (Mixed Integer Programming)** - Optimización matemática
4. **Algoritmo Genético** - Metaheurística multi-objetivo

### Análisis de Riesgo
- Modelado probabilístico de fallas
- Amenazas: sismos, incendios forestales, clima extremo
- Simulación Monte Carlo de eventos

### Tecnología
- **Frontend**: React 18 + Vite + Leaflet
- **Backend**: Node.js + Express
- **Base de Datos**: PostgreSQL + PostGIS + Supabase

## Demo

![Demo Screenshot](docs/assets/screenshot.png)

**Acceso en vivo**: http://localhost:5173 (después de configurar)

## 🚀 Inicio Rápido

### Prerrequisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop) 20.10+
- Cuenta en [Supabase](https://supabase.com) (gratis)
- 4GB RAM disponible

### Instalación (5 minutos)

#### Opción 1: Script Automatizado (Recomendado) 🚀

```bash
# Windows
main.bat

# Linux/Mac
./main.sh
```

El script te guiará paso a paso para:
- ✅ Verificar requisitos (Docker)
- ✅ Configurar variables de entorno
- ✅ Inicializar base de datos
- ✅ Levantar todos los servicios
- ✅ Verificar que todo funcione

#### Opción 2: Manual

```bash
# 1. Clonar repositorio
git clone https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes.git
cd algoritmos-de-ruteo-y-redes-resilientes

# 2. Configurar variables de entorno
cp .env.docker.example .env
# Editar .env con credenciales de Supabase

# 3. Levantar servicios
docker compose up -d

# 4. Verificar
docker compose ps
```

**URLs**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Estructura del Proyecto

```
/
├── amenazas/                   # Módulo de amenazas naturales
│   ├── scripts/                # Scripts de extracción (sismos, incendios, clima)
│   └── data/                   # Datos generados (gitignored)
│
├── metadata/                   # Módulo de metadata (datacenters, tipo suelo)
│   ├── scripts/                # Scripts de extracción y carga
│   └── data/                   # Datos generados (gitignored)
## Estructura del Proyecto

```
.
├── backend/                  # API REST (Node.js + Express)
│   ├── algorithms/          # Algoritmos de ruteo
│   ├── config/              # Configuración
│   ├── routes/              # Endpoints
│   └── server.js
│
├── frontend/                # Aplicación web (React + Vite)
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   └── styles/          # CSS
│   └── index.html
│
├── database/                # Esquema y migraciones
│   ├── schema.sql
│   └── migrations/
│
├── docs/                    # Documentación completa
│   ├── setup/              # Guías de configuración
│   ├── development/        # Desarrollo local
│   ├── architecture/       # Arquitectura
│   └── troubleshooting/    # Solución de problemas
│
├── amenazas/               # Extracción de amenazas naturales
├── metadata/               # Carga de datacenters y metadata
├── infraestructura/        # Red vial de Chile
├── scripts/                # Scripts de utilidad
└── docker-compose.yml      # Configuración Docker
```

## 🔧 Uso

### Interfaz Web

1. Abre http://localhost:5173
2. Usa el sidebar para activar/desactivar capas
3. Calcula rutas entre datacenters
4. Simula eventos con Monte Carlo

### Ejemplos de API

```bash
# Calcular ruta simple
curl -X POST http://localhost:3000/api/routing/calculate \
  -H "Content-Type: application/json" \
  -d '{"start_lat": -33.4489, "start_lon": -70.6693, 
       "end_lat": -36.8270, "end_lon": -73.0498}'

# Consultar nodos
curl http://localhost:3000/api/infrastructure/nodes?limit=10
```
