/**
 * @file timelineRoutes.js
 * @description Chronological timeline REST endpoints.
 */

const express = require('express');
const router = express.Router();
const timelineController = require('../controllers/timelineController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addTimelineRules } = require('../middleware/validators');

// Timeline endpoints (namespaced under /api/v1/timeline)
router.post('/', authenticateToken, addTimelineRules, validate, timelineController.addTimelineEvent);
router.post('/case/:caseId', authenticateToken, addTimelineRules, validate, timelineController.addTimelineEvent);
router.get('/case/:caseId', authenticateToken, timelineController.getCaseTimeline);
router.get('/case/:caseId/analysis', authenticateToken, timelineController.getTimelineAnalysis);

module.exports = router;
