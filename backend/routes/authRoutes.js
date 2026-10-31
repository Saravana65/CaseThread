/**
 * @file authRoutes.js
 * @description Authentication routing endpoints with express-validator middleware.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate, officerRegisterRules, officerLoginRules } = require('../middleware/validators');

router.post('/register', officerRegisterRules, validate, authController.register);
router.post('/login', officerLoginRules, validate, authController.login);
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router;
