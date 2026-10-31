/**
 * @file witnessRoutes.js
 * @description Witness management REST endpoints.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const witnessController = require('../controllers/witnessController');
const { authenticateToken } = require('../middleware/auth');
const { validate, addWitnessRules } = require('../middleware/validators');

router.post('/', authenticateToken, addWitnessRules, validate, witnessController.addWitness);
router.get('/', authenticateToken, witnessController.listWitnessesByCase);
router.get('/:id', authenticateToken, witnessController.getWitnessById);

module.exports = router;
