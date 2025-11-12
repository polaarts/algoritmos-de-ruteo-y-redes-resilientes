const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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
        ST_AsGeoJSON(fn.geom) as geometry
      FROM fiber_nodes fn
      JOIN node_probabilities np ON np.node_id = fn.id
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
        ST_AsGeoJSON(fl.geom) as geometry
      FROM fiber_links fl
      JOIN edge_probabilities ep ON ep.edge_id = fl.id
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
      const probability = parseFloat(node.total_failure_probability);
      const failed = randomValue < probability;
      
      if (failed) {
        nodeStats.failed++;
        
        // Determinar amenaza dominante
        const threats = [
          { name: 'earthquake', prob: parseFloat(node.earthquake_probability) },
          { name: 'fire', prob: parseFloat(node.fire_probability) },
          { name: 'flood', prob: parseFloat(node.flood_probability) },
          { name: 'weather', prob: parseFloat(node.weather_probability) }
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
      const probability = parseFloat(edge.total_failure_probability);
      const failed = randomValue < probability;
      
      if (failed) {
        edgeStats.failed++;
        
        // Determinar amenaza dominante
        const threats = [
          { name: 'earthquake', prob: parseFloat(edge.earthquake_probability) },
          { name: 'fire', prob: parseFloat(edge.fire_probability) },
          { name: 'flood', prob: parseFloat(edge.flood_probability) },
          { name: 'weather', prob: parseFloat(edge.weather_probability) },
          { name: 'landslide', prob: parseFloat(edge.landslide_probability) }
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
    const result = await pool.query(`
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
    await pool.query(`DROP TABLE IF EXISTS temp_simulation_failures`);
    
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
    const tableCheck = await pool.query(`
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
    const stats = await pool.query(`
      SELECT 
        element_type,
        COUNT(*) as total,
        SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed_count,
        AVG(probability) as avg_probability
      FROM temp_simulation_failures
      GROUP BY element_type
    `);
    
    // Obtener nodos operacionales
    const operationalNodes = await pool.query(`
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
    const operationalEdges = await pool.query(`
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
