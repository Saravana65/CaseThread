/**
 * @file rateLimiter.js
 * @description Production rate limiting middleware protecting against brute-force & DoS attacks.
 * @project CASETHREAD - Phase 11 Production Hardening
 */

const rateLimit = require('express-rate-limit');

const isTestEnv = process.env.NODE_ENV === 'test';

// 1. Global API Rate Limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10), // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests dispatched from this IP address. Please retry after 15 minutes.'
      }
    });
  }
});

// 2. Strict Authentication Rate Limiter (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10), // Max 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Account access temporarily throttled. Retry in 15 minutes.'
      }
    });
  }
});

// 3. Intensive Analysis Pipeline Rate Limiter (Prevents C-Engine compute exhaustion)
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_ANALYSIS_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'ANALYSIS_RATE_LIMIT_EXCEEDED',
        message: 'Algorithmic analysis request limit reached. Please allow the core engine to complete pending workloads.'
      }
    });
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  analysisLimiter
};
