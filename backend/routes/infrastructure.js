const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');

/**
 * GET /api/infrastructure/edges
 * Get all edges (fiber optic links) as GeoJSON
 */
router.get('/edges', async (req, res, next) => {
  try {
    const { region, limit = 1000, offset = 0 } = req.query;

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
        recubrimiento_estim,
        cost,
        reverse_cost,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM edges
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (region) {
      sql += ` AND region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    sql += ` ORDER BY id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM edges WHERE 1=1';
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
 * GET /api/infrastructure/edges/:id
 * Get specific edge by ID
 */
router.get('/edges/:id', async (req, res, next) => {
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
        recubrimiento_estim,
        cost,
        reverse_cost,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM edges
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edge not found' });
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
 */
router.get('/nodes', async (req, res, next) => {
  try {
    const { region, node_type, limit = 1000, offset = 0 } = req.query;

    let sql = `
      SELECT
        id,
        osm_id,
        node_type,
        latitude,
        longitude,
        region,
        city,
        elevation,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM nodes
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (region) {
      sql += ` AND region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    if (node_type) {
      sql += ` AND node_type = $${paramIndex}`;
      params.push(node_type);
      paramIndex++;
    }

    sql += ` ORDER BY id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM nodes WHERE 1=1';
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
 * GET /api/infrastructure/stats
 * Get network statistics by region
 */
router.get('/stats', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT * FROM network_stats_by_region
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
      SELECT DISTINCT region, COUNT(*) as edge_count
      FROM edges
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY edge_count DESC
    `);

    res.json({
      regions: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
