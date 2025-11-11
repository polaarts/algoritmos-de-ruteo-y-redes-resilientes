CREATE TABLE IF NOT EXISTS edge_failure_probabilities (
    id SERIAL PRIMARY KEY,
    edge_id BIGINT NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
    threat_type VARCHAR(50) NOT NULL, -- 'earthquake', 'fire_zone', 'weather'
    threat_id INTEGER NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    severity_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical', 'extreme'
    
    -- Probabilidades
    base_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- P base según amenaza
    infrastructure_factor DOUBLE PRECISION NOT NULL DEFAULT 1.0, -- Modificador por tipo infra
    distance_factor DOUBLE PRECISION NOT NULL DEFAULT 1.0, -- Modificador por distancia
    adjusted_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- P final ajustada
    
    -- Metadata
    calculation_date TIMESTAMP DEFAULT NOW(),
    calculation_method VARCHAR(100),
    
    -- Índices de performance
    UNIQUE(edge_id, threat_type, threat_id)
);

CREATE INDEX idx_edge_fail_prob_edge ON edge_failure_probabilities(edge_id);
CREATE INDEX idx_edge_fail_prob_threat ON edge_failure_probabilities(threat_type);
CREATE INDEX idx_edge_fail_prob_adjusted ON edge_failure_probabilities(adjusted_probability);

-- ============================================================================
-- TABLA: node_failure_probabilities
-- ============================================================================
CREATE TABLE IF NOT EXISTS node_failure_probabilities (
    id SERIAL PRIMARY KEY,
    node_id BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    threat_type VARCHAR(50) NOT NULL,
    threat_id INTEGER NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    severity_level VARCHAR(20),
    
    base_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    adjusted_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    
    calculation_date TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(node_id, threat_type, threat_id)
);

CREATE INDEX idx_node_fail_prob_node ON node_failure_probabilities(node_id);
CREATE INDEX idx_node_fail_prob_threat ON node_failure_probabilities(threat_type);

-- ============================================================================
-- TABLA: edge_combined_probabilities
-- ============================================================================
-- Almacena la probabilidad combinada de falla por enlace (todas las amenazas)
CREATE TABLE IF NOT EXISTS edge_combined_probabilities (
    edge_id BIGINT PRIMARY KEY REFERENCES edges(id) ON DELETE CASCADE,
    combined_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    threat_count INTEGER DEFAULT 0,
    max_individual_probability DOUBLE PRECISION DEFAULT 0.0,
    dominant_threat_type VARCHAR(50),
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_edge_combined_prob ON edge_combined_probabilities(combined_probability);

-- ============================================================================
-- FUNCIÓN: Calcular factores de infraestructura
-- ============================================================================
CREATE OR REPLACE FUNCTION get_infrastructure_factor(
    p_edge_id BIGINT
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_factor DOUBLE PRECISION := 1.0;
    v_edge RECORD;
BEGIN
    SELECT bridge, tunnel, recubrimiento_estim, surface
    INTO v_edge
    FROM edges
    WHERE id = p_edge_id;
    
    -- Factor por tipo de estructura
    IF v_edge.bridge THEN
        v_factor := v_factor * 1.5; -- Puentes más vulnerables
    END IF;
    
    IF v_edge.tunnel THEN
        v_factor := v_factor * 1.3; -- Túneles vulnerables a derrumbes
    END IF;
    
    -- Factor por recubrimiento
    CASE v_edge.recubrimiento_estim
        WHEN 'reforzado' THEN v_factor := v_factor * 0.7;
        WHEN 'básico' THEN v_factor := v_factor * 1.2;
        WHEN 'expuesto' THEN v_factor := v_factor * 1.5;
        ELSE v_factor := v_factor * 1.0;
    END CASE;
    
    -- Factor por superficie
    CASE v_edge.surface
        WHEN 'paved' THEN v_factor := v_factor * 0.9;
        WHEN 'unpaved' THEN v_factor := v_factor * 1.3;
        WHEN 'gravel' THEN v_factor := v_factor * 1.2;
        ELSE v_factor := v_factor * 1.0;
    END CASE;
    
    RETURN v_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCIÓN: Calcular probabilidad base por tipo de amenaza
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_threat_base_probability(
    p_threat_type VARCHAR,
    p_distance_km DOUBLE PRECISION,
    p_magnitude DOUBLE PRECISION DEFAULT NULL,
    p_risk_level VARCHAR DEFAULT NULL,
    p_severity VARCHAR DEFAULT NULL
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_probability DOUBLE PRECISION := 0.0;
BEGIN
    CASE p_threat_type
        WHEN 'earthquake' THEN
            -- Probabilidad basada en magnitud y distancia
            IF p_magnitude >= 7.0 THEN
                IF p_distance_km < 10 THEN v_probability := 1.0;
                ELSIF p_distance_km < 50 THEN v_probability := 0.8 * (1 - p_distance_km/50);
                ELSIF p_distance_km < 100 THEN v_probability := 0.5 * (1 - p_distance_km/100);
                ELSIF p_distance_km < 200 THEN v_probability := 0.3 * (1 - p_distance_km/200);
                END IF;
            ELSIF p_magnitude >= 6.0 THEN
                IF p_distance_km < 50 THEN v_probability := 0.7 * (1 - p_distance_km/50);
                ELSIF p_distance_km < 100 THEN v_probability := 0.4 * (1 - p_distance_km/100);
                END IF;
            ELSIF p_magnitude >= 5.0 THEN
                IF p_distance_km < 50 THEN v_probability := 0.4 * (1 - p_distance_km/50);
                ELSIF p_distance_km < 100 THEN v_probability := 0.2 * (1 - p_distance_km/100);
                END IF;
            ELSIF p_magnitude >= 4.0 THEN
                IF p_distance_km < 50 THEN v_probability := 0.2 * (1 - p_distance_km/50);
                END IF;
            END IF;
            
        WHEN 'fire_zone' THEN
            -- Probabilidad basada en nivel de riesgo
            CASE p_risk_level
                WHEN 'extreme' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.9;
                    ELSIF p_distance_km < 10 THEN v_probability := 0.7 * (1 - p_distance_km/10);
                    END IF;
                WHEN 'high' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.7;
                    ELSIF p_distance_km < 5 THEN v_probability := 0.5 * (1 - p_distance_km/5);
                    END IF;
                WHEN 'medium' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.4;
                    END IF;
                WHEN 'low' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.1;
                    END IF;
            END CASE;
            
        WHEN 'weather' THEN
            -- Probabilidad basada en severidad
            CASE p_severity
                WHEN 'extreme' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.8;
                    ELSIF p_distance_km < 20 THEN v_probability := 0.6 * (1 - p_distance_km/20);
                    END IF;
                WHEN 'high' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.6;
                    ELSIF p_distance_km < 15 THEN v_probability := 0.4 * (1 - p_distance_km/15);
                    END IF;
                WHEN 'medium' THEN
                    IF p_distance_km = 0 THEN v_probability := 0.3;
                    ELSIF p_distance_km < 10 THEN v_probability := 0.2 * (1 - p_distance_km/10);
                    END IF;
            END CASE;
    END CASE;
    
    -- Asegurar que esté en rango [0, 1]
    RETURN GREATEST(0.0, LEAST(1.0, v_probability));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCIÓN: Calcular probabilidad combinada (múltiples amenazas)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_combined_probability(
    p_probabilities DOUBLE PRECISION[]
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_result DOUBLE PRECISION := 1.0;
    v_prob DOUBLE PRECISION;
BEGIN
    -- P_total = 1 - ∏(1 - P_i)
    FOREACH v_prob IN ARRAY p_probabilities
    LOOP
        v_result := v_result * (1.0 - v_prob);
    END LOOP;
    
    RETURN 1.0 - v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCIÓN: Calcular probabilidades para un edge específico
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_edge_probabilities(
    p_edge_id BIGINT,
    p_threat_radius_km DOUBLE PRECISION DEFAULT 200
) RETURNS INTEGER AS $$
DECLARE
    v_edge RECORD;
    v_infra_factor DOUBLE PRECISION;
    v_count INTEGER := 0;
    v_temp INTEGER;
BEGIN
    -- Obtener geometría del edge
    SELECT geometry INTO v_edge FROM edges WHERE id = p_edge_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Obtener factor de infraestructura
    v_infra_factor := get_infrastructure_factor(p_edge_id);
    
    -- Limpiar probabilidades anteriores de este edge
    DELETE FROM edge_failure_probabilities WHERE edge_id = p_edge_id;
    
    -- Calcular probabilidades por sismos cercanos
    INSERT INTO edge_failure_probabilities (
        edge_id, threat_type, threat_id, distance_km, severity_level,
        base_probability, infrastructure_factor, distance_factor, adjusted_probability,
        calculation_method
    )
    SELECT
        p_edge_id,
        'earthquake',
        e.id,
        ST_Distance(v_edge.geometry::geography, e.geometry::geography) / 1000.0,
        e.threat_level,
        calculate_threat_base_probability(
            'earthquake',
            ST_Distance(v_edge.geometry::geography, e.geometry::geography) / 1000.0,
            e.magnitude,
            NULL,
            NULL
        ),
        v_infra_factor,
        1.0,
        calculate_threat_base_probability(
            'earthquake',
            ST_Distance(v_edge.geometry::geography, e.geometry::geography) / 1000.0,
            e.magnitude,
            NULL,
            NULL
        ) * v_infra_factor,
        'migration_004'
    FROM earthquakes e
    WHERE ST_DWithin(
        v_edge.geometry::geography,
        e.geometry::geography,
        p_threat_radius_km * 1000
    )
    AND e.magnitude >= 4.0;
    
    GET DIAGNOSTICS v_count := ROW_COUNT;
    
    -- Calcular probabilidades por zonas de incendio
    INSERT INTO edge_failure_probabilities (
        edge_id, threat_type, threat_id, distance_km, severity_level,
        base_probability, infrastructure_factor, distance_factor, adjusted_probability,
        calculation_method
    )
    SELECT
        p_edge_id,
        'fire_zone',
        f.id,
        CASE 
            WHEN ST_Intersects(v_edge.geometry, f.geometry) THEN 0
            ELSE ST_Distance(v_edge.geometry::geography, ST_Centroid(f.geometry)::geography) / 1000.0
        END,
        f.risk_level,
        calculate_threat_base_probability(
            'fire_zone',
            CASE 
                WHEN ST_Intersects(v_edge.geometry, f.geometry) THEN 0
                ELSE ST_Distance(v_edge.geometry::geography, ST_Centroid(f.geometry)::geography) / 1000.0
            END,
            NULL,
            f.risk_level,
            NULL
        ),
        v_infra_factor,
        1.0,
        calculate_threat_base_probability(
            'fire_zone',
            CASE 
                WHEN ST_Intersects(v_edge.geometry, f.geometry) THEN 0
                ELSE ST_Distance(v_edge.geometry::geography, ST_Centroid(f.geometry)::geography) / 1000.0
            END,
            NULL,
            f.risk_level,
            NULL
        ) * v_infra_factor,
        'migration_004'
    FROM fire_risk_zones f
    WHERE ST_DWithin(
        v_edge.geometry::geography,
        f.geometry::geography,
        p_threat_radius_km * 1000
    );
    
    GET DIAGNOSTICS v_temp := ROW_COUNT;
    v_count := v_count + v_temp;
    
    -- Calcular probabilidades por eventos climáticos
    INSERT INTO edge_failure_probabilities (
        edge_id, threat_type, threat_id, distance_km, severity_level,
        base_probability, infrastructure_factor, distance_factor, adjusted_probability,
        calculation_method
    )
    SELECT
        p_edge_id,
        'weather',
        w.id,
        CASE 
            WHEN ST_Intersects(v_edge.geometry, w.geometry) THEN 0
            ELSE ST_Distance(v_edge.geometry::geography, ST_Centroid(w.geometry)::geography) / 1000.0
        END,
        w.severity,
        calculate_threat_base_probability(
            'weather',
            CASE 
                WHEN ST_Intersects(v_edge.geometry, w.geometry) THEN 0
                ELSE ST_Distance(v_edge.geometry::geography, ST_Centroid(w.geometry)::geography) / 1000.0
            END,
            NULL,
            NULL,
            w.severity
        ),
        v_infra_factor,
        1.0,
        calculate_threat_base_probability(
            'weather',
            CASE 
                WHEN ST_Intersects(v_edge.geometry, w.geometry) THEN 0
                ELSE ST_Distance(v_edge.geometry::geography, ST_Centroid(w.geometry)::geography) / 1000.0
            END,
            NULL,
            NULL,
            w.severity
        ) * v_infra_factor,
        'migration_004'
    FROM weather_events w
    WHERE ST_DWithin(
        v_edge.geometry::geography,
        w.geometry::geography,
        p_threat_radius_km * 1000
    );
    
    GET DIAGNOSTICS v_temp := ROW_COUNT;
    v_count := v_count + v_temp;
    
    -- Calcular probabilidad combinada
    INSERT INTO edge_combined_probabilities (edge_id, combined_probability, threat_count, max_individual_probability, dominant_threat_type)
    SELECT
        p_edge_id,
        calculate_combined_probability(array_agg(adjusted_probability)),
        COUNT(*),
        MAX(adjusted_probability),
        (SELECT threat_type FROM edge_failure_probabilities 
         WHERE edge_id = p_edge_id 
         ORDER BY adjusted_probability DESC LIMIT 1)
    FROM edge_failure_probabilities
    WHERE edge_id = p_edge_id
    ON CONFLICT (edge_id) DO UPDATE SET
        combined_probability = EXCLUDED.combined_probability,
        threat_count = EXCLUDED.threat_count,
        max_individual_probability = EXCLUDED.max_individual_probability,
        dominant_threat_type = EXCLUDED.dominant_threat_type,
        last_updated = NOW();
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Calcular probabilidades para todos los edges
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_all_edge_probabilities(
    p_threat_radius_km DOUBLE PRECISION DEFAULT 200,
    p_limit INTEGER DEFAULT NULL
) RETURNS TABLE(
    edge_id BIGINT,
    threats_found INTEGER,
    combined_prob DOUBLE PRECISION
) AS $$
DECLARE
    v_edge_id BIGINT;
    v_count INTEGER;
    v_total INTEGER := 0;
BEGIN
    FOR v_edge_id IN 
        SELECT id FROM edges 
        ORDER BY id 
        LIMIT p_limit
    LOOP
        v_count := calculate_edge_probabilities(v_edge_id, p_threat_radius_km);
        
        edge_id := v_edge_id;
        threats_found := v_count;
        combined_prob := COALESCE(
            (SELECT combined_probability FROM edge_combined_probabilities WHERE edge_combined_probabilities.edge_id = v_edge_id),
            0.0
        );
        
        RETURN NEXT;
        
        v_total := v_total + 1;
        IF v_total % 100 = 0 THEN
            RAISE NOTICE 'Procesados % edges...', v_total;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Procesamiento completo: % edges', v_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE edge_failure_probabilities IS 'Probabilidades de falla de enlaces por amenaza individual';
COMMENT ON TABLE node_failure_probabilities IS 'Probabilidades de falla de nodos por amenaza individual';
COMMENT ON TABLE edge_combined_probabilities IS 'Probabilidad combinada de falla por enlace (todas las amenazas)';
COMMENT ON FUNCTION calculate_edge_probabilities IS 'Calcula probabilidades de falla para un edge específico';
COMMENT ON FUNCTION calculate_all_edge_probabilities IS 'Calcula probabilidades para todos los edges (puede ser lento)';

