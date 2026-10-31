/**
 * @file analysisRoutes.js
 * @description Investigation analysis endpoints communicating with C core DSA engine.
 */

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { authenticateToken } = require('../middleware/auth');

router.post('/cases/:caseId/run', authenticateToken, analysisController.runInvestigationAnalysis);
router.get('/cases/:caseId/history', authenticateToken, analysisController.getPastAnalyses);

module.exports = router;
