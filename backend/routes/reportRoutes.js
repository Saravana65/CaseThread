/**
 * @file reportRoutes.js
 * @brief Case investigation report generation, multi-format export, and history endpoints.
 * @project CASETHREAD — Phase 9 Investigative Reporting & Document Export System
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

// Dossier compilation for preview
router.get('/cases/:caseId/dossier', authenticateToken, reportController.getCaseDossier);

// Structured & Printable Multi-Format Exports
router.get('/cases/:caseId/json', authenticateToken, reportController.exportCaseReportJson);
router.get('/cases/:caseId/csv', authenticateToken, reportController.exportCaseReportCsv);
router.get('/cases/:caseId/html', authenticateToken, reportController.exportCaseReportHtml);

// Report History Management
router.get('/history', authenticateToken, reportController.getReportHistory);
router.post('/generate', authenticateToken, reportController.generateReportRecord);
router.delete('/:reportId', authenticateToken, reportController.deleteReportRecord);

module.exports = router;
