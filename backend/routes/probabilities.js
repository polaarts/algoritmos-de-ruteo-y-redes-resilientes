const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');
const { spawn } = require('child_process');
const path = require('path');

/**
 * GET /api/probabilities
 * Get available probability endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Failure Probabilities API',
    endpoints: {
      edges: {
        path: '/api/probabilities/edges',
        method: 'GET',
        description: 'Get all edge failure probabilities',
        query_params: ['min_probability', 'max_probability', 'limit', 'offset']
      },
      edge_detail: {
        path: '/api/probabilities/edges/:id',
        method: 'GET',
        description: 'Get detailed probabilities for specific edge'
      },
      statistics: {
        path: '/api/probabilities/statistics',
        method: 'GET',
        description: 'Get probability statistics'
      },
      calculate: {
        path: '/api/probabilities/calculate',
        method: 'POST',
        description: 'Recalculate failure probabilities',
        body: {
          threat_radius_km: 'number (default: 200)',
          limit: 'number (optional)'
        }
      }
    }
  });
});

/**
 * GET /api/probabilities/edges
 * Get all edges with their combined failure probabilities
 */
router.get('/edges', async (req, res, next) => {
  try {
    const { min_probability, max_probability, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT
        e.id,
        e.name,
        e.region,
        e.highway,
        e.bridge,
        e.tunnel,
        ecp.combined_probability,
        ecp.threat_count,
        ecp.max_individual_probability,
        ecp.dominant_threat_type,
        ecp.last_updated,
        ST_AsGeoJSON(e.geometry)::json as geometry
      FROM edges e
      JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (min_probability) {
      sql += ` AND ecp.combined_probability >= $${paramIndex}`;
      params.push(parseFloat(min_probability));
      paramIndex++;
    }

    if (max_probability) {
      sql += ` AND ecp.combined_probability <= $${paramIndex}`;
      params.push(parseFloat(max_probability));
      paramIndex++;
    }

    sql += ` ORDER BY ecp.combined_probability DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        returned: result.rows.length,
        filters: {
          min_probability: min_probability || 0,
          max_probability: max_probability || 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/probabilities/edges/:id
 * Get detailed failure probabilities for a specific edge
 */
router.get('/edges/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get combined probability
    const combinedResult = await query(
      `
      SELECT
        e.id,
        e.name,
        e.region,
        e.highway,
        e.bridge,
        e.tunnel,
        e.recubrimiento_estim,
        ecp.combined_probability,
        ecp.threat_count,
        ecp.max_individual_probability,
        ecp.dominant_threat_type,
        ecp.last_updated,
        ST_AsGeoJSON(e.geometry)::json as geometry
      FROM edges e
      LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
      WHERE e.id = $1
      `,
      [id]
    );

    if (combinedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Edge not found' });
    }

    // Get individual threat probabilities
    const threatsResult = await query(
      `
      SELECT
        efp.threat_type,
        efp.threat_id,
        efp.distance_km,
        efp.severity_level,
        efp.base_probability,
        efp.infrastructure_factor,
        efp.adjusted_probability,
        efp.calculation_date,
        CASE efp.threat_type
          WHEN 'earthquake' THEN (
            SELECT json_build_object(
              'magnitude', e.magnitude,
              'place', e.place,
              'time', e.time
            ) FROM earthquakes e WHERE e.id = efp.threat_id
          )
          WHEN 'fire_zone' THEN (
            SELECT json_build_object(
              'zone_name', f.zone_name,
              'risk_level', f.risk_level
            ) FROM fire_risk_zones f WHERE f.id = efp.threat_id
          )
          WHEN 'weather' THEN (
            SELECT json_build_object(
              'event_type', w.event_type,
              'severity', w.severity
            ) FROM weather_events w WHERE w.id = efp.threat_id
          )
        END as threat_details
      FROM edge_failure_probabilities efp
      WHERE efp.edge_id = $1
      ORDER BY efp.adjusted_probability DESC
      `,
      [id]
    );

    const edgeData = combinedResult.rows[0];
    const geojson = convertToGeoJSON([edgeData]);

    res.json({
      ...geojson.features[0],
      individual_threats: threatsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/probabilities/statistics
 * Get probability statistics
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_edges,
        COUNT(*) FILTER (WHERE combined_probability > 0) as edges_with_risk,
        AVG(combined_probability) as avg_probability,
        MAX(combined_probability) as max_probability,
        MIN(combined_probability) FILTER (WHERE combined_probability > 0) as min_nonzero_probability,
        COUNT(*) FILTER (WHERE combined_probability > 0.5) as high_risk_count,
        COUNT(*) FILTER (WHERE combined_probability BETWEEN 0.3 AND 0.5) as medium_risk_count,
        COUNT(*) FILTER (WHERE combined_probability BETWEEN 0.1 AND 0.3) as low_risk_count,
        COUNT(*) FILTER (WHERE combined_probability < 0.1 AND combined_probability > 0) as very_low_risk_count,
        AVG(threat_count) as avg_threats_per_edge,
        MAX(threat_count) as max_threats_per_edge
      FROM edge_combined_probabilities
    `);

    const byThreatType = await query(`
      SELECT
        threat_type,
        COUNT(*) as count,
        AVG(adjusted_probability) as avg_probability,
        MAX(adjusted_probability) as max_probability
      FROM edge_failure_probabilities
      GROUP BY threat_type
      ORDER BY count DESC
    `);

    const byRegion = await query(`
      SELECT
        e.region,
        COUNT(*) as edge_count,
        AVG(ecp.combined_probability) as avg_probability,
        COUNT(*) FILTER (WHERE ecp.combined_probability > 0.3) as high_risk_count
      FROM edges e
      JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
      WHERE e.region IS NOT NULL
      GROUP BY e.region
      ORDER BY avg_probability DESC
    `);

    res.json({
      overall: statsResult.rows[0],
      by_threat_type: byThreatType.rows,
      by_region: byRegion.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/probabilities/calculate
 * Trigger recalculation of failure probabilities
 */
router.post('/calculate', async (req, res, next) => {
  try {
    const { threat_radius_km = 200, limit = null } = req.body;

    console.log('Starting probability calculation...');
    console.log(`Radius: ${threat_radius_km} km, Limit: ${limit || 'all'}`);

    // Execute Python script
    const scriptPath = path.join(__dirname, '../../scripts/calculate_failure_probabilities.py');
    
    const args = ['--radius', threat_radius_km.toString()];
    if (limit) {
      args.push('--limit', limit.toString());
    }

    const pythonProcess = spawn('python3', [scriptPath, ...args]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        return res.status(500).json({
          error: 'Calculation failed',
          details: errorOutput,
          output: output
        });
      }

      // Get updated statistics
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_edges,
          COUNT(*) FILTER (WHERE combined_probability > 0) as edges_with_risk,
          AVG(combined_probability) as avg_probability
        FROM edge_combined_probabilities
      `);

      res.json({
        success: true,
        message: 'Probabilities calculated successfully',
        stats: statsResult.rows[0],
        output: output
      });
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
