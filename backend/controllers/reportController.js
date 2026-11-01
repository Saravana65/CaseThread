/**
 * @file reportController.js
 * @description Comprehensive forensic investigation dossier export (JSON & Printable HTML/PDF).
 * @project CASETHREAD - Phase 7 Forensic Evidence Integrity
 */

const { execute } = require('../database/connection');
const cryptoService = require('../services/cryptoService');

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
 * Gathers complete case investigation payload for report generation.
 */
async function compileCaseDossier(caseId, officer) {
  const [cases] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
  if (!cases || cases.length === 0) return null;
  const currentCase = cases[0];

  const [leadOfficer] = await execute('SELECT full_name, badge_number, rank_designation, department FROM officers WHERE officer_id = ?', [currentCase.lead_officer_id]);
  const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
  const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [caseId]);
  const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [caseId]);
  const [evidence] = await execute('SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0 ORDER BY collected_at ASC, evidence_id ASC', [caseId]);
  const [relationships] = await execute('SELECT * FROM evidence_relationships WHERE case_id = ?', [caseId]);
  const [timelines] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [caseId]);
  const [leads] = await execute('SELECT * FROM investigation_leads WHERE case_id = ? ORDER BY priority_score DESC', [caseId]);
  const [custodyEvents] = await execute('SELECT * FROM evidence_custody_events WHERE case_id = ? ORDER BY transfer_timestamp DESC', [caseId]);
  const [verifications] = await execute('SELECT * FROM evidence_integrity_verifications WHERE case_id = ? ORDER BY verified_at DESC', [caseId]);
  const [auditLogs] = await execute('SELECT * FROM evidence_audit_logs WHERE case_id = ? ORDER BY created_at ASC, audit_id ASC', [caseId]);

  // Group audit logs by evidence_id and verify each cryptographic hash chain independently
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
      verificationMsg = `Tampering detected in Evidence ID ${evId}: ${chainRes.error}`;
      break;
    }
  }

  const auditChainVerification = {
    is_valid: allChainsValid,
    events_checked: totalChecked,
    message: verificationMsg
  };

  return {
    report_metadata: {
      generated_at: new Date().toISOString(),
      generated_by_officer: officer ? `${officer.rank_designation || 'Officer'} ${officer.full_name} (${officer.badge_number})` : 'System Administrator',
      classification: 'LAW ENFORCEMENT SENSITIVE // FORENSIC DECISION SUPPORT',
      system_version: 'CASETHREAD v1.0.0 (Phase 7 Forensic Integrity)',
      disclaimer: 'ACADEMIC INVESTIGATION SUPPORT SYSTEM NOTICE: This automated report is generated as an investigative decision-support tool. Algorithmic gap discoveries, graph paths, and heuristic lead scores do NOT constitute legal proof, judicial certification, or established findings of guilt.'
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
      lead_officer: leadOfficer && leadOfficer[0] ? {
        officer_id: leadOfficer[0].officer_id,
        full_name: leadOfficer[0].full_name,
        badge_number: leadOfficer[0].badge_number,
        rank_designation: leadOfficer[0].rank_designation,
        department: leadOfficer[0].department
      } : null
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
    chain_of_custody_history: custodyEvents,
    integrity_verifications: verifications,
    relational_network: relationships,
    chronological_timeline: timelines,
    prioritized_investigative_leads: leads.map(l => ({
      lead_id: l.lead_id,
      title: l.title,
      hypothesis: l.hypothesis,
      recommended_action: l.recommended_action,
      priority_score: l.priority_score,
      lead_status: l.lead_status,
      source_gap_type: l.source_gap_type,
      algorithm_rule: 'BINARY_MAX_HEAP_COMPOSITE_SCORING',
      explainability: `Heuristic score: ${l.priority_score}/100. Synthesized from 40% Confidence, 30% Centrality, 30% Criticality.`
    })),
    tamper_evident_audit: {
      chain_intact: auditChainVerification.is_valid,
      events_verified_count: auditChainVerification.events_checked,
      verification_message: auditChainVerification.message,
      audit_events: auditLogs
    },
    academic_limitations: [
      'Evidence fingerprints verify bit-level integrity against the registered snapshot only; they do not verify authentic real-world physical origin or legal chain-of-custody validity prior to registration.',
      'Graph associative chains and shortest paths indicate multi-hop relational connectivity in recorded records. They do not prove direct association, criminal conspiracy, or intent.',
      'Spatiotemporal velocity anomalies flag mathematical contradictions under the assumption of straight-line transit without unaccounted air travel or unsynchronized recording clocks.',
      'Investigative leads are ranked by composite heuristic scoring and must be independently verified by sworn investigators prior to warrant application or prosecution.'
    ]
  };
}

/**
 * Exports complete structured case report as JSON.
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
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="CaseReport_${report.case_summary.case_number}.json"`);
    res.json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exports formatted, printable HTML/PDF-ready Case Intelligence Report.
 */
exports.exportCaseReportHtml = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const officer = req.officer;

    if (officer) {
      const access = await verifyCaseAccess(officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).send(`<h1>403 Forbidden</h1><p>${access.error}</p>`);
      }
    }

    const report = await compileCaseDossier(caseId, officer);
    if (!report) {
      return res.status(404).send('<h1>404 Not Found</h1><p>Case not found.</p>');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CASE REPORT: ${report.case_summary.case_number} - CASETHREAD</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #1e293b; line-height: 1.5; padding: 2rem; max-width: 1000px; margin: 0 auto; background: #fff; }
    h1, h2, h3 { color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .header-banner { border-bottom: 3px solid #e11d48; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-intact { background: #dcfce7; color: #166534; }
    .badge-mismatch { background: #fee2e2; color: #b91c1c; }
    .table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 0.6rem; text-align: left; }
    .table th { background: #f1f5f9; font-weight: 600; }
    .fingerprint { font-family: monospace; font-size: 0.75rem; background: #f8fafc; padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 3px; word-break: break-all; }
    .disclaimer-box { background: #fff1f2; border-left: 4px solid #e11d48; padding: 1rem; margin: 2rem 0; font-size: 0.8rem; color: #881337; }
    .lead-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 1rem; border-radius: 4px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 1rem; text-align: right;">
    <button onclick="window.print()" style="background: #e11d48; color: #fff; border: none; padding: 0.6rem 1.2rem; font-weight: bold; border-radius: 4px; cursor: pointer;">🖨️ Print to PDF / Paper</button>
  </div>

  <div class="header-banner">
    <div>
      <h1 style="margin: 0; font-size: 1.8rem; letter-spacing: -0.5px;">CASETHREAD FORENSIC DOSSIER</h1>
      <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.3rem;">Digital Forensic Decision-Support System • Case Ref: <strong>${report.case_summary.case_number}</strong></div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-critical">${report.case_summary.priority} PRIORITY</span>
      <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.4rem;">Status: <strong>${report.case_summary.status}</strong></div>
      <div style="font-size: 0.75rem; color: #64748b;">Generated: ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div class="disclaimer-box">
    <strong>⚠️ FORENSIC INTEGRITY NOTICE & LEGAL DISCLAIMER:</strong><br>
    ${report.report_metadata.disclaimer}
  </div>

  <h2>1. Case Overview</h2>
  <table class="table">
    <tr><th style="width: 25%;">Case Title</th><td>${report.case_summary.title}</td></tr>
    <tr><th>Incident Date</th><td>${report.case_summary.incident_date}</td></tr>
    <tr><th>Incident Location</th><td>${report.case_summary.incident_location}</td></tr>
    <tr><th>Lead Investigator</th><td>${report.case_summary.lead_officer ? report.case_summary.lead_officer.full_name + ' (' + report.case_summary.lead_officer.badge_number + ')' : 'Unassigned'}</td></tr>
    <tr><th>Description</th><td>${report.case_summary.description}</td></tr>
  </table>

  <h2>2. Evidence Inventory & Cryptographic Fingerprints</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Code</th>
        <th>Title</th>
        <th>Category</th>
        <th>Type</th>
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
          <td>${e.fingerprint_type}</td>
          <td><span class="fingerprint">${e.sha256_fingerprint || 'NOT_FINGERPRINTED'}</span></td>
          <td><span class="badge ${e.integrity_status === 'INTACT' ? 'badge-intact' : 'badge-mismatch'}">${e.integrity_status}</span></td>
          <td>v${e.current_version}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>3. Chain of Custody Event Log</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Transfer Time</th>
        <th>Evidence</th>
        <th>From</th>
        <th>To</th>
        <th>Reason & Location</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${report.chain_of_custody_history.length > 0 ? report.chain_of_custody_history.map(c => `
        <tr>
          <td>${c.transfer_timestamp}</td>
          <td>#${c.evidence_id}</td>
          <td>${c.previous_custodian}</td>
          <td><strong>${c.new_custodian}</strong></td>
          <td>${c.transfer_reason} (${c.transfer_location})</td>
          <td><span class="badge badge-intact">${c.verification_status}</span></td>
        </tr>
      `).join('') : '<tr><td colspan="6" style="text-align:center; color:#64748b;">No formal transfers recorded.</td></tr>'}
    </tbody>
  </table>

  <h2>4. Explainable Algorithmic Leads & Intelligence Findings</h2>
  ${report.prioritized_investigative_leads.map(l => `
    <div class="lead-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:#0f172a; font-size: 1rem;">${l.title}</strong>
        <span class="badge" style="background:#e0f2fe; color:#0369a1;">Score: ${l.priority_score}/100</span>
      </div>
      <p style="margin: 0.4rem 0; font-size: 0.85rem;">${l.hypothesis}</p>
      <div style="font-size: 0.75rem; color:#475569; background:#fff; padding: 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0; margin-top: 0.5rem;">
        <div><strong>Rule:</strong> <code>${l.algorithm_rule}</code></div>
        <div><strong>Explainability:</strong> ${l.explainability}</div>
        <div><strong>Recommended Step:</strong> ${l.recommended_action}</div>
      </div>
    </div>
  `).join('')}

  <h2>5. Tamper-Evident Audit Verification</h2>
  <div style="background:#f8fafc; border:1px solid #cbd5e1; padding: 1rem; border-radius: 4px; font-size: 0.85rem;">
    <div><strong>Hash Chain Integrity:</strong> <span class="badge ${report.tamper_evident_audit.chain_intact ? 'badge-intact' : 'badge-mismatch'}">${report.tamper_evident_audit.chain_intact ? 'VERIFIED INTACT' : 'TAMPER DETECTED'}</span></div>
    <div style="margin-top: 0.3rem;"><strong>Total Verified Events:</strong> ${report.tamper_evident_audit.events_verified_count} events linked via SHA-256 state-chain.</div>
    <div style="font-size: 0.75rem; color:#64748b; margin-top: 0.3rem;">${report.tamper_evident_audit.verification_message}</div>
  </div>

  <h2>6. System Limitations & Academic Notice</h2>
  <ul style="font-size: 0.8rem; color: #475569;">
    ${report.academic_limitations.map(lim => `<li>${lim}</li>`).join('')}
  </ul>

  <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; font-size: 0.75rem; color: #94a3b8; text-align: center;">
    CASETHREAD Academic Investigation Platform • Confidential Law Enforcement Decision Support System • Not for Unauthorized Public Distribution
  </footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};
