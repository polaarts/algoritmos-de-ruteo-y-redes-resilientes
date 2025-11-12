/**
 * Ejemplo de uso de Supabase en las rutas
 * Este archivo muestra cómo usar tanto el cliente de Supabase como el pool de PostgreSQL
 */

const express = require('express');
const router = express.Router();
const { supabase, query, convertToGeoJSON } = require('../config/database');

/**
 * Método 1: Usando el cliente de Supabase
 * Ideal para operaciones CRUD simples y rápidas
 */
router.get('/method1/datacenters', async (req, res, next) => {
  try {
    const { city, limit = 100 } = req.query;

    let supabaseQuery = supabase
      .from('datacenters')
      .select('*');

    if (city) {
      supabaseQuery = supabaseQuery.eq('city', city);
    }

    supabaseQuery = supabaseQuery.limit(parseInt(limit));

    const { data, error, count } = await supabaseQuery;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    res.json({
      type: 'FeatureCollection',
      features: data.map(item => ({
        type: 'Feature',
        geometry: item.geometry,
        properties: {
          id: item.id,
          name: item.name,
          city: item.city,
          state: item.state,
          tier_level: item.tier_level
        }
      })),
      metadata: {
        method: 'supabase-client',
        total: count,
        returned: data.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Método 2: Usando el pool de PostgreSQL
 * Ideal para consultas complejas con PostGIS, pgRouting o funciones personalizadas
 */
router.get('/method2/datacenters', async (req, res, next) => {
  try {
    const { city, limit = 100 } = req.query;

    let sql = `
      SELECT
        id,
        name,
        company_name,
        city,
        state,
        country,
        capacity_mw,
        tier_level,
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

    sql += ` LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    const geojson = convertToGeoJSON(result.rows);

    res.json({
      ...geojson,
      metadata: {
        method: 'postgresql-pool',
        returned: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Método 3: Consulta espacial compleja con PostGIS
 * Este tipo de consulta DEBE usar el pool de PostgreSQL
 */
router.get('/method3/nearby/:lat/:lon', async (req, res, next) => {
  try {
    const { lat, lon } = req.params;
    const { radius_km = 50 } = req.query;

    const result = await query(
      `
      SELECT
        id,
        name,
        city,
        state,
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
        method: 'postgresql-postgis',
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
 * Método 4: Uso combinado
 * Primero verifica con Supabase, luego hace consulta compleja con PostgreSQL
 */
router.get('/method4/complex/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Obtener datacenter con Supabase (rápido)
    const { data: datacenter, error } = await supabase
      .from('datacenters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Datacenter not found' });
    }

    // 2. Calcular amenazas cercanas con PostgreSQL (consulta compleja)
    const threats = await query(
      `
      SELECT 
        'earthquake' as type,
        magnitude as severity,
        ST_Distance(
          e.geometry::geography,
          d.geometry::geography
        ) / 1000 as distance_km
      FROM earthquakes e, datacenters d
      WHERE d.id = $1
      AND ST_DWithin(
        e.geometry::geography,
        d.geometry::geography,
        100000  -- 100 km
      )
      ORDER BY distance_km
      LIMIT 10
      `,
      [id]
    );

    res.json({
      datacenter,
      nearby_threats: threats.rows,
      metadata: {
        method: 'combined-supabase-postgresql'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Guía de uso:
 * 
 * ✅ USA SUPABASE cuando:
 * - Necesitas operaciones CRUD simples (SELECT, INSERT, UPDATE, DELETE)
 * - No necesitas funciones espaciales complejas
 * - Quieres aprovechar RLS (Row Level Security)
 * - Necesitas autenticación integrada
 * 
 * ✅ USA POSTGRESQL POOL cuando:
 * - Necesitas consultas con PostGIS (ST_Distance, ST_DWithin, etc.)
 * - Usas pgRouting (pgr_dijkstra, pgr_astar, etc.)
 * - Tienes funciones SQL personalizadas
 * - Necesitas transacciones complejas
 * - Consultas con múltiples JOINs espaciales
 */

module.exports = router;
