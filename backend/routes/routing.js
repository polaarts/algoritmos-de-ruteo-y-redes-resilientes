const express = require('express');
const router = express.Router();
const { query, convertToGeoJSON } = require('../config/database');

/**
 * GET /api/routing
 * Get available routing endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Routing API endpoints',
    endpoints: {
      calculate: {
        path: '/api/routing/calculate',
        methods: ['GET', 'POST'],
        description: 'Calculate shortest path using pgr_dijkstra',
        parameters: {
          start_lat: 'Starting latitude',
          start_lon: 'Starting longitude',
          end_lat: 'Ending latitude',
          end_lon: 'Ending longitude'
        }
      },
      calculate_resilient: {
        path: '/api/routing/calculate-resilient',
        methods: ['GET', 'POST'],
        description: 'Calculate resilient path considering threats',
        parameters: {
          start_lat: 'Starting latitude',
          start_lon: 'Starting longitude',
          end_lat: 'Ending latitude',
          end_lon: 'Ending longitude',
          avoid_threats: 'Comma-separated threat types to avoid'
        }
      },
      alternative_paths: {
        path: '/api/routing/alternative-paths',
        methods: ['GET', 'POST'],
        description: 'Find alternative paths between two points',
        parameters: {
          start_lat: 'Starting latitude',
          start_lon: 'Starting longitude',
          end_lat: 'Ending latitude',
          end_lon: 'Ending longitude',
          k: 'Number of alternative paths (default: 3)'
        }
      }
    },
    example: {
      url: '/api/routing/calculate?start_lat=-33.4489&start_lon=-70.6693&end_lat=-33.0369&end_lon=-71.6277',
      description: 'Santiago to Valparaíso route'
    }
  });
});

/**
 * GET /api/routing/calculate
 * Calculate shortest path using pgr_dijkstra
 * Query params: start_lat, start_lon, end_lat, end_lon
 */
router.get('/calculate', async (req, res, next) => {
  try {
    const { start_lat, start_lon, end_lat, end_lon } = req.query;

    // Validate required parameters
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Use the calculate_shortest_path function from schema.sql
    const result = await query(
      `SELECT * FROM calculate_shortest_path($1, $2, $3, $4)`,
      [
        parseFloat(start_lat),
        parseFloat(start_lon),
        parseFloat(end_lat),
        parseFloat(end_lon)
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No route found between these points',
        message: 'Nodes may not be connected or may not exist in the network'
      });
    }

    // Calculate total statistics
    const totalCost = result.rows[result.rows.length - 1].agg_cost;
    const totalEdges = result.rows.filter(r => r.edge !== null).length;

    // Convert to GeoJSON
    const features = result.rows
      .filter(row => row.geom !== null)
      .map(row => ({
        type: 'Feature',
        geometry: row.geom,
        properties: {
          seq: row.seq,
          path_seq: row.path_seq,
          node: row.node,
          edge: row.edge,
          cost: row.cost,
          agg_cost: row.agg_cost
        }
      }));

    res.json({
      type: 'FeatureCollection',
      features,
      route_info: {
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) },
        total_cost_meters: totalCost,
        total_cost_km: (totalCost / 1000).toFixed(2),
        total_edges: totalEdges,
        algorithm: 'pgr_dijkstra',
        considers_threats: false
      }
    });
  } catch (error) {
    console.error('Routing error:', error);
    next(error);
  }
});

/**
 * POST /api/routing/calculate
 * Calculate shortest path using pgr_dijkstra (POST version with body)
 * Body: { start_lat, start_lon, end_lat, end_lon }
 */
router.post('/calculate', async (req, res, next) => {
  try {
    const { start_lat, start_lon, end_lat, end_lon } = req.body;

    // Validate required parameters
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    const result = await query(
      `SELECT * FROM calculate_shortest_path($1, $2, $3, $4)`,
      [
        parseFloat(start_lat),
        parseFloat(start_lon),
        parseFloat(end_lat),
        parseFloat(end_lon)
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No route found between these points'
      });
    }

    const totalCost = result.rows[result.rows.length - 1].agg_cost;
    const totalEdges = result.rows.filter(r => r.edge !== null).length;

    const features = result.rows
      .filter(row => row.geom !== null)
      .map(row => ({
        type: 'Feature',
        geometry: row.geom,
        properties: {
          seq: row.seq,
          path_seq: row.path_seq,
          node: row.node,
          edge: row.edge,
          cost: row.cost,
          agg_cost: row.agg_cost
        }
      }));

    res.json({
      type: 'FeatureCollection',
      features,
      route_info: {
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) },
        total_cost_meters: totalCost,
        total_cost_km: (totalCost / 1000).toFixed(2),
        total_edges: totalEdges,
        algorithm: 'pgr_dijkstra',
        considers_threats: false
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/routing/example
 * Get a pre-defined example route (Santiago to Concepción)
 */
router.get('/example', async (req, res, next) => {
  try {
    // Santiago to Concepción
    const start_lat = -33.4489;
    const start_lon = -70.6693;
    const end_lat = -36.8270;
    const end_lon = -73.0498;

    const result = await query(
      `SELECT * FROM calculate_shortest_path($1, $2, $3, $4)`,
      [start_lat, start_lon, end_lat, end_lon]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Example route not available',
        message: 'Network may not be loaded yet'
      });
    }

    const totalCost = result.rows[result.rows.length - 1].agg_cost;
    const totalEdges = result.rows.filter(r => r.edge !== null).length;

    const features = result.rows
      .filter(row => row.geom !== null)
      .map(row => ({
        type: 'Feature',
        geometry: row.geom,
        properties: {
          seq: row.seq,
          path_seq: row.path_seq,
          node: row.node,
          edge: row.edge,
          cost: row.cost,
          agg_cost: row.agg_cost
        }
      }));

    res.json({
      type: 'FeatureCollection',
      features,
      route_info: {
        route_name: 'Santiago - Concepción',
        start: { name: 'Santiago', lat: start_lat, lon: start_lon },
        end: { name: 'Concepción', lat: end_lat, lon: end_lon },
        total_cost_meters: totalCost,
        total_cost_km: (totalCost / 1000).toFixed(2),
        total_edges: totalEdges,
        algorithm: 'pgr_dijkstra',
        considers_threats: false,
        description: 'Shortest path based on length only (worst case scenario - no threats considered)'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/routing/nearest-node/:lat/:lon
 * Find the nearest node to a coordinate
 */
router.get('/nearest-node/:lat/:lon', async (req, res, next) => {
  try {
    const { lat, lon } = req.params;

    const result = await query(
      `
      SELECT
        id,
        osm_id,
        node_type,
        latitude,
        longitude,
        region,
        city,
        ST_Distance(
          geometry,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        ) as distance_degrees,
        ST_Distance(
          geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM nodes
      ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1
      `,
      [parseFloat(lon), parseFloat(lat)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No nodes found in network' });
    }

    res.json({
      query_point: { lat: parseFloat(lat), lon: parseFloat(lon) },
      nearest_node: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/routing/topology-status
 * Check if network topology is ready for routing
 */
router.get('/topology-status', async (req, res, next) => {
  try {
    const edgesStatus = await query(`
      SELECT
        COUNT(*) as total_edges,
        COUNT(CASE WHEN source IS NOT NULL THEN 1 END) as edges_with_source,
        COUNT(CASE WHEN target IS NOT NULL THEN 1 END) as edges_with_target,
        COUNT(CASE WHEN cost IS NOT NULL AND cost > 0 THEN 1 END) as edges_with_cost,
        COUNT(CASE WHEN source IS NOT NULL AND target IS NOT NULL AND cost > 0 THEN 1 END) as edges_ready
      FROM edges
    `);

    const verticesStatus = await query(`
      SELECT COUNT(*) as total_vertices
      FROM edges_vertices_pgr
    `).catch(() => ({ rows: [{ total_vertices: 0 }] }));

    const nodesStatus = await query(`
      SELECT COUNT(*) as total_nodes
      FROM nodes
    `);

    const status = edgesStatus.rows[0];
    const readyPercentage = status.total_edges > 0
      ? ((status.edges_ready / status.total_edges) * 100).toFixed(2)
      : 0;

    const isReady = status.edges_ready > 0 && status.edges_ready === status.total_edges;

    res.json({
      ready: isReady,
      ready_percentage: parseFloat(readyPercentage),
      edges: {
        total: parseInt(status.total_edges),
        with_source: parseInt(status.edges_with_source),
        with_target: parseInt(status.edges_with_target),
        with_cost: parseInt(status.edges_with_cost),
        ready_for_routing: parseInt(status.edges_ready)
      },
      vertices: {
        total: parseInt(verticesStatus.rows[0].total_vertices)
      },
      nodes: {
        total: parseInt(nodesStatus.rows[0].total_nodes)
      },
      message: isReady
        ? 'Network topology is ready for routing'
        : 'Network topology needs to be created. Run create-topology.sql script.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
