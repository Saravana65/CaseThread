/**
 * @file geospatialRoutes.js
 * @brief REST routes for CaseThread Geospatial Investigation & Mapping subsystem.
 * @project CASETHREAD - Phase 9 Geospatial Intelligence
 */

const express = require('express');
const router = express.Router();
const geospatialController = require('../controllers/geospatialController');
const { authenticateToken } = require('../middleware/auth');

// All geospatial investigation operations require authenticated officer
router.use(authenticateToken);

// 1. Case-level geospatial queries and analysis
router.get('/cases/:caseId/geospatial', geospatialController.getCaseGeospatialPoints);
router.post('/cases/:caseId/geospatial/search', geospatialController.searchGeospatialPoints);
router.get('/cases/:caseId/geospatial/clusters', geospatialController.getGeospatialClusters);
router.post('/cases/:caseId/geospatial/analyze', geospatialController.analyzeGeospatialCase);
router.post('/cases/:caseId/geospatial/points', geospatialController.createGeospatialPoint);
router.post('/cases/:caseId/geospatial/points/:id/review', geospatialController.reviewGeospatialPoint);

// 2. Individual evidence location endpoints
router.get('/evidence/:evidenceId/location', geospatialController.getEvidenceLocation);

module.exports = router;
