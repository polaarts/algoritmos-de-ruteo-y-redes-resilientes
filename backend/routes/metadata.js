const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');

/**
 * GET /api/metadata
 * Get available metadata endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Metadata API endpoints',
    endpoints: {
      datacenters: {
        path: '/api/metadata/datacenters',
        method: 'GET',
        description: 'Get all datacenters as GeoJSON',
        query_params: ['region', 'limit', 'offset']
      },
      datacenter_by_id: {
        path: '/api/metadata/datacenters/:id',
        method: 'GET',
        description: 'Get specific datacenter by ID'
      },
      urban_density: {
        path: '/api/metadata/urban-density',
        method: 'GET',
        description: 'Get urban density data',
        query_params: ['min_lat', 'min_lon', 'max_lat', 'max_lon']
      },
      ground_types: {
        path: '/api/metadata/ground-types',
        method: 'GET',
        description: 'Get ground types data',
        query_params: ['min_lat', 'min_lon', 'max_lat', 'max_lon']
      }
    }
  });
});

/**
 * GET /api/metadata/datacenters
 * Get all datacenters as GeoJSON
 */
router.get('/datacenters', async (req, res, next) => {
  try {
    const { city, state, tier_level, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT
        id,
        name,
        company_name,
        address,
        city,
        state,
        country,
        capacity_mw,
        tier_level,
        year_opened,
        urban_density,
        population_5km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM datacenters
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (city) {
      sql += ` AND city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }

    if (state) {
      sql += ` AND state = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    if (tier_level) {
      sql += ` AND tier_level = $${paramIndex}`;
      params.push(parseInt(tier_level));
      paramIndex++;
    }

    sql += ` ORDER BY id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    const countResult = await query('SELECT COUNT(*) as total FROM datacenters');

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
 * GET /api/metadata/datacenters/:id
 * Get specific datacenter by ID
 */
router.get('/datacenters/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        id,
        name,
        company_name,
        address,
        city,
        state,
        country,
        capacity_mw,
        tier_level,
        year_opened,
        urban_density,
        population_5km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM datacenters
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Datacenter not found' });
    }

    const geojson = convertToGeoJSON(result.rows);
    res.json(geojson.features[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metadata/datacenters/nearby/:lat/:lon
 * Find datacenters within a radius
 */
router.get('/datacenters/nearby/:lat/:lon', async (req, res, next) => {
  try {
    const { lat, lon } = req.params;
    const { radius_km = 50 } = req.query;

    const result = await query(
      `
      SELECT
        id,
        name,
        company_name,
        city,
        state,
        tier_level,
        ST_Distance(
          geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM datacenters
      WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3 * 1000
      )
      ORDER BY distance_km
      `,
      [parseFloat(lon), parseFloat(lat), parseFloat(radius_km)]
    );

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        center: { lat: parseFloat(lat), lon: parseFloat(lon) },
        radius_km: parseFloat(radius_km),
        found: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metadata/ground-type
 * Get ground type zones as GeoJSON
 */
router.get('/ground-type', async (req, res, next) => {
  try {
    const { soil_type, stability, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT
        id,
        soil_type,
        stability,
        installation_difficulty,
        permeability,
        bearing_capacity,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM ground_type
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (soil_type) {
      sql += ` AND soil_type = $${paramIndex}`;
      params.push(soil_type);
      paramIndex++;
    }

    if (stability) {
      sql += ` AND stability = $${paramIndex}`;
      params.push(stability);
      paramIndex++;
    }

    sql += ` ORDER BY id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    const geojson = convertToGeoJSON(result.rows);

    res.json(geojson);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metadata/cities
 * Get list of cities with datacenters
 */
router.get('/cities', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        city,
        state,
        COUNT(*) as datacenter_count,
        AVG(tier_level) as avg_tier_level
      FROM datacenters
      WHERE city IS NOT NULL
      GROUP BY city, state
      ORDER BY datacenter_count DESC
    `);

    res.json({
      cities: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
