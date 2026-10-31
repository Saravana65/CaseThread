/**
 * @file timelineRoutes.js
 * @description Chronological timeline REST endpoints.
 */

const express = require('express');
const router = express.Router();
const timelineController = require('../controllers/timelineController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addTimelineRules } = require('../middleware/validators');

router.post('/', authenticateToken, addTimelineRules, validate, timelineController.addEvent);
router.post('/case/:caseId', authenticateToken, addTimelineRules, validate, timelineController.addEvent);
router.get('/case/:caseId', authenticateToken, timelineController.getTimelineByCase);

module.exports = router;
