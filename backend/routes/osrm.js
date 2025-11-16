const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const OSRM_URL = process.env.OSRM_URL || 'http://osrm:5000';

/**
 * GET /api/osrm/route
 * Obtiene una ruta realista entre dos puntos usando OSRM
 * 
 * Query params:
 *   start: "lon,lat" (ej: "-73.0444,-36.8201")
 *   end: "lon,lat" (ej: "-72.5904,-38.7359")
 *   geometries: "geojson" | "polyline" (default: "geojson")
 *   overview: "full" | "simplified" | "false" (default: "full")
 */
router.get('/route', async (req, res) => {
  try {
    const { start, end, geometries = 'geojson', overview = 'full' } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'Se requieren parámetros start y end',
        example: '/api/osrm/route?start=-73.0444,-36.8201&end=-72.5904,-38.7359'
      });
    }

    // Construir URL de OSRM
    const osrmUrl = `${OSRM_URL}/route/v1/driving/${start};${end}?overview=${overview}&geometries=${geometries}`;
    
    console.log('Consultando OSRM:', osrmUrl);
    
    const response = await fetch(osrmUrl);
    
    if (!response.ok) {
      throw new Error(`OSRM respondió con status ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok') {
      return res.status(400).json({
        error: 'OSRM no pudo encontrar una ruta',
        details: data.message
      });
    }

    // Extraer información útil
    const route = data.routes[0];
    const result = {
      distance: route.distance, // metros
      duration: route.duration, // segundos
      geometry: route.geometry, // GeoJSON LineString
      legs: route.legs.map(leg => ({
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps?.length || 0
      }))
    };

    res.json(result);

  } catch (error) {
    console.error('Error consultando OSRM:', error);
    res.status(500).json({
      error: 'Error consultando servicio de rutas',
      message: error.message,
      hint: 'Verifica que el contenedor OSRM esté corriendo: docker-compose ps osrm'
    });
  }
});

/**
 * GET /api/osrm/health
 * Verifica el estado del servicio OSRM
 */
router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${OSRM_URL}/`);
    const text = await response.text();
    
    res.json({
      status: 'ok',
      osrm_url: OSRM_URL,
      response: text
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      osrm_url: OSRM_URL,
      message: error.message
    });
  }
});

/**
 * POST /api/osrm/batch-routes
 * Obtiene múltiples rutas en una sola petición
 * 
 * Body:
 * {
 *   "routes": [
 *     { "start": [-73.0444, -36.8201], "end": [-72.5904, -38.7359] },
 *     { "start": [-72.5904, -38.7359], "end": [-73.4118, -37.6272] }
 *   ]
 * }
 */
router.post('/batch-routes', async (req, res) => {
  try {
    const { routes } = req.body;

    if (!routes || !Array.isArray(routes)) {
      return res.status(400).json({
        error: 'Se requiere un array de rutas',
        example: { routes: [{ start: [-73.0444, -36.8201], end: [-72.5904, -38.7359] }] }
      });
    }

    const results = [];
    
    for (const route of routes) {
      const { start, end } = route;
      
      if (!start || !end || start.length !== 2 || end.length !== 2) {
        results.push({
          error: 'Coordenadas inválidas',
          route
        });
        continue;
      }

      try {
        const startStr = `${start[0]},${start[1]}`;
        const endStr = `${end[0]},${end[1]}`;
        const osrmUrl = `${OSRM_URL}/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`;
        
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code === 'Ok') {
          const osrmRoute = data.routes[0];
          results.push({
            success: true,
            start,
            end,
            distance: osrmRoute.distance,
            duration: osrmRoute.duration,
            geometry: osrmRoute.geometry
          });
        } else {
          results.push({
            success: false,
            start,
            end,
            error: data.message || 'No se pudo encontrar ruta'
          });
        }
      } catch (error) {
        results.push({
          success: false,
          start,
          end,
          error: error.message
        });
      }
    }

    res.json({ results });

  } catch (error) {
    console.error('Error en batch-routes:', error);
    res.status(500).json({
      error: 'Error procesando rutas',
      message: error.message
    });
  }
});

module.exports = router;
