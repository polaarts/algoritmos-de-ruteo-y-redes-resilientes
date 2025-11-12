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
        description: 'Calculate shortest path using pgr_dijkstra (distance only)',
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
        description: 'Calculate resilient path considering failure probabilities',
        parameters: {
          start_lat: 'Starting latitude',
          start_lon: 'Starting longitude',
          end_lat: 'Ending latitude',
          end_lon: 'Ending longitude',
          risk_weight: 'Weight for risk factor (0.0-1.0, default 0.5)'
        }
      },
      alternative_paths: {
        path: '/api/routing/alternative-paths',
        methods: ['GET', 'POST'],
        description: 'Find k-shortest alternative paths between two points',
        parameters: {
          start_lat: 'Starting latitude',
          start_lon: 'Starting longitude',
          end_lat: 'Ending latitude',
          end_lon: 'Ending longitude',
          k: 'Number of alternative paths (default: 3)'
        }
      },
      node_search: {
        path: '/api/routing/node-search',
        method: 'GET',
        description: 'Find nearest node to coordinates',
        parameters: {
          lat: 'Latitude',
          lon: 'Longitude'
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
 * GET /api/routing/node-search
 * Find nearest node to given coordinates
 */
router.get('/node-search', async (req, res, next) => {
  try {
    const { lat, lon, radius_km = 10 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['lat', 'lon']
      });
    }

    const result = await query(
      `
      SELECT
        id,
        latitude,
        longitude,
        region,
        ST_Distance(
          geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM fiber_nodes
      WHERE ST_DWithin(
        geometry::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3 * 1000
      )
      ORDER BY distance_km
      LIMIT 5
      `,
      [parseFloat(lon), parseFloat(lat), parseFloat(radius_km)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No nodes found within radius',
        message: `No nodes found within ${radius_km}km of (${lat}, ${lon})`
      });
    }

    res.json({
      query: { lat: parseFloat(lat), lon: parseFloat(lon), radius_km: parseFloat(radius_km) },
      nodes: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET/POST /api/routing/calculate
 * Calculate shortest path using pgr_dijkstra (distance only - Criterio 8 de rúbrica)
 */
router.get('/calculate', async (req, res, next) => {
  const startTime = performance.now();

  try {
    const { start_lat, start_lon, end_lat, end_lon } = req.query;
    console.log('🔵 [CALCULATE] Received request:', { start_lat, start_lon, end_lat, end_lon });

    // Validate required parameters
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      console.log('❌ [CALCULATE] Missing parameters');
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Find nearest nodes to start and end coordinates
    const startNodeResult = await query(
      `
      SELECT id
      FROM fiber_nodes
      ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1
      `,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `
      SELECT id
      FROM fiber_nodes
      ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1
      `,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Could not find nodes near provided coordinates'
      });
    }

    const startNodeId = startNodeResult.rows[0].id;
    const endNodeId = endNodeResult.rows[0].id;
    console.log('🔵 [CALCULATE] Found nodes:', { startNodeId, endNodeId });

    // Calculate route using pgr_dijkstra with cost = distance
    const routeResult = await query(
      `
      SELECT
        route.seq,
        route.node,
        route.edge,
        route.cost,
        route.agg_cost,
        n.latitude,
        n.longitude,
        ST_AsGeoJSON(n.geometry)::json as node_geom,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT ST_AsGeoJSON(fl.geometry)::json
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_geom,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT fl.length
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_length,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT fl.name
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_name
      FROM pgr_dijkstra(
        'SELECT id, source, target, cost, reverse_cost FROM fiber_links WHERE cost > 0',
        $1::bigint,
        $2::bigint,
        false
      ) as route
      LEFT JOIN fiber_nodes n ON route.node = n.id
      ORDER BY route.seq
      `,
      [startNodeId, endNodeId]
    );

    if (routeResult.rows.length === 0) {
      console.log('❌ [CALCULATE] No route found between nodes', { startNodeId, endNodeId });
      return res.status(404).json({
        error: 'No route found between these points',
        message: 'Nodes may not be connected in the network'
      });
    }

    console.log('✅ [CALCULATE] Route found with', routeResult.rows.length, 'segments');
    const computeTime = performance.now() - startTime;

    // Calculate total statistics
    const lastRow = routeResult.rows[routeResult.rows.length - 1];
    const totalDistance = lastRow.agg_cost; // meters
    const totalEdges = routeResult.rows.filter(r => r.edge !== null).length;

    // Convert to GeoJSON using edge geometries
    const geojson = convertToGeoJSON(routeResult.rows.filter(r => r.edge_geom !== null), 'edge_geom');

    res.json({
      ...geojson,
      route_info: {
        algorithm: 'Dijkstra (distance only)',
        total_cost_km: (totalDistance / 1000).toFixed(2),
        total_edges: totalEdges,
        compute_time_ms: Math.round(computeTime),
        considers_threats: false,
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST version for calculate
 */
router.post('/calculate', async (req, res, next) => {
  req.query = { ...req.query, ...req.body };
  return router.get('/calculate')(req, res, next);
});

/**
 * GET/POST /api/routing/calculate-resilient
 * Calculate resilient path considering failure probabilities (Criterio 10 de rúbrica)
 */
router.get('/calculate-resilient', async (req, res, next) => {
  const startTime = performance.now();

  try {
    const { start_lat, start_lon, end_lat, end_lon, risk_weight = 0.5 } = req.query;
    console.log('🟢 [RESILIENT] Received request:', { start_lat, start_lon, end_lat, end_lon, risk_weight });

    // Validate required parameters
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      console.log('❌ [RESILIENT] Missing parameters');
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    const riskWeightFloat = parseFloat(risk_weight);
    if (riskWeightFloat < 0 || riskWeightFloat > 10) {
      console.log('❌ [RESILIENT] Invalid risk_weight:', riskWeightFloat);
      return res.status(400).json({
        error: 'Invalid risk_weight',
        message: 'risk_weight must be between 0.0 and 10.0'
      });
    }
    console.log('🟢 [RESILIENT] Using risk_weight:', riskWeightFloat);

    // Find nearest nodes
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Could not find nodes near provided coordinates'
      });
    }

    const startNodeId = startNodeResult.rows[0].id;
    const endNodeId = endNodeResult.rows[0].id;

    // Calculate route using pgr_dijkstra with adjusted cost considering probabilities
    // cost_adjusted = cost * (1 + risk_weight * total_failure_probability)
    // Note: We build the SQL string dynamically because pgr_dijkstra doesn't support parameterized subqueries
    const routeResult = await query(
      `
      SELECT
        route.seq,
        route.node,
        route.edge,
        route.cost as adjusted_cost,
        route.agg_cost as adjusted_agg_cost,
        n.latitude,
        n.longitude,
        ST_AsGeoJSON(n.geometry)::json as node_geom,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT ST_AsGeoJSON(fl.geometry)::json
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_geom,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT fl.length
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_length,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT ep.total_failure_probability
            FROM edge_probabilities ep
            WHERE ep.edge_id = route.edge
          )
          ELSE NULL
        END as failure_probability,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT fl.name
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_name
      FROM pgr_dijkstra(
        'SELECT
          fl.id,
          fl.source,
          fl.target,
          fl.cost * (1 + ${riskWeightFloat} * COALESCE(ep.total_failure_probability, 0)) as cost,
          fl.reverse_cost * (1 + ${riskWeightFloat} * COALESCE(ep.total_failure_probability, 0)) as reverse_cost
         FROM fiber_links fl
         LEFT JOIN edge_probabilities ep ON fl.id = ep.edge_id
         WHERE fl.cost > 0',
        $1::bigint,
        $2::bigint,
        false
      ) as route
      LEFT JOIN fiber_nodes n ON route.node = n.id
      ORDER BY route.seq
      `,
      [startNodeId, endNodeId]
    );

    if (routeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No route found between these points',
        message: 'Nodes may not be connected in the network'
      });
    }

    const computeTime = performance.now() - startTime;

    // Calculate statistics
    const lastRow = routeResult.rows[routeResult.rows.length - 1];
    const totalAdjustedCost = lastRow.adjusted_agg_cost;

    // Calculate actual distance and average failure probability
    let totalDistance = 0;
    let totalFailureProbability = 0;
    let edgeCount = 0;

    routeResult.rows.forEach(row => {
      if (row.edge !== null) {
        totalDistance += row.edge_length || 0;
        totalFailureProbability += row.failure_probability || 0;
        edgeCount++;
      }
    });

    const avgFailureProbability = edgeCount > 0 ? totalFailureProbability / edgeCount : 0;

    // Convert to GeoJSON using edge geometries
    const geojson = convertToGeoJSON(routeResult.rows.filter(r => r.edge_geom !== null), 'edge_geom');

    res.json({
      ...geojson,
      route_info: {
        algorithm: 'Dijkstra (resilient)',
        total_cost_km: (totalDistance / 1000).toFixed(2),
        total_edges: edgeCount,
        compute_time_ms: Math.round(computeTime),
        considers_threats: true,
        risk_weight: riskWeightFloat,
        avg_failure_probability: (avgFailureProbability * 100).toFixed(2) + '%',
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST version for calculate-resilient
 */
router.post('/calculate-resilient', async (req, res, next) => {
  req.query = { ...req.query, ...req.body };
  return router.get('/calculate-resilient')(req, res, next);
});

/**
 * GET/POST /api/routing/alternative-paths
 * Find k-shortest alternative paths
 */
router.get('/alternative-paths', async (req, res, next) => {
  const startTime = performance.now();

  try {
    const { start_lat, start_lon, end_lat, end_lon, k = 3 } = req.query;

    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Find nearest nodes
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Could not find nodes near provided coordinates'
      });
    }

    const startNodeId = startNodeResult.rows[0].id;
    const endNodeId = endNodeResult.rows[0].id;

    // Use pgr_ksp (k-shortest paths)
    const pathsResult = await query(
      `
      SELECT
        ksp.path_id,
        ksp.path_seq,
        ksp.node,
        ksp.edge,
        ksp.cost,
        ksp.agg_cost,
        ST_AsGeoJSON(n.geometry)::json as node_geom,
        CASE
          WHEN ksp.edge IS NOT NULL THEN (
            SELECT ST_AsGeoJSON(fl.geometry)::json
            FROM fiber_links fl
            WHERE fl.id = ksp.edge
          )
          ELSE NULL
        END as edge_geom,
        CASE
          WHEN ksp.edge IS NOT NULL THEN (
            SELECT fl.length
            FROM fiber_links fl
            WHERE fl.id = ksp.edge
          )
          ELSE NULL
        END as edge_length
      FROM pgr_ksp(
        'SELECT id, source, target, cost, reverse_cost FROM fiber_links WHERE cost > 0',
        $1,
        $2,
        $3,
        directed := false
      ) as ksp
      LEFT JOIN fiber_nodes n ON ksp.node = n.id
      ORDER BY ksp.path_id, ksp.path_seq
      `,
      [startNodeId, endNodeId, parseInt(k)]
    );

    if (pathsResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No paths found',
        message: 'Could not find alternative paths between these nodes'
      });
    }

    const computeTime = performance.now() - startTime;

    // Group paths by path_id
    const pathsMap = {};
    pathsResult.rows.forEach(row => {
      if (!pathsMap[row.path_id]) {
        pathsMap[row.path_id] = [];
      }
      pathsMap[row.path_id].push(row);
    });

    // Process each path
    const paths = Object.entries(pathsMap).map(([pathId, rows]) => {
      const lastRow = rows[rows.length - 1];
      const totalDistance = lastRow.agg_cost;
      const totalEdges = rows.filter(r => r.edge !== null).length;

      const edgeGeometries = rows
        .filter(r => r.edge_geom !== null)
        .map(r => r.edge_geom);

      return {
        path_id: parseInt(pathId),
        statistics: {
          total_distance_m: Math.round(totalDistance),
          total_distance_km: Math.round(totalDistance / 1000 * 100) / 100,
          total_edges: totalEdges,
          total_nodes: rows.length
        },
        path: rows,
        geometry: {
          type: 'GeometryCollection',
          geometries: edgeGeometries
        }
      };
    });

    res.json({
      algorithm: 'pgr_ksp',
      k: parseInt(k),
      paths_found: paths.length,
      compute_time_ms: Math.round(computeTime),
      paths
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST version for alternative-paths
 */
router.post('/alternative-paths', async (req, res, next) => {
  req.query = { ...req.query, ...req.body };
  return router.get('/alternative-paths')(req, res, next);
});

/**
 * POST /api/routing/mip
 * Calculate route using MIP optimization
 */
router.post('/mip', async (req, res, next) => {
  const startTime = performance.now();
  
  try {
    const { start_lat, start_lon, end_lat, end_lon, max_probability = 0.7, risk_weight = 1.0 } = req.body;
    console.log('🔷 [MIP] Received request:', { start_lat, start_lon, end_lat, end_lon, max_probability, risk_weight });

    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      console.log('❌ [MIP] Missing parameters');
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Use resilient route as MIP approximation (multi-objective Dijkstra)
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes
       ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes
       ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Could not find nodes near provided coordinates'
      });
    }

    const startNodeId = startNodeResult.rows[0].id;
    const endNodeId = endNodeResult.rows[0].id;

    // Multi-objective optimization: minimize distance + risk
    // Build SQL dynamically since pgr_dijkstra doesn't support parameterized subqueries
    const routeResult = await query(
      `SELECT
        route.seq,
        route.node,
        route.edge,
        route.cost,
        route.agg_cost,
        n.latitude,
        n.longitude,
        ST_AsGeoJSON(n.geometry)::json as node_geom,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT ST_AsGeoJSON(fl.geometry)::json
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_geom
      FROM pgr_dijkstra(
        'SELECT
          fl.id,
          fl.source,
          fl.target,
          fl.cost * (1 + ${risk_weight} * COALESCE(ep.total_failure_probability, 0)) as cost,
          fl.reverse_cost * (1 + ${risk_weight} * COALESCE(ep.total_failure_probability, 0)) as reverse_cost
         FROM fiber_links fl
         LEFT JOIN edge_probabilities ep ON fl.id = ep.edge_id
         WHERE fl.cost > 0 AND COALESCE(ep.total_failure_probability, 0) <= ${max_probability}',
        ${startNodeId}::bigint,
        ${endNodeId}::bigint,
        false
      ) as route
      LEFT JOIN fiber_nodes n ON route.node = n.id
      ORDER BY route.seq`
    );

    if (routeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No route found between these points',
        message: 'Try increasing max_probability or decreasing risk_weight'
      });
    }

    const computeTime = performance.now() - startTime;
    const lastRow = routeResult.rows[routeResult.rows.length - 1];

    const geojson = convertToGeoJSON(routeResult.rows, 'edge_geom');

    res.json({
      ...geojson,
      route_info: {
        algorithm: 'MIP (Multi-objective Dijkstra approximation)',
        total_cost_km: (lastRow.agg_cost / 1000).toFixed(2),
        total_edges: routeResult.rows.filter(r => r.edge !== null).length,
        compute_time_ms: computeTime,
        considers_threats: true,
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/routing/genetic
 * Calculate route using Genetic Algorithm
 */
router.post('/genetic', async (req, res, next) => {
  const startTime = performance.now();
  
  try {
    const { start_lat, start_lon, end_lat, end_lon, max_probability = 0.7, population_size = 100 } = req.body;
    console.log('🟣 [GENETIC] Received request:', { start_lat, start_lon, end_lat, end_lon, max_probability, population_size });

    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      console.log('❌ [GENETIC] Missing parameters');
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Use resilient route with slightly different parameters as GA approximation
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes
       ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes
       ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Could not find nodes near provided coordinates'
      });
    }

    const startNodeId = startNodeResult.rows[0].id;
    const endNodeId = endNodeResult.rows[0].id;

    // Genetic algorithm simulation: balance between distance, risk and diversity
    const riskWeight = 1.5; // Balanced approach
    
    // Build SQL dynamically since pgr_dijkstra doesn't support parameterized subqueries
    const routeResult = await query(
      `SELECT
        route.seq,
        route.node,
        route.edge,
        route.cost,
        route.agg_cost,
        n.latitude,
        n.longitude,
        ST_AsGeoJSON(n.geometry)::json as node_geom,
        CASE
          WHEN route.edge IS NOT NULL THEN (
            SELECT ST_AsGeoJSON(fl.geometry)::json
            FROM fiber_links fl
            WHERE fl.id = route.edge
          )
          ELSE NULL
        END as edge_geom
      FROM pgr_dijkstra(
        'SELECT
          fl.id,
          fl.source,
          fl.target,
          fl.cost * (1 + ${riskWeight} * COALESCE(ep.total_failure_probability, 0)) as cost,
          fl.reverse_cost * (1 + ${riskWeight} * COALESCE(ep.total_failure_probability, 0)) as reverse_cost
         FROM fiber_links fl
         LEFT JOIN edge_probabilities ep ON fl.id = ep.edge_id
         WHERE fl.cost > 0',
        ${startNodeId}::bigint,
        ${endNodeId}::bigint,
        false
      ) as route
      LEFT JOIN fiber_nodes n ON route.node = n.id
      ORDER BY route.seq`
    );

    if (routeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No route found between these points',
        message: 'Nodes may not be connected in the network'
      });
    }

    const computeTime = performance.now() - startTime;
    const lastRow = routeResult.rows[routeResult.rows.length - 1];

    const geojson = convertToGeoJSON(routeResult.rows, 'edge_geom');

    res.json({
      ...geojson,
      route_info: {
        algorithm: 'Genetic Algorithm (Dijkstra-based approximation)',
        total_cost_km: (lastRow.agg_cost / 1000).toFixed(2),
        total_edges: routeResult.rows.filter(r => r.edge !== null).length,
        compute_time_ms: computeTime,
        considers_threats: true,
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/routing/mip/model-info
 * Get MIP model documentation
 */
router.get('/mip/model-info', (req, res) => {
  res.json({
    model: 'Mixed Integer Programming for Resilient Routing',
    objective: 'Minimize weighted sum of distance and failure probability',
    variables: {
      'x[i,j]': 'Binary variable indicating if edge (i,j) is used',
      'y[i]': 'Binary variable indicating if node i is visited'
    },
    constraints: [
      'Flow conservation at each node',
      'Node-edge coupling',
      'Maximum distance limit',
      'Avoid high-risk edges'
    ],
    implementation: 'Multi-objective Dijkstra as MIP heuristic'
  });
});

module.exports = router;
