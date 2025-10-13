import axios from 'axios';

// Base URL for API - can be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  
  // Edges
  getEdges: (params = {}) => api.get('/infrastructure/edges', { params }),
  getEdgeById: (id) => api.get(`/infrastructure/edges/${id}`),
  
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
  
  // Calculate routes
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
  
  // Helper endpoints
  getExampleRoute: () => api.get('/routing/example'),
  getNearestNode: (lat, lon) => api.get(`/routing/nearest-node/${lat}/${lon}`),
  getTopologyStatus: () => api.get('/routing/topology-status'),
};

// Health check
export const healthAPI = {
  check: () => axios.get(`${API_BASE_URL.replace('/api', '')}/health`),
};

export default api;
