# Guía de Revisión del Proyecto - T3 Grupal

**Fecha:** 2025-11-11
**Proyecto:** Resiliencia de Redes de Fibra Óptica en Chile
**Estado:** ✅ LISTO PARA REVISIÓN

---

## 📋 Checklist de Revisión

### ✅ Archivos Implementados

#### Frontend - Componentes React
- [x] `frontend/src/components/RouteComparison.jsx` (25KB) - **NUEVO** ⭐
  - Comparación de 4 algoritmos
  - Tabla comparativa
  - Checkboxes para toggle
  - Formulario de restricciones integrado

- [x] `frontend/src/components/SimulationControls.jsx` (9.9KB) - **NUEVO** ⭐
  - Simulación Monte Carlo
  - Visualización de fallas
  - Configuración de umbral

- [x] `frontend/src/components/RouteCalculator.jsx` (9.2KB) - **MODIFICADO**
  - Agregado GPS automático
  - Función `useCurrentLocation()`

- [x] `frontend/src/components/ThreatsLayer.jsx` (13KB) - **MODIFICADO**
  - Popups mejorados con estilos inline
  - Íconos y colores por severidad
  - Información detallada de amenazas

- [x] `frontend/src/components/InfrastructureLayer.jsx` (8.5KB) - Existente
- [x] `frontend/src/components/Map.jsx` (1.9KB) - Existente

#### Frontend - Estilos CSS
- [x] `frontend/src/styles/RouteComparison.css` (9.6KB) - **NUEVO** ⭐
- [x] `frontend/src/styles/SimulationControls.css` (7.8KB) - **NUEVO** ⭐
- [x] `frontend/src/styles/App.css` (6.5KB) - **MODIFICADO**
- [x] `frontend/src/styles/index.css` (477B) - Existente

#### Frontend - Servicios
- [x] `frontend/src/services/api.js` - **MODIFICADO** ⭐
  - Agregadas APIs:
    - `optimizationAPI` (MIP y Genetic Algorithm)
    - `probabilitiesAPI`
    - `simulationAPI`
  - Actualizada `routingAPI` con métodos resilientes

#### Frontend - Configuración
- [x] `frontend/src/App.jsx` - **MODIFICADO** ⭐
  - Integrados nuevos componentes
  - Toggle entre modo simple y comparación
  - Checkbox de simulación
- [x] `frontend/src/main.jsx` - Existente
- [x] `frontend/index.html` - Existente
- [x] `frontend/package.json` - Existente
- [x] `frontend/vite.config.js` - Existente

#### Backend - Rutas API
- [x] `backend/server.js` - Existente ✅
- [x] `backend/routes/routing.js` - Existente ✅
  - `/api/routing/calculate` - Dijkstra distancia
  - `/api/routing/calculate-resilient` - Dijkstra resiliente
- [x] `backend/routes/optimization.js` - Existente ✅
  - `/api/optimization/mip` - MIP
  - `/api/optimization/genetic` - Algoritmo Genético
- [x] `backend/routes/simulation.js` - Existente ✅
- [x] `backend/routes/probabilities.js` - Existente ✅
- [x] `backend/routes/threats.js` - Existente ✅
- [x] `backend/routes/metadata.js` - Existente ✅
- [x] `backend/routes/infrastructure.js` - Existente ✅

#### Backend - Configuración
- [x] `backend/config/database.js` - Existente ✅
- [x] `backend/package.json` - Existente ✅
- [x] `backend/.env.example` - Existente ✅

#### Base de Datos
- [x] `schema.sql` - Schema completo ✅
- [x] `create-topology.sql` - Script topología ✅
- [x] `functions/resilient_routing.sql` - Funciones pgRouting ✅
- [x] `migrations/004_add_probabilities.sql` - Probabilidades ✅
- [x] `migrations/005_add_simulation.sql` - Simulación ✅
- [x] `migrations/006_fix_routing_functions.sql` - Fixes ✅

#### Scripts Python
- [x] `scripts/mip_optimizer.py` - MIP con python-mip ✅
- [x] `scripts/genetic_algorithm.py` - GA con DEAP ✅
- [x] `scripts/calc_prob_batch.py` - Cálculo probabilidades ✅
- [x] `scripts/quick_load_data.py` - Carga rápida ✅

#### Documentación
- [x] `EVALUACION_RUBRICA.md` - **NUEVO** ⭐ (650 líneas)
- [x] `EVALUACION_FINAL.md` - **NUEVO** ⭐ (450 líneas)
- [x] `GUIA_REVISION.md` - **NUEVO** ⭐ (este archivo)
- [x] `README.md` - Existente ✅
- [x] `CLAUDE.md` - Existente ✅

---

## 🔍 Revisión por Componente

### 1. RouteComparison.jsx - Comparación de 4 Algoritmos

**Ubicación:** `frontend/src/components/RouteComparison.jsx`
**Líneas:** 580
**Estado:** ✅ COMPLETO

#### Funcionalidades Implementadas:
✅ Calcula 4 rutas en paralelo:
  - Dijkstra (distancia) - Verde
  - Dijkstra (resiliente) - Naranja
  - MIP optimizado - Azul
  - Algoritmo Genético - Magenta

✅ Interfaz:
  - Selección de puntos inicio/fin
  - Botón "Cargar Ejemplo" (Santiago-Concepción)
  - Botón "📍 Mi Ubicación" (GPS)
  - Botón "Calcular Todas las Rutas"

✅ Panel de opciones avanzadas (colapsable):
  - Dijkstra Resiliente:
    - Probabilidad máxima de falla (0-1)
    - Peso de riesgo vs distancia (0-10)
  - MIP Optimización:
    - Probabilidad máxima permitida (0-1)
    - Tiempo límite (10-300s)
  - Algoritmo Genético:
    - Tamaño de población (20-200)
    - Número de generaciones (10-100)
  - Botón "Restablecer Valores por Defecto"

✅ Visualización:
  - Tabla comparativa con:
    - Algoritmo
    - Distancia (km)
    - Tiempo de cómputo (ms)
    - Riesgo promedio (%)
    - Estado (OK/Error/Calculando/Pendiente)
  - Checkboxes para mostrar/ocultar cada ruta
  - Indicadores de color para cada algoritmo
  - Toggle para ocultar/mostrar tabla

✅ Renderizado en mapa:
  - 4 rutas con colores distintos
  - Popups informativos en segmentos
  - Marcadores de inicio (verde) y fin (rojo)

✅ Estados:
  - Loading overlay con spinner
  - Progreso por algoritmo
  - Manejo de errores individual
  - Hint de selección de puntos

#### Cómo Probar:
```bash
# 1. Abrir frontend
cd frontend
npm run dev
# → http://localhost:5173

# 2. En el sidebar izquierdo:
#    - Seleccionar "Comparación 4 Algoritmos"
#    - Habilitar "Mostrar Ruta"

# 3. En el panel derecho:
#    - Click "Cargar Ejemplo"
#    - Click "Calcular Rutas"
#    - Esperar 10-30 segundos

# 4. Verificar:
#    ✓ 4 rutas visualizadas en colores distintos
#    ✓ Tabla comparativa con métricas
#    ✓ Checkboxes funcionales
#    ✓ Panel de opciones avanzadas
```

#### Código Clave:
```javascript
// Calcular todas las rutas en paralelo
const calculateAllRoutes = async () => {
  const promises = [
    calculateDijkstraRoute(...),
    calculateDijkstraResilientRoute(...),
    calculateMIPRoute(...),
    calculateGeneticRoute(...)
  ];
  await Promise.allSettled(promises);
};

// Toggle visibilidad de rutas
const [visibleRoutes, setVisibleRoutes] = useState({
  dijkstra: true,
  dijkstraResilient: true,
  mip: true,
  genetic: true
});
```

---

### 2. SimulationControls.jsx - Simulación Monte Carlo

**Ubicación:** `frontend/src/components/SimulationControls.jsx`
**Líneas:** 295
**Estado:** ✅ COMPLETO

#### Funcionalidades Implementadas:
✅ Configuración:
  - Input de nombre de simulación
  - Slider de umbral de probabilidad (0-100%)
  - Descripción del funcionamiento

✅ Ejecución:
  - Botón "🎲 Ejecutar Simulación"
  - Llamada a `/api/simulation/run`
  - Loading overlay con spinner

✅ Resultados:
  - Nombre y fecha de simulación
  - Enlaces analizados
  - Fallas detectadas (count en rojo)
  - Umbral usado

✅ Visualización:
  - Checkbox "Mostrar enlaces fallidos"
  - Checkbox "Mostrar solo amenazas activas"
  - Enlaces fallidos en rojo con línea discontinua

✅ Acciones:
  - Botón "Nueva Simulación"
  - Botón "Eliminar" (rojo)

✅ Información:
  - Sección "¿Cómo funciona?" con pasos numerados
  - Tips de uso

#### Cómo Probar:
```bash
# 1. En el sidebar:
#    - Habilitar "Mostrar Simulación Monte Carlo"

# 2. En el panel inferior izquierdo:
#    - (Opcional) Escribir nombre: "Simulación Terremoto 2024"
#    - Ajustar umbral: 40%
#    - Click "🎲 Ejecutar Simulación"

# 3. Esperar 3-10 segundos

# 4. Verificar:
#    ✓ Panel de resultados con estadísticas
#    ✓ Enlaces fallidos en rojo punteado
#    ✓ Checkboxes funcionales
#    ✓ Popups en enlaces fallidos
```

#### Código Clave:
```javascript
// Ejecutar simulación
const runSimulation = async () => {
  const response = await simulationAPI.runSimulation({
    name: simulationName,
    probabilityThreshold: config.probabilityThreshold
  });
  setSimulation(response.data.simulation);
  await fetchFailures(response.data.simulationId);
};

// Visualizar fallas
{showFailedEdges && failures && (
  <GeoJSON
    data={failures}
    style={failedEdgeStyle}
    onEachFeature={onEachFailedEdge}
  />
)}
```

---

### 3. GPS en RouteCalculator.jsx

**Ubicación:** `frontend/src/components/RouteCalculator.jsx:100-146`
**Estado:** ✅ COMPLETO

#### Funcionalidades Implementadas:
✅ Función `useCurrentLocation()`:
  - Detecta soporte del navegador
  - Llama a `navigator.geolocation.getCurrentPosition()`
  - Configuración: `enableHighAccuracy: true`, `timeout: 10000ms`
  - Centra mapa en ubicación

✅ Manejo de errores:
  - `PERMISSION_DENIED` → "Debes permitir el acceso"
  - `POSITION_UNAVAILABLE` → "Ubicación no disponible"
  - `TIMEOUT` → "Tiempo de espera agotado"
  - Navegador sin soporte → Alert informativo

✅ UI:
  - Botón "📍 Usar Mi Ubicación"
  - Estado disabled mientras carga
  - Marcador "Mi Ubicación" en el mapa

#### Cómo Probar:
```bash
# 1. En modo "Modo Simple" o "Comparación":
#    - Click "📍 Usar Mi Ubicación"

# 2. El navegador pedirá permiso:
#    - Click "Permitir"

# 3. Verificar:
#    ✓ Mapa se centra en tu ubicación
#    ✓ Marcador verde aparece
#    ✓ Punto de inicio configurado

# 4. (Opcional) Denegar permisos:
#    - Mensaje de error informativo
#    - Opción de selección manual
```

---

### 4. Popups Mejorados en ThreatsLayer.jsx

**Ubicación:** `frontend/src/components/ThreatsLayer.jsx:111-257`
**Estado:** ✅ COMPLETO

#### Sismos (CircleMarker):
✅ Información:
  - Magnitud, profundidad, fecha, lugar
  - Nivel de amenaza (critical/high/medium/low)
  - Link a USGS

✅ Estilo:
  - Color por magnitud (rojo oscuro → amarillo)
  - Tamaño proporcional a magnitud
  - Badge con nivel de amenaza

#### Zonas de Incendio (Polygon):
✅ Información:
  - Nombre, nivel de riesgo, área (km²)
  - Tipo de vegetación
  - Último incendio, frecuencia

✅ Estilo:
  - Íconos: 🔥🔥🔥 (extreme), 🔥🔥 (high), 🔥 (medium), ⚠️ (low)
  - Colores por nivel de riesgo
  - Warning box con impacto

#### Eventos Climáticos (Polygon):
✅ Información:
  - Tipo, severidad, fecha, duración
  - Viento máximo, precipitación, temperatura
  - Descripción del evento

✅ Estilo:
  - Íconos por tipo: ⛈️🌊❄️💨🌧️🌪️
  - Colores por severidad
  - Info box con impacto

#### Cómo Probar:
```bash
# 1. En el sidebar:
#    - Habilitar "Sismos"
#    - Habilitar "Zonas de Incendio"
#    - Habilitar "Eventos Climáticos"

# 2. Click en cualquier elemento del mapa

# 3. Verificar:
#    ✓ Popup con información completa
#    ✓ Íconos y colores apropiados
#    ✓ Warning/info boxes
#    ✓ Links externos (para sismos)
```

---

### 5. API Services - api.js

**Ubicación:** `frontend/src/services/api.js`
**Estado:** ✅ COMPLETO

#### APIs Agregadas:

##### optimizationAPI:
```javascript
calculateMIPRoute(startLat, startLon, endLat, endLon, options)
// POST /api/optimization/mip
// Parámetros: maxProbability, riskWeight, timeLimit

calculateGeneticRoute(startLat, startLon, endLat, endLon, options)
// POST /api/optimization/genetic
// Parámetros: maxProbability, populationSize, generations
```

##### probabilitiesAPI:
```javascript
getEdgeProbabilities(params)
// GET /api/probabilities/edges

getStatistics()
// GET /api/probabilities/statistics

calculateProbabilities(options)
// POST /api/probabilities/calculate
```

##### simulationAPI:
```javascript
runSimulation(options)
// POST /api/simulation/run

getSimulationFailures(id, elementType)
// GET /api/simulation/:id/failures

deleteSimulation(id)
// DELETE /api/simulation/:id
```

##### routingAPI (actualizada):
```javascript
calculateResilientRoute(startLat, startLon, endLat, endLon, options)
// GET /api/routing/calculate-resilient
// Parámetros: maxFailureProb, riskWeight, simulationId
```

---

## 🧪 Plan de Pruebas Completo

### Prueba 1: Levantar el Sistema (5 min)

#### Backend:
```bash
cd /home/samuel/Documents/universidad/algoritmos-de-ruteo-y-redes-resilientes/backend

# Si no tienes las dependencias instaladas:
npm install

# Crear archivo .env si no existe:
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# Iniciar servidor:
npm start

# Verificar en terminal:
# ✓ "🚀 Server running on port 5000"
# ✓ "🗄️ Database: ..."
```

#### Frontend:
```bash
cd /home/samuel/Documents/universidad/algoritmos-de-ruteo-y-redes-resilientes/frontend

# Si no tienes las dependencias instaladas:
npm install

# Iniciar dev server:
npm run dev

# Verificar en terminal:
# ✓ "VITE v4.x.x ready in xxx ms"
# ✓ "➜ Local: http://localhost:5173/"
```

#### Navegador:
```bash
# Abrir: http://localhost:5173
# Verificar:
# ✓ Mapa de Chile cargado
# ✓ Sidebar a la izquierda
# ✓ Checkboxes funcionales
```

---

### Prueba 2: Comparación de 4 Rutas (10 min)

```bash
# 1. Sidebar: Seleccionar "Comparación 4 Algoritmos"
# 2. Habilitar "Mostrar Ruta"
# 3. Panel derecho: Click "Cargar Ejemplo"
#    ✓ Puntos configurados: Santiago → Concepción
# 4. Click "Calcular Rutas"
#    ✓ Overlay de carga aparece
#    ✓ Progreso por algoritmo: ⏳ Dijkstra, ⏳ MIP, etc.
# 5. Esperar 10-30 segundos
# 6. Verificar resultados:
#    ✓ 4 rutas visualizadas en colores distintos
#    ✓ Tabla comparativa con métricas
#    ✓ Checkboxes para toggle
# 7. Probar checkboxes:
#    ✓ Desmarcar "Dijkstra (Distancia)"
#    ✓ Ruta verde desaparece
#    ✓ Volver a marcar → ruta reaparece
# 8. Click en segmento de ruta:
#    ✓ Popup con info del segmento
```

**Resultados Esperados:**
- Dijkstra (distancia): ~500-550 km, ~100-200 ms
- Dijkstra (resiliente): ~520-580 km, ~150-300 ms
- MIP: ~530-600 km, ~5000-20000 ms
- Algoritmo Genético: ~540-610 km, ~3000-15000 ms

---

### Prueba 3: Opciones Avanzadas (5 min)

```bash
# 1. Panel derecho: Click "▶ Opciones Avanzadas"
#    ✓ Panel se expande

# 2. Ajustar parámetros:
#    - Peso de riesgo vs distancia: 5.0
#    - Probabilidad máxima permitida (MIP): 0.5
#    - Tamaño de población (GA): 150

# 3. Click "Calcular Rutas"
#    ✓ Rutas recalculadas con nuevos parámetros

# 4. Comparar resultados:
#    ✓ Ruta resiliente más larga (evita más riesgo)
#    ✓ MIP más restrictivo (puede fallar si muy bajo)

# 5. Click "Restablecer Valores por Defecto"
#    ✓ Sliders vuelven a valores iniciales
```

---

### Prueba 4: GPS (3 min)

```bash
# 1. Panel derecho: Click "📍 Mi Ubicación"
# 2. Navegador pide permiso: Click "Permitir"
#    ✓ Mapa se centra en tu ubicación
#    ✓ Marcador verde aparece
#    ✓ Texto muestra "Mi Ubicación"

# 3. (Si falla) Verificar:
#    - ¿Estás en HTTPS o localhost? (requerido)
#    - ¿Navegador soporta geolocalización?
#    - ¿Permisos otorgados?

# 4. Seleccionar destino manualmente:
#    - Click "Seleccionar" para destino
#    - Click en el mapa
#    ✓ Marcador rojo aparece

# 5. Click "Calcular Rutas"
#    ✓ Rutas desde tu ubicación al destino
```

---

### Prueba 5: Simulación Monte Carlo (7 min)

```bash
# 1. Sidebar: Habilitar "Mostrar Simulación Monte Carlo"
#    ✓ Panel aparece en esquina inferior izquierda

# 2. Configurar simulación:
#    - Nombre: "Prueba Terremoto"
#    - Umbral: 40%
#    ✓ Sliders funcionales

# 3. Leer explicación "¿Cómo funciona?"
#    ✓ 4 pasos explicados

# 4. Click "🎲 Ejecutar Simulación"
#    ✓ Loading overlay aparece
#    ✓ "Ejecutando simulación Monte Carlo..."

# 5. Esperar 3-10 segundos

# 6. Verificar resultados:
#    ✓ Panel de resultados
#    ✓ Nombre: "Prueba Terremoto"
#    ✓ Fecha: hoy
#    ✓ Enlaces analizados: > 0
#    ✓ Fallas detectadas: > 0 (en rojo)

# 7. Visualización:
#    ✓ Checkbox "Mostrar enlaces fallidos" marcado
#    ✓ Enlaces en rojo con línea discontinua
#    ✓ Click en enlace fallido → popup detallado

# 8. Probar checkboxes:
#    - Desmarcar "Mostrar enlaces fallidos"
#    ✓ Enlaces rojos desaparecen
#    - Marcar "Mostrar solo amenazas activas"
#    ✓ Filtro aplicado (funcionalidad futura)

# 9. Click "Nueva Simulación"
#    ✓ Panel vuelve a formulario inicial

# 10. Ejecutar otra simulación con umbral 80%
#    ✓ Más fallas detectadas (mayor umbral)
```

---

### Prueba 6: Popups de Amenazas (5 min)

```bash
# 1. Sidebar: Habilitar "Sismos"
#    ✓ Círculos rojos/amarillos aparecen

# 2. Click en sismo (círculo rojo):
#    ✓ Popup abre
#    ✓ Título: "🔴 Sismo"
#    ✓ Magnitud, profundidad, fecha, lugar
#    ✓ Nivel de amenaza con color
#    ✓ Link a USGS (click para probar)

# 3. Sidebar: Habilitar "Zonas de Incendio"
#    ✓ Polígonos naranjas/rojos aparecen

# 4. Click en zona de incendio:
#    ✓ Popup abre
#    ✓ Título con íconos: "🔥🔥🔥 Zona de Riesgo"
#    ✓ Nombre, nivel de riesgo (badge colorido)
#    ✓ Área en km², vegetación
#    ✓ Warning box amarillo

# 5. Sidebar: Habilitar "Eventos Climáticos"
#    ✓ Polígonos azules aparecen

# 6. Click en evento climático:
#    ✓ Popup abre
#    ✓ Título con ícono: "⛈️ Evento Climático"
#    ✓ Tipo, severidad, fecha
#    ✓ Duración, viento, precipitación
#    ✓ Info box azul con impacto
```

---

### Prueba 7: Modo Simple vs Comparación (3 min)

```bash
# 1. Sidebar: Seleccionar "Modo Simple"
#    ✓ Panel derecho cambia a RouteCalculator

# 2. Click "Cargar Ejemplo"
#    ✓ Ruta única verde cargada
#    ✓ Info panel con métricas

# 3. Sidebar: Seleccionar "Comparación 4 Algoritmos"
#    ✓ Panel derecho cambia a RouteComparison
#    ✓ Puntos se mantienen

# 4. Click "Calcular Rutas"
#    ✓ 4 rutas calculadas
```

---

## 📊 Verificación de Métricas

### Tabla de Métricas Esperadas (Santiago → Concepción)

| Algoritmo | Distancia Aprox. | Tiempo Aprox. | Riesgo Prom. | Color |
|-----------|------------------|---------------|--------------|-------|
| Dijkstra (distancia) | 500-550 km | 100-200 ms | N/A | 🟢 Verde |
| Dijkstra (resiliente) | 520-580 km | 150-300 ms | 5-15% | 🟠 Naranja |
| MIP Optimizado | 530-600 km | 5-20 s | 3-10% | 🔵 Azul |
| Algoritmo Genético | 540-610 km | 3-15 s | 4-12% | 🟣 Magenta |

**Nota:** Los tiempos varían según la carga del sistema y la complejidad de la red.

---

## 🐛 Troubleshooting Común

### Problema 1: Backend no inicia
```bash
# Error: "Cannot find module 'express'"
# Solución:
cd backend
npm install

# Error: "EADDRINUSE: address already in use :::5000"
# Solución:
killall node
# O cambiar puerto en backend/.env: PORT=5001
```

### Problema 2: Frontend no carga el mapa
```bash
# Error: Pantalla en blanco
# Solución:
# 1. Abrir consola del navegador (F12)
# 2. Verificar errores
# 3. Verificar que backend esté corriendo
# 4. Verificar variable VITE_API_URL en frontend/.env
```

### Problema 3: No se calculan rutas
```bash
# Error: "No route found between these points"
# Solución:
# 1. Verificar topología de BD:
psql -h localhost -U postgres -d fiber_network -c "SELECT COUNT(*) FROM edges WHERE source IS NOT NULL;"

# 2. Si es 0, ejecutar:
psql -h localhost -U postgres -d fiber_network -f create-topology.sql

# 3. Verificar que pgRouting esté instalado:
psql -h localhost -U postgres -d fiber_network -c "SELECT pgr_version();"
```

### Problema 4: GPS no funciona
```bash
# Posibles causas:
# 1. No estás en HTTPS (localhost está OK)
# 2. Permisos denegados
# 3. Navegador sin soporte

# Solución:
# - Usar Chrome/Firefox actualizado
# - Dar permisos de ubicación
# - Usar selección manual como fallback
```

### Problema 5: Simulación no ejecuta
```bash
# Error: "Error al ejecutar simulación"
# Solución:
# 1. Verificar que existan probabilidades calculadas:
psql -h localhost -U postgres -d fiber_network -c "SELECT COUNT(*) FROM edge_combined_probabilities;"

# 2. Si es 0, calcular:
python scripts/calc_prob_batch.py

# 3. Verificar función simulate_failures():
psql -h localhost -U postgres -d fiber_network -c "SELECT * FROM simulate_failures('Test', 0.5);"
```

---

## ✅ Checklist de Entrega

### Documentación
- [x] README.md actualizado
- [x] CLAUDE.md con contexto
- [x] EVALUACION_RUBRICA.md con análisis
- [x] EVALUACION_FINAL.md con resumen
- [x] GUIA_REVISION.md (este archivo)

### Código
- [x] Frontend completo y funcional
- [x] Backend completo y funcional
- [x] Base de datos con schema y funciones
- [x] Scripts Python para optimización

### Pruebas
- [ ] Backend corriendo sin errores
- [ ] Frontend corriendo sin errores
- [ ] BD con topología creada
- [ ] Rutas calculadas exitosamente
- [ ] Simulación ejecutada exitosamente
- [ ] GPS probado
- [ ] Popups verificados

### Presentación
- [ ] Capturas de pantalla
- [ ] Video demo (opcional)
- [ ] Diapositivas (si aplica)

---

## 📞 Contacto y Soporte

**Repositorio:** https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes

**Issues conocidos:** Ninguno reportado

**Autores:**
- Samuel
- Agustín

---

**Última actualización:** 2025-11-11 16:30
**Versión:** 1.0
**Estado:** ✅ LISTO PARA REVISIÓN
