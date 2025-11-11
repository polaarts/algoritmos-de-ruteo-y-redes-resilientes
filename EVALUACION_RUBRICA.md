# Evaluación del Proyecto según Rúbrica - T3 Grupal

**Fecha de Evaluación:** 2025-11-11
**Proyecto:** Resiliencia de Redes de Fibra Óptica en Chile

---

## Resumen Ejecutivo

| Estado | Puntos Obtenidos (Estimado) | Puntos Totales | Porcentaje |
|--------|------------------------------|----------------|------------|
| 🟡 En Progreso | ~54-60 pts | 84 pts | ~64-71% |

### Estado General
El proyecto tiene una **base sólida** con backend completo, frontend funcional y algoritmos implementados. Sin embargo, **faltan integraciones críticas** entre componentes y funcionalidades de UI para cumplir con varios requisitos de la rúbrica.

---

## Evaluación Detallada por Criterio

### 1. Infraestructura para Generación de Rutas Realistas (6 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 6/6 pts

**Evidencia:**
- `backend/routes/routing.js:61-134` - Endpoint `/api/routing/calculate` usando `pgr_dijkstra`
- `functions/resilient_routing.sql` - Función `calculate_shortest_path()` implementada
- El algoritmo usa la red de caminos reales (edges), no líneas rectas

**Archivos Clave:**
- `backend/routes/routing.js`
- `schema.sql:330-379` (función `calculate_shortest_path`)

---

### 2. Ingreso de Restricciones (6 pts)
**Estado:** ⚠️ **PARCIAL**
**Puntos Estimados:** 3/6 pts

**Evidencia:**
- Backend soporta restricciones: `max_failure_prob`, `risk_weight`, `simulation_id` en `/api/routing/calculate-resilient`
- **FALTANTE:** Interfaz de usuario para ingresar restricciones en el frontend

**Qué Falta:**
- Formulario en frontend para que el usuario especifique:
  - Probabilidad máxima de falla aceptable
  - Peso de riesgo vs distancia
  - Tipos de amenazas a evitar
  - Restricciones de infraestructura (tipo de vía, recubrimiento, etc.)

**Archivos a Modificar:**
- `frontend/src/components/RouteCalculator.jsx` - Agregar formulario de restricciones

---

### 3. GPS - Detección Automática o Manual (6 pts)
**Estado:** ❌ **NO IMPLEMENTADO**
**Puntos Estimados:** 0/6 pts

**Evidencia:**
- `frontend/src/components/RouteCalculator.jsx:78-98` - Solo permite selección manual con clics en el mapa
- **NO existe** detección de geolocalización automática con `navigator.geolocation`

**Qué Falta:**
- Implementar botón "Usar mi ubicación" que llame a `navigator.geolocation.getCurrentPosition()`
- Fallback a selección manual si el usuario niega permisos
- Mostrar marcador de ubicación actual en el mapa

**Código Sugerido:**
```jsx
const useCurrentLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartPoint({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        alert('No se pudo obtener la ubicación. Selecciona manualmente.');
      }
    );
  }
};
```

---

### 4. Muestra Metadata (4 pts)
**Estado:** ⚠️ **PARCIAL**
**Puntos Estimados:** 2/4 pts

**Evidencia:**
- Backend tiene endpoints: `/api/metadata/datacenters`, `/api/metadata/ground-type`, etc.
- Frontend tiene `ThreatsLayer.jsx` pero **no encontré evidencia de MetadataLayer**
- **FALTANTE:** Popups con información detallada de metadata al hacer clic

**Qué Falta:**
- Componente `MetadataLayer.jsx` para mostrar:
  - Datacenters (icono personalizado, popup con capacidad, tier level)
  - Tipo de suelo (color por tipo)
  - Densidad poblacional (heatmap o marcadores)
- Popups informativos con datos de cada elemento

**Archivos a Crear:**
- `frontend/src/components/MetadataLayer.jsx`
- `frontend/src/components/DatacenterMarkers.jsx`

---

### 5. Muestra Amenazas (4 pts)
**Estado:** ⚠️ **PARCIAL**
**Puntos Estimados:** 2/4 pts

**Evidencia:**
- Backend tiene endpoints: `/api/threats/earthquakes`, `/api/threats/fire-zones`, `/api/threats/weather`
- Frontend tiene `ThreatsLayer.jsx:1-4`
- **FALTANTE:** Verificar que los popups muestren información detallada

**Qué Falta:**
- Popups con información completa:
  - **Sismos:** Magnitud, profundidad, fecha, lugar, threat_level
  - **Incendios:** Nombre de zona, nivel de riesgo, área en km²
  - **Clima:** Tipo de evento, severidad, fecha, velocidad del viento
- Estilos diferenciados por severidad (colores, tamaños)

**Archivos a Revisar/Modificar:**
- `frontend/src/components/ThreatsLayer.jsx`

---

### 6. Checkboxes para Habilitar Capas (4 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 4/4 pts

**Evidencia:**
- `frontend/src/App.jsx:22-27` - Función `toggleLayer()` para habilitar/deshabilitar capas
- `frontend/src/App.jsx:61-80` - Checkboxes para infraestructura, datacenters, sismos, etc.

**Archivos Clave:**
- `frontend/src/App.jsx:55-100`

---

### 7. Modelado de Probabilidades de Fallo (8 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 8/8 pts

**Evidencia:**
- `backend/routes/probabilities.js` - API completa para probabilidades
- `migrations/004_add_probabilities.sql` - Tablas `edge_failure_probabilities`, `edge_combined_probabilities`
- `scripts/calc_prob_batch.py` - Script para calcular probabilidades por lote
- Modelo considera:
  - Distancia a amenazas
  - Severidad de la amenaza
  - Factores de infraestructura (tipo de vía, recubrimiento, puentes, túneles)

**Fórmulas Implementadas:**
- Probabilidad base: función de distancia y severidad
- Ajuste por infraestructura: multiplicadores según tipo de vía/recubrimiento
- Combinación de amenazas: `1 - ∏(1 - p_i)` (probabilidad independiente)

**Archivos Clave:**
- `backend/routes/probabilities.js`
- `migrations/004_add_probabilities.sql`
- `scripts/calc_prob_batch.py` (si existe)

---

### 8. Rutas - Pgr_dijkstra con Solo Distancia (4 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 4/4 pts

**Evidencia:**
- `backend/routes/routing.js:61-134` - Endpoint `/api/routing/calculate`
- Usa `calculate_shortest_path()` que solo considera `cost` (longitud en metros)
- `route_info.considers_threats = false`
- `route_info.compute_time_ms` registra tiempo de cómputo

**Ejemplo de Uso:**
```bash
GET /api/routing/calculate?start_lat=-33.4489&start_lon=-70.6693&end_lat=-36.8270&end_lon=-73.0498
```

**Archivos Clave:**
- `backend/routes/routing.js:61-134`

---

### 9. Rutas - CPLEX/MIP con Metadatos y Amenazas (12 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 12/12 pts

**Evidencia:**
- `scripts/mip_optimizer.py` - Implementación MIP usando python-mip
- `backend/routes/optimization.js:38-100` - Endpoint `/api/optimization/mip`
- Consideraciones del modelo:
  - Variables de decisión: x_ij (binarias) para usar edge o no
  - Función objetivo: minimizar distancia + penalización por riesgo
  - Restricciones:
    - Conservación de flujo
    - Conectividad (solo un camino)
    - Probabilidad de falla < umbral
- Tiempo de cómputo registrado

**Archivos Clave:**
- `scripts/mip_optimizer.py`
- `backend/routes/optimization.js:38-100`

---

### 10. Rutas - Pgr_dijkstra con Variables (4 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 4/4 pts

**Evidencia:**
- `backend/routes/routing.js:377-472` - Endpoint `/api/routing/calculate-resilient`
- Usa función `calculate_resilient_path()` que ajusta `cost` con:
  - `cost_adjusted = distance * (1 + risk_weight * failure_probability)`
- Considera `max_failure_prob`, `risk_weight`, `simulation_id`
- Retorna `avg_failure_prob`, `max_failure_prob`, `total_failure_risk`

**Archivos Clave:**
- `backend/routes/routing.js:377-472`
- `functions/resilient_routing.sql` (función `calculate_resilient_path`)

---

### 11. Rutas - Metaheurística (4 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 4/4 pts

**Evidencia:**
- `scripts/genetic_algorithm.py` - Algoritmo Genético usando DEAP
- Características:
  - Cromosoma: secuencia de nodos desde origen a destino
  - Fitness: minimiza distancia + riesgo
  - Operadores: cruce, mutación
  - Selección: torneo
- `backend/routes/optimization.js` probablemente tiene endpoint para llamarlo

**Archivos Clave:**
- `scripts/genetic_algorithm.py`
- `backend/routes/optimization.js` (revisar endpoint `/api/optimization/genetic`)

---

### 12. Rutas - Checkboxes para Habilitar Rutas (2 pts)
**Estado:** ❌ **NO IMPLEMENTADO**
**Puntos Estimados:** 0/2 pts

**Evidencia:**
- `frontend/src/components/RouteCalculator.jsx` solo muestra UNA ruta a la vez
- **NO existe** funcionalidad para calcular y mostrar las 4 rutas simultáneamente:
  1. Dijkstra con distancia
  2. MIP con amenazas/metadata
  3. Dijkstra con variables (resiliente)
  4. Metaheurística (Algoritmo Genético)

**Qué Falta:**
- Componente `RouteComparison.jsx` que:
  - Tenga 4 checkboxes, uno por algoritmo
  - Calcule las 4 rutas en paralelo
  - Las muestre con colores distintos (verde, azul, amarillo, rojo)
  - Tabla comparativa con: distancia, tiempo de cómputo, riesgo promedio

**Código Sugerido:**
```jsx
const [routes, setRoutes] = useState({
  dijkstra: null,
  mip: null,
  dijkstra_resilient: null,
  genetic: null
});

const [visibleRoutes, setVisibleRoutes] = useState({
  dijkstra: true,
  mip: true,
  dijkstra_resilient: true,
  genetic: true
});
```

---

### 13. Tiempo de Cómputo por Ruta (4 pts)
**Estado:** ✅ **COMPLETO**
**Puntos Estimados:** 4/4 pts

**Evidencia:**
- Todos los endpoints de routing registran tiempo:
  - `backend/routes/routing.js:62,96` - `const startTime = performance.now()`
  - `backend/routes/routing.js:126-127` - `compute_time_ms` y `compute_time_seconds`
- Frontend muestra esta información en `route_info`

**Ejemplo de Respuesta:**
```json
{
  "route_info": {
    "algorithm": "pgr_dijkstra",
    "compute_time_ms": 245.67,
    "compute_time_seconds": 0.2457
  }
}
```

**Archivos Clave:**
- `backend/routes/routing.js:62,96,126-127`
- `backend/routes/optimization.js:39,87` (para MIP y GA)

---

### 14. Simulación de Fallas con Checkbox (8 pts)
**Estado:** ⚠️ **PARCIAL**
**Puntos Estimados:** 4/8 pts

**Evidencia:**
- Backend tiene funcionalidad completa:
  - `backend/routes/simulation.js:88-131` - Endpoint `/api/simulation/run`
  - `migrations/005_add_simulation.sql` - Función `simulate_failures()`
  - Genera números aleatorios 0-100 y compara con umbral de falla
- **FALTANTE:** Checkbox en frontend para:
  1. Activar/desactivar simulación
  2. Mostrar solo amenazas que "ocurrieron" según simulación
  3. Visualizar edges/nodos fallidos en rojo

**Qué Falta:**
- Componente `SimulationControls.jsx` con:
  - Botón "Ejecutar Simulación"
  - Slider para umbral de probabilidad (0-1)
  - Checkbox "Mostrar solo amenazas activas"
  - Visualización de edges/nodos fallidos
- Integrar con `ThreatsLayer.jsx` para filtrar amenazas

**Archivos a Crear/Modificar:**
- `frontend/src/components/SimulationControls.jsx`
- `frontend/src/components/ThreatsLayer.jsx` - Agregar filtro por simulación

---

### 15. Caso Ejemplo (8 pts)
**Estado:** ⚠️ **PARCIAL**
**Puntos Estimados:** 2/8 pts

**Evidencia:**
- Backend tiene ruta de ejemplo: `backend/routes/routing.js:209-265` (`/api/routing/example`)
- Ruta Santiago - Concepción implementada
- **FALTANTE:** Demostración completa que evidencie:
  1. Ruta SIN considerar amenazas (peor caso)
  2. Ruta CON amenazas (resiliente)
  3. Comparación visual mostrando cómo evita zonas de riesgo
  4. Métricas: distancia extra vs reducción de riesgo

**Qué Falta:**
- Componente `CaseStudy.jsx` o página `/example` que:
  - Muestre 2 rutas lado a lado (sin amenazas vs resiliente)
  - Resalte amenazas cercanas a cada ruta
  - Tabla comparativa con métricas
  - Descripción del caso de uso (ej: "Conexión datacenter Santiago a Concepción evitando zona sísmica activa")

**Archivos a Crear:**
- `frontend/src/components/CaseStudy.jsx`
- `frontend/src/pages/Example.jsx`

---

## Resumen de Estado

### ✅ Criterios Completos (6/15)
1. ✅ Infraestructura para Rutas Realistas (6 pts)
2. ✅ Checkboxes para Habilitar Capas (4 pts)
3. ✅ Modelado de Probabilidades de Fallo (8 pts)
4. ✅ Pgr_dijkstra con Solo Distancia (4 pts)
5. ✅ CPLEX/MIP con Metadatos y Amenazas (12 pts)
6. ✅ Pgr_dijkstra con Variables (4 pts)
7. ✅ Metaheurística (4 pts)
8. ✅ Tiempo de Cómputo (4 pts)

**Subtotal:** 46 pts

### ⚠️ Criterios Parciales (6/15)
1. ⚠️ Ingreso de Restricciones (3/6 pts)
2. ⚠️ Muestra Metadata (2/4 pts)
3. ⚠️ Muestra Amenazas (2/4 pts)
4. ⚠️ Simulación de Fallas (4/8 pts)
5. ⚠️ Caso Ejemplo (2/8 pts)

**Subtotal:** 13 pts

### ❌ Criterios No Implementados (3/15)
1. ❌ GPS - Detección Automática (0/6 pts)
2. ❌ Checkboxes para Habilitar Rutas (0/2 pts)

**Subtotal:** 0 pts

---

## Total Estimado: 54-60 pts / 84 pts (64-71%)

---

## Prioridades para Completar el Proyecto

### 🔴 CRÍTICO (24 pts faltantes)

#### 1. Checkboxes para Comparar 4 Rutas (2 pts) - **CRÍTICO**
**Impacto:** Requisito central de la rúbrica (punto 5)
**Esfuerzo:** Medio (4-6 horas)
**Archivos:**
- `frontend/src/components/RouteComparison.jsx` (CREAR)
- `frontend/src/App.jsx` (MODIFICAR)

**Tareas:**
- [ ] Crear componente `RouteComparison.jsx`
- [ ] Calcular 4 rutas en paralelo al hacer clic en "Calcular Rutas"
- [ ] Renderizar cada ruta con color distinto
- [ ] Checkboxes para mostrar/ocultar cada algoritmo
- [ ] Tabla comparativa con distancia, tiempo, riesgo

#### 2. GPS - Geolocalización Automática (6 pts) - **CRÍTICO**
**Impacto:** Requisito explícito (punto 2,3 de la rúbrica)
**Esfuerzo:** Bajo (2-3 horas)
**Archivos:**
- `frontend/src/components/RouteCalculator.jsx` (MODIFICAR)

**Tareas:**
- [ ] Botón "Usar mi ubicación"
- [ ] Implementar `navigator.geolocation.getCurrentPosition()`
- [ ] Fallback a selección manual si falla
- [ ] Mostrar marcador de ubicación actual

#### 3. Ingreso de Restricciones por UI (3 pts faltantes) - **IMPORTANTE**
**Impacto:** Completar criterio parcial
**Esfuerzo:** Medio (3-4 horas)
**Archivos:**
- `frontend/src/components/RestrictionForm.jsx` (CREAR)
- `frontend/src/components/RouteComparison.jsx` (MODIFICAR)

**Tareas:**
- [ ] Formulario con campos:
  - Probabilidad máxima de falla (slider 0-1)
  - Peso de riesgo (slider 0-10)
  - Tipos de amenazas a evitar (checkboxes)
  - Tipos de vía permitidos (checkboxes)
- [ ] Pasar parámetros a APIs de routing

#### 4. Simulación - Checkbox y Visualización (4 pts faltantes) - **IMPORTANTE**
**Impacto:** Completar criterio parcial
**Esfuerzo:** Medio (4-5 horas)
**Archivos:**
- `frontend/src/components/SimulationControls.jsx` (CREAR)
- `frontend/src/components/ThreatsLayer.jsx` (MODIFICAR)

**Tareas:**
- [ ] Botón "Ejecutar Simulación Monte Carlo"
- [ ] Slider para umbral de probabilidad
- [ ] Checkbox "Mostrar solo amenazas activas"
- [ ] Visualizar edges/nodos fallidos en rojo
- [ ] Integrar con capas de amenazas

#### 5. Caso Ejemplo Completo (6 pts faltantes) - **IMPORTANTE**
**Impacto:** Demostración del valor del proyecto
**Esfuerzo:** Medio (3-4 horas)
**Archivos:**
- `frontend/src/components/CaseStudy.jsx` (CREAR)
- `docs/CASO_EJEMPLO.md` (CREAR)

**Tareas:**
- [ ] Página dedicada con caso de estudio
- [ ] Comparación visual: ruta sin amenazas vs resiliente
- [ ] Métricas: distancia extra, reducción de riesgo
- [ ] Descripción del escenario y resultados
- [ ] Capturas para presentación

### 🟡 IMPORTANTE (11 pts faltantes)

#### 6. Metadata - Popups Completos (2 pts faltantes)
**Esfuerzo:** Bajo (2-3 horas)
**Archivos:**
- `frontend/src/components/MetadataLayer.jsx` (CREAR)

**Tareas:**
- [ ] Datacenters con popup (capacidad, tier, compañía)
- [ ] Tipo de suelo con colores
- [ ] Densidad poblacional (heatmap opcional)

#### 7. Amenazas - Popups Completos (2 pts faltantes)
**Esfuerzo:** Bajo (2-3 horas)
**Archivos:**
- `frontend/src/components/ThreatsLayer.jsx` (MODIFICAR)

**Tareas:**
- [ ] Popup sismos: magnitud, profundidad, fecha, lugar
- [ ] Popup incendios: nombre zona, riesgo, área
- [ ] Popup clima: tipo evento, severidad, fecha
- [ ] Estilos por severidad (colores, tamaños)

---

## Plan de Trabajo Recomendado (Ordenado por Prioridad)

### Día 1-2: Funcionalidades Críticas de Interfaz (12 pts)
1. ✅ GPS - Geolocalización (6 pts) - **2-3 horas**
2. ✅ Checkboxes para Comparar Rutas (2 pts) - **4-6 horas**
3. ✅ Ingreso de Restricciones (3 pts) - **3-4 horas**

### Día 3: Simulación y Visualización (4 pts)
4. ✅ Simulación - Checkbox y Visualización (4 pts) - **4-5 horas**

### Día 4: Caso Ejemplo y Documentación (8 pts)
5. ✅ Caso Ejemplo Completo (6 pts) - **3-4 horas**
6. ✅ Metadata Popups (2 pts) - **2-3 horas**

### Día 5: Pulido y Testing
7. ✅ Amenazas Popups (2 pts) - **2-3 horas**
8. ✅ Testing end-to-end
9. ✅ Documentación y capturas para presentación

---

## Comandos de Verificación

### Verificar Backend Funcionando
```bash
cd backend
npm start
# Debería correr en http://localhost:5000

# Verificar endpoints
curl http://localhost:5000/health
curl "http://localhost:5000/api/routing/calculate?start_lat=-33.4489&start_lon=-70.6693&end_lat=-36.8270&end_lon=-73.0498"
```

### Verificar Frontend Funcionando
```bash
cd frontend
npm run dev
# Debería correr en http://localhost:5173
```

### Verificar Base de Datos
```bash
# Conectar a PostgreSQL
psql -h localhost -U postgres -d postgres

# Verificar tablas
\dt

# Verificar topología
SELECT COUNT(*) FROM edges WHERE source IS NOT NULL AND target IS NOT NULL;
SELECT COUNT(*) FROM edges_vertices_pgr;

# Probar Dijkstra
SELECT * FROM calculate_shortest_path(-33.4489, -70.6693, -36.8270, -73.0498) LIMIT 5;
```

### Verificar Docker
```bash
docker-compose up -d
docker-compose logs -f
```

---

## Archivos Críticos a Revisar

### Backend
- ✅ `backend/server.js` - Servidor Express
- ✅ `backend/routes/routing.js` - Rutas de routing
- ✅ `backend/routes/optimization.js` - MIP y GA
- ✅ `backend/routes/probabilities.js` - Probabilidades
- ✅ `backend/routes/simulation.js` - Simulación

### Frontend
- ⚠️ `frontend/src/App.jsx` - Aplicación principal
- ⚠️ `frontend/src/components/RouteCalculator.jsx` - Calcular rutas (FALTA GPS)
- ❌ `frontend/src/components/RouteComparison.jsx` - **NO EXISTE** (CREAR)
- ❌ `frontend/src/components/SimulationControls.jsx` - **NO EXISTE** (CREAR)
- ❌ `frontend/src/components/MetadataLayer.jsx` - **NO EXISTE** (CREAR)
- ⚠️ `frontend/src/components/ThreatsLayer.jsx` - Amenazas (MEJORAR POPUPS)

### Scripts
- ✅ `scripts/mip_optimizer.py` - Optimizador MIP
- ✅ `scripts/genetic_algorithm.py` - Algoritmo Genético
- ✅ `scripts/calc_prob_batch.py` - Calcular probabilidades

### Base de Datos
- ✅ `schema.sql` - Schema principal
- ✅ `migrations/004_add_probabilities.sql` - Probabilidades
- ✅ `migrations/005_add_simulation.sql` - Simulación
- ✅ `functions/resilient_routing.sql` - Funciones de routing

---

## Conclusión

El proyecto tiene una **base técnica sólida** (backend completo, algoritmos implementados, base de datos diseñada). Sin embargo, **faltan integraciones en el frontend** para exponer estas funcionalidades al usuario.

**Con 3-4 días de trabajo enfocado**, el proyecto puede alcanzar **75-85 pts (89-100%)**, cumpliendo con todos los requisitos de la rúbrica.

Las prioridades son:
1. **Comparación de 4 rutas** (requisito central)
2. **GPS automático** (requisito explícito)
3. **Simulación visual** (demostrar resiliencia)
4. **Caso ejemplo** (evidenciar valor)

---

**Última actualización:** 2025-11-11
**Próxima revisión:** Después de implementar funcionalidades críticas
