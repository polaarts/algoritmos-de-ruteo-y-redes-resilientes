# Resiliencia de Redes de Fibra Óptica en Chile

Sistema de análisis y visualización de resiliencia para redes de fibra óptica en Chile, considerando amenazas naturales y algoritmos de ruteo optimizado.

## Estado del Proyecto

**Versión:** 1.0.0
**Estado:** ✅ Producción (90.5% completado según rúbrica)
**Última actualización:** Noviembre 2025

### Puntuación de Rúbrica
- **Puntos obtenidos:** 76/84 (90.5%)
- **Nota estimada:** 6.5-7.0

## Características Principales

### 🗺️ Visualización Interactiva
- Mapa de Chile con red de fibra óptica real (extraída de OSM)
- Capas toggleables: infraestructura, datacenters, amenazas naturales
- Popups informativos con metadata detallada

### 🔍 4 Algoritmos de Ruteo
1. **Dijkstra (Distancia)** - Ruta más corta sin considerar riesgos
2. **Dijkstra (Resiliente)** - Ruta optimizada con ponderación de riesgos
3. **MIP (Optimización Entera Mixta)** - Modelo matemático con restricciones
4. **Algoritmo Genético** - Metaheurística multi-objetivo

### 📊 Modelado Probabilístico
- Cálculo de probabilidades de falla por enlace
- Considera múltiples amenazas: sismos, incendios, clima extremo
- Modelo combinado: `P_total = 1 - ∏(1 - P_i)`

### 🎲 Simulación Monte Carlo
- Simulación de fallas aleatorias basada en probabilidades
- Visualización de red post-evento
- Recálculo de rutas considerando fallas

## Inicio Rápido

### Requisitos Previos
- Node.js 18+
- PostgreSQL 15+ con PostGIS 3.3+ y pgRouting 3.4+
- Python 3.11+ (para scripts de optimización)

### Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes.git
cd algoritmos-de-ruteo-y-redes-resilientes

# 2. Configurar base de datos
psql -U postgres -d fiber_network -f database/schema.sql
psql -U postgres -d fiber_network -f database/migrations/000_supabase_init.sql
# ... ejecutar resto de migraciones en orden

# 3. Backend
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm start
# → http://localhost:5000

# 4. Frontend
cd ../frontend
npm install
npm run dev
# → http://localhost:5173
```

### Verificación Rápida

```bash
# Backend funcionando
curl http://localhost:5000/api/infrastructure/stats
# Debe retornar JSON con estadísticas

# Frontend funcionando
# Abrir http://localhost:5173 en el navegador
# Debe verse mapa de Chile con controles
```

## Arquitectura

```
┌─────────────┐      ┌─────────────┐      ┌──────────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│  PostgreSQL +    │
│  (React +   │◀─────│  (Node.js + │◀─────│  PostGIS +       │
│  Leaflet)   │      │   Express)  │      │  pgRouting       │
└─────────────┘      └─────────────┘      └──────────────────┘
                            │
                            │
                            ▼
                     ┌─────────────┐
                     │  Python     │
                     │  Optimizers │
                     │  (MIP, GA)  │
                     └─────────────┘
```

### Stack Tecnológico

**Frontend:**
- React 18 + Vite
- Leaflet + React-Leaflet
- Axios

**Backend:**
- Node.js + Express
- pg (PostgreSQL client)
- @supabase/supabase-js

**Base de Datos:**
- PostgreSQL 15
- PostGIS 3.3 (extensión geoespacial)
- pgRouting 3.4 (algoritmos de ruteo)

**Optimización (Python):**
- python-mip (MIP solver)
- DEAP (algoritmo genético)
- GeoPandas (manipulación geoespacial)

## Uso

### Caso de Uso 1: Calcular Ruta Óptima

1. Abrir frontend: `http://localhost:5173`
2. Sidebar: Seleccionar "Comparación 4 Algoritmos"
3. Habilitar "Mostrar Ruta"
4. Panel derecho: Click "Cargar Ejemplo" (Santiago → Concepción)
5. Click "Calcular Rutas"
6. Comparar resultados en tabla

### Caso de Uso 2: Simular Evento de Falla

1. Sidebar: Habilitar "Mostrar Simulación Monte Carlo"
2. Panel inferior: Configurar umbral (ej: 40%)
3. Click "🎲 Ejecutar Simulación"
4. Visualizar fallas en rojo
5. Recalcular rutas evitando enlaces fallidos

Ver [GETTING_STARTED.md](./GETTING_STARTED.md) para guía paso a paso completa.

## Documentación

- [**Guía de Inicio**](./GETTING_STARTED.md) - Instalación y primeros pasos
- [**Arquitectura**](./ARCHITECTURE.md) - Diseño del sistema
- [**Base de Datos**](./DATABASE.md) - Schema, funciones SQL, topología
- [**Referencia de API**](./API_REFERENCE.md) - Endpoints disponibles
- [**Algoritmos**](./ALGORITHMS.md) - Explicación de los 4 algoritmos
- [**Testing**](./TESTING.md) - Guía de pruebas
- [**Deployment**](./DEPLOYMENT.md) - Docker y producción
- [**Caso Ejemplo**](./CASO_EJEMPLO.md) - Caso de estudio completo

## Estructura del Proyecto

```
/
├── docs/                    # Documentación completa
├── backend/                 # API REST (Node.js + Express)
│   ├── algorithms/          # MIP y Algoritmo Genético (JS wrappers)
│   ├── config/              # Configuración de BD
│   ├── routes/              # Endpoints de API
│   └── server.js            # Servidor principal
├── frontend/                # Aplicación React + Leaflet
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── services/        # API clients
│   │   └── styles/          # CSS
│   └── index.html
├── database/                # Todo lo relacionado con BD
│   ├── schema.sql           # Schema completo
│   ├── migrations/          # Migraciones SQL
│   ├── functions/           # Funciones pgRouting
│   └── seeds/               # Datos de prueba
├── scripts/                 # Scripts de ETL y optimización
│   ├── etl/                 # Extracción de datos
│   ├── optimization/        # MIP y GA (Python)
│   └── data_loading/        # Carga a BD
├── data/                    # Datos generados (no en git)
└── config/                  # Configuración global
    └── docker-compose.yml
```

## API Endpoints

### Ruteo
```bash
# Dijkstra (distancia)
POST /api/routing/calculate

# Dijkstra (resiliente)
POST /api/routing/calculate-resilient

# Algoritmo Genético
POST /api/routing/genetic

# MIP
POST /api/routing/mip
```

### Infraestructura
```bash
GET /api/infrastructure/nodes
GET /api/infrastructure/edges
GET /api/infrastructure/stats
```

### Amenazas
```bash
GET /api/threats/earthquakes
GET /api/threats/fire-zones
GET /api/threats/weather-events
```

### Simulación
```bash
POST /api/simulation/run
GET /api/simulation/:id/failures
POST /api/simulation/:id/clear
```

Ver [API_REFERENCE.md](./API_REFERENCE.md) para documentación completa.

## Funcionalidades Destacadas

### Comparación Multi-Algoritmo
Panel lateral con tabla comparativa que permite:
- Calcular 4 rutas simultáneamente
- Toggle visual de cada ruta
- Métricas: distancia, tiempo de cómputo, riesgo promedio
- Parámetros configurables por algoritmo

### GPS Automático
- Detección de ubicación con `navigator.geolocation`
- Fallback a selección manual
- Manejo robusto de errores

### Simulación de Fallas
- Modelo Monte Carlo basado en probabilidades reales
- Identificación de amenaza dominante por falla
- Estadísticas detalladas por tipo de amenaza

## Desarrollo

### Tests
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm run test

# End-to-end
npm run test:e2e
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Build Producción
```bash
# Frontend
cd frontend
npm run build
# Output en frontend/dist

# Docker (todo el stack)
docker-compose up --build
```

## Contribuir

Este es un proyecto universitario. Pull requests son bienvenidos para:
- Correcciones de bugs
- Mejoras de documentación
- Optimizaciones de rendimiento

## Licencia

MIT License - Ver [LICENSE](../LICENSE)

## Autores

- **Samuel** - Backend, Base de Datos, Infraestructura
- **Agustín** - Frontend, ETL, Documentación

## Agradecimientos

- Datos de OpenStreetMap (red vial)
- USGS (datos de sismos)
- Supabase (hosting de PostgreSQL)
- Leaflet.js (mapas interactivos)

## Contacto

**Repositorio:** https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes
**Issues:** https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes/issues

---

**Última actualización:** 2025-11-11
**Versión:** 1.0.0
**Estado:** ✅ Listo para producción
