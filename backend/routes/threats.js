const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');

/**
 * GET /api/threats
 * Get available threats endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Threats API endpoints',
    endpoints: {
      earthquakes: {
        path: '/api/threats/earthquakes',
        method: 'GET',
        description: 'Get earthquake data as GeoJSON',
        query_params: ['min_magnitude', 'max_magnitude', 'start_date', 'end_date', 'limit', 'offset']
      },
      wildfires: {
        path: '/api/threats/wildfires',
        method: 'GET',
        description: 'Get wildfire risk zones as GeoJSON',
        query_params: ['min_risk', 'region', 'limit', 'offset']
      },
      extreme_weather: {
        path: '/api/threats/extreme-weather',
        method: 'GET',
        description: 'Get extreme weather events as GeoJSON',
        query_params: ['event_type', 'start_date', 'end_date', 'limit', 'offset']
      },
      all_threats: {
        path: '/api/threats/all',
        method: 'GET',
        description: 'Get all threats in a bounding box',
        query_params: ['min_lat', 'min_lon', 'max_lat', 'max_lon']
      },
      threat_impact: {
        path: '/api/threats/impact/:edge_id',
        method: 'GET',
        description: 'Get threat impact analysis for specific edge'
      }
    }
  });
});

/**
 * GET /api/threats/earthquakes
 * Get all earthquakes as GeoJSON
 */
router.get('/earthquakes', async (req, res, next) => {
  try {
    const { min_magnitude, threat_level, start_date, end_date, limit = 1000, offset = 0 } = req.query;

    let sql = `
      SELECT
        id,
        usgs_id,
        magnitude,
        depth,
        time,
        place,
        threat_level,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM earthquakes
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (min_magnitude) {
      sql += ` AND magnitude >= $${paramIndex}`;
      params.push(parseFloat(min_magnitude));
      paramIndex++;
    }

    if (threat_level) {
      sql += ` AND threat_level = $${paramIndex}`;
      params.push(threat_level);
      paramIndex++;
    }

    if (start_date) {
      sql += ` AND time >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      sql += ` AND time <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    sql += ` ORDER BY time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Get total count
    const countResult = await query('SELECT COUNT(*) as total FROM earthquakes');

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
 * GET /api/threats/earthquakes/nearby/:lat/:lon
 * Find earthquakes within a radius
 */
router.get('/earthquakes/nearby/:lat/:lon', async (req, res, next) => {
  try {
    const { lat, lon } = req.params;
    const { radius_km = 100, min_magnitude = 4.0 } = req.query;

    const result = await query(
      `
      SELECT
        id,
        usgs_id,
        magnitude,
        depth,
        time,
        place,
        threat_level,
        ST_Distance(
          geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM earthquakes
      WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3 * 1000
      )
      AND magnitude >= $4
      ORDER BY distance_km, magnitude DESC
      `,
      [parseFloat(lon), parseFloat(lat), parseFloat(radius_km), parseFloat(min_magnitude)]
    );

    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        center: { lat: parseFloat(lat), lon: parseFloat(lon) },
        radius_km: parseFloat(radius_km),
        min_magnitude: parseFloat(min_magnitude),
        found: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/threats/fire-zones
 * Get fire risk zones as GeoJSON
 */
router.get('/fire-zones', async (req, res, next) => {
  try {
    const { risk_level, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT
        id,
        zone_name,
        risk_level,
        vegetation_type,
        area_km2,
        high_risk_months,
        last_fire_date,
        fire_frequency,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM fire_risk_zones
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (risk_level) {
      sql += ` AND risk_level = $${paramIndex}`;
      params.push(risk_level);
      paramIndex++;
    }

    sql += ` ORDER BY risk_level DESC, area_km2 DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    const geojson = convertToGeoJSON(result.rows);

    res.json(geojson);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/threats/weather-events
 * Get weather events as GeoJSON
 */
router.get('/weather-events', async (req, res, next) => {
  try {
    const { event_type, severity, start_date, end_date, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT
        id,
        event_type,
        severity,
        event_date,
        duration_hours,
        max_wind_speed,
        precipitation_mm,
        temperature_c,
        affected_population,
        infrastructure_damage,
        description,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM weather_events
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (event_type) {
      sql += ` AND event_type = $${paramIndex}`;
      params.push(event_type);
      paramIndex++;
    }

    if (severity) {
      sql += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (start_date) {
      sql += ` AND event_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      sql += ` AND event_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    sql += ` ORDER BY event_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    const geojson = convertToGeoJSON(result.rows);

    res.json(geojson);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/threats/nearby/:lat/:lon
 * Find all threats (earthquakes, fire zones, weather) near a point
 * Uses the find_nearby_threats() SQL function
 */
router.get('/nearby/:lat/:lon', async (req, res, next) => {
  try {
    const { lat, lon } = req.params;
    const { radius_km = 50 } = req.query;

    const result = await query(
      `
      SELECT * FROM find_nearby_threats($1, $2, $3)
      ORDER BY distance_km
      `,
      [parseFloat(lat), parseFloat(lon), parseFloat(radius_km)]
    );

    res.json({
      location: { lat: parseFloat(lat), lon: parseFloat(lon) },
      radius_km: parseFloat(radius_km),
      threats: result.rows,
      total_found: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/threats/statistics
 * Get threat statistics
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const earthquakeStats = await query(`
      SELECT
        COUNT(*) as total,
        AVG(magnitude) as avg_magnitude,
        MAX(magnitude) as max_magnitude,
        MIN(magnitude) as min_magnitude,
        COUNT(CASE WHEN threat_level = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN threat_level = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN threat_level = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN threat_level = 'low' THEN 1 END) as low_count
      FROM earthquakes
    `);

    const fireStats = await query(`
      SELECT
        COUNT(*) as total_zones,
        SUM(area_km2) as total_area_km2,
        COUNT(CASE WHEN risk_level = 'extreme' THEN 1 END) as extreme_count,
        COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_count
      FROM fire_risk_zones
    `);

    const weatherStats = await query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN severity = 'extreme' THEN 1 END) as extreme_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN event_type = 'storm' THEN 1 END) as storms,
        COUNT(CASE WHEN event_type = 'flood' THEN 1 END) as floods
      FROM weather_events
    `);

    res.json({
      earthquakes: earthquakeStats.rows[0],
      fire_zones: fireStats.rows[0],
      weather_events: weatherStats.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
