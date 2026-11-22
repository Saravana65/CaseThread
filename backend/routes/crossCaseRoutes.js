/**
 * @file crossCaseRoutes.js
 * @brief REST API routes for Global Cross-Case Intelligence, Native C Graph Analysis,
 * and Explainable Crime Pattern Detection (Phase 17).
 * @project CASETHREAD
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const CrossCaseService = require('../knowledge-base/intelligence/cross-case/crossCaseService');

// All cross-case intelligence routes require authentication
router.use(authenticateToken);

/**
 * POST /api/v1/intelligence/cross-case/analyze
 * Dispatches multi-case retrieval, native C graph algorithm execution, pattern detection,
 * and resolution comparison.
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const { query, caseId, filters, algorithm, limit } = req.body;
    const result = await CrossCaseService.analyzeQuery({
      query,
      caseId,
      filters,
      algorithm,
      limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/intelligence/cross-case/path
 * Computes native C shortest path connecting two historical case references through the cross-case graph.
 */
router.post('/path', async (req, res, next) => {
  try {
    const { sourceCaseRef, targetCaseRef } = req.body;
    if (!sourceCaseRef || !targetCaseRef) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Both sourceCaseRef and targetCaseRef are required.' }
      });
    }

    const result = await CrossCaseService.findCasePath({ sourceCaseRef, targetCaseRef });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/intelligence/cross-case/patterns
 * Discovers empirical crime patterns across genuine historical records.
 */
router.post('/patterns', async (req, res, next) => {
  try {
    const { query, filters, limit } = req.body;
    const result = await CrossCaseService.analyzeQuery({
      query: query || 'recurring crime patterns commercial robbery burglary',
      filters,
      limit: limit || 10
    });
    res.json({
      success: true,
      patterns: result.patterns_detected,
      total_patterns: result.patterns_detected.length,
      supporting_cases_total: result.total_cases,
      citations: result.citations
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/intelligence/cross-case/graph
 * Returns the interactive cross-case graph nodes and edges for visualization.
 */
router.get('/graph', async (req, res, next) => {
  try {
    const { query, country, crimeCategory, maxNodes } = req.query;
    const filters = {};
    if (country) filters.country = country;
    if (crimeCategory) filters.crimeCategory = crimeCategory;

    const result = await CrossCaseService.getCrossCaseGraph({
      query,
      filters,
      maxNodes: parseInt(maxNodes, 10) || 30
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
