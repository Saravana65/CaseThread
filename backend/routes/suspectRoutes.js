/**
 * @file suspectRoutes.js
 * @description Suspect management routes.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const suspectController = require('../controllers/suspectController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addSuspectRules } = require('../middleware/validators');

router.post('/', authenticateToken, addSuspectRules, validate, suspectController.addSuspect);
router.get('/', authenticateToken, suspectController.listSuspectsByCase);
router.get('/:id', authenticateToken, suspectController.getSuspectById);

module.exports = router;
