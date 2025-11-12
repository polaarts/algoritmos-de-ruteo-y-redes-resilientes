const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');

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
      nodes: {
        path: '/api/probabilities/nodes',
        method: 'GET',
        description: 'Get all node failure probabilities',
        query_params: ['limit', 'offset']
      },
      node_detail: {
        path: '/api/probabilities/nodes/:id',
        method: 'GET',
        description: 'Get detailed probabilities for specific node'
      },
      statistics: {
        path: '/api/probabilities/statistics',
        method: 'GET',
        description: 'Get probability statistics'
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
        fl.id,
        fl.name,
        fl.region,
        fl.highway,
        fl.bridge,
        fl.tunnel,
        fl.length,
        ep.earthquake_probability,
        ep.fire_probability,
        ep.flood_probability,
        ep.weather_probability,
        ep.landslide_probability,
        ep.total_failure_probability,
        ep.bridge_factor,
        ep.tunnel_factor,
        ep.surface_quality_factor,
        ST_AsGeoJSON(fl.geometry)::json as geometry
      FROM fiber_links fl
      LEFT JOIN edge_probabilities ep ON fl.id = ep.edge_id
      WHERE fl.cost > 0
    `;

    const params = [];
    let paramIndex = 1;

    if (min_probability) {
      sql += ` AND ep.total_failure_probability >= $${paramIndex}`;
      params.push(parseFloat(min_probability));
      paramIndex++;
    }

    if (max_probability) {
      sql += ` AND ep.total_failure_probability <= $${paramIndex}`;
      params.push(parseFloat(max_probability));
      paramIndex++;
    }

    sql += ` ORDER BY ep.total_failure_probability DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM edge_probabilities'
    );

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        total: parseInt(countResult.rows[0].total),
        returned: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
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
 * Get detailed probability breakdown for a specific edge
 */
router.get('/edges/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        fl.id,
        fl.name,
        fl.region,
        fl.highway,
        fl.bridge,
        fl.tunnel,
        fl.length,
        fl.surface,
        ep.earthquake_probability,
        ep.fire_probability,
        ep.flood_probability,
        ep.weather_probability,
        ep.landslide_probability,
        ep.total_failure_probability,
        ep.bridge_factor,
        ep.tunnel_factor,
        ep.surface_quality_factor,
        ST_AsGeoJSON(fl.geometry)::json as geometry
      FROM fiber_links fl
      LEFT JOIN edge_probabilities ep ON fl.id = ep.edge_id
      WHERE fl.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edge not found' });
    }

    const edge = result.rows[0];

    // Get nearby threats
    const nearbyThreats = await query(
      `
      SELECT
        'earthquake' as threat_type,
        COUNT(*) as count,
        AVG(magnitude) as avg_magnitude
      FROM earthquakes
      WHERE ST_DWithin(
        geometry::geography,
        (SELECT geometry::geography FROM fiber_links WHERE id = $1),
        200000  -- 200km radius
      )
      UNION ALL
      SELECT
        'fire_zone' as threat_type,
        COUNT(*) as count,
        NULL as avg_magnitude
      FROM fire_risk_zones
      WHERE ST_Intersects(
        geometry,
        ST_Buffer((SELECT geometry FROM fiber_links WHERE id = $1)::geography, 50000)::geometry
      )
      UNION ALL
      SELECT
        'weather_event' as threat_type,
        COUNT(*) as count,
        NULL as avg_magnitude
      FROM weather_events
      WHERE ST_DWithin(
        geometry::geography,
        (SELECT geometry::geography FROM fiber_links WHERE id = $1),
        100000  -- 100km radius
      )
      `,
      [id]
    );

    res.json({
      edge: {
        ...edge,
        geometry: edge.geometry
      },
      probability_breakdown: {
        earthquake: edge.earthquake_probability,
        fire: edge.fire_probability,
        flood: edge.flood_probability,
        weather: edge.weather_probability,
        landslide: edge.landslide_probability,
        total: edge.total_failure_probability
      },
      adjustment_factors: {
        bridge: edge.bridge_factor,
        tunnel: edge.tunnel_factor,
        surface_quality: edge.surface_quality_factor
      },
      nearby_threats: nearbyThreats.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/probabilities/nodes
 * Get all nodes with their failure probabilities
 */
router.get('/nodes', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const result = await query(
      `
      SELECT
        fn.id,
        fn.region,
        fn.city,
        np.earthquake_probability,
        np.fire_probability,
        np.flood_probability,
        np.total_failure_probability,
        ST_AsGeoJSON(fn.geometry)::json as geometry
      FROM fiber_nodes fn
      LEFT JOIN node_probabilities np ON fn.id = np.node_id
      ORDER BY np.total_failure_probability DESC
      LIMIT $1 OFFSET $2
      `,
      [parseInt(limit), parseInt(offset)]
    );

    const countResult = await query('SELECT COUNT(*) as total FROM node_probabilities');

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        total: parseInt(countResult.rows[0].total),
        returned: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/probabilities/nodes/:id
 * Get detailed probability for a specific node
 */
router.get('/nodes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        fn.id,
        fn.region,
        fn.city,
        fn.latitude,
        fn.longitude,
        np.earthquake_probability,
        np.fire_probability,
        np.flood_probability,
        np.total_failure_probability,
        ST_AsGeoJSON(fn.geometry)::json as geometry
      FROM fiber_nodes fn
      LEFT JOIN node_probabilities np ON fn.id = np.node_id
      WHERE fn.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/probabilities/statistics
 * Get overall probability statistics
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const edgeStats = await query(`
      SELECT
        COUNT(*) as total_edges,
        AVG(total_failure_probability) as avg_total_probability,
        MAX(total_failure_probability) as max_total_probability,
        MIN(total_failure_probability) as min_total_probability,
        AVG(earthquake_probability) as avg_earthquake_prob,
        AVG(fire_probability) as avg_fire_prob,
        AVG(flood_probability) as avg_flood_prob,
        AVG(weather_probability) as avg_weather_prob,
        AVG(landslide_probability) as avg_landslide_prob,
        COUNT(CASE WHEN total_failure_probability > 0.5 THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN total_failure_probability BETWEEN 0.3 AND 0.5 THEN 1 END) as medium_risk_count,
        COUNT(CASE WHEN total_failure_probability < 0.3 THEN 1 END) as low_risk_count
      FROM edge_probabilities
    `);

    const nodeStats = await query(`
      SELECT
        COUNT(*) as total_nodes,
        AVG(total_failure_probability) as avg_total_probability,
        MAX(total_failure_probability) as max_total_probability,
        MIN(total_failure_probability) as min_total_probability,
        COUNT(CASE WHEN total_failure_probability > 0.5 THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN total_failure_probability BETWEEN 0.3 AND 0.5 THEN 1 END) as medium_risk_count,
        COUNT(CASE WHEN total_failure_probability < 0.3 THEN 1 END) as low_risk_count
      FROM node_probabilities
    `);

    const regionalStats = await query(`
      SELECT
        fl.region,
        COUNT(DISTINCT ep.edge_id) as edge_count,
        AVG(ep.total_failure_probability) as avg_failure_probability,
        MAX(ep.total_failure_probability) as max_failure_probability
      FROM fiber_links fl
      JOIN edge_probabilities ep ON fl.id = ep.edge_id
      WHERE fl.region IS NOT NULL
      GROUP BY fl.region
      ORDER BY avg_failure_probability DESC
    `);

    res.json({
      edges: edgeStats.rows[0],
      nodes: nodeStats.rows[0],
      by_region: regionalStats.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/probabilities/heatmap
 * Get probability data for heatmap visualization
 */
router.get('/heatmap', async (req, res, next) => {
  try {
    const { bbox, min_probability = 0.3 } = req.query;

    let sql = `
      SELECT
        fl.id,
        ST_Y(ST_Centroid(fl.geometry)) as lat,
        ST_X(ST_Centroid(fl.geometry)) as lon,
        ep.total_failure_probability as intensity
      FROM fiber_links fl
      JOIN edge_probabilities ep ON fl.id = ep.edge_id
      WHERE ep.total_failure_probability >= $1
    `;

    const params = [parseFloat(min_probability)];
    let paramIndex = 2;

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(parseFloat);
      sql += ` AND fl.geometry && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
    }

    sql += ` LIMIT 1000`;

    const result = await query(sql, params);

    res.json({
      type: 'heatmap',
      points: result.rows.map(row => ({
        lat: row.lat,
        lon: row.lon,
        intensity: row.intensity
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
