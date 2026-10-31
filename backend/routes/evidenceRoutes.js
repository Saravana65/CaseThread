/**
 * @file evidenceRoutes.js
 * @description Evidence management REST endpoints with express-validator middleware.
 */

const express = require('express');
const router = express.Router();
const evidenceController = require('../controllers/evidenceController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addEvidenceRules } = require('../middleware/validators');

router.post('/', authenticateToken, addEvidenceRules, validate, evidenceController.addEvidence);
router.get('/case/:caseId', authenticateToken, evidenceController.listEvidenceByCase);
router.get('/search', authenticateToken, evidenceController.searchEvidence);
router.get('/:id', authenticateToken, evidenceController.getEvidenceById);
router.put('/:id', authenticateToken, evidenceController.updateEvidence);
router.post('/relationships', authenticateToken, evidenceController.addRelationship);

module.exports = router;
