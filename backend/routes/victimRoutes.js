/**
 * @file victimRoutes.js
 * @description Victim management routes.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const victimController = require('../controllers/victimController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addVictimRules } = require('../middleware/validators');

router.post('/', authenticateToken, addVictimRules, validate, victimController.addVictim);
router.get('/', authenticateToken, victimController.listVictimsByCase);
router.get('/:id', authenticateToken, victimController.getVictimById);

module.exports = router;
