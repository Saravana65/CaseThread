/**
 * @file gapAnalysisRoutes.js
 * @brief REST API Routes for Phase 12 Evidence Gap Intelligence & Assistant.
 * @project CASETHREAD
 */

const express = require('express');
const router = express.Router();
const gapAnalysisController = require('../controllers/gapAnalysisController');
const { authenticateToken } = require('../middleware/auth');

// All gap analysis routes require authenticated detective session
router.use(authenticateToken);

// Evidence Dropdown Options
router.get('/cases/:caseId/evidence-options', gapAnalysisController.getEvidenceOptions);

// Execute Gap & Path Analysis
router.post('/analyze', gapAnalysisController.analyzeGap);

// Record Review Decision for Candidate Link
router.post('/review', gapAnalysisController.reviewCandidate);

// Retrieve Case Review History
router.get('/reviews/:caseId', gapAnalysisController.getCandidateReviews);

module.exports = router;
