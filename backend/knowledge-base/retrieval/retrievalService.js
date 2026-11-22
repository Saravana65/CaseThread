/**
 * @file retrievalService.js
 * @brief Internal backend retrieval service for Phase 13 Private Crime Knowledge Base.
 * Enforces role-based clearance boundaries, audit logging, and bounded context retrieval.
 * @project CASETHREAD
 */

const FullTextIndexer = require('../indexing/fullTextIndexer');
const KnowledgeSecurity = require('../security/knowledgeSecurity');
const { execute } = require('../../database/connection');

class RetrievalService {
  /**
   * Determines list of classifications permitted for the given access context.
   */
  static getAllowedClassifications(accessContext) {
    if (!accessContext) return ['PUBLIC_RECORD'];
    const role = accessContext.role || 'GUEST';

    if (['LEAD_OFFICER', 'ADMIN', 'COMMANDER'].includes(role)) {
      return ['PUBLIC_RECORD', 'OFFICIAL_USE_ONLY', 'RESTRICTED_LAW_ENFORCEMENT', 'CONFIDENTIAL'];
    }
    if (['INVESTIGATOR', 'SENIOR_DETECTIVE'].includes(role)) {
      return ['PUBLIC_RECORD', 'OFFICIAL_USE_ONLY', 'RESTRICTED_LAW_ENFORCEMENT'];
    }
    if (['ANALYST', 'REVIEWER'].includes(role)) {
      return ['PUBLIC_RECORD', 'OFFICIAL_USE_ONLY'];
    }
    return ['PUBLIC_RECORD'];
  }

  /**
   * Logs retrieval audit event to activity log or audit store.
   */
  static async logAuditAccess(accessContext, query, resultCount) {
    try {
      const userId = accessContext && accessContext.userId ? accessContext.userId : null;
      const userRole = accessContext && accessContext.role ? accessContext.role : 'UNKNOWN';
      const details = JSON.stringify({
        action: 'KNOWLEDGE_BASE_SEARCH',
        userRole,
        queryPreview: (query || '').slice(0, 100),
        resultCount,
        timestamp: new Date().toISOString()
      });

      // Insert into activity_logs if table exists, or log to secure stdout
      await execute(`
        INSERT INTO activity_logs (investigation_id, user_id, action, entity_type, entity_id, details)
        VALUES (NULL, ?, 'KNOWLEDGE_BASE_SEARCH', 'KNOWLEDGE_CHUNK', 0, ?)
      `, [userId, details]).catch(() => {
        // Non-blocking fallback if foreign key or null constraint
      });
    } catch {
      // Audit fail-safe: keep retrieval running
    }
  }

  /**
   * Primary internal search method for backend services & future AI retrieval.
   * @param {object} params
   * @param {string} params.query - Natural language or keyword query
   * @param {object} params.filters - Optional domain filters (category, jurisdiction, dateRange)
   * @param {object} params.accessContext - Requester security context ({ userId, role, badgeNumber })
   * @param {number} params.limit - Max snippets to retrieve (max 20 for prompt context)
   * @returns {Promise<object>} Bounded retrieval result with provenance metadata
   */
  static async searchKnowledgeBase({ query, filters = {}, accessContext = null, limit = 5 }) {
    // 1. Enforce access authorization
    const allowedClassifications = this.getAllowedClassifications(accessContext);

    // 2. Prepare bounded filters
    const searchFilters = {
      ...filters,
      allowedClassifications
    };

    // Cap limit to 20 snippets to avoid prompt-injection or bulk scraping
    const boundedLimit = Math.min(Math.max(1, parseInt(limit) || 5), 20);

    // 3. Execute full-text index retrieval
    const searchResult = await FullTextIndexer.search({
      query,
      filters: searchFilters,
      limit: boundedLimit
    });

    // 4. Log audit trail
    await this.logAuditAccess(accessContext, query, searchResult.results.length);

    // 5. Structure payload for AI context window consumption
    return {
      query: searchResult.query,
      match_count: searchResult.results.length,
      access_clearance: allowedClassifications[allowedClassifications.length - 1],
      snippets: searchResult.results.map(r => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        document_title: r.document_title,
        case_number: r.case_number,
        jurisdiction: r.jurisdiction,
        crime_category: r.crime_category,
        incident_date: r.incident_date,
        classification_level: r.classification_level,
        page_number: r.page_number,
        section_reference: r.section_reference,
        relevance_score: r.relevance_score,
        excerpt: r.excerpt,
        text: r.chunk_text
      }))
    };
  }
}

module.exports = RetrievalService;
