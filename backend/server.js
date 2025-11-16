const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const infrastructureRoutes = require('./routes/infrastructure');
const metadataRoutes = require('./routes/metadata');
const threatsRoutes = require('./routes/threats');
const routingRoutes = require('./routes/routing');
const probabilitiesRoutes = require('./routes/probabilities');
const simulationRoutes = require('./routes/simulation');
const optimizationRoutes = require('./routes/optimization');
const osrmRoutes = require('./routes/osrm');

const app = express();
const PORT = 5001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Fiber Network Backend API'
  });
});

// API Routes
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/threats', threatsRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/probabilities', probabilitiesRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/optimization', optimizationRoutes);
app.use('/api/osrm', osrmRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Fiber Optic Network Resilience API',
    version: '1.0.0',
    endpoints: {
      infrastructure: '/api/infrastructure',
      metadata: '/api/metadata',
      threats: '/api/threats',
      routing: '/api/routing',
      probabilities: '/api/probabilities',
      simulation: '/api/simulation',
      optimization: '/api/optimization'
    },
    documentation: 'https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST || 'Not configured'}`);
  console.log(`\n📍 Available endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - Infrastructure: http://localhost:${PORT}/api/infrastructure`);
  console.log(`   - Metadata: http://localhost:${PORT}/api/metadata`);
  console.log(`   - Threats: http://localhost:${PORT}/api/threats`);
  console.log(`   - Routing: http://localhost:${PORT}/api/routing`);
  console.log(`   - Simulation: http://localhost:${PORT}/api/simulation`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;
