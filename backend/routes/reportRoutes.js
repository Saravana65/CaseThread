/**
 * @file reportRoutes.js
 * @description Case investigation report generation endpoints (JSON & Printable HTML/PDF).
 * @project CASETHREAD - Phase 7 Forensic Evidence Integrity
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.get('/cases/:caseId/json', authenticateToken, reportController.exportCaseReportJson);
router.get('/cases/:caseId/html', authenticateToken, reportController.exportCaseReportHtml);

module.exports = router;
