-- ============================================================================
-- MÉTODO MANUAL CORREGIDO: CREAR TOPOLOGÍA SIN pgr_createTopology
-- ============================================================================

-- PASO 1: Verificar que tienes datos en edges
SELECT COUNT(*) as total_edges FROM edges;

-- PASO 2: Limpiar tabla de vértices si existe
DROP TABLE IF EXISTS edges_vertices_pgr CASCADE;

-- PASO 3: Crear tabla de vértices
CREATE TABLE edges_vertices_pgr (
    id BIGSERIAL PRIMARY KEY,
    cnt INTEGER DEFAULT 0,
    chk INTEGER DEFAULT 0,
    ein INTEGER DEFAULT 0,
    eout INTEGER DEFAULT 0,
    the_geom GEOMETRY(Point, 4326)
);

-- PASO 4: Extraer todos los puntos únicos (inicio y fin de cada edge)
WITH all_points AS (
    SELECT ST_StartPoint(geometry) as geom
    FROM edges
    WHERE geometry IS NOT NULL AND ST_IsValid(geometry)
    
    UNION
    
    SELECT ST_EndPoint(geometry) as geom
    FROM edges
    WHERE geometry IS NOT NULL AND ST_IsValid(geometry)
)
INSERT INTO edges_vertices_pgr (the_geom)
SELECT DISTINCT geom 
FROM all_points
WHERE geom IS NOT NULL;

-- PASO 5: Verificar vértices creados
SELECT COUNT(*) as total_vertices FROM edges_vertices_pgr;

-- PASO 6: Crear índice espacial en vértices
CREATE INDEX idx_edges_vertices_pgr_geom 
ON edges_vertices_pgr USING GIST(the_geom);

-- PASO 7: Poblar columna SOURCE (SINTAXIS CORREGIDA)
UPDATE edges e
SET source = (
    SELECT v.id
    FROM edges_vertices_pgr v
    ORDER BY ST_Distance(ST_StartPoint(e.geometry), v.the_geom)
    LIMIT 1
)
WHERE e.source IS NULL;

-- PASO 8: Poblar columna TARGET (SINTAXIS CORREGIDA)
UPDATE edges e
SET target = (
    SELECT v.id
    FROM edges_vertices_pgr v
    ORDER BY ST_Distance(ST_EndPoint(e.geometry), v.the_geom)
    LIMIT 1
)
WHERE e.target IS NULL;

-- PASO 9: Calcular costos si no están poblados
UPDATE edges 
SET cost = CASE 
    WHEN length IS NOT NULL AND length > 0 THEN length
    ELSE ST_Length(geometry::geography)
END
WHERE cost IS NULL;

UPDATE edges 
SET reverse_cost = CASE 
    WHEN oneway = TRUE THEN 1000000
    WHEN length IS NOT NULL AND length > 0 THEN length
    ELSE ST_Length(geometry::geography)
END
WHERE reverse_cost IS NULL;

-- PASO 10: Crear índices en source/target
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source, target);

-- PASO 11: VERIFICACIÓN COMPLETA
SELECT 
    'Total edges' as metric,
    COUNT(*)::text as value
FROM edges

UNION ALL

SELECT 
    'Edges with source',
    COUNT(*)::text
FROM edges
WHERE source IS NOT NULL

UNION ALL

SELECT 
    'Edges with target',
    COUNT(*)::text
FROM edges
WHERE target IS NOT NULL

UNION ALL

SELECT 
    'Edges with cost',
    COUNT(*)::text
FROM edges
WHERE cost IS NOT NULL AND cost > 0

UNION ALL

SELECT 
    'Total vertices',
    COUNT(*)::text
FROM edges_vertices_pgr

UNION ALL

SELECT
    'Edges ready for routing',
    COUNT(*)::text
FROM edges
WHERE source IS NOT NULL 
  AND target IS NOT NULL 
  AND cost > 0
  AND reverse_cost > 0;