/**
 * @file geospatialRoutes.js
 * @brief REST routes for CaseThread Geospatial Investigation & Mapping subsystem.
 * @project CASETHREAD - Phase 9 Geospatial Intelligence
 */

const express = require('express');
const router = express.Router();
const geospatialController = require('../controllers/geospatialController');
const { authenticateToken } = require('../middleware/auth');

// 1. Case-level geospatial queries and analysis
router.get('/cases/:caseId/geospatial', authenticateToken, geospatialController.getCaseGeospatialPoints);
router.post('/cases/:caseId/geospatial/search', authenticateToken, geospatialController.searchGeospatialPoints);
router.get('/cases/:caseId/geospatial/clusters', authenticateToken, geospatialController.getGeospatialClusters);
router.post('/cases/:caseId/geospatial/analyze', authenticateToken, geospatialController.analyzeGeospatialCase);
router.post('/cases/:caseId/geospatial/points', authenticateToken, geospatialController.createGeospatialPoint);
router.post('/cases/:caseId/geospatial/points/:id/review', authenticateToken, geospatialController.reviewGeospatialPoint);

// 2. Individual evidence location endpoints
router.get('/evidence/:evidenceId/location', authenticateToken, geospatialController.getEvidenceLocation);

module.exports = router;
