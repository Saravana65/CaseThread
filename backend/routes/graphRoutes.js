/**
 * @file graphRoutes.js
 * @description API Routes for CaseThread Evidence Relationship Graph and C-Engine traversals.
 * @project CASETHREAD
 */

const express = require('express');
const router = express.Router();
const graphController = require('../controllers/graphController');
const { authenticateToken } = require('../middleware/auth');

// Complete Case Graph & Analysis
router.get('/cases/:caseId/graph', authenticateToken, graphController.getCaseGraph);

// Graph Element Queries with filtering
router.get('/cases/:caseId/graph/nodes', authenticateToken, graphController.getGraphNodes);
router.get('/cases/:caseId/graph/edges', authenticateToken, graphController.getGraphEdges);

// Algorithmic Traversals (BFS / DFS in C)
router.get('/cases/:caseId/graph/path', authenticateToken, graphController.findPath);
router.get('/cases/:caseId/graph/explore/:nodeId', authenticateToken, graphController.exploreNode);
router.get('/cases/:caseId/graph/components', authenticateToken, graphController.getConnectedComponents);
router.get('/cases/:caseId/graph/isolated', authenticateToken, graphController.getIsolatedEvidence);

// Persist / Confirm Relational Edge
router.post('/cases/:caseId/graph/edges', authenticateToken, graphController.saveRelationship);

module.exports = router;
