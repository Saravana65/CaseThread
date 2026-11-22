/**
 * @file intelligenceRoutes.js
 * @brief Authenticated REST API routes for CaseThread AI Investigation Intelligence.
 * @project CASETHREAD
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const IntelligenceService = require('../knowledge-base/intelligence/intelligenceService');
const ConversationMemory = require('../knowledge-base/intelligence/conversation/conversationMemory');

// Mount Phase 17 Cross-Case Intelligence & Graph Analysis Subsystem
router.use('/cross-case', require('./crossCaseRoutes'));

/**
 * @route POST /api/v1/intelligence/query
 * @brief Natural language investigation inquiry with evidence-grounded RAG reasoning.
 */
router.post('/query', authenticateToken, async (req, res, next) => {
  try {
    const { query, conversationId, filters, limit, investigationId } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'A non-empty query string is required.'
        }
      });
    }

    const accessContext = {
      userId: req.user?.officer_id || req.user?.id || 1,
      role: req.user?.role || req.user?.rank_designation || 'INVESTIGATOR',
      badgeNumber: req.user?.badge_number || 'DET-8841'
    };

    const result = await IntelligenceService.queryIntelligence({
      query,
      conversationId,
      filters: filters || {},
      accessContext,
      limit: parseInt(limit, 10) || 5
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/v1/intelligence/conversations/:id
 * @brief Retrieves conversation history for an active session.
 */
router.get('/conversations/:id', authenticateToken, (req, res) => {
  const session = ConversationMemory.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'No active session found for the provided identifier.'
      }
    });
  }

  return res.status(200).json({
    success: true,
    conversation_id: session.conversationId,
    turns: session.turns,
    created_at: new Date(session.createdAt).toISOString()
  });
});

module.exports = router;
