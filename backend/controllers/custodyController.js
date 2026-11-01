/**
 * @file custodyController.js
 * @description Auditable physical & digital chain-of-custody transfer workflow and historical tracking.
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
      error: 'Access denied: You are not authorized to perform custody operations on another officer\'s case file.'
    };
  }
  return { authorized: true };
}

/**
 * Records a new chain-of-custody transfer event.
 */
exports.transferCustody = async (req, res, next) => {
  try {
    const {
      evidence_id,
      case_id,
      previous_custodian,
      new_custodian,
      transfer_timestamp,
      transfer_reason,
      transfer_location,
      transfer_notes,
      verification_status
    } = req.body;

    const officer = req.officer || { officer_id: 1, role: 'LEAD_OFFICER' };

    // 1. Validate mandatory fields
    if (!evidence_id || !case_id || !previous_custodian || !new_custodian || !transfer_reason || !transfer_location) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'All custody transfer fields (evidence_id, case_id, previous_custodian, new_custodian, transfer_reason, transfer_location) are required.'
        }
      });
    }

    // 2. Enforce case-level access isolation
    const access = await verifyCaseAccess(officer, case_id);
    if (!access.authorized) {
      return res.status(access.status).json({
        success: false,
        error: { code: 'FORBIDDEN_CUSTODY_ACCESS', message: access.error }
      });
    }

    // 3. Verify evidence existence and case ownership
    const [evRows] = await execute('SELECT * FROM evidence WHERE evidence_id = ? AND case_id = ?', [evidence_id, case_id]);
    if (!evRows || evRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ID ${evidence_id} not found in Case ${case_id}.` }
      });
    }
    const evidenceItem = evRows[0];

    const timestamp = transfer_timestamp ? new Date(transfer_timestamp).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
    const vStatus = verification_status || 'VERIFIED';
    const relatedFp = evidenceItem.sha256_fingerprint || null;

    // 4. Insert into immutable custody events table
    const [result] = await execute(
      `INSERT INTO evidence_custody_events 
       (evidence_id, case_id, previous_custodian, new_custodian, transfer_timestamp, 
        transfer_reason, transfer_location, transfer_notes, transferring_officer_id, 
        verification_status, related_fingerprint, is_successful, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidence_id,
        case_id,
        previous_custodian,
        new_custodian,
        timestamp,
        transfer_reason,
        transfer_location,
        transfer_notes || null,
        officer.officer_id,
        vStatus,
        relatedFp,
        1,
        null
      ]
    );

    const custodyEventId = result.insertId;

    // 5. Append to cryptographically chained audit log
    const [priorLogs] = await execute(
      'SELECT current_event_hash FROM evidence_audit_logs WHERE evidence_id = ? ORDER BY created_at ASC, audit_id ASC',
      [evidence_id]
    );
    const prevEventHash = (priorLogs && priorLogs.length > 0)
      ? priorLogs[priorLogs.length - 1].current_event_hash
      : cryptoService.GENESIS_HASH;

    const statePayload = {
      custody_event_id: custodyEventId,
      previous_custodian,
      new_custodian,
      transfer_reason,
      location: transfer_location
    };
    const stateHash = cryptoService.generateSha256(cryptoService.canonicalize(statePayload));

    const eventTime = new Date().toISOString();
    const eventHash = cryptoService.calculateEventHash({
      previous_event_hash: prevEventHash,
      evidence_id,
      case_id,
      officer_id: officer.officer_id,
      action_type: 'CUSTODY_TRANSFERRED',
      created_at: eventTime,
      previous_state_hash: '',
      current_state_hash: stateHash,
      reason_for_change: transfer_reason
    });

    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, 
        previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, 
        canonical_payload, reason_for_change, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidence_id,
        case_id,
        officer.officer_id,
        'CUSTODY_TRANSFERRED',
        JSON.stringify({ custodian: previous_custodian }),
        JSON.stringify({ custodian: new_custodian, transfer_reason, location: transfer_location }),
        '',
        stateHash,
        prevEventHash,
        eventHash,
        cryptoService.canonicalize(statePayload),
        transfer_reason,
        req.ip || '127.0.0.1',
        eventTime
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        custody_event_id: custodyEventId,
        evidence_id,
        case_id,
        previous_custodian,
        new_custodian,
        transfer_timestamp: timestamp,
        transfer_reason,
        transfer_location,
        transferring_officer_id: officer.officer_id,
        verification_status: vStatus,
        related_fingerprint: relatedFp,
        is_successful: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists chronological chain-of-custody transfer history for an evidence item or entire case.
 */
exports.getCustodyHistory = async (req, res, next) => {
  try {
    const evidenceId = req.params.evidenceId ? parseInt(req.params.evidenceId, 10) : null;
    const caseId = req.query.case_id ? parseInt(req.query.case_id, 10) : null;

    if (!evidenceId && !caseId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Either evidence ID parameter or case_id query is required.' }
      });
    }

    // Determine target case ID for access check
    let targetCaseId = caseId;
    if (evidenceId && !targetCaseId) {
      const [evRows] = await execute('SELECT case_id FROM evidence WHERE evidence_id = ?', [evidenceId]);
      if (!evRows || evRows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ID ${evidenceId} not found.` }
        });
      }
      targetCaseId = evRows[0].case_id;
    }

    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, targetCaseId);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CUSTODY_ACCESS', message: access.error }
        });
      }
    }

    let rows;
    if (evidenceId) {
      [rows] = await execute(
        `SELECT c.*, o.full_name AS transferring_officer_name, o.badge_number AS transferring_officer_badge 
         FROM evidence_custody_events c
         LEFT JOIN officers o ON c.transferring_officer_id = o.officer_id
         WHERE c.evidence_id = ?
         ORDER BY c.transfer_timestamp DESC, c.created_at DESC`,
        [evidenceId]
      );
    } else {
      [rows] = await execute(
        `SELECT c.*, o.full_name AS transferring_officer_name, o.badge_number AS transferring_officer_badge, e.title AS evidence_title, e.tracking_code 
         FROM evidence_custody_events c
         LEFT JOIN officers o ON c.transferring_officer_id = o.officer_id
         LEFT JOIN evidence e ON c.evidence_id = e.evidence_id
         WHERE c.case_id = ?
         ORDER BY c.transfer_timestamp DESC, c.created_at DESC`,
        [caseId]
      );
    }

    res.json({
      success: true,
      total_events: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};
