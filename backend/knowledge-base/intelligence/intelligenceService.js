/**
 * @file intelligenceService.js
 * @brief Primary orchestration coordinator for CaseThread AI Investigation Intelligence.
 * Implements end-to-end RAG workflow:
 * Natural Language Query -> Security Guard -> Query Understanding -> Hybrid Retrieval ->
 * Case Ranking -> Cross-Case Comparison -> Evidence-Grounded Reasoning -> Citation Validation -> Memory.
 * @project CASETHREAD
 */

const crypto = require('crypto');
const PromptGuard = require('./validation/promptGuard');
const QueryParser = require('./query-understanding/queryParser');
const HybridRetriever = require('./retrieval/hybridRetriever');
const CaseRanker = require('./ranking/caseRanker');
const CaseComparator = require('./case-comparison/caseComparator');
const CitationValidator = require('./citations/citationValidator');
const EvidenceReasoner = require('./reasoning/evidenceReasoner');
const ConversationMemory = require('./conversation/conversationMemory');
const CrossCaseGraphBuilder = require('./cross-case/crossCaseGraphBuilder');
const NativeGraphService = require('./cross-case/nativeGraphService');
const PatternDetector = require('./cross-case/patternDetector');

class IntelligenceService {
  /**
   * Primary entry point for investigator natural language inquiries.
   * @param {object} params
   * @param {string} params.query - Natural language incident description or question
   * @param {string} [params.conversationId] - Active session identifier
   * @param {object} [params.filters] - Explicit filters (country, crimeCategory, etc.)
   * @param {object} [params.accessContext] - Investigator clearance ({ userId, role, badgeNumber })
   * @param {number} [params.limit=5] - Number of candidate cases to compare
   * @returns {Promise<object>} Complete investigative intelligence report
   */
  static async queryIntelligence({ query, conversationId = null, filters = {}, accessContext = null, limit = 5 }) {
    const activeConversationId = conversationId || `conv-${crypto.randomBytes(8).toString('hex')}`;
    const session = ConversationMemory.getSession(activeConversationId);

    // 1. Security Inspection & Anti-Prompt-Injection Sanitization
    const { safeQuery, isSanitized, flaggedPatterns } = PromptGuard.inspectAndSanitize(query);
    if (!safeQuery) {
      return {
        success: false,
        error: 'Query string cannot be empty.'
      };
    }

    // 2. Query Understanding & Criteria Extraction
    const criteria = QueryParser.parse(safeQuery, session);

    if (criteria.followUpTarget && session.incidentCriteria) {
      for (const field of ['crimeCategories', 'propertyKeywords', 'stolenProperty', 'ignoredItems', 'targetCountries']) {
        if (!criteria[field].length) criteria[field] = [...session.incidentCriteria[field]];
      }
      criteria.premises ||= session.incidentCriteria.premises;
      criteria.approximateTime ||= session.incidentCriteria.approximateTime;
    }

    // Merge explicit filters from API call
    if (filters.country) {
      criteria.targetCountries = [filters.country];
    }
    if (filters.crimeCategory) {
      criteria.crimeCategories = [filters.crimeCategory];
      criteria.explicitCrimeCategory = filters.crimeCategory;
    }

    // 3. Hybrid Case Retrieval (Full-Text + Structured + Semantic Vectors)
    const retrievedCandidates = await HybridRetriever.retrieve({
      criteria,
      accessContext,
      limit: Math.max(limit * 2, 8)
    });

    // 4. Multi-Attribute Case Ranking
    const seenDocuments = new Set();
    const rankedCases = CaseRanker.rank(retrievedCandidates, criteria).filter(candidate => {
      if (seenDocuments.has(candidate.document_id) || candidate.record_level === 'AGGREGATE_STATISTIC') return false;
      const matched = ['DIRECT_CONNECTION_CHECK', 'GRAPH_ANALYSIS', 'CROSS_CASE_PATTERNS'].includes(criteria.requestedIntent) ||
        candidate.match_breakdown.some(({ attribute }) =>
          attribute === 'CONTEXT_TARGET_MATCH' || attribute === 'STOLEN_PROPERTY' ||
          (!criteria.propertyKeywords.length && attribute === 'CRIME_CATEGORY'));
      if (matched) seenDocuments.add(candidate.document_id);
      return matched;
    }).slice(0, limit);

    // 5. Cross-Case Comparison Analysis
    const comparisons = rankedCases.map(c => CaseComparator.compare(criteria, c));

    // 6. Source Citation Validation
    const citations = CitationValidator.buildCitations(rankedCases);

    // 6.5. Cross-Case Graph Construction & Pattern Discovery
    const graphData = CrossCaseGraphBuilder.buildGraph(rankedCases);
    const patterns = PatternDetector.detectPatterns(rankedCases, criteria);
    let graphExecution = null;

    if (criteria.requestedIntent === 'GRAPH_ANALYSIS' && graphData.nodes.length > 0) {
      try {
        graphExecution = await NativeGraphService.runBfs(graphData.cPayload, 0);
      } catch (e) {
        console.warn('Native C graph BFS execution notice:', e.message);
      }
    }

    // 7. Evidence-Grounded Reasoning & Synthesis
    const reasoningOutput = EvidenceReasoner.reason({
      query: safeQuery,
      criteria,
      rankedCases,
      comparisons,
      citations,
      patterns,
      graphExecution
    });

    // 8. Record Turn in Conversation Memory
    const topCase = rankedCases.length > 0 ? rankedCases[0] : null;
    if (!criteria.followUpTarget) session.incidentCriteria = criteria;
    session.lastReferencedCase = topCase;
    ConversationMemory.recordTurn(activeConversationId, safeQuery, reasoningOutput, topCase);

    return {
      success: true,
      conversation_id: activeConversationId,
      query: safeQuery,
      is_sanitized: isSanitized,
      query_understanding: {
        engine: criteria.engine,
        crime_category: criteria.crimeCategories[0] || 'GENERAL_CRIME',
        crime_categories: criteria.crimeCategories,
        property_keywords: criteria.propertyKeywords,
        ignored_items: criteria.ignoredItems,
        premises: criteria.premises,
        approximate_time: criteria.approximateTime,
        target_countries: criteria.targetCountries,
        requested_intent: criteria.requestedIntent,
        follow_up_target: (typeof criteria.followUpTarget === 'object' ? criteria.followUpTarget?.case_reference_number : criteria.followUpTarget) || null
      },
      answer: reasoningOutput.answer,
      how_previous_cases_were_solved: reasoningOutput.how_previous_cases_were_solved,
      investigative_suggestions: reasoningOutput.investigative_suggestions,
      similar_cases: rankedCases.map((c, index) => ({
        comparison: comparisons[index],
        document_id: c.document_id,
        case_reference_number: c.case_reference_number,
        document_title: c.document_title,
        country: c.country,
        region_state: c.region_state,
        city: c.city,
        jurisdiction: c.jurisdiction,
        crime_category: c.crime_category,
        crime_subtype: c.crime_subtype,
        incident_datetime: c.incident_datetime,
        stolen_property: c.stolen_property,
        property_recovered: c.property_recovered,
        case_outcome: c.case_outcome,
        investigation_status: c.investigation_status,
        is_investigation_details_available: c.is_investigation_details_available,
        relevance_tier: c.relevance_tier,
        rank_score: c.rank_score,
        similarity_explanation: c.similarity_explanation,
        investigative_notice: c.investigative_notice
      })),
      case_comparisons: comparisons,
      patterns_detected: patterns,
      cross_case_graph: {
        nodes: graphData.nodes,
        edges: graphData.edges
      },
      graph_execution: graphExecution,
      citations: citations,
      limitations: reasoningOutput.limitations
    };
  }
}

module.exports = IntelligenceService;
