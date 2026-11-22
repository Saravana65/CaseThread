/**
 * @file labRoutes.js
 * @brief REST endpoints for the Native C Investigation Lab (Phase 7).
 * @project CASETHREAD
 */

const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');
const { authenticateToken } = require('../middleware/auth');

// Public catalog and demo datasets
router.get('/catalog', labController.getCatalog);
router.get('/demo-datasets', labController.getDemoDatasets);

// Algorithm execution endpoint (requires authentication token for audit security)
router.post('/execute', authenticateToken, labController.executeAlgorithm);

module.exports = router;
