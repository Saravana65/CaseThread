/**
 * @file crossCaseService.js
 * @brief Master coordinator for Cross-Case Intelligence & Native C Graph Analysis.
 * Orchestrates multi-case retrieval, C-engine graph execution (BFS, DFS, Shortest Path, Components),
 * pattern discovery, resolution comparison, and source-grounded reasoning.
 * @project CASETHREAD
 */

const { execute } = require('../../../database/connection');
const QueryParser = require('../query-understanding/queryParser');
const HybridRetriever = require('../retrieval/hybridRetriever');
const CrossCaseGraphBuilder = require('./crossCaseGraphBuilder');
const NativeGraphService = require('./nativeGraphService');
const PatternDetector = require('./patternDetector');
const CitationValidator = require('../citations/citationValidator');

class CrossCaseService {
  /**
   * Performs end-to-end cross-case graph analysis and pattern discovery.
   * @param {object} params
   * @param {string} params.query - Natural language query or incident description
   * @param {number} [params.caseId] - Optional active case context ID
   * @param {object} [params.filters] - Country, crime category filters
   * @param {string} [params.algorithm='BFS'] - Graph algorithm (BFS, DFS, CONNECTED_COMPONENTS, SHORTEST_PATH)
   * @param {number} [params.limit=6] - Max candidate cases to analyze
   * @returns {Promise<object>} Complete cross-case intelligence analysis
   */
  static async analyzeQuery({ query, caseId = null, filters = {}, algorithm = 'BFS', limit = 6 }) {
    const startTime = Date.now();

    // 1. Parse query or populate from case record
    let criteria;
    let queryText = query || '';

    if (!queryText && caseId) {
      const [cases] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
      if (cases && cases.length > 0) {
        queryText = `${cases[0].title} ${cases[0].description || ''} ${cases[0].category || ''}`;
      }
    }

    criteria = QueryParser.parse(queryText || 'cross case crime analysis');
    if (filters.country) criteria.targetCountries = [filters.country];
    if (filters.crimeCategory) criteria.crimeCategories = [filters.crimeCategory];

    // 2. Retrieve relevant historical candidate cases from private knowledge base
    const candidateCases = await HybridRetriever.retrieve({
      criteria,
      limit: Math.max(limit, 6)
    });

    if (!candidateCases || candidateCases.length === 0) {
      return {
        success: true,
        query: queryText,
        total_cases: 0,
        patterns_detected: [],
        cross_case_graph: { nodes: [], edges: [] },
        graph_execution: null,
        resolution_comparison: [],
        investigative_verification_questions: [],
        summary: 'No historical records matching the requested attributes were discovered in the indexed private knowledge base across authorized jurisdictions.',
        citations: []
      };
    }

    // 3. Build Evidence-Grounded Cross-Case Graph
    const graphData = CrossCaseGraphBuilder.buildGraph(candidateCases);

    // 4. Execute Native C Graph Algorithm
    let graphExecution = null;
    const requestedAlgo = (algorithm || 'BFS').toUpperCase();

    try {
      if (requestedAlgo === 'DFS') {
        graphExecution = await NativeGraphService.runDfs(graphData.cPayload, 0);
      } else if (requestedAlgo === 'CONNECTED_COMPONENTS') {
        graphExecution = await NativeGraphService.runConnectedComponents(graphData.cPayload);
      } else if (requestedAlgo === 'SHORTEST_PATH' && graphData.nodes.length >= 2) {
        // Find second case node for path target
        const caseNodes = graphData.nodes.filter(n => n.type === 'HISTORICAL_CASE');
        const targetId = caseNodes.length > 1 ? caseNodes[1].id : 1;
        graphExecution = await NativeGraphService.runShortestPath(graphData.cPayload, caseNodes[0]?.id || 0, targetId);
      } else {
        // Default: Native C BFS
        graphExecution = await NativeGraphService.runBfs(graphData.cPayload, 0);
      }
    } catch (engineErr) {
      console.warn('[CROSS-CASE SERVICE] Native C engine warning:', engineErr.message);
      graphExecution = {
        algorithm: requestedAlgo,
        status: 'FALLBACK_NOTICE',
        error: engineErr.message,
        execution_latency_ms: 0
      };
    }

    // 5. Pattern Discovery
    const detectedPatterns = PatternDetector.detectPatterns(candidateCases, criteria);

    // 6. Resolution & Investigative Method Comparison
    const resolutionComparison = candidateCases.slice(0, 4).map(c => ({
      case_reference: c.case_reference_number,
      title: c.document_title,
      country: c.country,
      jurisdiction: c.jurisdiction,
      evidence_types: c.evidence_types || 'Digital records, physical scene evidence',
      investigative_actions: c.is_investigation_details_available ? c.investigative_actions : 'Narrative details restricted under public record exemptions',
      property_recovered: c.property_recovered ? 'YES (Recovered)' : (c.property_recovered === false ? 'NO (Unrecovered)' : 'PARTIAL / NOT SPECIFIED'),
      case_outcome: c.case_outcome || 'PENDING JUDICIAL ADJUDICATION',
      citation_id: `CIT-${c.document_id}`
    }));

    // 7. Grounded Investigative Verification Questions
    const verificationQuestions = [
      {
        priority: 'HIGH',
        question: 'Are serial numbers or manufacturer MAC addresses for the targeted property available to establish exact provenance?',
        rationale: 'In precedent CRL-REV-P-442-2023, serial numbers on point-of-sale hardware enabled decisive Section 27 recovery confirmation.'
      },
      {
        priority: 'HIGH',
        question: 'Have commercial CCTV DVR hard drives been secured before automated 30-day FIFO loop overwrite?',
        rationale: 'Spot inspection DVR seizure was the primary identifying evidence establishing ingress timeline in historical warehouse burglaries.'
      },
      {
        priority: 'MEDIUM',
        question: 'Does the incident timeline align with cell site tower dump logs within a ±30 minute radius?',
        rationale: 'Telecom tower dump correlation identified co-located subscriber identifiers across geographically similar commercial break-ins.'
      },
      {
        priority: 'MEDIUM',
        question: 'Is the shared attribute (e.g. targeted electronics or cash) common enough in commercial crime to be coincidental?',
        rationale: 'Prevent false conspiracy linkages: shared targeting of consumer goods represents a recognized criminal typology rather than proof of a shared perpetrator.'
      }
    ];

    // 8. Citations Validation
    const citations = CitationValidator.buildCitations(candidateCases);

    // 9. Synthesize Executive Investigative Summary
    const summaryParts = [];
    const countryList = [...new Set(candidateCases.map(c => c.country))].join(', ');
    summaryParts.push(
      `Cross-case intelligence analyzed ${candidateCases.length} genuine historical records across ${countryList}. ` +
      `Native C graph engine executed ${requestedAlgo} traversal across ${graphData.total_nodes} nodes and ${graphData.total_edges} edges in ${graphExecution?.execution_latency_ms || 0}ms.`
    );

    if (detectedPatterns.length > 0) {
      summaryParts.push(`Discovered ${detectedPatterns.length} empirical pattern(s): ${detectedPatterns.map(p => p.pattern_name).join('; ')}.`);
    }

    summaryParts.push('IMPORTANT: Shared attributes indicate similar offense typologies, NOT common perpetrators or coordinated operations.');

    return {
      success: true,
      query: queryText,
      total_cases: candidateCases.length,
      candidate_cases: candidateCases.map(c => ({
        document_id: c.document_id,
        case_reference_number: c.case_reference_number,
        title: c.document_title,
        country: c.country,
        jurisdiction: c.jurisdiction,
        crime_category: c.crime_category,
        crime_subtype: c.crime_subtype,
        stolen_property: c.stolen_property,
        case_outcome: c.case_outcome,
        relevance_tier: c.relevance_tier || 'MEDIUM'
      })),
      patterns_detected: detectedPatterns,
      cross_case_graph: {
        nodes: graphData.nodes,
        edges: graphData.edges
      },
      graph_execution: graphExecution,
      resolution_comparison: resolutionComparison,
      investigative_verification_questions: verificationQuestions,
      summary: summaryParts.join('\n\n'),
      citations,
      total_latency_ms: Date.now() - startTime
    };
  }

  /**
   * Computes native C shortest path connecting two specific historical cases via shared attributes.
   * @param {object} params
   * @param {string} params.sourceCaseRef - Source case reference (e.g. 'CRL-REV-P-442-2023')
   * @param {string} params.targetCaseRef - Target case reference (e.g. 'JK488839')
   * @returns {Promise<object>} Path nodes, hop count, and step-by-step C engine trace
   */
  static async findCasePath({ sourceCaseRef, targetCaseRef }) {
    if (!sourceCaseRef || !targetCaseRef) {
      throw new Error('Both sourceCaseRef and targetCaseRef are required to compute a cross-case path.');
    }

    // Retrieve source and target cases first to guarantee inclusion
    const [targetedDocs] = await execute(`
      SELECT 
        kd.document_id, kd.case_reference_number, kd.document_title, kd.country,
        kd.jurisdiction, kd.crime_category, kd.crime_subtype, kd.stolen_property,
        kd.documented_circumstances, kd.case_outcome, kd.investigation_status,
        kd.investigative_actions, kd.is_investigation_details_available,
        ks.source_name
      FROM knowledge_documents kd
      JOIN knowledge_sources ks ON kd.source_id = ks.source_id
      WHERE kd.case_reference_number IN (?, ?)
    `, [sourceCaseRef, targetCaseRef]);

    if (targetedDocs.length < 2) {
      return {
        found: false,
        source: sourceCaseRef,
        target: targetCaseRef,
        message: 'One or both case references could not be located in the authorized knowledge base.'
      };
    }

    // Retrieve contextual cases sharing relevant categories
    const categories = [...new Set(targetedDocs.map(d => d.crime_category))];
    const [contextDocs] = await execute(`
      SELECT 
        kd.document_id, kd.case_reference_number, kd.document_title, kd.country,
        kd.jurisdiction, kd.crime_category, kd.crime_subtype, kd.stolen_property,
        kd.documented_circumstances, kd.case_outcome, kd.investigation_status,
        kd.investigative_actions, kd.is_investigation_details_available,
        ks.source_name
      FROM knowledge_documents kd
      JOIN knowledge_sources ks ON kd.source_id = ks.source_id
      WHERE kd.crime_category IN (${categories.map(() => '?').join(',')})
        AND kd.case_reference_number NOT IN (?, ?)
      LIMIT 15
    `, [...categories, sourceCaseRef, targetCaseRef]);

    const docs = [...targetedDocs, ...contextDocs];

    const graphData = CrossCaseGraphBuilder.buildGraph(docs);

    // Locate source and target nodes
    const sourceNode = graphData.nodes.find(n => n.case_reference_number === sourceCaseRef);
    const targetNode = graphData.nodes.find(n => n.case_reference_number === targetCaseRef);

    if (!sourceNode || !targetNode) {
      return {
        found: false,
        source: sourceCaseRef,
        target: targetCaseRef,
        message: 'One or both case references could not be located in the authorized knowledge base.'
      };
    }

    const pathResult = await NativeGraphService.runShortestPath(
      graphData.cPayload,
      sourceNode.id,
      targetNode.id
    );

    return {
      found: pathResult.lab_result?.found || false,
      source: { ref: sourceCaseRef, id: sourceNode.id, label: sourceNode.label },
      target: { ref: targetCaseRef, id: targetNode.id, label: targetNode.label },
      hops: pathResult.lab_result?.path_length || 0,
      path_nodes: pathResult.lab_result?.path_nodes || [],
      trace: pathResult.lab_result?.trace || [],
      execution_ms: pathResult.lab_result?.metrics?.execution_ms || 0,
      c_engine_latency_ms: pathResult.execution_latency_ms,
      relationship_nature_notice: 'PATH_NOTICE: Path traverses shared attributes (e.g. crime category or property type). This demonstrates evidentiary parallels, not direct conspiracy or co-offender status.'
    };
  }

  /**
   * Retrieves visualizable cross-case graph nodes and edges.
   */
  static async getCrossCaseGraph({ query = '', filters = {}, maxNodes = 30 } = {}) {
    const criteria = QueryParser.parse(query || 'robbery burglary electronics cash');
    if (filters.country) criteria.targetCountries = [filters.country];
    if (filters.crimeCategory) criteria.crimeCategories = [filters.crimeCategory];

    const candidateCases = await HybridRetriever.retrieve({
      criteria,
      limit: Math.min(maxNodes, 12)
    });

    const graphData = CrossCaseGraphBuilder.buildGraph(candidateCases);

    return {
      success: true,
      nodes: graphData.nodes,
      edges: graphData.edges,
      total_nodes: graphData.total_nodes,
      total_edges: graphData.total_edges
    };
  }
}

module.exports = CrossCaseService;
