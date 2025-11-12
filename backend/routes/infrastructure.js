const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');

/**
 * GET /api/infrastructure
 * Get available infrastructure endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Infrastructure API endpoints',
    endpoints: {
      links: {
        path: '/api/infrastructure/links',
        method: 'GET',
        description: 'Get all fiber optic links as GeoJSON',
        query_params: ['region', 'limit', 'offset', 'bbox']
      },
      link_by_id: {
        path: '/api/infrastructure/links/:id',
        method: 'GET',
        description: 'Get specific link by ID'
      },
      nodes: {
        path: '/api/infrastructure/nodes',
        method: 'GET',
        description: 'Get all nodes as GeoJSON',
        query_params: ['region', 'limit', 'offset', 'bbox']
      },
      node_by_id: {
        path: '/api/infrastructure/nodes/:id',
        method: 'GET',
        description: 'Get specific node by ID'
      },
      stats: {
        path: '/api/infrastructure/stats',
        method: 'GET',
        description: 'Get infrastructure statistics by region'
      },
      regions: {
        path: '/api/infrastructure/regions',
        method: 'GET',
        description: 'Get list of available regions'
      }
    }
  });
});

/**
 * GET /api/infrastructure/links
 * Get all fiber links as GeoJSON
 * Query params: region, limit, offset, bbox (minLon,minLat,maxLon,maxLat)
 */
router.get('/links', async (req, res, next) => {
  try {
    const { region, limit = 1000, offset = 0, bbox } = req.query;

    let sql = `
      SELECT
        id,
        source,
        target,
        osm_id,
        length,
        highway,
        name,
        surface,
        lanes,
        maxspeed,
        oneway,
        bridge,
        tunnel,
        region,
        link_type,
        cost,
        reverse_cost,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM fiber_links
      WHERE cost > 0
    `;

    const params = [];
    let paramIndex = 1;

    if (region) {
      sql += ` AND region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    // Bounding box filter for map viewport
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(parseFloat);
      sql += ` AND geometry && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
      paramIndex += 4;
    }

    sql += ` ORDER BY id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM fiber_links WHERE cost > 0';
    const countParams = [];
    if (region) {
      countSql += ' AND region = $1';
      countParams.push(region);
    }
    const countResult = await query(countSql, countParams);

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        returned: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/infrastructure/links/:id
 * Get specific link by ID
 */
router.get('/links/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        id,
        source,
        target,
        osm_id,
        length,
        highway,
        name,
        surface,
        lanes,
        maxspeed,
        oneway,
        bridge,
        tunnel,
        region,
        link_type,
        cost,
        reverse_cost,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM fiber_links
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const geojson = convertToGeoJSON(result.rows);
    res.json(geojson.features[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/infrastructure/nodes
 * Get all nodes as GeoJSON
 * Query params: region, limit, offset, bbox
 */
router.get('/nodes', async (req, res, next) => {
  try {
    const { region, limit = 100, offset = 0, bbox } = req.query;

    let sql = `
      SELECT
        id,
        osm_id,
        latitude,
        longitude,
        region,
        city,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM fiber_nodes
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (region) {
      sql += ` AND region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    // Bounding box filter
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(parseFloat);
      sql += ` AND geometry && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
      paramIndex += 4;
    }

    sql += ` ORDER BY id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM fiber_nodes WHERE 1=1';
    const countParams = [];
    if (region) {
      countSql += ' AND region = $1';
      countParams.push(region);
    }
    const countResult = await query(countSql, countParams);

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        returned: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/infrastructure/nodes/:id
 * Get specific node by ID
 */
router.get('/nodes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        id,
        osm_id,
        latitude,
        longitude,
        region,
        city,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM fiber_nodes
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const geojson = convertToGeoJSON(result.rows);
    res.json(geojson.features[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/infrastructure/stats
 * Get network statistics by region
 */
router.get('/stats', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        region,
        COUNT(DISTINCT id) as total_links,
        COUNT(DISTINCT source) + COUNT(DISTINCT target) as total_nodes,
        ROUND(SUM(length)/1000, 2) as total_km,
        COUNT(CASE WHEN highway LIKE '%motorway%' THEN 1 END) as motorways,
        COUNT(CASE WHEN bridge = 'yes' THEN 1 END) as bridges,
        COUNT(CASE WHEN tunnel = 'yes' THEN 1 END) as tunnels
      FROM fiber_links
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY total_km DESC
    `);

    res.json({
      statistics: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/infrastructure/regions
 * Get list of available regions
 */
router.get('/regions', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT DISTINCT region, COUNT(*) as link_count
      FROM fiber_links
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY link_count DESC
    `);

    res.json({
      regions: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
