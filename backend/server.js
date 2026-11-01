/**
 * @file server.js
 * @description Main application server for CASETHREAD REST APIs.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { testConnection, closePool } = require('./database/connection');
const { validateConfig } = require('./config/validateConfig');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter, authLimiter, analysisLimiter } = require('./middleware/rateLimiter');
const cEngineService = require('./services/cEngineService');
const vaultService = require('./services/vaultService');

const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const suspectRoutes = require('./routes/suspectRoutes');
const victimRoutes = require('./routes/victimRoutes');
const witnessRoutes = require('./routes/witnessRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const timelineRoutes = require('./routes/timelineRoutes');
const leadRoutes = require('./routes/leadRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const graphRoutes = require('./routes/graphRoutes');
const custodyRoutes = require('./routes/custodyRoutes');
const reportRoutes = require('./routes/reportRoutes');
const vaultRoutes = require('./routes/vaultRoutes');
const geospatialRoutes = require('./routes/geospatialRoutes');
const collaborationRoutes = require('./routes/collaborationRoutes');
const validationRoutes = require('./routes/validationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(helmet());

// Restrict CORS to configured origins
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser agents, CLI tools, tests, or direct curl without Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*'))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Origin '${origin}' is not permitted.`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Forensic Request Audit Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsed}ms)`);
    }
  });
  next();
});

// Health & System Info Route
// Composite health assessment: Database, Native C Algorithm Engine, and Digital Vault Storage
app.get('/api/v1/health', async (req, res) => {
  const dbStart = Date.now();
  const dbStatus = await testConnection();
  const dbLatencyMs = Date.now() - dbStart;

  const cEngineHealth = cEngineService.checkEngineReadiness();
  const storageHealth = vaultService.checkStorageHealth();

  const isProduction = process.env.NODE_ENV === 'production';
  const allServicesHealthy = dbStatus && cEngineHealth.available && storageHealth.writable;

  const healthPayload = {
    status: allServicesHealthy ? 'ONLINE' : 'UNHEALTHY',
    service: 'CASETHREAD Intelligence API',
    version: '1.0.0-phase11',
    checks: {
      database: {
        status: dbStatus ? 'UP' : 'DOWN',
        latency_ms: dbLatencyMs
      },
      c_engine: cEngineHealth,
      storage_vault: storageHealth
    },
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };

  if (isProduction) {
    if (!allServicesHealthy) {
      healthPayload.error = 'One or more mission-critical forensic services are unavailable.';
      return res.status(503).json(healthPayload);
    }
    return res.status(200).json(healthPayload);
  }

  // Non-production (development or test)
  const isHealthy = dbStatus || process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_STORE === 'true';
  healthPayload.status = isHealthy ? 'ONLINE' : 'UNHEALTHY';
  return res.status(isHealthy ? 200 : 503).json(healthPayload);
});

// Global Rate Limiting across all API routes
app.use('/api/v1', globalLimiter);

// API Routes Mount
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', caseRoutes);

// Nested & direct entity routes
app.use('/api/v1/cases/:caseId/suspects', suspectRoutes);
app.use('/api/v1/cases/:caseId/victims', victimRoutes);
app.use('/api/v1/cases/:caseId/witnesses', witnessRoutes);
app.use('/api/v1/suspects', suspectRoutes);
app.use('/api/v1/victims', victimRoutes);
app.use('/api/v1/witnesses', witnessRoutes);

app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1', geospatialRoutes);
app.use('/api/v1/custody', custodyRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/timeline', timelineRoutes);
app.use('/api/v1/leads', leadRoutes);

// Intensive C-Engine DSA analysis rate-limited endpoints
app.use('/api/v1/analysis', analysisLimiter, analysisRoutes);
app.use('/api/v1/validation', analysisLimiter, validationRoutes);
app.use('/api/v1', graphRoutes);
app.use('/api/v1', collaborationRoutes);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
});

// Centralized Forensic Error Handling
app.use(errorHandler);

// Server Startup
let serverInstance = null;

if (process.env.NODE_ENV !== 'test') {
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    console.error('[SECURITY CRITICAL] Server startup aborted due to configuration errors:');
    configValidation.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  serverInstance = app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(`CASETHREAD Forensic Platform API active on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`=======================================================`);
    const dbConnected = await testConnection();
    if (process.env.NODE_ENV === 'production' && !dbConnected) {
      console.error('[DATABASE CRITICAL] Production server startup failed: MySQL database is unreachable.');
      process.exit(1);
    }
  });

  // Graceful Shutdown Handler
  function gracefulShutdown(signal) {
    console.log(`\n[SHUTDOWN] Received ${signal}. Initiating graceful termination...`);
    if (serverInstance) {
      serverInstance.close(async () => {
        console.log('[SHUTDOWN] HTTP listener closed. Closing MySQL connection pool...');
        await closePool();
        console.log('[SHUTDOWN] All connections closed. Clean exit.');
        process.exit(0);
      });

      // Force exit if connections do not close within 10s
      setTimeout(() => {
        console.error('[SHUTDOWN] Forceful shutdown initiated after 10s timeout.');
        process.exit(1);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Process Exception:', err);
  });
}

module.exports = app;
