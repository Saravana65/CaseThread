/**
 * @file server.js
 * @description Main application server for CASETHREAD REST APIs.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { testConnection } = require('./database/connection');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const suspectRoutes = require('./routes/suspectRoutes');
const victimRoutes = require('./routes/victimRoutes');
const witnessRoutes = require('./routes/witnessRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const timelineRoutes = require('./routes/timelineRoutes');
const leadRoutes = require('./routes/leadRoutes');
const analysisRoutes = require('./routes/analysisRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
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
app.get('/api/v1/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ONLINE',
    service: 'CASETHREAD Intelligence API',
    version: '1.0.0-phase2',
    database_connected: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// API Routes Mount
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
app.use('/api/v1/timeline', timelineRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/analysis', analysisRoutes);

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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(`CASETHREAD Forensic Platform API active on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`=======================================================`);
    await testConnection();
  });
}

module.exports = app;
