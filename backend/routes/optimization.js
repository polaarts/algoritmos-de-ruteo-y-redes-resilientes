const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { spawn } = require('child_process');
const path = require('path');

/**
 * GET /api/optimization
 * Lista de endpoints disponibles
 */
router.get('/', (req, res) => {
    res.json({
        message: 'API de Optimización - Algoritmos avanzados de ruteo',
        endpoints: {
            'GET /api/optimization': 'Lista de endpoints',
            'POST /api/optimization/mip': 'Optimización MIP (Python-MIP)',
            'POST /api/optimization/genetic': 'Algoritmo Genético (DEAP)',
            'GET /api/optimization/compare': 'Comparar todos los algoritmos'
        }
    });
});

/**
 * POST /api/optimization/mip
 * Calcula ruta óptima usando Mixed Integer Programming
 * 
 * Body:
 * {
 *   "start_lat": -33.4489,
 *   "start_lon": -70.6693,
 *   "end_lat": -36.8270,
 *   "end_lon": -73.0498,
 *   "max_probability": 0.7,
 *   "risk_weight": 1.0,
 *   "time_limit": 60
 * }
 */
router.post('/mip', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const {
            start_lat,
            start_lon,
            end_lat,
            end_lon,
            max_probability = 0.7,
            risk_weight = 1.0,
            time_limit = 60
        } = req.body;

        // Validación
        if (!start_lat || !start_lon || !end_lat || !end_lon) {
            return res.status(400).json({
                error: 'Faltan parámetros requeridos: start_lat, start_lon, end_lat, end_lon'
            });
        }

        console.log(`🔧 MIP Optimization: (${start_lat},${start_lon}) → (${end_lat},${end_lon})`);

        // Ejecutar script Python
        const scriptPath = path.join(__dirname, '../../scripts/mip_optimizer.py');
        const pythonPath = path.join(__dirname, '../../.venv/bin/python');
        
        const pythonProcess = spawn(pythonPath, [
            scriptPath,
            start_lat.toString(),
            start_lon.toString(),
            end_lat.toString(),
            end_lon.toString(),
            max_probability.toString(),
            risk_weight.toString()
        ]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            const computationTime = Date.now() - startTime;

            if (code !== 0) {
                console.error('Error en MIP:', stderr);
                return res.status(500).json({
                    error: 'Error en optimización MIP',
                    details: stderr,
                    computation_time_ms: computationTime
                });
            }

            try {
                // Extraer JSON de la salida
                const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No se encontró JSON en la salida');
                }

                const result = JSON.parse(jsonMatch[0]);

                // Si hay edges, obtener geometría
                let route = null;
                if (result.edges && result.edges.length > 0) {
                    const edgeIds = result.edges.join(',');
                    const routeQuery = await db.query(`
                        SELECT json_build_object(
                            'type', 'FeatureCollection',
                            'features', json_agg(
                                json_build_object(
                                    'type', 'Feature',
                                    'geometry', ST_AsGeoJSON(geometry)::json,
                                    'properties', json_build_object(
                                        'edge_id', id,
                                        'length', length,
                                        'highway', highway
                                    )
                                )
                            )
                        ) as geojson
                        FROM edges
                        WHERE id = ANY($1::bigint[])
                    `, [result.edges]);

                    route = routeQuery.rows[0].geojson;
                }

                res.json({
                    algorithm: 'MIP',
                    status: result.status,
                    route: route,
                    route_info: {
                        start: { lat: start_lat, lon: start_lon },
                        end: { lat: end_lat, lon: end_lon },
                        total_distance_km: (result.total_distance / 1000).toFixed(2),
                        total_edges: result.total_edges,
                        avg_probability: result.avg_probability?.toFixed(4),
                        max_probability: result.max_probability?.toFixed(4),
                        objective_value: result.objective_value?.toFixed(2),
                        computation_time_ms: computationTime,
                        solver_time_s: result.computation_time?.toFixed(2)
                    },
                    parameters: {
                        max_probability,
                        risk_weight,
                        time_limit
                    }
                });

            } catch (parseError) {
                console.error('Error parseando resultado:', parseError);
                console.log('Salida completa:', stdout);
                res.status(500).json({
                    error: 'Error procesando resultado de MIP',
                    details: parseError.message,
                    raw_output: stdout
                });
            }
        });

    } catch (error) {
        console.error('Error en /api/optimization/mip:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * POST /api/optimization/genetic
 * Calcula ruta usando Algoritmo Genético
 * 
 * Body:
 * {
 *   "start_lat": -33.4489,
 *   "start_lon": -70.6693,
 *   "end_lat": -36.8270,
 *   "end_lon": -73.0498,
 *   "max_probability": 0.7,
 *   "risk_weight": 1.0,
 *   "population_size": 50,
 *   "generations": 100
 * }
 */
router.post('/genetic', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const {
            start_lat,
            start_lon,
            end_lat,
            end_lon,
            max_probability = 0.7,
            risk_weight = 1.0,
            population_size = 50,
            generations = 100
        } = req.body;

        if (!start_lat || !start_lon || !end_lat || !end_lon) {
            return res.status(400).json({
                error: 'Faltan parámetros requeridos'
            });
        }

        console.log(`🧬 Genetic Algorithm: (${start_lat},${start_lon}) → (${end_lat},${end_lon})`);

        const scriptPath = path.join(__dirname, '../../scripts/genetic_algorithm.py');
        const pythonPath = path.join(__dirname, '../../.venv/bin/python');
        
        const pythonProcess = spawn(pythonPath, [
            scriptPath,
            start_lat.toString(),
            start_lon.toString(),
            end_lat.toString(),
            end_lon.toString(),
            max_probability.toString(),
            risk_weight.toString(),
            population_size.toString(),
            generations.toString()
        ]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            const computationTime = Date.now() - startTime;

            if (code !== 0) {
                console.error('Error en GA:', stderr);
                return res.status(500).json({
                    error: 'Error en algoritmo genético',
                    details: stderr,
                    computation_time_ms: computationTime
                });
            }

            try {
                const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No se encontró JSON en la salida');
                }

                const result = JSON.parse(jsonMatch[0]);

                let route = null;
                if (result.edges && result.edges.length > 0) {
                    const routeQuery = await db.query(`
                        SELECT json_build_object(
                            'type', 'FeatureCollection',
                            'features', json_agg(
                                json_build_object(
                                    'type', 'Feature',
                                    'geometry', ST_AsGeoJSON(geometry)::json,
                                    'properties', json_build_object(
                                        'edge_id', id,
                                        'length', length,
                                        'highway', highway
                                    )
                                )
                            )
                        ) as geojson
                        FROM edges
                        WHERE id = ANY($1::bigint[])
                    `, [result.edges]);

                    route = routeQuery.rows[0].geojson;
                }

                res.json({
                    algorithm: 'Genetic Algorithm',
                    status: result.status,
                    route: route,
                    route_info: {
                        start: { lat: start_lat, lon: start_lon },
                        end: { lat: end_lat, lon: end_lon },
                        total_distance_km: (result.total_distance / 1000).toFixed(2),
                        total_edges: result.total_edges,
                        avg_probability: result.avg_probability?.toFixed(4),
                        max_probability: result.max_probability?.toFixed(4),
                        fitness_value: result.fitness_value?.toFixed(2),
                        computation_time_ms: computationTime,
                        algorithm_time_s: result.computation_time?.toFixed(2)
                    },
                    parameters: {
                        max_probability,
                        risk_weight,
                        population_size,
                        generations
                    }
                });

            } catch (parseError) {
                console.error('Error parseando resultado:', parseError);
                res.status(500).json({
                    error: 'Error procesando resultado de GA',
                    details: parseError.message,
                    raw_output: stdout
                });
            }
        });

    } catch (error) {
        console.error('Error en /api/optimization/genetic:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/optimization/compare
 * Compara todos los algoritmos de ruteo
 */
router.get('/compare', async (req, res) => {
    const {
        start_lat,
        start_lon,
        end_lat,
        end_lon
    } = req.query;

    if (!start_lat || !start_lon || !end_lat || !end_lon) {
        return res.status(400).json({
            error: 'Faltan parámetros requeridos en query string'
        });
    }

    res.json({
        message: 'Endpoint de comparación - En desarrollo',
        algorithms: ['Dijkstra', 'Dijkstra Resiliente', 'MIP', 'Genetic Algorithm'],
        status: 'pending_implementation'
    });
});

module.exports = router;
