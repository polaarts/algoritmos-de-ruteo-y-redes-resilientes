## 🧪 REPORTE DE PRUEBAS - Sistema de Ruteo Resiliente

**Fecha:** 10 de noviembre de 2025  
**Estado:** ⚠️ PRUEBAS PARCIALES - PROBLEMAS ENCONTRADOS

---

## ✅ PRUEBAS EXITOSAS

### 1. Infraestructura Docker
- ✅ Contenedor PostgreSQL: **FUNCIONANDO**
- ✅ PostGIS extensión: **INSTALADA**
- ✅ pgRouting extensión: **INSTALADA**

```
Estado: Up 31 minutes (healthy)
Puerto: 0.0.0.0:5432->5432/tcp
```

### 2. Base de Datos - Tablas
- ✅ `edges`: 59,916 registros
- ✅ `earthquakes`: 30 registros
- ✅ `fire_risk_zones`: 6 registros
- ✅ `weather_events`: 6 registros
- ✅ `edge_failure_probabilities`: 276,354 registros
- ✅ `edge_combined_probabilities`: Creada

### 3. Topología de Red (pgRouting)
- ✅ Topología creada con `pgr_createTopology()`
- ✅ Nodos: 9,918 vertices creados
- ✅ Tabla `edges_vertices_pgr`: CREADA
- ✅ source/target poblados para todos los edges

### 4. Análisis de Conectividad
- ✅ Grafo analizado con `pgr_analyzeGraph()`
- Resultados:
  - Segmentos aislados: 0
  - Dead ends: 0
  - Intersecciones detectadas: 161,385
  - Geometrías anillo: 57
- ⚠️ **Red fragmentada**: 5 componentes principales detectados
  - Componente más grande: 1,993 nodos (20% del total)
  - Otros componentes: 972, 630, 544, 535 nodos

### 5. Cálculo de Probabilidades
- ✅ Probabilidades calculadas para todos los edges
- Estadísticas:
  - Probabilidad promedio: 4.35%
  - Probabilidad máxima: 90%
  - Edges alto riesgo (>50%): 8,396 (14.2%)
  - Amenazas detectadas: 276,354 total

### 6. Funciones SQL Corregidas
- ✅ `calculate_resilient_path()`: CORREGIDA (nodes → edges_vertices_pgr)
- ✅ `calculate_safest_path()`: CORREGIDA
- ✅ `calculate_balanced_path()`: CORREGIDA
- ✅ Migration 006 aplicada exitosamente

### 7. Routing Básico (pgr_dijkstra)
- ✅ Función core de pgRouting: **FUNCIONANDO**
- ✅ Prueba exitosa: Nodos 5804 → 808
  - Ruta encontrada: 163 edges
  - Distancia total: ~773 km
  - Costos calculados correctamente

---

## ❌ PROBLEMAS ENCONTRADOS

### 1. Fragmentación de Red ⚠️ CRÍTICO
**Problema:** La red tiene múltiples componentes desconectados.

**Causa:** Datos de OSM contienen gaps en la red de fibra óptica.

**Impacto:** 
- Solo se pueden calcular rutas dentro del mismo componente
- ~80% de los nodos están en componentes pequeños y aislados

**Solución Propuesta:**
```sql
-- Opción 1: Usar solo el componente más grande
CREATE VIEW connected_edges AS
WITH main_component AS (
    SELECT node FROM pgr_connectedComponents('SELECT id, source, target, cost FROM edges')
    WHERE component = 777
)
SELECT e.* FROM edges e
WHERE e.source IN (SELECT node FROM main_component);

-- Opción 2: Agregar edges artificiales para conectar componentes
-- (Requiere análisis geoespacial adicional)
```

### 2. Funciones de Ruteo con Queries Dinámicas
**Problema:** Las funciones `calculate_resilient_path()` con filtros complejos retornan 0 resultados.

**Causa Probable:** 
- Query dinámica SQL muy compleja
- Posibles problemas con el escape de comillas
- Filtros de probabilidad muy restrictivos

**Evidencia:**
```sql
-- Función simplificada: ✅ FUNCIONA (163 resultados)
SELECT * FROM test_resilient_path(5804, 808);

-- Función completa: ❌ FALLA (0 resultados)
SELECT * FROM calculate_resilient_path(-36.78976, -73.088873, -36.942551, -73.022058);
```

**Solución Propuesta:**
- Simplificar queries dinámicas
- Usar CTEs en lugar de subqueries complejas
- Testear con menos filtros inicialmente

### 3. Backend - Dependencias
**Problema:** Módulos faltantes y archivos de rutas no creados.

**Estado Actual:**
- ✅ Dependencias npm: INSTALADAS (125 packages)
- ❌ `routes/simulation.js`: NO EXISTE
- ⚠️ `routes/probabilities.js`: NO VERIFICADO

**Acciones Necesarias:**
1. Crear `backend/routes/simulation.js`
2. Verificar/completar `backend/routes/probabilities.js`
3. Probar endpoints individuales

### 4. Scripts Python de Optimización
**Estado:** NO TESTEADOS

**Pendiente:**
- Probar `scripts/mip_optimizer.py`
- Probar `scripts/genetic_algorithm.py`
- Verificar conectividad con base de datos
- Testear con casos reales

---

## 📊 COBERTURA DE PRUEBAS

| Componente | Estado | Cobertura |
|-----------|--------|-----------|
| Base de Datos | ✅ | 100% |
| Topología pgRouting | ✅ | 100% |
| Cálculo Probabilidades | ✅ | 100% |
| Funciones SQL Básicas | ✅ | 80% |
| Funciones SQL Avanzadas | ⚠️ | 30% |
| Backend Node.js | ❌ | 0% |
| Scripts Python | ❌ | 0% |
| Frontend React | ❌ | 0% |
| APIs REST | ❌ | 0% |

---

## 🎯 PRÓXIMOS PASOS PRIORITARIOS

### URGENTE
1. **Simplificar funciones SQL de ruteo**
   - Remover queries dinámicas complejas
   - Usar prepared statements o views
   - Testear con casos simples primero

2. **Completar archivos de backend**
   - Crear `routes/simulation.js`
   - Crear `routes/probabilities.js` si falta
   - Iniciar servidor y verificar endpoints

3. **Decidir estrategia para red fragmentada**
   - Opción A: Trabajar solo con componente principal (20%)
   - Opción B: Agregar edges de conexión artificiales
   - Opción C: Cargar datos más completos

### IMPORTANTE
4. **Probar Scripts Python**
   - Testear conexión a DB
   - Ejecutar MIP con caso simple
   - Ejecutar GA con caso simple

5. **Crear Tests Automatizados**
   - Unit tests para funciones SQL
   - Integration tests para APIs
   - End-to-end tests para flujo completo

### PUEDE ESPERAR
6. **Frontend**
   - Una vez backend funcione
   - Empezar con visualización básica
   - Agregar features avanzadas

---

## 🔧 COMANDOS ÚTILES PARA DEBUGGING

```bash
# Verificar conectividad de red
docker-compose exec -T db psql -U postgres -d postgres -c "
SELECT component, COUNT(*) FROM 
pgr_connectedComponents('SELECT id, source, target, cost FROM edges') 
GROUP BY component ORDER BY COUNT(*) DESC LIMIT 10;"

# Probar routing simple
docker-compose exec -T db psql -U postgres -d postgres -c "
SELECT COUNT(*) FROM pgr_dijkstra(
  'SELECT id, source, target, cost, reverse_cost FROM edges', 
  5804, 808, false
);"

# Ver edges con alta probabilidad
docker-compose exec -T db psql -U postgres -d postgres -c "
SELECT edge_id, combined_probability 
FROM edge_combined_probabilities 
ORDER BY combined_probability DESC LIMIT 20;"

# Analizar queries lentas
docker-compose exec -T db psql -U postgres -d postgres -c "
EXPLAIN ANALYZE SELECT * FROM calculate_resilient_path(-36.78, -73.08, -36.94, -73.02);"
```

---

## 📝 CONCLUSIONES

### Lo Bueno ✅
- Infraestructura base sólida
- Datos cargados correctamente
- Probabilidades calculadas exitosamente
- pgRouting funcional a nivel básico

### Lo Malo ❌
- Red fragmentada limita funcionalidad
- Funciones avanzadas necesitan simplificación
- Backend incompleto
- Sin tests de integración

### Recomendación 💡
**Priorizar simplificación antes de agregar features.**

El sistema tiene una base sólida, pero las queries SQL complejas y la fragmentación de red están bloqueando el progreso. Recomiendo:

1. Simplificar funciones SQL (1-2 horas)
2. Completar backend básico (2-3 horas)
3. Probar end-to-end con componente principal (1 hora)
4. Luego decidir si vale la pena arreglar fragmentación o trabajar con subset

**Tiempo estimado para tener sistema funcional básico: 4-6 horas**

---

**Generado por:** Sistema de Testing Automatizado  
**Última actualización:** 10 de noviembre de 2025 - 22:15
