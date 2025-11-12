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
  const startTime = performance.now();
  
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
    const computeTime = performance.now() - startTime;

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
        algorithm: 'pgr_dijkstra',
        algorithm_name: 'Dijkstra (Distancia)',
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) },
        total_cost_meters: totalCost,
        total_cost_km: (totalCost / 1000).toFixed(2),
        total_edges: totalEdges,
        considers_threats: false,
        compute_time_ms: computeTime.toFixed(2),
        compute_time_seconds: (computeTime / 1000).toFixed(4)
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

/**
 * GET /api/routing/calculate-resilient
 * Calculate resilient path using pgr_dijkstra with failure probabilities
 * Query params: start_lat, start_lon, end_lat, end_lon, max_failure_prob, risk_weight, simulation_id
 */
router.get('/calculate-resilient', async (req, res, next) => {
  const startTime = performance.now();
  
  try {
    const { 
      start_lat, start_lon, end_lat, end_lon,
      max_failure_prob = 0.3,
      risk_weight = 2.0,
      simulation_id = null
    } = req.query;

    // Validate required parameters
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Use the calculate_resilient_path function
    const result = await query(
      `SELECT * FROM calculate_resilient_path($1, $2, $3, $4, $5, $6, $7)`,
      [
        parseFloat(start_lat),
        parseFloat(start_lon),
        parseFloat(end_lat),
        parseFloat(end_lon),
        parseFloat(max_failure_prob),
        parseFloat(risk_weight),
        simulation_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No resilient route found',
        message: 'Try increasing max_failure_prob or decreasing risk_weight'
      });
    }

    const computeTime = performance.now() - startTime;
    
    const totalCost = result.rows[result.rows.length - 1].agg_cost;
    const totalEdges = result.rows.filter(r => r.edge !== null).length;
    const avgFailureProb = result.rows
      .filter(r => r.failure_prob !== null)
      .reduce((sum, r) => sum + r.failure_prob, 0) / totalEdges;
    const maxFailureProb = Math.max(...result.rows.map(r => r.failure_prob || 0));

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
          agg_cost: row.agg_cost,
          failure_prob: row.failure_prob
        }
      }));

    res.json({
      type: 'FeatureCollection',
      features,
      route_info: {
        algorithm: 'pgr_dijkstra_resilient',
        algorithm_name: 'Dijkstra (Resiliente)',
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) },
        total_cost_meters: totalCost,
        total_cost_km: (totalCost / 1000).toFixed(2),
        total_edges: totalEdges,
        considers_threats: true,
        risk_weight: parseFloat(risk_weight),
        max_failure_prob_allowed: parseFloat(max_failure_prob),
        avg_failure_prob: avgFailureProb.toFixed(4),
        max_failure_prob: maxFailureProb.toFixed(4),
        total_failure_risk: (1 - Math.exp(result.rows
          .filter(r => r.failure_prob)
          .reduce((sum, r) => sum + Math.log(1 - r.failure_prob), 0)
        )).toFixed(4),
        simulation_id: simulation_id,
        compute_time_ms: computeTime.toFixed(2),
        compute_time_seconds: (computeTime / 1000).toFixed(4)
      }
    });
  } catch (error) {
    console.error('Resilient routing error:', error);
    next(error);
  }
});

/**
 * POST /api/routing/calculate-resilient
 * Same as GET but with POST body
 */
router.post('/calculate-resilient', async (req, res, next) => {
  const startTime = performance.now();
  
  try {
    const { 
      start_lat, start_lon, end_lat, end_lon,
      max_failure_prob = 0.3,
      risk_weight = 2.0,
      simulation_id = null
    } = req.body;

    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    const result = await query(
      `SELECT * FROM calculate_resilient_path($1, $2, $3, $4, $5, $6, $7)`,
      [
        parseFloat(start_lat),
        parseFloat(start_lon),
        parseFloat(end_lat),
        parseFloat(end_lon),
        parseFloat(max_failure_prob),
        parseFloat(risk_weight),
        simulation_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No resilient route found',
        message: 'Try adjusting parameters'
      });
    }

    const computeTime = performance.now() - startTime;
    
    const totalCost = result.rows[result.rows.length - 1].agg_cost;
    const totalEdges = result.rows.filter(r => r.edge !== null).length;
    const avgFailureProb = result.rows
      .filter(r => r.failure_prob !== null)
      .reduce((sum, r) => sum + r.failure_prob, 0) / totalEdges;

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
          agg_cost: row.agg_cost,
          failure_prob: row.failure_prob
        }
      }));

    res.json({
      type: 'FeatureCollection',
      features,
      route_info: {
        algorithm: 'pgr_dijkstra_resilient',
        algorithm_name: 'Dijkstra (Resiliente)',
        start: { lat: parseFloat(start_lat), lon: parseFloat(start_lon) },
        end: { lat: parseFloat(end_lat), lon: parseFloat(end_lon) },
        total_cost_meters: totalCost,
        total_cost_km: (totalCost / 1000).toFixed(2),
        total_edges: totalEdges,
        considers_threats: true,
        avg_failure_prob: avgFailureProb.toFixed(4),
        compute_time_ms: computeTime.toFixed(2),
        compute_time_seconds: (computeTime / 1000).toFixed(4)
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
  try {
    const { 
      start_lat, 
      start_lon, 
      end_lat, 
      end_lon,
      populationSize = 50,
      generations = 100,
      mutationRate = 0.15
    } = req.body;

    // Validar parámetros requeridos
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Encontrar nodos más cercanos
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes 
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) 
       LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes 
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) 
       LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No nodes found near specified coordinates'
      });
    }

    const sourceId = startNodeResult.rows[0].id;
    const targetId = endNodeResult.rows[0].id;

    // Inicializar y ejecutar algoritmo genético
    const GeneticRoutingAlgorithm = require('../algorithms/genetic_routing');
    const ga = new GeneticRoutingAlgorithm({
      populationSize: parseInt(populationSize),
      generations: parseInt(generations),
      mutationRate: parseFloat(mutationRate),
      weightDistance: 0.4,
      weightRisk: 0.4,
      weightHops: 0.2
    });

    await ga.initialize();

    const route = await ga.findRoute(sourceId, targetId);

    res.json({
      success: true,
      route: route,
      algorithm: 'genetic_algorithm',
      parameters: {
        population_size: populationSize,
        generations: generations,
        mutation_rate: mutationRate
      }
    });

  } catch (error) {
    console.error('Error en ruta genética:', error);
    next(error);
  }
});

/**
 * POST /api/routing/mip
 * Calculate route using Mixed Integer Programming (MIP) optimization
 */
router.post('/mip', async (req, res, next) => {
  try {
    const { 
      start_lat, 
      start_lon, 
      end_lat, 
      end_lon,
      riskWeight = 0.5,
      distanceWeight = 0.5,
      maxDistance = null,
      avoidHighRisk = false,
      highRiskThreshold = 50,
      avoidNodes = [],
      avoidEdges = []
    } = req.body;

    // Validar parámetros requeridos
    if (!start_lat || !start_lon || !end_lat || !end_lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['start_lat', 'start_lon', 'end_lat', 'end_lon']
      });
    }

    // Encontrar nodos más cercanos
    const startNodeResult = await query(
      `SELECT id FROM fiber_nodes 
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) 
       LIMIT 1`,
      [parseFloat(start_lon), parseFloat(start_lat)]
    );

    const endNodeResult = await query(
      `SELECT id FROM fiber_nodes 
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) 
       LIMIT 1`,
      [parseFloat(end_lon), parseFloat(end_lat)]
    );

    if (startNodeResult.rows.length === 0 || endNodeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No nodes found near specified coordinates'
      });
    }

    const sourceId = startNodeResult.rows[0].id;
    const targetId = endNodeResult.rows[0].id;

    // Inicializar y ejecutar optimizador MIP
    const MIPRoutingOptimizer = require('../algorithms/mip_routing');
    const mip = new MIPRoutingOptimizer({
      riskWeight: parseFloat(riskWeight),
      distanceWeight: parseFloat(distanceWeight),
      maxDistance: maxDistance ? parseFloat(maxDistance) : Infinity,
      avoidHighRisk: Boolean(avoidHighRisk),
      highRiskThreshold: parseFloat(highRiskThreshold)
    });

    await mip.initialize();

    const route = await mip.solve(sourceId, targetId, {
      avoidNodes: avoidNodes,
      avoidEdges: avoidEdges
    });

    // Obtener explicación del modelo
    const modelExplanation = mip.getModelExplanation();

    res.json({
      success: true,
      route: route,
      algorithm: 'mip_optimization',
      model: modelExplanation,
      parameters: {
        risk_weight: riskWeight,
        distance_weight: distanceWeight,
        max_distance: maxDistance || 'unlimited',
        avoid_high_risk: avoidHighRisk,
        high_risk_threshold: highRiskThreshold
      }
    });

  } catch (error) {
    console.error('Error en optimización MIP:', error);
    next(error);
  }
});

/**
 * GET /api/routing/mip/model-info
 * Get information about the MIP optimization model
 */
router.get('/mip/model-info', (req, res) => {
  const MIPRoutingOptimizer = require('../algorithms/mip_routing');
  const mip = new MIPRoutingOptimizer();
  const explanation = mip.getModelExplanation();
  
  res.json({
    success: true,
    model: explanation
  });
});

module.exports = router;
