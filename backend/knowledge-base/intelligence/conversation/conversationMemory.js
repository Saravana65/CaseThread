/**
 * @file conversationMemory.js
 * @brief In-memory conversation state manager with bounded history and automatic TTL eviction.
 * Maintains context across multi-turn investigator sessions without exposing private databases.
 * @project CASETHREAD
 */

class ConversationMemory {
  static SESSIONS = new Map();
  static SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Retrieves or creates a conversation session.
   * @param {string} conversationId
   */
  static getSession(conversationId) {
    if (!conversationId) return null;

    const existing = this.SESSIONS.get(conversationId);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing;
    }

    const newSession = {
      conversationId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      turns: [],
      lastReferencedCase: null,
      activeFilters: {}
    };

    this.SESSIONS.set(conversationId, newSession);
    this.evictExpiredSessions();
    return newSession;
  }

  /**
   * Records a user/assistant interaction turn.
   */
  static recordTurn(conversationId, userQuery, assistantResponse, topCase = null) {
    const session = this.getSession(conversationId);
    if (!session) return;

    session.turns.push({
      turn_id: session.turns.length + 1,
      timestamp: new Date().toISOString(),
      user_query: userQuery,
      assistant_summary: (assistantResponse.answer || '').slice(0, 300),
      top_case_reference: topCase ? topCase.case_reference_number : null
    });

    if (topCase) {
      session.lastReferencedCase = topCase;
    }

    // Keep turns bounded (max 20 turns per conversation)
    if (session.turns.length > 20) {
      session.turns.shift();
    }
  }

  /**
   * Cleans up sessions older than TTL.
   */
  static evictExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.SESSIONS.entries()) {
      if (now - session.lastAccessedAt > this.SESSION_TTL_MS) {
        this.SESSIONS.delete(id);
      }
    }
  }
}

module.exports = ConversationMemory;
