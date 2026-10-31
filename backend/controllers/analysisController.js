/**
 * @file analysisController.js
 * @description Orchestrates DSA execution in C Core Engine and persists forensic intelligence results.
 */

const { execute } = require('../database/connection');
const cEngineService = require('../services/cEngineService');

exports.runInvestigationAnalysis = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);

    // 1. Enforce officer authentication (never fallback to arbitrary officer ID)
    if (!req.officer || !req.officer.officer_id) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_TOKEN_REQUIRED', message: 'Investigator authentication token required.' }
      });
    }

    const officerId = req.officer.officer_id;

    // 2. Gather case and verify investigator authorization
    const [cases] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
    if (!cases || cases.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const currentCase = cases[0];
    const isAuthorized = req.officer.role === 'ADMIN' ||
                         req.officer.role === 'LEAD_OFFICER' ||
                         currentCase.lead_officer_id === officerId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_UNAUTHORIZED_CASE_ACCESS',
          message: 'Access denied: You are not authorized to access or analyze another officer\'s case file.'
        }
      });
    }

    const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
    const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [caseId]);
    const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [caseId]);
    const [evidence] = await execute('SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0', [caseId]);
    const [relationships] = await execute('SELECT * FROM evidence_relationships WHERE case_id = ?', [caseId]);
    const [timeline] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [caseId]);

    // 3. Format structured IPC payload with complete forensic metadata for C Core Engine
    const cEnginePayload = {
      case_id: caseId,
      case_metadata: currentCase,
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
        location: e.collection_location || '',
        timestamp: e.collected_at ? Math.floor(new Date(e.collected_at).getTime() / 1000) : 0,
        source: e.source || '',
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
        location: t.location || '',
        status: t.status,
        is_verified: !!t.is_verified
      }))
    };

    // 4. Dispatch to native C Engine via standard input IPC (No mock fallback)
    const engineResults = await cEngineService.runAnalysis(cEnginePayload);

    // 5. Persist synthesized C Engine leads into MySQL / Data Store
    if (engineResults.prioritized_leads && engineResults.prioritized_leads.length > 0) {
      for (const lead of engineResults.prioritized_leads) {
        try {
          // Check if similar lead already recorded
          const [existingLeads] = await execute(
            'SELECT lead_id FROM investigation_leads WHERE case_id = ? AND title = ?',
            [caseId, lead.title]
          );

          if (existingLeads.length === 0) {
            await execute(
              `INSERT INTO investigation_leads 
                (case_id, title, hypothesis, recommended_action, lead_status, priority_score, assigned_officer_id, source_gap_type, generated_by)
               VALUES (?, ?, ?, ?, 'OPEN', ?, ?, 'MISSING_EVIDENCE', 'C_ENGINE_DETECTED')`,
              [
                caseId,
                lead.title,
                lead.explanation || 'Hypothesis synthesized by C Engine graph traversal.',
                lead.suggested_step || 'Verify supporting evidence.',
                lead.score ? parseFloat(lead.score) : 65.0,
                officerId
              ]
            );
          }
        } catch (leadPersistErr) {
          console.warn('[ANALYSIS] Lead persistence notice:', leadPersistErr.message);
        }
      }
    }

    const executionLatency = engineResults.execution_latency_ms || 0;

    res.json({
      success: true,
      data: {
        case_id: caseId,
        execution_latency_ms: executionLatency,
        analysis: engineResults
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPastAnalyses = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const [rows] = await execute(
      `SELECT l.*, o.full_name as officer_name 
       FROM investigation_leads l 
       LEFT JOIN officers o ON l.assigned_officer_id = o.officer_id 
       WHERE l.case_id = ? 
       ORDER BY l.created_at DESC`,
      [caseId]
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};
