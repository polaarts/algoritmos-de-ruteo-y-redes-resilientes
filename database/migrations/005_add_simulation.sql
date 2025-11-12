-- ============================================================================
-- MIGRATION 005: Sistema de Simulación de Fallas
-- ============================================================================
-- Descripción: Agrega tablas para simular fallas basadas en probabilidades
-- Autor: GitHub Copilot
-- Fecha: 10 de noviembre de 2025
-- ============================================================================

-- ============================================================================
-- EXTENSIÓN: Generar UUIDs
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLA: simulations
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    description TEXT,
    seed INTEGER,
    threat_radius_km DOUBLE PRECISION DEFAULT 200,
    
    -- Estadísticas
    total_edges INTEGER DEFAULT 0,
    failed_edges INTEGER DEFAULT 0,
    total_nodes INTEGER DEFAULT 0,
    failed_nodes INTEGER DEFAULT 0,
    failure_rate DOUBLE PRECISION DEFAULT 0.0,
    
    -- Amenazas activas
    total_threats INTEGER DEFAULT 0,
    active_threats INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'completed' -- 'running', 'completed', 'failed'
);

CREATE INDEX idx_simulations_created ON simulations(created_at DESC);
CREATE INDEX idx_simulations_status ON simulations(status);

-- ============================================================================
-- TABLA: simulated_failures
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulated_failures (
    id SERIAL PRIMARY KEY,
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    element_type VARCHAR(10) NOT NULL, -- 'edge' o 'node'
    element_id BIGINT NOT NULL,
    
    -- Probabilidades
    failure_probability DOUBLE PRECISION NOT NULL,
    random_number DOUBLE PRECISION NOT NULL, -- 0-100
    failed BOOLEAN NOT NULL,
    
    -- Detalles
    threat_count INTEGER DEFAULT 0,
    dominant_threat VARCHAR(50),
    
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_simulated_failures_simulation ON simulated_failures(simulation_id);
CREATE INDEX idx_simulated_failures_element ON simulated_failures(element_type, element_id);
CREATE INDEX idx_simulated_failures_failed ON simulated_failures(failed) WHERE failed = true;

-- ============================================================================
-- TABLA: simulated_threat_occurrences
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulated_threat_occurrences (
    id SERIAL PRIMARY KEY,
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    threat_type VARCHAR(50) NOT NULL,
    threat_id INTEGER NOT NULL,
    
    occurrence_probability DOUBLE PRECISION NOT NULL,
    random_number DOUBLE PRECISION NOT NULL,
    will_occur BOOLEAN NOT NULL,
    
    timestamp TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(simulation_id, threat_type, threat_id)
);

CREATE INDEX idx_threat_occurrences_simulation ON simulated_threat_occurrences(simulation_id);
CREATE INDEX idx_threat_occurrences_active ON simulated_threat_occurrences(will_occur) WHERE will_occur = true;

-- ============================================================================
-- FUNCIÓN: Simular ocurrencia de amenazas
-- ============================================================================
CREATE OR REPLACE FUNCTION simulate_threat_occurrences(
    p_simulation_id UUID,
    p_seed INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Configurar seed si se proporciona
    IF p_seed IS NOT NULL THEN
        PERFORM setseed(p_seed / 2147483647.0);
    END IF;
    
    -- Simular sismos (probabilidad basada en magnitud y recurrencia)
    INSERT INTO simulated_threat_occurrences (
        simulation_id, threat_type, threat_id,
        occurrence_probability, random_number, will_occur
    )
    SELECT
        p_simulation_id,
        'earthquake',
        id,
        CASE 
            WHEN magnitude >= 7.0 THEN 0.10 -- 10% probabilidad de ocurrir
            WHEN magnitude >= 6.0 THEN 0.15
            WHEN magnitude >= 5.0 THEN 0.25
            ELSE 0.30
        END as occurrence_prob,
        random() * 100 as rand_num,
        (random() * 100) < CASE 
            WHEN magnitude >= 7.0 THEN 10.0
            WHEN magnitude >= 6.0 THEN 15.0
            WHEN magnitude >= 5.0 THEN 25.0
            ELSE 30.0
        END as will_occur
    FROM earthquakes;
    
    GET DIAGNOSTICS v_count := ROW_COUNT;
    
    -- Simular incendios (probabilidad según nivel de riesgo y época)
    INSERT INTO simulated_threat_occurrences (
        simulation_id, threat_type, threat_id,
        occurrence_probability, random_number, will_occur
    )
    SELECT
        p_simulation_id,
        'fire_zone',
        id,
        CASE risk_level
            WHEN 'extreme' THEN 0.40
            WHEN 'high' THEN 0.25
            WHEN 'medium' THEN 0.15
            WHEN 'low' THEN 0.05
            ELSE 0.10
        END as occurrence_prob,
        random() * 100 as rand_num,
        (random() * 100) < CASE risk_level
            WHEN 'extreme' THEN 40.0
            WHEN 'high' THEN 25.0
            WHEN 'medium' THEN 15.0
            WHEN 'low' THEN 5.0
            ELSE 10.0
        END as will_occur
    FROM fire_risk_zones;
    
    v_count := v_count + ROW_COUNT;
    
    -- Simular eventos climáticos
    INSERT INTO simulated_threat_occurrences (
        simulation_id, threat_type, threat_id,
        occurrence_probability, random_number, will_occur
    )
    SELECT
        p_simulation_id,
        'weather',
        id,
        CASE severity
            WHEN 'extreme' THEN 0.20
            WHEN 'high' THEN 0.30
            WHEN 'medium' THEN 0.40
            ELSE 0.50
        END as occurrence_prob,
        random() * 100 as rand_num,
        (random() * 100) < CASE severity
            WHEN 'extreme' THEN 20.0
            WHEN 'high' THEN 30.0
            WHEN 'medium' THEN 40.0
            ELSE 50.0
        END as will_occur
    FROM weather_events;
    
    v_count := v_count + ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Simular fallas de infraestructura
-- ============================================================================
CREATE OR REPLACE FUNCTION simulate_failures(
    p_simulation_name VARCHAR DEFAULT 'Unnamed Simulation',
    p_seed INTEGER DEFAULT NULL,
    p_threat_radius_km DOUBLE PRECISION DEFAULT 200,
    p_consider_threat_occurrence BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
    v_simulation_id UUID;
    v_total_edges INTEGER;
    v_failed_edges INTEGER;
    v_total_nodes INTEGER;
    v_failed_nodes INTEGER;
    v_total_threats INTEGER;
    v_active_threats INTEGER;
BEGIN
    -- Crear registro de simulación
    INSERT INTO simulations (name, seed, threat_radius_km)
    VALUES (p_simulation_name, p_seed, p_threat_radius_km)
    RETURNING id INTO v_simulation_id;
    
    -- Configurar seed si se proporciona
    IF p_seed IS NOT NULL THEN
        PERFORM setseed(p_seed / 2147483647.0);
    END IF;
    
    -- Simular ocurrencia de amenazas
    IF p_consider_threat_occurrence THEN
        v_total_threats := simulate_threat_occurrences(v_simulation_id, p_seed);
        
        SELECT COUNT(*) INTO v_active_threats
        FROM simulated_threat_occurrences
        WHERE simulation_id = v_simulation_id AND will_occur = true;
    END IF;
    
    -- Simular fallas de edges
    -- Solo considerar amenazas que "ocurrirán" si p_consider_threat_occurrence = true
    INSERT INTO simulated_failures (
        simulation_id, element_type, element_id,
        failure_probability, random_number, failed,
        threat_count, dominant_threat
    )
    SELECT
        v_simulation_id,
        'edge',
        ecp.edge_id,
        ecp.combined_probability,
        random() * 100 as rand_num,
        (random() * 100) < (ecp.combined_probability * 100) as failed,
        ecp.threat_count,
        ecp.dominant_threat_type
    FROM edge_combined_probabilities ecp
    WHERE ecp.combined_probability > 0
    AND (
        NOT p_consider_threat_occurrence
        OR EXISTS (
            SELECT 1 FROM edge_failure_probabilities efp
            JOIN simulated_threat_occurrences sto 
                ON efp.threat_type = sto.threat_type 
                AND efp.threat_id = sto.threat_id
            WHERE efp.edge_id = ecp.edge_id
            AND sto.simulation_id = v_simulation_id
            AND sto.will_occur = true
        )
    );
    
    -- Contar estadísticas
    SELECT COUNT(*) INTO v_total_edges FROM edges;
    
    SELECT COUNT(*) INTO v_failed_edges
    FROM simulated_failures
    WHERE simulation_id = v_simulation_id
    AND element_type = 'edge'
    AND failed = true;
    
    -- Por ahora no simulamos nodes (se puede agregar después)
    v_total_nodes := 0;
    v_failed_nodes := 0;
    
    -- Actualizar estadísticas de simulación
    UPDATE simulations SET
        total_edges = v_total_edges,
        failed_edges = v_failed_edges,
        total_nodes = v_total_nodes,
        failed_nodes = v_failed_nodes,
        failure_rate = CASE WHEN v_total_edges > 0 
                       THEN v_failed_edges::DOUBLE PRECISION / v_total_edges 
                       ELSE 0.0 END,
        total_threats = COALESCE(v_total_threats, 0),
        active_threats = COALESCE(v_active_threats, 0),
        status = 'completed'
    WHERE id = v_simulation_id;
    
    RETURN v_simulation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Obtener elementos fallados de una simulación
-- ============================================================================
CREATE OR REPLACE FUNCTION get_failed_elements(
    p_simulation_id UUID
) RETURNS TABLE(
    element_type VARCHAR,
    element_id BIGINT,
    failure_probability DOUBLE PRECISION,
    geometry JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sf.element_type,
        sf.element_id,
        sf.failure_probability,
        CASE sf.element_type
            WHEN 'edge' THEN (SELECT ST_AsGeoJSON(e.geometry)::json FROM edges e WHERE e.id = sf.element_id)
            WHEN 'node' THEN (SELECT ST_AsGeoJSON(n.geometry)::json FROM nodes n WHERE n.id = sf.element_id)
        END as geometry
    FROM simulated_failures sf
    WHERE sf.simulation_id = p_simulation_id
    AND sf.failed = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Limpiar simulaciones antiguas
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_simulations(
    p_days_old INTEGER DEFAULT 7
) RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM simulations
    WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON TABLE simulations IS 'Registro de simulaciones de fallas ejecutadas';
COMMENT ON TABLE simulated_failures IS 'Elementos que fallaron en cada simulación';
COMMENT ON TABLE simulated_threat_occurrences IS 'Amenazas que ocurrirán en la simulación';
COMMENT ON FUNCTION simulate_failures IS 'Ejecuta una simulación completa de fallas';
COMMENT ON FUNCTION get_failed_elements IS 'Obtiene elementos fallados con geometría';

-- ============================================================================
-- FIN DE MIGRACIÓN 005
-- ============================================================================
