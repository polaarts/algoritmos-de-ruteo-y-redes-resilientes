const express = require('express');
const router = express.Router();
const { query, pool } = require('../config/database');

/**
 * GET /api/simulation
 * Get available simulation endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Network Simulation API (Monte Carlo)',
    description: 'Simulate network failures based on probability distributions',
    endpoints: {
      run: {
        path: '/api/simulation/run',
        method: 'POST',
        description: 'Run Monte Carlo simulation for a route',
        body: {
          start_lat: 'number (required)',
          start_lon: 'number (required)',
          end_lat: 'number (required)',
          end_lon: 'number (required)',
          iterations: 'number (default: 100)',
          scenario: 'string (base|earthquake|fire|weather|combined, default: combined)'
        }
      },
      trigger_failures: {
        path: '/api/simulation/trigger-failures',
        method: 'POST',
        description: 'Trigger network-wide failure simulation'
      },
      current_failures: {
        path: '/api/simulation/current-failures',
        method: 'GET',
        description: 'Get active failures from current simulation'
      },
      clear_failures: {
        path: '/api/simulation/clear-failures',
        method: 'POST',
        description: 'Clear current simulation failures'
      },
      network_status: {
        path: '/api/simulation/network-status',
        method: 'GET',
        description: 'Get network operational status with failures applied'
      }
    }
  });
});

/**
 * POST /api/simulation/run
 * Run Monte Carlo simulation for route failures
 * Criterio 14 de rúbrica: Simulación de fallas
 */
router.post('/run', async (req, res, next) => {
  const startTime = performance.now();

  try {
    const {
      start_lat,
      start_lon,
      end_lat,
      end_lon,
      iterations = 100,
      scenario = 'combined'
    } = req.body;

    // Validate required parameters
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    const iterationsInt = Math.min(Math.max(parseInt(iterations), 10), 1000);

    // Find nearest nodes
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Could not find nodes near provided coordinates'
      });
    }

    const startNodeId = startNodeResult.rows[0].id;
    const endNodeId = endNodeResult.rows[0].id;

    // Calculate base route
    const baseRouteResult = await query(
      `
      SELECT
        route.edge,
        route.cost,
        ep.total_failure_probability,
        ep.earthquake_probability,
        ep.fire_probability,
        ep.weather_probability
      FROM pgr_dijkstra(
        'SELECT id, source, target, cost, reverse_cost FROM fiber_links WHERE cost > 0',
        $1::bigint,
        $2::bigint,
        false
      ) as route
      LEFT JOIN edge_probabilities ep ON route.edge = ep.edge_id
      WHERE route.edge IS NOT NULL
      ORDER BY route.seq
      `,
      [startNodeId, endNodeId]
    );

    if (baseRouteResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No route found between these nodes'
      });
    }

    const edges = baseRouteResult.rows;
    const totalDistance = edges.reduce((sum, e) => sum + e.cost, 0);

    // Determine which probability to use based on scenario
    const probabilityField = {
      'base': null,
      'earthquake': 'earthquake_probability',
      'fire': 'fire_probability',
      'weather': 'weather_probability',
      'combined': 'total_failure_probability'
    }[scenario] || 'total_failure_probability';

    // Run Monte Carlo simulation
    let successCount = 0;
    let failureCount = 0;
    const failedEdges = {};

    for (let i = 0; i < iterationsInt; i++) {
      let routeSucceeded = true;

      for (const edge of edges) {
        const probability = probabilityField && edge[probabilityField] ? edge[probabilityField] : 0;
        const randomValue = Math.random();

        if (randomValue < probability) {
          routeSucceeded = false;
          failedEdges[edge.edge] = (failedEdges[edge.edge] || 0) + 1;
        }
      }

      if (routeSucceeded) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const successRate = (successCount / iterationsInt) * 100;
    const failureRate = (failureCount / iterationsInt) * 100;

    const avgFailureProbability = edges.reduce((sum, e) => {
      const prob = probabilityField && e[probabilityField] ? e[probabilityField] : 0;
      return sum + prob;
    }, 0) / edges.length;

    const routeReliability = edges.reduce((product, e) => {
      const prob = probabilityField && e[probabilityField] ? e[probabilityField] : 0;
      return product * (1 - prob);
    }, 1);

    const criticalEdges = Object.entries(failedEdges)
      .map(([edge_id, failure_count]) => ({
        edge_id: parseInt(edge_id),
        failure_count,
        failure_rate: (failure_count / iterationsInt) * 100
      }))
      .sort((a, b) => b.failure_count - a.failure_count)
      .slice(0, 5);

    const computeTime = performance.now() - startTime;

    // Save simulation result
    try {
      await query(
        `
        INSERT INTO simulation_results (
          route_name,
          start_node_id,
          end_node_id,
          total_distance,
          simulation_iterations,
          success_count,
          failure_count,
          avg_failure_probability,
          scenario
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          `Simulation ${new Date().toISOString()}`,
          startNodeId,
          endNodeId,
          totalDistance,
          iterationsInt,
          successCount,
          failureCount,
          avgFailureProbability,
          scenario
        ]
      );
    } catch (saveError) {
      console.warn('Could not save simulation result:', saveError.message);
    }

    res.json({
      simulation: {
        scenario,
        iterations: iterationsInt,
        compute_time_ms: Math.round(computeTime)
      },
      route: {
        start_node_id: startNodeId,
        end_node_id: endNodeId,
        total_distance_m: Math.round(totalDistance),
        total_distance_km: Math.round(totalDistance / 1000 * 100) / 100,
        total_edges: edges.length
      },
      results: {
        success_count: successCount,
        failure_count: failureCount,
        success_rate_pct: Math.round(successRate * 100) / 100,
        failure_rate_pct: Math.round(failureRate * 100) / 100,
        avg_edge_failure_probability: Math.round(avgFailureProbability * 10000) / 100,
        route_reliability: Math.round(routeReliability * 10000) / 100
      },
      critical_edges: criticalEdges,
      interpretation: {
        message: successRate > 95
          ? 'Route is highly reliable'
          : successRate > 80
          ? 'Route has moderate reliability'
          : successRate > 50
          ? 'Route has significant failure risk'
          : 'Route has high failure risk',
        recommendation: successRate < 80
          ? 'Consider alternative routes with lower failure probabilities'
          : 'Route is acceptable for use'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/simulation/trigger-failures
 * Genera una simulación Monte Carlo de fallas en la red
 * basada en las probabilidades calculadas
 */
router.post('/trigger-failures', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      simulationName = `Simulación ${new Date().toISOString()}`,
      seed = Math.random() 
    } = req.body;
    
    const startTime = Date.now();
    
    await client.query('BEGIN');
    
    // 1. Obtener todos los nodos con sus probabilidades
    const nodesResult = await client.query(`
      SELECT 
        fn.id,
        fn.osm_id,
        fn.node_type,
        fn.region,
        fn.city,
        np.total_failure_probability,
        np.earthquake_probability,
        np.fire_probability,
        np.flood_probability,
        np.weather_probability,
        ST_AsGeoJSON(fn.geometry) as geometry
      FROM fiber_nodes fn
      LEFT JOIN node_probabilities np ON np.node_id = fn.id
    `);
    
    // 2. Obtener todos los enlaces con sus probabilidades
    const edgesResult = await client.query(`
      SELECT 
        fl.id,
        fl.source,
        fl.target,
        fl.length,
        fl.cost,
        ep.total_failure_probability,
        ep.earthquake_probability,
        ep.fire_probability,
        ep.flood_probability,
        ep.weather_probability,
        ep.landslide_probability,
        ST_AsGeoJSON(fl.geometry) as geometry
      FROM fiber_links fl
      LEFT JOIN edge_probabilities ep ON ep.edge_id = fl.id
    `);
    
    // 3. Crear tabla temporal para esta simulación
    await client.query(`
      DROP TABLE IF EXISTS temp_simulation_failures;
      CREATE TEMP TABLE temp_simulation_failures (
        element_type TEXT,
        element_id INTEGER,
        failed BOOLEAN,
        random_value FLOAT,
        probability FLOAT,
        details JSONB
      );
    `);
    
    // 4. Simular fallas en nodos
    const nodeFails = [];
    const nodeStats = {
      total: nodesResult.rows.length,
      failed: 0,
      byThreat: {
        earthquake: 0,
        fire: 0,
        flood: 0,
        weather: 0
      }
    };
    
    for (const node of nodesResult.rows) {
      const randomValue = Math.random() * 100; // 0-100
      const probability = parseFloat(node.total_failure_probability || 0);
      const failed = randomValue < probability;
      
      if (failed) {
        nodeStats.failed++;
        
        // Determinar amenaza dominante
        const threats = [
          { name: 'earthquake', prob: parseFloat(node.earthquake_probability || 0) },
          { name: 'fire', prob: parseFloat(node.fire_probability || 0) },
          { name: 'flood', prob: parseFloat(node.flood_probability || 0) },
          { name: 'weather', prob: parseFloat(node.weather_probability || 0) }
        ];
        
        const dominantThreat = threats.reduce((max, t) => 
          t.prob > max.prob ? t : max, threats[0]
        );
        
        nodeStats.byThreat[dominantThreat.name]++;
        
        nodeFails.push({
          type: 'Feature',
          properties: {
            element_type: 'node',
            element_id: node.id,
            osm_id: node.osm_id,
            node_type: node.node_type,
            region: node.region,
            city: node.city,
            failed: true,
            random_value: randomValue,
            probability: probability,
            dominant_threat: dominantThreat.name
          },
          geometry: JSON.parse(node.geometry)
        });
      }
      
      // Insertar en tabla temporal
      await client.query(`
        INSERT INTO temp_simulation_failures 
        (element_type, element_id, failed, random_value, probability, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'node',
        node.id,
        failed,
        randomValue,
        probability,
        JSON.stringify({
          osm_id: node.osm_id,
          node_type: node.node_type,
          region: node.region,
          city: node.city
        })
      ]);
    }
    
    // 5. Simular fallas en enlaces
    const edgeFails = [];
    const edgeStats = {
      total: edgesResult.rows.length,
      failed: 0,
      byThreat: {
        earthquake: 0,
        fire: 0,
        flood: 0,
        weather: 0,
        landslide: 0
      }
    };
    
    for (const edge of edgesResult.rows) {
      const randomValue = Math.random() * 100; // 0-100
      const probability = parseFloat(edge.total_failure_probability || 0);
      const failed = randomValue < probability;
      
      if (failed) {
        edgeStats.failed++;
        
        // Determinar amenaza dominante
        const threats = [
          { name: 'earthquake', prob: parseFloat(edge.earthquake_probability || 0) },
          { name: 'fire', prob: parseFloat(edge.fire_probability || 0) },
          { name: 'flood', prob: parseFloat(edge.flood_probability || 0) },
          { name: 'weather', prob: parseFloat(edge.weather_probability || 0) },
          { name: 'landslide', prob: parseFloat(edge.landslide_probability || 0) }
        ];
        
        const dominantThreat = threats.reduce((max, t) => 
          t.prob > max.prob ? t : max, threats[0]
        );
        
        edgeStats.byThreat[dominantThreat.name]++;
        
        edgeFails.push({
          type: 'Feature',
          properties: {
            element_type: 'edge',
            element_id: edge.id,
            source: edge.source,
            target: edge.target,
            length: edge.length,
            failed: true,
            random_value: randomValue,
            probability: probability,
            dominant_threat: dominantThreat.name
          },
          geometry: JSON.parse(edge.geometry)
        });
      }
      
      // Insertar en tabla temporal
      await client.query(`
        INSERT INTO temp_simulation_failures 
        (element_type, element_id, failed, random_value, probability, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'edge',
        edge.id,
        failed,
        randomValue,
        probability,
        JSON.stringify({
          source: edge.source,
          target: edge.target,
          length: edge.length
        })
      ]);
    }
    
    await client.query('COMMIT');
    
    const executionTime = Date.now() - startTime;
    
    // 6. Construir respuesta
    res.json({
      success: true,
      simulation: {
        name: simulationName,
        timestamp: new Date().toISOString(),
        seed: seed,
        execution_time_ms: executionTime
      },
      statistics: {
        nodes: nodeStats,
        edges: edgeStats,
        total_elements: nodeStats.total + edgeStats.total,
        total_failures: nodeStats.failed + edgeStats.failed,
        failure_rate: (
          ((nodeStats.failed + edgeStats.failed) / 
          (nodeStats.total + edgeStats.total)) * 100
        ).toFixed(2) + '%'
      },
      failures: {
        type: 'FeatureCollection',
        features: [...nodeFails, ...edgeFails]
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en simulación de fallas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al ejecutar simulación: ' + error.message
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/simulation/current-failures
 * Obtiene las fallas activas de la última simulación en memoria
 */
router.get('/current-failures', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        element_type,
        element_id,
        failed,
        random_value,
        probability,
        details
      FROM temp_simulation_failures
      WHERE failed = true
      ORDER BY element_type, element_id
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      failures: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo fallas actuales:', error);
    res.status(500).json({
      success: false,
      error: 'No hay simulación activa'
    });
  }
});

/**
 * POST /api/simulation/clear-failures
 * Limpia las fallas de la simulación actual
 */
router.post('/clear-failures', async (req, res) => {
  try {
    await query(`DROP TABLE IF EXISTS temp_simulation_failures`);
    
    res.json({
      success: true,
      message: 'Fallas limpiadas exitosamente'
    });
  } catch (error) {
    console.error('Error limpiando fallas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar fallas'
    });
  }
});

/**
 * GET /api/simulation/network-status
 * Obtiene el estado de la red con fallas aplicadas
 */
router.get('/network-status', async (req, res) => {
  try {
    // Verificar si hay simulación activa
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'temp_simulation_failures'
      ) as exists
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        simulation_active: false,
        message: 'No hay simulación activa'
      });
    }
    
    // Obtener estadísticas
    const stats = await query(`
      SELECT 
        element_type,
        COUNT(*) as total,
        SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed_count,
        AVG(probability) as avg_probability
      FROM temp_simulation_failures
      GROUP BY element_type
    `);
    
    // Obtener nodos operacionales
    const operationalNodes = await query(`
      SELECT COUNT(*) as count
      FROM fiber_nodes fn
      WHERE NOT EXISTS (
        SELECT 1 FROM temp_simulation_failures tsf
        WHERE tsf.element_type = 'node' 
          AND tsf.element_id = fn.id 
          AND tsf.failed = true
      )
    `);
    
    // Obtener enlaces operacionales
    const operationalEdges = await query(`
      SELECT COUNT(*) as count
      FROM fiber_links fl
      WHERE NOT EXISTS (
        SELECT 1 FROM temp_simulation_failures tsf
        WHERE tsf.element_type = 'edge' 
          AND tsf.element_id = fl.id 
          AND tsf.failed = true
      )
    `);
    
    res.json({
      success: true,
      simulation_active: true,
      network_status: {
        nodes: {
          total: parseInt(stats.rows.find(r => r.element_type === 'node')?.total || 0),
          failed: parseInt(stats.rows.find(r => r.element_type === 'node')?.failed_count || 0),
          operational: parseInt(operationalNodes.rows[0].count)
        },
        edges: {
          total: parseInt(stats.rows.find(r => r.element_type === 'edge')?.total || 0),
          failed: parseInt(stats.rows.find(r => r.element_type === 'edge')?.failed_count || 0),
          operational: parseInt(operationalEdges.rows[0].count)
        }
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estado de la red:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de la red'
    });
  }
});

module.exports = router;
