/**
 * @file auth.js
 * @description JWT verification and role-based access control middleware.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'casethread_super_secure_jwt_dev_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_TOKEN_REQUIRED',
        message: 'Access denied. Investigator authentication token required.'
      }
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Session expired or invalid credentials.'
        }
      });
    }

    req.officer = decoded;
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.officer || !allowedRoles.includes(req.officer.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_INSUFFICIENT_PRIVILEGES',
          message: 'Investigator authorization level insufficient for this action.'
        }
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
