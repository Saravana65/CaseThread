/**
 * @file custodyRoutes.js
 * @description REST endpoints for chain-of-custody transfer logging and historical tracking.
 * @project CASETHREAD - Phase 7 Forensic Evidence Integrity
 */

const express = require('express');
const router = express.Router();
const custodyController = require('../controllers/custodyController');
const { authenticateToken } = require('../middleware/auth');

router.post('/transfer', authenticateToken, custodyController.transferCustody);
router.get('/evidence/:evidenceId', authenticateToken, custodyController.getCustodyHistory);
router.get('/case/:caseId', authenticateToken, (req, res, next) => {
  req.query.case_id = req.params.caseId;
  return custodyController.getCustodyHistory(req, res, next);
});

module.exports = router;
