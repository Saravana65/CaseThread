/**
 * @file healthRoutes.js
 * @brief High-availability health checks, Kubernetes/Docker liveness & readiness probes,
 * and operational telemetry metrics endpoints.
 * @project CASETHREAD - Phase 19 Production Infrastructure
 */

const express = require('express');
const router = express.Router();
const { testConnection } = require('../database/connection');
const cEngineService = require('../services/cEngineService');
const vaultService = require('../services/vaultService');
const KnowledgeSecurity = require('../knowledge-base/security/knowledgeSecurity');
const { ingestionWorker } = require('../knowledge-base/ingestion/ingestionWorker');
const metricsService = require('../services/metricsService');

/**
 * @route GET /api/v1/health/liveness
 * @brief Lightweight liveness probe for container orchestrators (k8s/docker).
 */
router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'ALIVE',
    service: 'CASETHREAD Intelligence API',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /api/v1/health/readiness
 * @brief Strict readiness probe verifying operational availability of all dependencies.
 */
router.get('/readiness', async (req, res) => {
  const dbStart = Date.now();
  const dbUp = await testConnection();
  const dbLatency = Date.now() - dbStart;

  const cEngineHealth = cEngineService.checkEngineReadiness();
  const vaultHealth = vaultService.checkStorageHealth();
  const kbVaultHealth = KnowledgeSecurity.checkKnowledgeVaultHealth();
  const workerStatus = ingestionWorker.getStatus();

  const isProduction = process.env.NODE_ENV === 'production';
  const isReady = dbUp && cEngineHealth.available && vaultHealth.writable && kbVaultHealth.writable;

  const payload = {
    status: isReady ? 'READY' : 'NOT_READY',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: {
        status: dbUp ? 'UP' : 'DOWN',
        latency_ms: dbLatency
      },
      c_engine: cEngineHealth,
      storage_vault: vaultHealth,
      knowledge_vault: kbVaultHealth,
      ingestion_worker: workerStatus
    },
    timestamp: new Date().toISOString()
  };

  if (!isReady && isProduction) {
    return res.status(503).json(payload);
  }

  return res.status(isReady ? 200 : (process.env.NODE_ENV === 'test' ? 200 : 503)).json(payload);
});

/**
 * @route GET /api/v1/health/metrics
 * @brief Operational metrics and telemetry snapshot (safe from case content leakage).
 */
router.get('/metrics', (req, res) => {
  res.status(200).json(metricsService.getSnapshot());
});

/**
 * @route GET /api/v1/health
 * @brief Composite health check (backward-compatible).
 */
router.get('/', async (req, res) => {
  const dbStart = Date.now();
  const dbStatus = await testConnection();
  const dbLatencyMs = Date.now() - dbStart;

  const cEngineHealth = cEngineService.checkEngineReadiness();
  const storageHealth = vaultService.checkStorageHealth();
  const kbVaultHealth = KnowledgeSecurity.checkKnowledgeVaultHealth();
  const workerStatus = ingestionWorker.getStatus();

  const isProduction = process.env.NODE_ENV === 'production';
  const allServicesHealthy = dbStatus && cEngineHealth.available && storageHealth.writable && kbVaultHealth.writable;

  const healthPayload = {
    status: allServicesHealthy ? 'ONLINE' : 'UNHEALTHY',
    service: 'CASETHREAD Intelligence API',
    version: '1.0.0-phase19',
    checks: {
      database: {
        status: dbStatus ? 'UP' : 'DOWN',
        latency_ms: dbLatencyMs
      },
      c_engine: cEngineHealth,
      storage_vault: storageHealth,
      knowledge_vault: kbVaultHealth,
      ingestion_worker: workerStatus
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

  const isHealthy = dbStatus || process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_STORE === 'true';
  healthPayload.status = isHealthy ? 'ONLINE' : 'UNHEALTHY';
  return res.status(isHealthy ? 200 : 503).json(healthPayload);
});

module.exports = router;
