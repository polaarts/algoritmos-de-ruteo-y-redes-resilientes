-- ============================================================================
-- FUNCIONES: Ruteo Resiliente con pgRouting
-- ============================================================================
-- Descripción: Funciones para calcular rutas considerando amenazas
-- Autor: GitHub Copilot
-- Fecha: 10 de noviembre de 2025
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: Calcular ruta resiliente (Dijkstra con probabilidades)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_resilient_path(
    p_start_lat DOUBLE PRECISION,
    p_start_lon DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lon DOUBLE PRECISION,
    p_max_failure_prob DOUBLE PRECISION DEFAULT 0.3,
    p_risk_weight DOUBLE PRECISION DEFAULT 2.0,
    p_exclude_simulation_id UUID DEFAULT NULL
) RETURNS TABLE (
    seq INTEGER,
    path_seq INTEGER,
    node BIGINT,
    edge BIGINT,
    cost DOUBLE PRECISION,
    agg_cost DOUBLE PRECISION,
    failure_prob DOUBLE PRECISION,
    geom GEOMETRY
) AS $$
DECLARE
    v_start_node_id BIGINT;
    v_end_node_id BIGINT;
BEGIN
    -- Encontrar nodos más cercanos
    SELECT id INTO v_start_node_id
    FROM nodes
    ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)
    LIMIT 1;
    
    SELECT id INTO v_end_node_id
    FROM nodes
    ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)
    LIMIT 1;
    
    IF v_start_node_id IS NULL OR v_end_node_id IS NULL THEN
        RAISE EXCEPTION 'No se encontraron nodos cercanos';
    END IF;
    
    -- Ejecutar pgr_dijkstra con costos ajustados
    RETURN QUERY
    WITH adjusted_edges AS (
        SELECT
            e.id,
            e.source,
            e.target,
            -- Costo ajustado = distancia * (1 + peso_riesgo * probabilidad_falla)
            e.cost * (1 + p_risk_weight * COALESCE(ecp.combined_probability, 0)) as adjusted_cost,
            e.reverse_cost * (1 + p_risk_weight * COALESCE(ecp.combined_probability, 0)) as adjusted_reverse_cost,
            COALESCE(ecp.combined_probability, 0) as failure_prob,
            e.geometry
        FROM edges e
        LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
        WHERE 
            -- Excluir edges con probabilidad muy alta
            COALESCE(ecp.combined_probability, 0) < p_max_failure_prob
            -- Excluir edges fallados en simulación activa
            AND (
                p_exclude_simulation_id IS NULL
                OR NOT EXISTS (
                    SELECT 1 FROM simulated_failures sf
                    WHERE sf.simulation_id = p_exclude_simulation_id
                    AND sf.element_type = 'edge'
                    AND sf.element_id = e.id
                    AND sf.failed = true
                )
            )
    )
    SELECT
        r.seq,
        r.path_seq,
        r.node,
        r.edge,
        r.cost,
        r.agg_cost,
        COALESCE(ae.failure_prob, 0) as failure_prob,
        ae.geometry as geom
    FROM pgr_dijkstra(
        'SELECT id, source, target, adjusted_cost as cost, adjusted_reverse_cost as reverse_cost FROM (' ||
        'SELECT e.id, e.source, e.target, ' ||
        'e.cost * (1 + ' || p_risk_weight || ' * COALESCE(ecp.combined_probability, 0)) as adjusted_cost, ' ||
        'e.reverse_cost * (1 + ' || p_risk_weight || ' * COALESCE(ecp.combined_probability, 0)) as adjusted_reverse_cost ' ||
        'FROM edges e ' ||
        'LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id ' ||
        'WHERE COALESCE(ecp.combined_probability, 0) < ' || p_max_failure_prob ||
        CASE WHEN p_exclude_simulation_id IS NOT NULL THEN
            ' AND NOT EXISTS (SELECT 1 FROM simulated_failures sf ' ||
            'WHERE sf.simulation_id = ''' || p_exclude_simulation_id || '''::uuid ' ||
            'AND sf.element_type = ''edge'' AND sf.element_id = e.id AND sf.failed = true)'
        ELSE '' END ||
        ') temp_edges',
        v_start_node_id,
        v_end_node_id,
        directed := false
    ) r
    LEFT JOIN adjusted_edges ae ON r.edge = ae.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Calcular múltiples rutas alternativas (k-shortest paths)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_alternative_paths(
    p_start_lat DOUBLE PRECISION,
    p_start_lon DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lon DOUBLE PRECISION,
    p_k INTEGER DEFAULT 3
) RETURNS TABLE (
    path_id INTEGER,
    seq INTEGER,
    path_seq INTEGER,
    node BIGINT,
    edge BIGINT,
    cost DOUBLE PRECISION,
    agg_cost DOUBLE PRECISION,
    geom GEOMETRY
) AS $$
DECLARE
    v_start_node_id BIGINT;
    v_end_node_id BIGINT;
BEGIN
    -- Encontrar nodos más cercanos
    SELECT id INTO v_start_node_id
    FROM nodes
    ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)
    LIMIT 1;
    
    SELECT id INTO v_end_node_id
    FROM nodes
    ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)
    LIMIT 1;
    
    -- Usar pgr_ksp (k-shortest paths) si está disponible
    RETURN QUERY
    SELECT
        r.path_id::INTEGER,
        r.path_seq,
        r.seq,
        r.node,
        r.edge,
        r.cost,
        r.agg_cost,
        e.geometry as geom
    FROM pgr_ksp(
        'SELECT id, source, target, cost, reverse_cost FROM edges',
        v_start_node_id,
        v_end_node_id,
        p_k,
        directed := false
    ) r
    LEFT JOIN edges e ON r.edge = e.id
    ORDER BY r.path_id, r.path_seq;
    
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'pgr_ksp no está disponible, usando alternativa simple';
        -- Fallback: retornar solo ruta básica
        RETURN QUERY
        SELECT
            1 as path_id,
            r.seq,
            r.path_seq,
            r.node,
            r.edge,
            r.cost,
            r.agg_cost,
            e.geometry as geom
        FROM pgr_dijkstra(
            'SELECT id, source, target, cost, reverse_cost FROM edges',
            v_start_node_id,
            v_end_node_id,
            directed := false
        ) r
        LEFT JOIN edges e ON r.edge = e.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Encontrar nodo más cercano
-- ============================================================================
CREATE OR REPLACE FUNCTION find_nearest_node(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION
) RETURNS BIGINT AS $$
DECLARE
    v_node_id BIGINT;
BEGIN
    SELECT id INTO v_node_id
    FROM nodes
    ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)
    LIMIT 1;
    
    RETURN v_node_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCIÓN: Calcular estadísticas de una ruta
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_route_statistics(
    p_edge_ids BIGINT[]
) RETURNS TABLE (
    total_length_km DOUBLE PRECISION,
    total_probability DOUBLE PRECISION,
    max_probability DOUBLE PRECISION,
    avg_probability DOUBLE PRECISION,
    high_risk_segments INTEGER,
    bridge_count INTEGER,
    tunnel_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        SUM(e.length) / 1000.0 as total_length_km,
        -- Probabilidad combinada de la ruta
        1.0 - EXP(SUM(LN(1.0 - COALESCE(ecp.combined_probability, 0.001)))) as total_probability,
        MAX(COALESCE(ecp.combined_probability, 0)) as max_probability,
        AVG(COALESCE(ecp.combined_probability, 0)) as avg_probability,
        COUNT(*) FILTER (WHERE COALESCE(ecp.combined_probability, 0) > 0.3) as high_risk_segments,
        COUNT(*) FILTER (WHERE e.bridge = true) as bridge_count,
        COUNT(*) FILTER (WHERE e.tunnel = true) as tunnel_count
    FROM unnest(p_edge_ids) WITH ORDINALITY AS edge_list(edge_id, ord)
    JOIN edges e ON e.id = edge_list.edge_id
    LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON FUNCTION calculate_resilient_path IS 'Calcula ruta con Dijkstra considerando probabilidades de falla';
COMMENT ON FUNCTION calculate_alternative_paths IS 'Calcula k rutas alternativas entre dos puntos';
COMMENT ON FUNCTION find_nearest_node IS 'Encuentra el nodo más cercano a una coordenada';
COMMENT ON FUNCTION calculate_route_statistics IS 'Calcula estadísticas de riesgo para una ruta';

-- ============================================================================
-- FIN
-- ============================================================================
