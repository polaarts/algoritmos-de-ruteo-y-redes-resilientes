const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/simulation
 * Lista todas las simulaciones
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        probability_threshold,
        created_at,
        total_failures,
        total_edges_analyzed
      FROM simulation_runs
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      simulations: result.rows
    });
  } catch (error) {
    console.error('Error fetching simulations:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener simulaciones'
    });
  }
});

/**
 * GET /api/simulation/:id
 * Obtiene detalles de una simulación específica
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener información de la simulación
    const simResult = await pool.query(`
      SELECT * FROM simulation_runs WHERE id = $1
    `, [id]);
    
    if (simResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Simulación no encontrada'
      });
    }
    
    // Obtener estadísticas de fallas
    const statsResult = await pool.query(`
      SELECT
        element_type,
        COUNT(*) as total_elements,
        SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed_count,
        AVG(CASE WHEN failed THEN failure_probability ELSE 0 END) as avg_failure_prob
      FROM simulated_failures
      WHERE simulation_id = $1
      GROUP BY element_type
    `, [id]);
    
    res.json({
      success: true,
      simulation: simResult.rows[0],
      statistics: statsResult.rows
    });
  } catch (error) {
    console.error('Error fetching simulation:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener detalles de simulación'
    });
  }
});

/**
 * POST /api/simulation/run
 * Ejecuta una nueva simulación Monte Carlo
 */
router.post('/run', async (req, res) => {
  try {
    const { 
      name = 'Simulación ' + new Date().toISOString(),
      probabilityThreshold = 0.3 
    } = req.body;
    
    // Validaciones
    if (probabilityThreshold < 0 || probabilityThreshold > 1) {
      return res.status(400).json({
        success: false,
        error: 'Umbral de probabilidad debe estar entre 0 y 1'
      });
    }
    
    const startTime = Date.now();
    
    // Ejecutar simulación
    const result = await pool.query(`
      SELECT simulate_failures($1, $2) as simulation_id
    `, [name, probabilityThreshold]);
    
    const simulationId = result.rows[0].simulation_id;
    const executionTime = Date.now() - startTime;
    
    // Obtener estadísticas de la simulación
    const statsResult = await pool.query(`
      SELECT * FROM simulation_runs WHERE id = $1
    `, [simulationId]);
    
    res.json({
      success: true,
      simulationId,
      executionTimeMs: executionTime,
      simulation: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error running simulation:', error);
    res.status(500).json({
      success: false,
      error: 'Error al ejecutar simulación: ' + error.message
    });
  }
});

/**
 * GET /api/simulation/:id/failures
 * Obtiene los edges/nodos que fallaron en una simulación
 */
router.get('/:id/failures', async (req, res) => {
  try {
    const { id } = req.params;
    const { element_type = 'edge' } = req.query;
    
    const result = await pool.query(`
      SELECT 
        sf.element_id,
        sf.element_type,
        sf.failure_probability,
        sf.failed,
        e.geometry
      FROM simulated_failures sf
      LEFT JOIN edges e ON sf.element_type = 'edge' AND sf.element_id = e.id
      WHERE sf.simulation_id = $1 
        AND sf.element_type = $2
        AND sf.failed = true
    `, [id, element_type]);
    
    // Convertir a GeoJSON
    const features = result.rows.map(row => ({
      type: 'Feature',
      properties: {
        element_id: row.element_id,
        element_type: row.element_type,
        failure_probability: row.failure_probability,
        failed: row.failed
      },
      geometry: row.geometry ? JSON.parse(JSON.stringify(row.geometry)) : null
    }));
    
    res.json({
      type: 'FeatureCollection',
      features,
      count: features.length
    });
  } catch (error) {
    console.error('Error fetching failures:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener fallas de simulación'
    });
  }
});

/**
 * GET /api/simulation/:id/statistics
 * Obtiene estadísticas detalladas de una simulación
 */
router.get('/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM calculate_simulation_statistics($1)
    `, [id]);
    
    res.json({
      success: true,
      statistics: result.rows[0]
    });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular estadísticas'
    });
  }
});

/**
 * DELETE /api/simulation/:id
 * Elimina una simulación y sus resultados
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(`
      DELETE FROM simulation_runs WHERE id = $1
    `, [id]);
    
    res.json({
      success: true,
      message: 'Simulación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting simulation:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar simulación'
    });
  }
});

module.exports = router;
