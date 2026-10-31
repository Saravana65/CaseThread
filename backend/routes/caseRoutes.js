/**
 * @file caseRoutes.js
 * @description Case management REST endpoints.
 */

const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticateToken } = require('../middleware/auth');
const { validate, createCaseRules } = require('../middleware/validators');

router.post('/', authenticateToken, createCaseRules, validate, caseController.createCase);
router.get('/', authenticateToken, caseController.listCases);
router.get('/:id', authenticateToken, caseController.getCaseById);
router.put('/:id', authenticateToken, caseController.updateCase);
router.patch('/:id/archive', authenticateToken, caseController.archiveCase);
router.get('/:id/people', authenticateToken, caseController.getPeopleByCase);

module.exports = router;
