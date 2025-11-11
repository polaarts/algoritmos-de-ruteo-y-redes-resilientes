-- ============================================================================
-- MIGRACIÓN: Corrección de funciones de ruteo
-- ============================================================================
-- Descripción: Corrige referencias a tabla 'nodes' por 'edges_vertices_pgr'
-- Fecha: 10 de noviembre de 2025
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS calculate_resilient_path CASCADE;
DROP FUNCTION IF EXISTS calculate_safest_path CASCADE;
DROP FUNCTION IF EXISTS calculate_balanced_path CASCADE;

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
    -- Encontrar nodos más cercanos usando edges_vertices_pgr
    SELECT id INTO v_start_node_id
    FROM edges_vertices_pgr
    ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)
    LIMIT 1;
    
    SELECT id INTO v_end_node_id
    FROM edges_vertices_pgr
    ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)
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
-- FUNCIÓN: Calcular ruta más segura (minimiza probabilidad total)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_safest_path(
    p_start_lat DOUBLE PRECISION,
    p_start_lon DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lon DOUBLE PRECISION,
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
    FROM edges_vertices_pgr
    ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)
    LIMIT 1;
    
    SELECT id INTO v_end_node_id
    FROM edges_vertices_pgr
    ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)
    LIMIT 1;
    
    IF v_start_node_id IS NULL OR v_end_node_id IS NULL THEN
        RAISE EXCEPTION 'No se encontraron nodos cercanos';
    END IF;
    
    -- Calcular ruta minimizando probabilidad (usando -log(1-p) como costo)
    RETURN QUERY
    WITH safe_edges AS (
        SELECT
            e.id,
            e.source,
            e.target,
            -- Costo = -log(1 - probabilidad) para minimizar probabilidad acumulada
            CASE 
                WHEN COALESCE(ecp.combined_probability, 0) >= 0.9999 THEN 1000000
                ELSE -LN(1 - COALESCE(ecp.combined_probability, 0))
            END as safe_cost,
            COALESCE(ecp.combined_probability, 0) as failure_prob,
            e.cost as distance,
            e.geometry
        FROM edges e
        LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
        WHERE 
            p_exclude_simulation_id IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM simulated_failures sf
                WHERE sf.simulation_id = p_exclude_simulation_id
                AND sf.element_type = 'edge'
                AND sf.element_id = e.id
                AND sf.failed = true
            )
    )
    SELECT
        r.seq,
        r.path_seq,
        r.node,
        r.edge,
        se.distance as cost,
        r.agg_cost,
        se.failure_prob,
        se.geometry as geom
    FROM pgr_dijkstra(
        'SELECT id, source, target, safe_cost as cost, safe_cost as reverse_cost FROM (' ||
        'SELECT e.id, e.source, e.target, ' ||
        'CASE WHEN COALESCE(ecp.combined_probability, 0) >= 0.9999 THEN 1000000 ' ||
        'ELSE -LN(1 - COALESCE(ecp.combined_probability, 0)) END as safe_cost ' ||
        'FROM edges e ' ||
        'LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id' ||
        CASE WHEN p_exclude_simulation_id IS NOT NULL THEN
            ' WHERE NOT EXISTS (SELECT 1 FROM simulated_failures sf ' ||
            'WHERE sf.simulation_id = ''' || p_exclude_simulation_id || '''::uuid ' ||
            'AND sf.element_type = ''edge'' AND sf.element_id = e.id AND sf.failed = true)'
        ELSE '' END ||
        ') temp_edges',
        v_start_node_id,
        v_end_node_id,
        directed := false
    ) r
    LEFT JOIN safe_edges se ON r.edge = se.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Calcular ruta balanceada (distancia vs seguridad)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_balanced_path(
    p_start_lat DOUBLE PRECISION,
    p_start_lon DOUBLE PRECISION,
    p_end_lat DOUBLE PRECISION,
    p_end_lon DOUBLE PRECISION,
    p_safety_weight DOUBLE PRECISION DEFAULT 0.5,
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
    FROM edges_vertices_pgr
    ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)
    LIMIT 1;
    
    SELECT id INTO v_end_node_id
    FROM edges_vertices_pgr
    ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)
    LIMIT 1;
    
    IF v_start_node_id IS NULL OR v_end_node_id IS NULL THEN
        RAISE EXCEPTION 'No se encontraron nodos cercanos';
    END IF;
    
    -- Calcular ruta balanceada
    RETURN QUERY
    WITH balanced_edges AS (
        SELECT
            e.id,
            e.source,
            e.target,
            -- Costo balanceado = w*distancia + (1-w)*probabilidad_normalizada
            e.cost * p_safety_weight + 
            COALESCE(ecp.combined_probability, 0) * 100 * (1 - p_safety_weight) as balanced_cost,
            COALESCE(ecp.combined_probability, 0) as failure_prob,
            e.cost as distance,
            e.geometry
        FROM edges e
        LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
        WHERE 
            p_exclude_simulation_id IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM simulated_failures sf
                WHERE sf.simulation_id = p_exclude_simulation_id
                AND sf.element_type = 'edge'
                AND sf.element_id = e.id
                AND sf.failed = true
            )
    )
    SELECT
        r.seq,
        r.path_seq,
        r.node,
        r.edge,
        be.distance as cost,
        r.agg_cost,
        be.failure_prob,
        be.geometry as geom
    FROM pgr_dijkstra(
        'SELECT id, source, target, balanced_cost as cost, balanced_cost as reverse_cost FROM (' ||
        'SELECT e.id, e.source, e.target, ' ||
        'e.cost * ' || p_safety_weight || ' + ' ||
        'COALESCE(ecp.combined_probability, 0) * 100 * ' || (1 - p_safety_weight) || ' as balanced_cost ' ||
        'FROM edges e ' ||
        'LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id' ||
        CASE WHEN p_exclude_simulation_id IS NOT NULL THEN
            ' WHERE NOT EXISTS (SELECT 1 FROM simulated_failures sf ' ||
            'WHERE sf.simulation_id = ''' || p_exclude_simulation_id || '''::uuid ' ||
            'AND sf.element_type = ''edge'' AND sf.element_id = e.id AND sf.failed = true)'
        ELSE '' END ||
        ') temp_edges',
        v_start_node_id,
        v_end_node_id,
        directed := false
    ) r
    LEFT JOIN balanced_edges be ON r.edge = be.id;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION calculate_resilient_path IS 'Calcula ruta con costos ajustados por probabilidad de falla';
COMMENT ON FUNCTION calculate_safest_path IS 'Calcula ruta minimizando probabilidad total de falla';
COMMENT ON FUNCTION calculate_balanced_path IS 'Calcula ruta balanceada entre distancia y seguridad';
