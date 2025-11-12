import axios from 'axios';

// Base URL for API - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Infrastructure API
export const infrastructureAPI = {
  // Get all available endpoints
  getInfo: () => api.get('/infrastructure'),
  
  // Links (fiber optic cables) - CORRECTED: uses /links not /edges
  getLinks: (params = {}) => api.get('/infrastructure/links', { params }),
  getLinkById: (id) => api.get(`/infrastructure/links/${id}`),
  
  // Legacy alias for backwards compatibility
  getEdges: (params = {}) => api.get('/infrastructure/links', { params }),
  getEdgeById: (id) => api.get(`/infrastructure/links/${id}`),
  
  // Nodes
  getNodes: (params = {}) => api.get('/infrastructure/nodes', { params }),
  getNodeById: (id) => api.get(`/infrastructure/nodes/${id}`),
  
  // Statistics
  getStats: () => api.get('/infrastructure/stats'),
  getRegions: () => api.get('/infrastructure/regions'),
};

// Metadata API
export const metadataAPI = {
  // Get all available endpoints
  getInfo: () => api.get('/metadata'),
  
  // Datacenters
  getDatacenters: (params = {}) => api.get('/metadata/datacenters', { params }),
  getDatacenterById: (id) => api.get(`/metadata/datacenters/${id}`),
  getNearbyDatacenters: (lat, lon, radiusKm = 50) =>
    api.get(`/metadata/datacenters/nearby/${lat}/${lon}`, { params: { radius_km: radiusKm } }),
  
  // Ground type
  getGroundType: (params = {}) => api.get('/metadata/ground-type', { params }),
  
  // Cities
  getCities: () => api.get('/metadata/cities'),
};

// Threats API
export const threatsAPI = {
  // Get all available endpoints
  getInfo: () => api.get('/threats'),
  
  // Earthquakes
  getEarthquakes: (params = {}) => api.get('/threats/earthquakes', { params }),
  getNearbyEarthquakes: (lat, lon, radiusKm = 100, minMagnitude = 4.0) =>
    api.get(`/threats/earthquakes/nearby/${lat}/${lon}`, {
      params: { radius_km: radiusKm, min_magnitude: minMagnitude }
    }),
  
  // Fire zones
  getFireZones: (params = {}) => api.get('/threats/fire-zones', { params }),
  
  // Weather events
  getWeatherEvents: (params = {}) => api.get('/threats/weather-events', { params }),
  
  // Nearby threats
  getNearbyThreats: (lat, lon, radiusKm = 50) =>
    api.get(`/threats/nearby/${lat}/${lon}`, { params: { radius_km: radiusKm } }),
  
  // Statistics
  getStatistics: () => api.get('/threats/statistics'),
};

// Routing API
export const routingAPI = {
  // Get all available endpoints
  getInfo: () => api.get('/routing'),

  // Calculate routes - Dijkstra with distance only
  calculateRoute: (startLat, startLon, endLat, endLon) =>
    api.get('/routing/calculate', {
      params: {
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
      },
    }),
  calculateRoutePost: (startLat, startLon, endLat, endLon) =>
    api.post('/routing/calculate', {
      start_lat: startLat,
      start_lon: startLon,
      end_lat: endLat,
      end_lon: endLon,
    }),

  // Calculate resilient route - Dijkstra with variables (risk-aware)
  calculateResilientRoute: (startLat, startLon, endLat, endLon, options = {}) =>
    api.get('/routing/calculate-resilient', {
      params: {
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
        max_failure_prob: options.maxFailureProb || 0.3,
        risk_weight: options.riskWeight || 2.0,
        simulation_id: options.simulationId || null,
      },
    }),
  calculateResilientRoutePost: (startLat, startLon, endLat, endLon, options = {}) =>
    api.post('/routing/calculate-resilient', {
      start_lat: startLat,
      start_lon: startLon,
      end_lat: endLat,
      end_lon: endLon,
      max_failure_prob: options.maxFailureProb || 0.3,
      risk_weight: options.riskWeight || 2.0,
      simulation_id: options.simulationId || null,
    }),

  // Helper endpoints - Santiago to Valparaíso (shorter route, more likely to be connected)
  getExampleRoute: () => api.get('/routing/calculate', {
    params: {
      start_lat: -33.4489,  // Santiago
      start_lon: -70.6693,
      end_lat: -33.0472,    // Valparaíso (ajustado)
      end_lon: -71.6127
    }
  }),
  getNearestNode: (lat, lon) => api.get('/routing/node-search', {
    params: { lat, lon }
  }),
  getTopologyStatus: () => api.get('/routing'),
};

// Optimization API (MIP and Genetic Algorithm)
export const optimizationAPI = {
  // Get all available endpoints
  getInfo: () => api.get('/routing'),

  // MIP (Mixed Integer Programming) optimization
  calculateMIPRoute: (startLat, startLon, endLat, endLon, options = {}) =>
    api.post('/routing/mip', {
      start_lat: startLat,
      start_lon: startLon,
      end_lat: endLat,
      end_lon: endLon,
      max_probability: options.maxProbability || 0.7,
      risk_weight: options.riskWeight || 1.0,
      time_limit: options.timeLimit || 60,
    }),

  // MIP model information
  getMIPModelInfo: () => api.get('/routing/mip/model-info'),

  // Genetic Algorithm optimization
  calculateGeneticRoute: (startLat, startLon, endLat, endLon, options = {}) =>
    api.post('/routing/genetic', {
      start_lat: startLat,
      start_lon: startLon,
      end_lat: endLat,
      end_lon: endLon,
      max_probability: options.maxProbability || 0.7,
      population_size: options.populationSize || 100,
      generations: options.generations || 50,
    }),

  // Compare all algorithms
  compareAlgorithms: (startLat, startLon, endLat, endLon, options = {}) =>
    api.get('/routing/compare', {
      params: {
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
        ...options,
      },
    }),
};

// Probabilities API
export const probabilitiesAPI = {
  // Get all available endpoints
  getInfo: () => api.get('/probabilities'),

  // Get edge probabilities
  getEdgeProbabilities: (params = {}) => api.get('/probabilities/edges', { params }),
  getEdgeProbabilityById: (id) => api.get(`/probabilities/edges/${id}`),

  // Statistics
  getStatistics: () => api.get('/probabilities/statistics'),

  // Calculate probabilities
  calculateProbabilities: (options = {}) =>
    api.post('/probabilities/calculate', {
      threat_radius_km: options.threatRadiusKm || 200,
      limit: options.limit || null,
    }),
};

// Simulation API
export const simulationAPI = {
  // Trigger Monte Carlo simulation
  triggerSimulation: (options = {}) =>
    api.post('/simulation/trigger-failures', {
      probabilityThreshold: options.probabilityThreshold || 0.5,
      includeGeometry: options.includeGeometry !== false,
    }),

  // Get current failures
  getCurrentFailures: () => api.get('/simulation/current-failures'),

  // Clear all failures
  clearSimulation: () => api.post('/simulation/clear-failures'),

  // Get network operational status
  getNetworkStatus: () => api.get('/simulation/network-status'),
  
  // Legacy endpoints (backward compatibility)
  getSimulations: () => api.get('/simulation'),
  getSimulationById: (id) => api.get(`/simulation/${id}`),
  runSimulation: (options = {}) =>
    api.post('/simulation/run', {
      name: options.name || `Simulación ${new Date().toISOString()}`,
      probabilityThreshold: options.probabilityThreshold || 0.3,
    }),
  getSimulationFailures: (id, elementType = 'edge') =>
    api.get(`/simulation/${id}/failures`, { params: { element_type: elementType } }),
  getSimulationStatistics: (id) => api.get(`/simulation/${id}/statistics`),
  deleteSimulation: (id) => api.delete(`/simulation/${id}`),
};

// Health check
export const healthAPI = {
  check: () => axios.get(`${API_BASE_URL.replace('/api', '')}/health`),
};

export default api;
