/**
 * @file validationRoutes.js
 * @description API routes for Phase 12 academic validation, algorithm accuracy, and benchmarks.
 * @project CASETHREAD
 */

const express = require('express');
const router = express.Router();
const validationController = require('../controllers/validationController');

// GET /api/v1/validation/summary - Evaluates scenarios and returns accuracy & benchmark metrics
router.get('/summary', validationController.getValidationSummary);

module.exports = router;
