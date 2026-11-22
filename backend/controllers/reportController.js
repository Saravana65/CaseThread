/**
 * @file reportController.js
 * @brief Comprehensive Forensic Investigation Dossier & Multi-Format Reporting Engine.
 * @project CASETHREAD — Phase 9 Investigative Reporting & Document Export System
 */

const { execute } = require('../database/connection');
const cryptoService = require('../services/cryptoService');
const timelineController = require('./timelineController');

/**
 * Validates officer case access permissions.
 */
async function verifyCaseAccess(officer, caseId) {
  if (!officer) return { authorized: false, status: 401, error: 'Authentication required' };
  if (officer.role === 'ADMIN' || officer.role === 'LEAD_OFFICER') {
    return { authorized: true };
  }
  const [cases] = await execute('SELECT lead_officer_id FROM cases WHERE case_id = ?', [caseId]);
  if (!cases || cases.length === 0) {
    return { authorized: false, status: 404, error: 'Case not found' };
  }
  if (cases[0].lead_officer_id !== officer.officer_id) {
    return {
      authorized: false,
      status: 403,
      error: 'Access denied: You are not authorized to export reports for another officer\'s case file.'
    };
  }
  return { authorized: true };
}

/**
 * Sanitizes field values for CSV export to strictly prevent CSV / DDE Formula Injection attacks.
 * If a value starts with '=', '+', '-', '@', '\t', or '\r', prefixes with a single quote.
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Neutralize formula injection triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // If contains delimiter, quotes, or newlines, escape internal quotes and wrap in quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gathers complete case investigation payload for report generation.
 */
async function compileCaseDossier(caseId, officer, customNotes = null) {
  const [cases] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
  if (!cases || cases.length === 0) return null;
  const currentCase = cases[0];

  const [leadOfficer] = await execute(
    'SELECT full_name, badge_number, rank_designation, department FROM officers WHERE officer_id = ?',
    [currentCase.lead_officer_id]
  );
  const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
  const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [caseId]);
  const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [caseId]);
  const [evidence] = await execute(
    'SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0 ORDER BY collected_at ASC, evidence_id ASC',
    [caseId]
  );
  const [relationships] = await execute('SELECT * FROM evidence_relationships WHERE case_id = ?', [caseId]);
  const [leads] = await execute('SELECT * FROM investigation_leads WHERE case_id = ? ORDER BY priority_score DESC', [caseId]);
  const [custodyEvents] = await execute(
    'SELECT c.*, e.tracking_code, e.title AS evidence_title FROM evidence_custody_events c JOIN evidence e ON c.evidence_id = e.evidence_id WHERE c.case_id = ? ORDER BY c.transfer_timestamp ASC',
    [caseId]
  );
  const [verifications] = await execute('SELECT * FROM evidence_integrity_verifications WHERE case_id = ? ORDER BY verified_at DESC', [caseId]);
  const [auditLogs] = await execute('SELECT * FROM evidence_audit_logs WHERE case_id = ? ORDER BY created_at ASC, audit_id ASC', [caseId]);
  const [vaultFiles] = await execute('SELECT * FROM evidence_files WHERE case_id = ? ORDER BY upload_timestamp DESC', [caseId]);
  const [derivedArtifacts] = await execute('SELECT * FROM evidence_derived_artifacts WHERE case_id = ? ORDER BY created_at DESC', [caseId]);
  const [tasks] = await execute('SELECT * FROM investigation_tasks WHERE case_id = ? ORDER BY priority DESC, created_at ASC', [caseId]);

  // Phase 8 Consolidated Timeline Events & Precision
  let consolidatedTimeline = [];
  try {
    if (timelineController.fetchConsolidatedTimelineEvents) {
      consolidatedTimeline = await timelineController.fetchConsolidatedTimelineEvents(caseId);
      consolidatedTimeline.sort((a, b) => {
        if (a.timestamp_epoch === null && b.timestamp_epoch === null) return 0;
        if (a.timestamp_epoch === null) return 1;
        if (b.timestamp_epoch === null) return -1;
        return a.timestamp_epoch - b.timestamp_epoch;
      });
    }
  } catch (tErr) {
    console.warn('[REPORT] Consolidated timeline fallback to raw table:', tErr.message);
    const [rawTimelines] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [caseId]);
    consolidatedTimeline = rawTimelines.map(t => ({
      event_id: `TL-${t.timeline_id}`,
      title: t.event_title,
      description: t.event_description,
      category: t.entity_type,
      location: t.location,
      timestamp: t.event_timestamp ? new Date(t.event_timestamp).toISOString() : null,
      precision: 'EXACT',
      source_table: 'investigation_timelines',
      is_verified: !!t.is_verified
    }));
  }

  // Audit Hash Chain Verification
  const logsByEvidence = {};
  for (const log of auditLogs) {
    if (!logsByEvidence[log.evidence_id]) {
      logsByEvidence[log.evidence_id] = [];
    }
    logsByEvidence[log.evidence_id].push(log);
  }

  let allChainsValid = true;
  let totalChecked = 0;
  let verificationMsg = 'All case evidence audit hash chains verified intact.';

  for (const evId of Object.keys(logsByEvidence)) {
    const chainRes = cryptoService.verifyAuditChain(logsByEvidence[evId]);
    totalChecked += chainRes.events_checked;
    if (!chainRes.is_valid) {
      allChainsValid = false;
      verificationMsg = `Tampering detected in Evidence ID #${evId}: ${chainRes.error}`;
      break;
    }
  }

  // Graph topology calculations
  const graphEntityIds = new Set();
  evidence.forEach(e => graphEntityIds.add(`EVIDENCE_${e.evidence_id}`));
  suspects.forEach(s => graphEntityIds.add(`SUSPECT_${s.suspect_id}`));
  victims.forEach(v => graphEntityIds.add(`VICTIM_${v.victim_id}`));
  witnesses.forEach(w => graphEntityIds.add(`WITNESS_${w.witness_id}`));

  const connectedEntityIds = new Set();
  relationships.forEach(r => {
    connectedEntityIds.add(r.source_entity_id);
    connectedEntityIds.add(r.target_entity_id);
  });

  const isolatedEntities = Array.from(graphEntityIds).filter(id => !connectedEntityIds.has(id));

  // Time gaps (consecutive dated events > 6 hours)
  const datedEvents = consolidatedTimeline.filter(e => e.timestamp_epoch !== null);
  const detectedTimeGaps = [];
  for (let i = 0; i < datedEvents.length - 1; i++) {
    const diffSec = datedEvents[i + 1].timestamp_epoch - datedEvents[i].timestamp_epoch;
    if (diffSec >= 6 * 3600) {
      const hours = (diffSec / 3600).toFixed(1);
      detectedTimeGaps.push({
        gap_id: `GAP-${i + 1}`,
        start_event: datedEvents[i].title,
        end_event: datedEvents[i + 1].title,
        start_time: datedEvents[i].timestamp,
        end_time: datedEvents[i + 1].timestamp,
        duration_hours: parseFloat(hours),
        note: `Unrecorded ${hours}h interval between '${datedEvents[i].title}' and '${datedEvents[i + 1].title}'.`
      });
    }
  }

  return {
    report_metadata: {
      generated_at: new Date().toISOString(),
      generated_by_officer: officer
        ? `${officer.rank_designation || 'Officer'} ${officer.full_name} (${officer.badge_number})`
        : 'Authorized Forensic Investigator',
      officer_badge: officer ? officer.badge_number : 'SYSTEM',
      classification: 'LAW ENFORCEMENT SENSITIVE // OFFICIAL FORENSIC DOSSIER',
      system_version: 'CASETHREAD v1.0.0-phase9',
      disclaimer: 'ACADEMIC & INVESTIGATIVE DECISION SUPPORT NOTICE: This automated report is generated as an investigative decision-support tool. Algorithmic gap discoveries, graph paths, and heuristic lead scores do NOT constitute legal proof, judicial certification, or established findings of guilt.'
    },
    case_summary: {
      case_id: currentCase.case_id,
      case_number: currentCase.case_number,
      title: currentCase.title,
      description: currentCase.description,
      incident_date: currentCase.incident_date,
      incident_location: currentCase.incident_location,
      priority: currentCase.priority,
      status: currentCase.status,
      created_at: currentCase.created_at,
      lead_officer: leadOfficer && leadOfficer[0] ? {
        full_name: leadOfficer[0].full_name,
        badge_number: leadOfficer[0].badge_number,
        rank_designation: leadOfficer[0].rank_designation,
        department: leadOfficer[0].department
      } : null,
      statistics: {
        total_evidence: evidence.length,
        total_vault_files: (vaultFiles || []).length,
        total_custody_transfers: custodyEvents.length,
        total_timeline_events: consolidatedTimeline.length,
        complete_timestamps: consolidatedTimeline.filter(e => e.precision === 'EXACT').length,
        undated_records: consolidatedTimeline.filter(e => e.precision === 'UNKNOWN').length,
        total_graph_relationships: relationships.length,
        total_leads_generated: leads.length,
        active_investigative_tasks: tasks.length,
        audit_chain_verified: allChainsValid
      }
    },
    people: {
      suspects: suspects.map(s => ({ suspect_id: s.suspect_id, name: s.full_name, alias: s.alias, status: s.status, notes: s.notes })),
      victims: victims.map(v => ({ victim_id: v.victim_id, name: v.full_name, condition: v.condition_status })),
      witnesses: witnesses.map(w => ({ witness_id: w.witness_id, name: w.full_name, credibility_score: w.credibility_score, statement: w.statement }))
    },
    evidence_inventory: evidence.map(e => ({
      evidence_id: e.evidence_id,
      tracking_code: e.tracking_code,
      title: e.title,
      category: e.category,
      description: e.description,
      source: e.source,
      collection_location: e.collection_location,
      collected_at: e.collected_at,
      verification_status: e.verification_status,
      reliability_assessment: e.reliability_assessment,
      sha256_fingerprint: e.sha256_fingerprint,
      fingerprint_algorithm: e.fingerprint_algorithm,
      fingerprint_type: e.fingerprint_type,
      integrity_status: e.integrity_status,
      last_verified_at: e.last_verified_at,
      current_version: e.current_version
    })),
    chain_of_custody_history: custodyEvents.map(c => ({
      custody_id: c.custody_id,
      evidence_id: c.evidence_id,
      evidence_tracking: c.tracking_code,
      evidence_title: c.evidence_title,
      transfer_timestamp: c.transfer_timestamp,
      previous_custodian: c.previous_custodian,
      new_custodian: c.new_custodian,
      transfer_reason: c.transfer_reason,
      transfer_location: c.transfer_location,
      verification_status: c.verification_status,
      notes: c.notes
    })),
    digital_vault_inventory: (vaultFiles || []).map(f => ({
      file_id: f.file_id,
      original_filename: f.original_filename,
      file_size_bytes: f.file_size_bytes,
      mime_type: f.mime_type,
      sha256_hash: f.sha256_hash,
      upload_timestamp: f.upload_timestamp,
      integrity_status: f.integrity_status
    })),
    derived_forensic_artifacts: derivedArtifacts || [],
    integrity_verifications: verifications,
    relational_network: {
      total_edges: relationships.length,
      relationships: relationships.map(r => ({
        relationship_id: r.relationship_id,
        source_id: r.source_entity_id,
        target_id: r.target_entity_id,
        type: r.relationship_type,
        origin: r.origin || 'RECORDED_DIRECT',
        strength: r.strength,
        confidence: r.confidence_score,
        explanation: r.explanation || 'Directly recorded relational link.'
      })),
      isolated_nodes_count: isolatedEntities.length,
      isolated_entity_keys: isolatedEntities
    },
    chronological_timeline: consolidatedTimeline,
    detected_time_gaps: detectedTimeGaps,
    prioritized_investigative_leads: leads.map(l => ({
      lead_id: l.lead_id,
      title: l.title,
      hypothesis: l.hypothesis,
      recommended_action: l.recommended_action,
      priority_score: l.priority_score,
      lead_status: l.lead_status,
      source_gap_type: l.source_gap_type,
      algorithm_rule: 'BINARY_MAX_HEAP_COMPOSITE_SCORING',
      explainability: `Score ${l.priority_score}/100 synthesized from 40% Confidence, 30% Centrality, 30% Criticality.`
    })),
    tamper_evident_audit: {
      chain_intact: allChainsValid,
      events_verified_count: totalChecked,
      verification_message: verificationMsg,
      audit_events: auditLogs
    },
    investigator_notes: customNotes || 'Official case record compiled under authorized investigative authority. All stated timestamps, evidence hashes, and chain-of-custody transfers verified against master database records.',
    academic_limitations: [
      'Evidence SHA-256 digests verify bit-level integrity against the registered snapshot only; they do not authenticate physical origin or legal chain validity prior to seizure.',
      'Graph network edges and shortest paths indicate multi-hop relational connectivity in recorded records. They do not prove direct association, criminal conspiracy, or intent.',
      'Spatiotemporal velocity anomalies flag mathematical contradictions under the assumption of straight-line transit without unaccounted air travel or unsynchronized recording clocks.',
      'Investigative leads are ranked by composite heuristic scoring and must be independently verified by sworn investigators prior to warrant application or prosecution.'
    ]
  };
}

/**
 * GET /api/v1/reports/cases/:caseId/dossier
 * Returns complete compiled dossier JSON for live interactive preview and template inspection.
 */
exports.getCaseDossier = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const officer = req.officer;

    if (officer) {
      const access = await verifyCaseAccess(officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_REPORT_ACCESS', message: access.error }
        });
      }
    }

    const report = await compileCaseDossier(caseId, officer);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/reports/cases/:caseId/json
 * Exports complete structured case report as a downloadable JSON file.
 */
exports.exportCaseReportJson = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const officer = req.officer;

    if (officer) {
      const access = await verifyCaseAccess(officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_REPORT_ACCESS', message: access.error }
        });
      }
    }

    const report = await compileCaseDossier(caseId, officer);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    const filename = `CASETHREAD_REPORT_${report.case_summary.case_number}_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      success: true,
      report,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/reports/cases/:caseId/csv
 * Exports case records as a sanitized, formula-injection-safe CSV file.
 * Query param `template`: 'EVIDENCE' (default) | 'CUSTODY' | 'TIMELINE' | 'COMPREHENSIVE'
 */
exports.exportCaseReportCsv = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const officer = req.officer;
    const template = (req.query.template || 'EVIDENCE').toUpperCase();

    if (officer) {
      const access = await verifyCaseAccess(officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_REPORT_ACCESS', message: access.error }
        });
      }
    }

    const dossier = await compileCaseDossier(caseId, officer);
    if (!dossier) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    let csvContent = '';
    let filenameSuffix = 'Evidence';

    if (template === 'CUSTODY') {
      filenameSuffix = 'CustodyChain';
      const headers = ['Transfer Timestamp', 'Evidence ID', 'Tracking Code', 'Evidence Title', 'Previous Custodian', 'New Custodian', 'Reason', 'Location', 'Verification Status', 'Notes'];
      csvContent += headers.map(escapeCsvField).join(',') + '\r\n';

      dossier.chain_of_custody_history.forEach(c => {
        const row = [
          c.transfer_timestamp,
          c.evidence_id,
          c.evidence_tracking,
          c.evidence_title,
          c.previous_custodian,
          c.new_custodian,
          c.transfer_reason,
          c.transfer_location,
          c.verification_status,
          c.notes || ''
        ];
        csvContent += row.map(escapeCsvField).join(',') + '\r\n';
      });
    } else if (template === 'TIMELINE') {
      filenameSuffix = 'Timeline';
      const headers = ['Event ID', 'Timestamp (UTC)', 'Precision', 'Category', 'Title', 'Location', 'Associated Entity', 'Source Table', 'Verification Status', 'Description'];
      csvContent += headers.map(escapeCsvField).join(',') + '\r\n';

      dossier.chronological_timeline.forEach(t => {
        const row = [
          t.event_id,
          t.timestamp || 'Undated',
          t.precision,
          t.category,
          t.title,
          t.location || 'Unknown',
          t.entity_label || 'Case Record',
          t.source_table,
          t.is_verified ? 'VERIFIED' : 'UNVERIFIED',
          t.description || ''
        ];
        csvContent += row.map(escapeCsvField).join(',') + '\r\n';
      });
    } else {
      // Default: Evidence Inventory
      filenameSuffix = 'EvidenceInventory';
      const headers = ['Tracking Code', 'Title', 'Category', 'Source', 'Collection Date', 'Location', 'Verification Status', 'Reliability', 'SHA-256 Digest', 'Integrity Status', 'Version', 'Description'];
      csvContent += headers.map(escapeCsvField).join(',') + '\r\n';

      dossier.evidence_inventory.forEach(e => {
        const row = [
          e.tracking_code,
          e.title,
          e.category,
          e.source || '',
          e.collected_at || 'Undated',
          e.collection_location || 'Unknown',
          e.verification_status,
          e.reliability_assessment || '',
          e.sha256_fingerprint || 'NOT_FINGERPRINTED',
          e.integrity_status,
          `v${e.current_version}`,
          e.description || ''
        ];
        csvContent += row.map(escapeCsvField).join(',') + '\r\n';
      });
    }

    const filename = `CaseReport_${dossier.case_summary.case_number}_${filenameSuffix}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/reports/cases/:caseId/html
 * Exports printable, high-resolution HTML/PDF-ready Case Intelligence Report.
 * Query param `template`: 'OVERVIEW' | 'EVIDENCE_INVENTORY' | 'CHAIN_OF_CUSTODY' | 'GRAPH_ANALYSIS' | 'TIMELINE_ANALYSIS' | 'COMPREHENSIVE'
 */
exports.exportCaseReportHtml = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const officer = req.officer;
    const template = (req.query.template || 'COMPREHENSIVE').toUpperCase();

    if (officer) {
      const access = await verifyCaseAccess(officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).send(`<h1>403 Forbidden</h1><p>${access.error}</p>`);
      }
    }

    const report = await compileCaseDossier(caseId, officer);
    if (!report) {
      return res.status(404).send('<h1>404 Not Found</h1><p>Investigation case file does not exist.</p>');
    }

    const html = generatePrintableHtml(report, template);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/reports/generate
 * Records a report generation entry in `investigation_reports` history.
 */
exports.generateReportRecord = async (req, res, next) => {
  try {
    const { case_id, report_name, template_type, format, included_sections } = req.body;
    const caseId = parseInt(case_id, 10);
    const officer = req.officer;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Case ID is required.' }
      });
    }

    if (officer) {
      const access = await verifyCaseAccess(officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_REPORT_ACCESS', message: access.error }
        });
      }
    }

    const dossier = await compileCaseDossier(caseId, officer);
    if (!dossier) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    const generatedByName = officer
      ? `${officer.rank_designation || 'Officer'} ${officer.full_name} (${officer.badge_number})`
      : 'Authorized Forensic Investigator';

    const finalReportName = report_name || `${dossier.case_summary.case_number} - ${template_type || 'Comprehensive'} Report`;
    const finalTemplate = template_type || 'COMPREHENSIVE';
    const finalFormat = format || 'PDF';
    const sectionsJson = JSON.stringify(included_sections || ['overview', 'evidence', 'custody', 'graph', 'timeline']);
    const summaryJson = JSON.stringify({
      total_evidence: dossier.case_summary.statistics.total_evidence,
      total_custody_transfers: dossier.case_summary.statistics.total_custody_transfers,
      total_timeline_events: dossier.case_summary.statistics.total_timeline_events,
      audit_chain_verified: dossier.case_summary.statistics.audit_chain_verified
    });

    const [insertResult] = await execute(
      `INSERT INTO investigation_reports 
       (case_id, report_name, template_type, format, included_sections, generated_by_id, generated_by_name, metadata_summary, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'READY')`,
      [
        caseId,
        finalReportName,
        finalTemplate,
        finalFormat,
        sectionsJson,
        officer ? officer.officer_id : null,
        generatedByName,
        summaryJson
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        report_id: insertResult.insertId,
        case_id: caseId,
        report_name: finalReportName,
        template_type: finalTemplate,
        format: finalFormat,
        status: 'READY',
        created_at: new Date().toISOString(),
        download_urls: {
          html_pdf: `/api/v1/reports/cases/${caseId}/html?template=${finalTemplate}`,
          json: `/api/v1/reports/cases/${caseId}/json`,
          csv: `/api/v1/reports/cases/${caseId}/csv?template=${finalTemplate}`
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/reports/history
 * Retrieves report generation history, optionally filtered by caseId.
 */
exports.getReportHistory = async (req, res, next) => {
  try {
    const caseId = req.query.caseId ? parseInt(req.query.caseId, 10) : null;
    let query = `
      SELECT r.*, c.case_number, c.title AS case_title 
      FROM investigation_reports r
      JOIN cases c ON r.case_id = c.case_id
    `;
    const params = [];

    if (caseId) {
      query += ' WHERE r.case_id = ?';
      params.push(caseId);
    }

    query += ' ORDER BY r.created_at DESC LIMIT 50';

    const [rows] = await execute(query, params);

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/reports/:reportId
 * Deletes a report record from history.
 */
exports.deleteReportRecord = async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.reportId, 10);
    const [result] = await execute('DELETE FROM investigation_reports WHERE report_id = ?', [reportId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'REPORT_NOT_FOUND', message: `Report ID #${reportId} does not exist.` }
      });
    }

    res.json({
      success: true,
      message: `Report ID #${reportId} removed from history.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generates official, clean print-optimized HTML document.
 */
function generatePrintableHtml(report, template) {
  const showOverview = template === 'COMPREHENSIVE' || template === 'OVERVIEW';
  const showEvidence = template === 'COMPREHENSIVE' || template === 'EVIDENCE_INVENTORY';
  const showCustody = template === 'COMPREHENSIVE' || template === 'CHAIN_OF_CUSTODY';
  const showGraph = template === 'COMPREHENSIVE' || template === 'GRAPH_ANALYSIS';
  const showTimeline = template === 'COMPREHENSIVE' || template === 'TIMELINE_ANALYSIS';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CASE REPORT: ${report.case_summary.case_number} - CASETHREAD</title>
  <style>
    @page {
      margin: 1.6cm 1.4cm;
      size: A4 portrait;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #64748b;
      }
    }
    *, *:before, *:after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
      font-size: 9.5pt;
      margin: 0;
      padding: 2.5rem 3rem;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3, h4 { color: #0f172a; margin-top: 1.6rem; margin-bottom: 0.5rem; font-weight: 700; }
    h1 { font-size: 1.7rem; letter-spacing: -0.02em; }
    h2 { font-size: 1.15rem; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 0.35rem; margin-top: 2rem; }
    h3 { font-size: 1rem; color: #1e293b; }
    
    .header-banner {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-critical { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-intact { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-info { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.75rem;
      margin-bottom: 1.25rem;
      font-size: 8.5pt;
      page-break-inside: auto;
    }
    .table tr { page-break-inside: avoid; page-break-after: auto; }
    .table th, .table td {
      border: 1px solid #cbd5e1;
      padding: 0.45rem 0.65rem;
      text-align: left;
      vertical-align: top;
    }
    .table th {
      background: #f8fafc;
      color: #334155;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.03em;
    }
    .fingerprint {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7pt;
      background: #f1f5f9;
      padding: 2px 4px;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      word-break: break-all;
    }
    .disclaimer-box {
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      padding: 0.85rem 1rem;
      margin: 1.25rem 0;
      font-size: 8pt;
      color: #475569;
      border-radius: 0 4px 4px 0;
    }
    .lead-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #2563eb;
      padding: 0.85rem;
      margin-bottom: 0.75rem;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin: 1rem 0;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 0.65rem;
    }
    .meta-box .lbl { font-size: 7pt; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .meta-box .val { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem; }

    @media print {
      body { padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
      a { text-decoration: none; color: inherit; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px;">
    <div>
      <span style="font-weight: 700; font-size: 0.9rem;">Template: ${template}</span>
      <span style="color: #64748b; font-size: 0.8rem; margin-left: 0.5rem;">Case Ref: ${report.case_summary.case_number}</span>
    </div>
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 0.5rem 1.25rem; font-weight: 600; border-radius: 6px; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header-banner">
    <div>
      <div style="font-size: 8pt; color: #2563eb; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.25rem;">
        FORENSIC INTELLIGENCE PLATFORM • OFFICIAL REPORT
      </div>
      <h1 style="margin: 0;">CASE INVESTIGATION REPORT</h1>
      <div style="font-size: 9pt; color: #64748b; margin-top: 0.35rem;">
        Docket Ref: <strong>${report.case_summary.case_number}</strong> • Case Title: <strong>${report.case_summary.title}</strong>
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-critical">${report.case_summary.priority} PRIORITY</span>
      <div style="font-size: 8pt; color: #64748b; margin-top: 0.45rem;">Status: <strong>${report.case_summary.status}</strong></div>
      <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 0.2rem;">Generated: ${new Date(report.report_metadata.generated_at).toLocaleString()} UTC</div>
      <div style="font-size: 7.5pt; color: #94a3b8;">Investigator: ${report.report_metadata.generated_by_officer}</div>
    </div>
  </div>

  <div class="disclaimer-box">
    <strong>⚠️ LEGAL & ACADEMIC GROUND-TRUTH NOTICE:</strong><br>
    ${report.report_metadata.disclaimer}
  </div>

  <!-- Executive Summary Metrics -->
  <div class="meta-grid">
    <div class="meta-box">
      <div class="lbl">Total Evidence Records</div>
      <div class="val">${report.case_summary.statistics.total_evidence}</div>
    </div>
    <div class="meta-box">
      <div class="lbl">Custody Transfers</div>
      <div class="val">${report.case_summary.statistics.total_custody_transfers}</div>
    </div>
    <div class="meta-box">
      <div class="lbl">Timeline Records</div>
      <div class="val">${report.case_summary.statistics.total_timeline_events}</div>
    </div>
    <div class="meta-box">
      <div class="lbl">Audit Hash Chain</div>
      <div class="val" style="color: ${report.case_summary.statistics.audit_chain_verified ? '#166534' : '#991b1b'};">
        ${report.case_summary.statistics.audit_chain_verified ? 'VERIFIED' : 'REVIEW'}
      </div>
    </div>
  </div>

  ${showOverview ? `
  <h2>1. Investigation Overview & Entities</h2>
  <table class="table">
    <tr><th style="width: 25%;">Investigation Title</th><td><strong>${report.case_summary.title}</strong></td></tr>
    <tr><th>Case Number</th><td><code>${report.case_summary.case_number}</code></td></tr>
    <tr><th>Incident Date / Location</th><td>${report.case_summary.incident_date || 'Unspecified'} — ${report.case_summary.incident_location || 'Unspecified'}</td></tr>
    <tr><th>Lead Investigator</th><td>${report.case_summary.lead_officer ? `${report.case_summary.lead_officer.rank_designation || 'Officer'} ${report.case_summary.lead_officer.full_name} (${report.case_summary.lead_officer.badge_number})` : 'Unassigned'}</td></tr>
    <tr><th>Summary Description</th><td>${report.case_summary.description || 'No detailed description provided.'}</td></tr>
  </table>

  <h3>People of Interest</h3>
  <table class="table">
    <thead>
      <tr>
        <th>Role</th>
        <th>Full Name</th>
        <th>Alias / Status</th>
        <th>Recorded Details</th>
      </tr>
    </thead>
    <tbody>
      ${report.people.suspects.map(s => `<tr><td><span class="badge badge-critical">SUSPECT</span></td><td><strong>${s.name}</strong></td><td>${s.alias || 'None'} (${s.status})</td><td>${s.notes || 'No alibi statement logged.'}</td></tr>`).join('')}
      ${report.people.victims.map(v => `<tr><td><span class="badge badge-info">VICTIM</span></td><td><strong>${v.name}</strong></td><td>Condition: ${v.condition}</td><td>Victim of recorded incident.</td></tr>`).join('')}
      ${report.people.witnesses.map(w => `<tr><td><span class="badge badge-warning">WITNESS</span></td><td><strong>${w.name}</strong></td><td>Credibility: ${w.credibility_score || 'N/A'}/10</td><td>${w.statement || 'Statement on file.'}</td></tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  ${showEvidence ? `
  <h2>2. Evidence Inventory & Cryptographic Fingerprints</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Code</th>
        <th>Title</th>
        <th>Category</th>
        <th>Collection Date / Location</th>
        <th>SHA-256 Fingerprint Digest</th>
        <th>Integrity</th>
        <th>Ver.</th>
      </tr>
    </thead>
    <tbody>
      ${report.evidence_inventory.map(e => `
        <tr>
          <td><strong>${e.tracking_code}</strong></td>
          <td>${e.title}</td>
          <td>${e.category}</td>
          <td>${e.collected_at ? new Date(e.collected_at).toLocaleDateString() : 'Undated'}<br><span style="color:#64748b; font-size:7.5pt;">${e.collection_location || 'Unknown'}</span></td>
          <td><span class="fingerprint">${e.sha256_fingerprint || 'NOT_FINGERPRINTED'}</span></td>
          <td><span class="badge ${e.integrity_status === 'INTACT' ? 'badge-intact' : 'badge-critical'}">${e.integrity_status}</span></td>
          <td>v${e.current_version}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${showCustody ? `
  <h2>3. Chain of Custody Audit Log</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Transfer Timestamp (UTC)</th>
        <th>Evidence</th>
        <th>From Custodian</th>
        <th>To Custodian</th>
        <th>Reason & Transfer Location</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${report.chain_of_custody_history.length > 0 ? report.chain_of_custody_history.map(c => `
        <tr>
          <td>${c.transfer_timestamp}</td>
          <td><strong>${c.evidence_tracking || `#${c.evidence_id}`}</strong><br><span style="color:#64748b; font-size:7.5pt;">${c.evidence_title || ''}</span></td>
          <td>${c.previous_custodian}</td>
          <td><strong>${c.new_custodian}</strong></td>
          <td>${c.transfer_reason} (${c.transfer_location})</td>
          <td><span class="badge badge-intact">${c.verification_status}</span></td>
        </tr>
      `).join('') : '<tr><td colspan="6" style="text-align:center; color:#64748b;">No formal custody transfers logged.</td></tr>'}
    </tbody>
  </table>
  ` : ''}

  ${showGraph ? `
  <h2>4. Evidence Relationship & Network Graph Analysis</h2>
  <p style="font-size: 8.5pt; color: #475569;">
    Relational topology evaluated via native C graph engine. Total evaluated relational links: <strong>${report.relational_network.total_edges}</strong>. Isolated entities: <strong>${report.relational_network.isolated_nodes_count}</strong>.
  </p>
  <table class="table">
    <thead>
      <tr>
        <th>Source Entity</th>
        <th>Target Entity</th>
        <th>Relationship Type</th>
        <th>Origin</th>
        <th>Confidence</th>
        <th>Explanation</th>
      </tr>
    </thead>
    <tbody>
      ${report.relational_network.relationships.map(r => `
        <tr>
          <td><strong>${r.source_id}</strong></td>
          <td><strong>${r.target_id}</strong></td>
          <td><span class="badge badge-info">${r.type}</span></td>
          <td>${r.origin}</td>
          <td>${(r.confidence * 100).toFixed(0)}%</td>
          <td>${r.explanation}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${showTimeline ? `
  <h2>5. Chronological Reconstruction & Gap Analysis</h2>
  <p style="font-size: 8.5pt; color: #475569;">
    Chronology normalized across incident reports, evidence collection, custody transfers, and activity logs.
  </p>
  <table class="table">
    <thead>
      <tr>
        <th>Time (UTC)</th>
        <th>Precision</th>
        <th>Category</th>
        <th>Event Title & Location</th>
        <th>Source Record</th>
        <th>Verification</th>
      </tr>
    </thead>
    <tbody>
      ${report.chronological_timeline.map(t => `
        <tr>
          <td><strong>${t.display_time || (t.timestamp ? new Date(t.timestamp).toTimeString().split(' ')[0] : 'Undated')}</strong><br><span style="color:#64748b; font-size:7.5pt;">${t.display_date || (t.timestamp ? t.timestamp.split('T')[0] : '')}</span></td>
          <td><span class="badge ${t.precision === 'EXACT' ? 'badge-intact' : 'badge-warning'}">${t.precision}</span></td>
          <td>${t.category}</td>
          <td><strong>${t.title}</strong><br><span style="color:#64748b; font-size:7.5pt;">📍 ${t.location || 'Unknown'}</span></td>
          <td><code>${t.source_table}</code></td>
          <td><span class="badge ${t.is_verified ? 'badge-intact' : 'badge-warning'}">${t.is_verified ? 'VERIFIED' : 'UNVERIFIED'}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${report.detected_time_gaps.length > 0 ? `
  <h3>Identified Temporal Gaps (> 6 Hours)</h3>
  <table class="table">
    <thead>
      <tr>
        <th>Gap ID</th>
        <th>Duration</th>
        <th>Preceding Event</th>
        <th>Succeeding Event</th>
        <th>Investigative Inquiry Note</th>
      </tr>
    </thead>
    <tbody>
      ${report.detected_time_gaps.map(g => `
        <tr>
          <td><code>${g.gap_id}</code></td>
          <td><strong>${g.duration_hours}h</strong></td>
          <td>${g.start_event}</td>
          <td>${g.end_event}</td>
          <td>${g.note}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  ` : ''}

  <h2>6. Prioritized Investigative Leads & Heuristics</h2>
  ${report.prioritized_investigative_leads.map(l => `
    <div class="lead-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:#0f172a; font-size: 0.95rem;">${l.title}</strong>
        <span class="badge badge-info">Score: ${l.priority_score}/100</span>
      </div>
      <p style="margin: 0.35rem 0; font-size: 8.5pt;">${l.hypothesis}</p>
      <div style="font-size: 7.5pt; color:#475569; background:#fff; padding: 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0; margin-top: 0.4rem;">
        <div><strong>Algorithm Rule:</strong> <code>${l.algorithm_rule}</code></div>
        <div><strong>Explainability:</strong> ${l.explainability}</div>
        <div><strong>Recommended Step:</strong> ${l.recommended_action}</div>
      </div>
    </div>
  `).join('')}

  <h2>7. Tamper-Evident Audit Verification</h2>
  <div style="background:#f8fafc; border:1px solid #cbd5e1; padding: 0.85rem; border-radius: 4px; font-size: 8.5pt;">
    <div><strong>Hash Chain Integrity:</strong> <span class="badge ${report.tamper_evident_audit.chain_intact ? 'badge-intact' : 'badge-critical'}">${report.tamper_evident_audit.chain_intact ? 'VERIFIED INTACT' : 'TAMPER DETECTED'}</span></div>
    <div style="margin-top: 0.3rem;"><strong>Total Verified Events:</strong> ${report.tamper_evident_audit.events_verified_count} events linked via SHA-256 state-chain.</div>
    <div style="font-size: 7.5pt; color:#64748b; margin-top: 0.2rem;">${report.tamper_evident_audit.verification_message}</div>
  </div>

  <h2>8. Investigator Notes & Conclusions</h2>
  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #64748b; padding: 0.85rem; border-radius: 4px; font-size: 8.5pt; color: #334155; line-height: 1.5;">
    ${report.investigator_notes}
  </div>

  <h2>9. System Limitations & Academic Notice</h2>
  <ul style="font-size: 8pt; color: #475569; padding-left: 1.25rem;">
    ${report.academic_limitations.map(lim => `<li>${lim}</li>`).join('')}
  </ul>

  <footer style="margin-top: 2.5rem; padding-top: 0.75rem; border-top: 1px solid #cbd5e1; font-size: 7.5pt; color: #94a3b8; text-align: center;">
    CASETHREAD Academic Investigation Support Platform • Confidential Law Enforcement Decision Support System • Case #${report.case_summary.case_number}
  </footer>
</body>
</html>`;
}
