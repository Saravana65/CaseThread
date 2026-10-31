/**
 * @file leadRoutes.js
 * @description Investigative lead management REST endpoints.
 */

const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addLeadRules } = require('../middleware/validators');

router.post('/', authenticateToken, addLeadRules, validate, leadController.addLead);
router.post('/case/:caseId', authenticateToken, addLeadRules, validate, leadController.addLead);
router.get('/case/:caseId', authenticateToken, leadController.listLeadsByCase);
router.patch('/:id/status', authenticateToken, leadController.updateLeadStatus);

module.exports = router;
