/**
 * @file graphController.js
 * @description Orchestrates C-Engine Graph Relationship Analysis, Path Exploration, and Relational Edges.
 * @project CASETHREAD
 */

const { execute } = require('../database/connection');
const cEngineService = require('../services/cEngineService');

/**
 * Builds normalized payload from MySQL case tables for C Core Engine ingestion.
 */
async function buildCaseGraphPayload(caseId, queryOption = null) {
  const [cases] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
  if (!cases || cases.length === 0) {
    return null;
  }

  const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
  const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [caseId]);
  const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [caseId]);
  const [evidence] = await execute('SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0', [caseId]);
  const [relationships] = await execute('SELECT * FROM evidence_relationships WHERE case_id = ?', [caseId]);
  const [timeline] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [caseId]);

  const payload = {
    case_id: caseId,
    case_metadata: cases[0],
    entities: [
      ...suspects.map(s => ({ id: s.suspect_id, type: 'SUSPECT', label: s.full_name, alias: s.alias, phone: s.phone_number })),
      ...victims.map(v => ({ id: v.victim_id, type: 'VICTIM', label: v.full_name, condition: v.condition_status })),
      ...witnesses.map(w => ({ id: w.witness_id, type: 'WITNESS', label: w.full_name, credibility: w.credibility_score }))
    ],
    evidence: evidence.map(e => ({
      id: e.evidence_id,
      tracking_code: e.tracking_code,
      category: e.category,
      title: e.title,
      description: e.description,
      location: e.collection_location,
      timestamp: e.collected_at ? Math.floor(new Date(e.collected_at).getTime() / 1000) : 0,
      source: e.source,
      verification_status: e.verification_status,
      reliability_assessment: e.reliability_assessment,
      metadata: e.metadata_json
    })),
    relationships: relationships.map(r => ({
      id: r.relationship_id,
      source_type: r.source_type,
      source_id: r.source_id,
      target_type: r.target_type,
      target_id: r.target_id,
      relation_type: r.relation_type,
      confidence_weight: parseFloat(r.confidence_weight || 0.5),
      relationship_nature: r.relationship_nature
    })),
    timeline: timeline.map(t => ({
      event_id: t.timeline_id,
      timestamp_epoch: Math.floor(new Date(t.event_timestamp).getTime() / 1000),
      entity_type: t.entity_type,
      entity_id: t.entity_id,
      location: t.location,
      status: t.status,
      is_verified: !!t.is_verified
    }))
  };

  if (queryOption) {
    payload.query = queryOption;
  }

  return payload;
}

/**
 * GET /api/v1/cases/:caseId/graph
 * Executes C Engine Graph Analysis and returns complete graph topology & metrics.
 */
exports.getCaseGraph = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const payload = await buildCaseGraphPayload(caseId);

    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        engine_version: engineResults.engine_version,
        metrics: engineResults.metrics,
        classification_summary: engineResults.classification_summary,
        nodes: engineResults.graph_nodes || [],
        edges: engineResults.graph_edges || [],
        connected_components: engineResults.connected_components || [],
        isolated_nodes: engineResults.isolated_nodes || [],
        evidence_gaps: engineResults.evidence_gaps || [],
        timeline_anomalies: engineResults.timeline_anomalies || [],
        prioritized_leads: engineResults.prioritized_leads || [],
        execution_latency_ms: engineResults.execution_latency_ms
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/graph/nodes
 * Retrieves graph nodes with optional filtering by type or verification status.
 */
exports.getGraphNodes = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const { type, status } = req.query;
    const payload = await buildCaseGraphPayload(caseId);

    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);
    let nodes = engineResults.graph_nodes || [];

    if (type) {
      nodes = nodes.filter(n => n.entity_type.toUpperCase() === type.toUpperCase());
    }
    if (status) {
      nodes = nodes.filter(n => n.verification_status.toUpperCase() === status.toUpperCase());
    }

    res.json({
      success: true,
      data: {
        case_id: caseId,
        total: nodes.length,
        nodes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/graph/edges
 * Retrieves graph edges with filtering by relation_type, origin, or verification status.
 */
exports.getGraphEdges = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const { relation_type, origin, status } = req.query;
    const payload = await buildCaseGraphPayload(caseId);

    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);
    let edges = engineResults.graph_edges || [];

    if (relation_type) {
      edges = edges.filter(e => e.relation_type.toUpperCase() === relation_type.toUpperCase());
    }
    if (origin) {
      edges = edges.filter(e => e.relationship_nature.toUpperCase() === origin.toUpperCase());
    }
    if (status) {
      edges = edges.filter(e => e.verification_status.toUpperCase() === status.toUpperCase());
    }

    res.json({
      success: true,
      data: {
        case_id: caseId,
        total: edges.length,
        edges
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/graph/path
 * Finds shortest path connecting two investigation records using C BFS traversal.
 */
exports.findPath = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const sourceId = parseInt(req.query.source || req.query.source_id, 10);
    const targetId = parseInt(req.query.target || req.query.target_id, 10);
    const sourceType = req.query.source_type || '';
    const targetType = req.query.target_type || '';

    if (isNaN(sourceId) || isNaN(targetId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Parameters source and target (IDs) are required.' }
      });
    }

    const queryOption = {
      action: 'FIND_PATH',
      source_id: sourceId,
      source_type: sourceType,
      target_id: targetId,
      target_type: targetType
    };

    const payload = await buildCaseGraphPayload(caseId, queryOption);
    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        query: queryOption,
        path: engineResults.query_result || { found: false, message: 'No path calculated.' }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/graph/explore/:nodeId
 * Explores neighborhood of a node up to specified depth using C BFS.
 */
exports.exploreNode = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const nodeId = parseInt(req.params.nodeId, 10);
    const depth = parseInt(req.query.depth, 10) || 2;
    const nodeType = req.query.node_type || '';

    if (isNaN(nodeId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAM', message: 'Valid nodeId is required.' }
      });
    }

    const queryOption = {
      action: 'EXPLORE_NODE',
      node_id: nodeId,
      node_type: nodeType,
      depth: Math.min(depth, 4) // Safety cap
    };

    const payload = await buildCaseGraphPayload(caseId, queryOption);
    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        node_id: nodeId,
        neighborhood: engineResults.query_result || { found: false }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/graph/components
 * Retrieves connected components partitioned by C DFS.
 */
exports.getConnectedComponents = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const payload = await buildCaseGraphPayload(caseId);

    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        total_components: (engineResults.connected_components || []).length,
        components: engineResults.connected_components || []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/graph/isolated
 * Retrieves isolated evidence and entities with degree 0.
 */
exports.getIsolatedEvidence = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const payload = await buildCaseGraphPayload(caseId);

    if (!payload) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const engineResults = await cEngineService.runAnalysis(payload);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        total_isolated: (engineResults.isolated_nodes || []).length,
        isolated_nodes: engineResults.isolated_nodes || []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/cases/:caseId/graph/edges
 * Persists an investigator-verified or manual relationship to MySQL.
 */
exports.saveRelationship = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const officerId = req.officer ? req.officer.officer_id : 1;
    const {
      source_type,
      source_id,
      target_type,
      target_id,
      relation_type,
      confidence_weight = 0.8,
      relationship_nature = 'CONFIRMED_FACT',
      notes = ''
    } = req.body;

    if (!source_type || !source_id || !target_type || !target_id || !relation_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Missing required relationship fields.' }
      });
    }

    // Insert into MySQL evidence_relationships
    const [result] = await execute(
      `INSERT INTO evidence_relationships 
       (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature, notes, discovered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OFFICER_MANUAL')`,
      [caseId, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature, notes]
    );

    // Audit Log
    await execute(
      `INSERT INTO audit_logs (case_id, officer_id, action_type, entity_affected, entity_id, change_details)
       VALUES (?, ?, 'CREATE_RELATIONSHIP', 'EVIDENCE_RELATIONSHIP', ?, ?)`,
      [caseId, officerId, result.insertId, JSON.stringify({ relation_type, source_type, source_id, target_type, target_id })]
    );

    res.status(201).json({
      success: true,
      data: {
        relationship_id: result.insertId,
        case_id: caseId,
        relation_type,
        confidence_weight,
        relationship_nature
      }
    });
  } catch (error) {
    next(error);
  }
};
