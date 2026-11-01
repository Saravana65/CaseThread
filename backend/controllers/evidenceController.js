/**
 * @file evidenceController.js
 * @description Evidence lifecycle management, cryptographic fingerprinting, versioning, provenance tracking, and tamper-evident audit logging.
 * @project CASETHREAD - Phase 7 Forensic Evidence Integrity
 */

const fs = require('fs');
const { execute } = require('../database/connection');
const cryptoService = require('../services/cryptoService');
const vaultService = require('../services/vaultService');

/**
 * Validates officer case access permissions.
 */
async function verifyCaseAccess(officer, caseId) {
  if (!officer) return { authorized: true }; // Default internal / permissive fallback if unauthenticated test
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
      error: 'Access denied: You are not authorized to modify or verify evidence in another officer\'s case file.'
    };
  }
  return { authorized: true };
}

/**
 * Adds a new evidence record with SHA-256 fingerprinting, Version 1 baseline, and cryptographically chained audit logging.
 */
exports.addEvidence = async (req, res, next) => {
  try {
    const {
      case_id,
      tracking_code,
      title,
      category,
      description,
      collection_location,
      collected_at,
      source,
      related_entity_ids,
      verification_status,
      reliability_assessment,
      file_reference,
      chain_of_custody_notes,
      metadata_json,
      content_payload,
      fingerprint_type
    } = req.body;

    const officer_id = req.officer ? req.officer.officer_id : 1;

    // 2. Check if tracking code is already used
    const [existing] = await execute('SELECT evidence_id FROM evidence WHERE tracking_code = ?', [tracking_code]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_TRACKING_CODE', message: `Tracking code ${tracking_code} is already registered.` }
      });
    }

    const verification = verification_status || 'UNVERIFIED_OBSERVATION';
    const reliability = reliability_assessment || 'MEDIUM';
    const relatedEntitiesStr = related_entity_ids ? JSON.stringify(related_entity_ids) : null;
    const metadataStr = metadata_json ? (typeof metadata_json === 'string' ? metadata_json : JSON.stringify(metadata_json)) : null;

    // 3. Cryptographic Fingerprinting (Stage 1)
    let sha256Fingerprint;
    let effectiveFpType;
    const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (content_payload !== undefined && content_payload !== null && content_payload !== '') {
      sha256Fingerprint = cryptoService.generateSha256(content_payload);
      effectiveFpType = fingerprint_type === 'METADATA_CANONICAL' ? 'METADATA_CANONICAL' : 'ORIGINAL_FILE';
    } else {
      const canonicalMeta = {
        tracking_code,
        title,
        category,
        description,
        source,
        collection_location: collection_location || null,
        metadata: metadata_json || null
      };
      sha256Fingerprint = cryptoService.generateMetadataFingerprint(canonicalMeta);
      effectiveFpType = 'METADATA_CANONICAL';
    }

    // 4. Insert Master Evidence Record
    const [result] = await execute(
      `INSERT INTO evidence 
       (case_id, tracking_code, title, category, description, collection_location, collected_at, 
        source, related_entity_ids, verification_status, reliability_assessment, file_reference, 
        entered_by_officer_id, chain_of_custody_notes, metadata_json, content_payload,
        sha256_fingerprint, fingerprint_algorithm, fingerprint_type, fingerprinted_at,
        integrity_status, current_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_id,
        tracking_code,
        title,
        category,
        description,
        collection_location || null,
        collected_at || null,
        source,
        relatedEntitiesStr,
        verification,
        reliability,
        file_reference || null,
        officer_id,
        chain_of_custody_notes || null,
        metadataStr,
        content_payload || null,
        sha256Fingerprint,
        'SHA-256',
        effectiveFpType,
        nowIso,
        'INTACT',
        1
      ]
    );

    const evidenceId = result.insertId;

    // 5. Create Version 1 in evidence_versions (Stage 4)
    await execute(
      `INSERT INTO evidence_versions 
       (evidence_id, case_id, version_number, title, category, description, collection_location, 
        collected_at, source, verification_status, reliability_assessment, content_payload, 
        metadata_json, version_fingerprint, fingerprint_type, modified_by_officer_id, reason_for_modification)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Initial evidence baseline ingestion')`,
      [
        evidenceId,
        case_id,
        title,
        category,
        description,
        collection_location || null,
        collected_at || null,
        source,
        verification,
        reliability,
        content_payload || null,
        metadataStr,
        sha256Fingerprint,
        effectiveFpType,
        officer_id
      ]
    );

    // 6. Append to Cryptographically Chained Audit Ledger (Stage 3)
    const [priorLogs] = await execute(
      'SELECT current_event_hash FROM evidence_audit_logs WHERE evidence_id = ? ORDER BY created_at ASC, audit_id ASC',
      [evidenceId]
    );
    const prevEventHash = (priorLogs && priorLogs.length > 0)
      ? priorLogs[priorLogs.length - 1].current_event_hash
      : cryptoService.GENESIS_HASH;

    const newSnapshot = {
      tracking_code,
      title,
      category,
      verification,
      reliability,
      source,
      fingerprint: sha256Fingerprint
    };
    const newStateHash = cryptoService.generateSha256(cryptoService.canonicalize(newSnapshot));

    const eventTime = new Date().toISOString();
    const eventHash = cryptoService.calculateEventHash({
      previous_event_hash: prevEventHash,
      evidence_id: evidenceId,
      case_id,
      officer_id,
      action_type: 'CREATED',
      created_at: eventTime,
      previous_state_hash: '',
      current_state_hash: newStateHash,
      reason_for_change: 'Initial forensic evidence ingestion'
    });

    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, 
        previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, 
        canonical_payload, reason_for_change, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        case_id,
        officer_id,
        'CREATED',
        null,
        JSON.stringify(newSnapshot),
        '',
        newStateHash,
        prevEventHash,
        eventHash,
        cryptoService.canonicalize(newSnapshot),
        'Initial forensic evidence ingestion',
        req.ip || '127.0.0.1',
        eventTime
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        evidence_id: evidenceId,
        tracking_code,
        title,
        category,
        source,
        verification_status: verification,
        reliability_assessment: reliability,
        sha256_fingerprint: sha256Fingerprint,
        fingerprint_algorithm: 'SHA-256',
        fingerprint_type: effectiveFpType,
        integrity_status: 'INTACT',
        current_version: 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all active evidence records for a specific case with cryptographic integrity status.
 */
exports.listEvidenceByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);

    const [rows] = await execute(
      `SELECT e.*, o.full_name AS entered_by_officer_name, o.badge_number AS entered_by_badge
       FROM evidence e
       LEFT JOIN officers o ON e.entered_by_officer_id = o.officer_id
       WHERE e.case_id = ? AND e.is_archived = 0
       ORDER BY e.collected_at DESC, e.created_at DESC`,
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

/**
 * Retrieves a single evidence item with its complete audit trail and version info.
 */
exports.getEvidenceById = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);

    const [rows] = await execute(
      `SELECT e.*, o.full_name AS entered_by_officer_name, o.badge_number AS entered_by_badge
       FROM evidence e
       LEFT JOIN officers o ON e.entered_by_officer_id = o.officer_id
       WHERE e.evidence_id = ?`,
      [evidenceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ID ${evidenceId} does not exist.` }
      });
    }

    const evidenceItem = rows[0];

    // Fetch audit history
    const [auditLogs] = await execute(
      `SELECT a.*, o.full_name AS officer_name, o.badge_number AS officer_badge
       FROM evidence_audit_logs a
       LEFT JOIN officers o ON a.officer_id = o.officer_id
       WHERE a.evidence_id = ?
       ORDER BY a.created_at DESC, a.audit_id DESC`,
      [evidenceId]
    );

    res.json({
      success: true,
      data: {
        ...evidenceItem,
        audit_history: auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates evidence metadata, creates a new version record, and persists a cryptographically chained audit entry.
 */
exports.updateEvidence = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);
    const {
      title,
      description,
      verification_status,
      reliability_assessment,
      metadata_json,
      content_payload,
      reason_for_change
    } = req.body;

    const officer_id = req.officer ? req.officer.officer_id : 1;

    const [existing] = await execute('SELECT * FROM evidence WHERE evidence_id = ?', [evidenceId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ID ${evidenceId} does not exist.` }
      });
    }

    const prev = existing[0];

    const newTitle = title || prev.title;
    const newDesc = description || prev.description;
    const newVerification = verification_status || prev.verification_status;
    const newReliability = reliability_assessment || prev.reliability_assessment;
    const newMetaStr = metadata_json !== undefined ? (typeof metadata_json === 'string' ? metadata_json : JSON.stringify(metadata_json)) : prev.metadata_json;
    const newContent = content_payload !== undefined ? content_payload : prev.content_payload;
    const modificationReason = reason_for_change || 'Controlled metadata amendment';

    // Recalculate fingerprint for new version
    let newFingerprint;
    if (prev.fingerprint_type === 'ORIGINAL_FILE' && newContent !== null && newContent !== undefined) {
      newFingerprint = cryptoService.generateSha256(newContent);
    } else {
      const parsedMeta = newMetaStr ? (typeof newMetaStr === 'string' ? JSON.parse(newMetaStr) : newMetaStr) : null;
      newFingerprint = cryptoService.generateMetadataFingerprint({
        tracking_code: prev.tracking_code,
        title: newTitle,
        category: prev.category,
        description: newDesc,
        source: prev.source,
        collection_location: prev.collection_location,
        metadata: parsedMeta
      });
    }

    const nextVersion = (prev.current_version || 1) + 1;

    // Create New Evidence Version Snapshot (Stage 4)
    await execute(
      `INSERT INTO evidence_versions 
       (evidence_id, case_id, version_number, title, category, description, collection_location, 
        collected_at, source, verification_status, reliability_assessment, content_payload, 
        metadata_json, version_fingerprint, fingerprint_type, modified_by_officer_id, reason_for_modification)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        prev.case_id,
        nextVersion,
        newTitle,
        prev.category,
        newDesc,
        prev.collection_location,
        prev.collected_at,
        prev.source,
        newVerification,
        newReliability,
        newContent,
        newMetaStr,
        newFingerprint,
        prev.fingerprint_type,
        officer_id,
        modificationReason
      ]
    );

    // Update Master Evidence Record
    await execute(
      `UPDATE evidence 
       SET title = ?, description = ?, verification_status = ?, reliability_assessment = ?, 
           metadata_json = ?, content_payload = ?, sha256_fingerprint = ?, current_version = current_version + 1
       WHERE evidence_id = ?`,
      [newTitle, newDesc, newVerification, newReliability, newMetaStr, newContent, newFingerprint, evidenceId]
    );

    // Append Chained Audit Log (Stage 3)
    const [priorLogs] = await execute(
      'SELECT current_event_hash FROM evidence_audit_logs WHERE evidence_id = ? ORDER BY created_at ASC, audit_id ASC',
      [evidenceId]
    );
    const prevEventHash = (priorLogs && priorLogs.length > 0)
      ? priorLogs[priorLogs.length - 1].current_event_hash
      : cryptoService.GENESIS_HASH;

    const prevState = {
      title: prev.title,
      description: prev.description,
      verification_status: prev.verification_status,
      reliability_assessment: prev.reliability_assessment,
      fingerprint: prev.sha256_fingerprint
    };
    const newState = {
      title: newTitle,
      description: newDesc,
      verification_status: newVerification,
      reliability_assessment: newReliability,
      fingerprint: newFingerprint,
      version: nextVersion
    };

    const prevStateHash = cryptoService.generateSha256(cryptoService.canonicalize(prevState));
    const newStateHash = cryptoService.generateSha256(cryptoService.canonicalize(newState));

    const eventTime = new Date().toISOString();
    const eventHash = cryptoService.calculateEventHash({
      previous_event_hash: prevEventHash,
      evidence_id: evidenceId,
      case_id: prev.case_id,
      officer_id,
      action_type: 'METADATA_UPDATED',
      created_at: eventTime,
      previous_state_hash: prevStateHash,
      current_state_hash: newStateHash,
      reason_for_change: modificationReason
    });

    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, 
        previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, 
        canonical_payload, reason_for_change, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        prev.case_id,
        officer_id,
        'METADATA_UPDATED',
        JSON.stringify(prevState),
        JSON.stringify(newState),
        prevStateHash,
        newStateHash,
        prevEventHash,
        eventHash,
        cryptoService.canonicalize(newState),
        modificationReason,
        req.ip || '127.0.0.1',
        eventTime
      ]
    );

    res.json({
      success: true,
      data: {
        evidence_id: evidenceId,
        title: newTitle,
        verification_status: newVerification,
        reliability_assessment: newReliability,
        sha256_fingerprint: newFingerprint,
        current_version: nextVersion
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Performs cryptographic integrity verification of an evidence item against its recorded SHA-256 fingerprint.
 */
exports.verifyEvidenceIntegrity = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);
    const officerId = req.officer ? req.officer.officer_id : 1;

    const [rows] = await execute('SELECT * FROM evidence WHERE evidence_id = ?', [evidenceId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ID ${evidenceId} does not exist.` }
      });
    }

    const ev = rows[0];

    // Case access check
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, ev.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    // 1. Recalculate hash from physical vault file, stored content, or canonical metadata
    let recalculatedHash;
    const [vFiles] = await execute('SELECT * FROM evidence_files WHERE evidence_id = ? AND is_primary = 1', [evidenceId]);
    if (vFiles && vFiles.length > 0 && vFiles[0].storage_key) {
      try {
        const vPath = vaultService.resolveVaultPath(ev.case_id, vFiles[0].storage_key, false);
        if (fs.existsSync(vPath)) {
          const fileHashRes = await cryptoService.calculateFileSha256(vPath);
          recalculatedHash = fileHashRes.sha256_hash;
        } else if (ev.content_payload !== null && ev.content_payload !== undefined && ev.content_payload.length > 0) {
          recalculatedHash = cryptoService.generateSha256(ev.content_payload);
        } else {
          recalculatedHash = 'FILE_MISSING_ON_DISK';
        }
      } catch (fErr) {
        recalculatedHash = cryptoService.generateSha256(ev.content_payload !== null && ev.content_payload !== undefined ? ev.content_payload : '');
      }
    } else if (ev.fingerprint_type === 'ORIGINAL_FILE') {
      recalculatedHash = cryptoService.generateSha256(ev.content_payload !== null && ev.content_payload !== undefined ? ev.content_payload : '');
    } else {
      let parsedMeta = null;
      try {
        parsedMeta = ev.metadata_json ? (typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json) : null;
      } catch (e) {
        parsedMeta = ev.metadata_json;
      }
      recalculatedHash = cryptoService.generateMetadataFingerprint({
        tracking_code: ev.tracking_code,
        title: ev.title,
        category: ev.category,
        description: ev.description,
        source: ev.source,
        collection_location: ev.collection_location,
        metadata: parsedMeta
      });
    }

    const recordedHash = ev.sha256_fingerprint || '';
    const isMatch = recordedHash.length > 0 && recalculatedHash === recordedHash;
    const matchStatus = isMatch ? 'MATCH' : 'MISMATCH';
    const integrityStatus = isMatch ? 'INTACT' : 'TAMPERED_MISMATCH';
    const verifiedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 2. Persist verification outcome in evidence_integrity_verifications
    await execute(
      `INSERT INTO evidence_integrity_verifications 
       (evidence_id, case_id, officer_id, recalculated_hash, recorded_hash, match_status, fingerprint_type, notes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        ev.case_id,
        officerId,
        recalculatedHash,
        recordedHash,
        matchStatus,
        ev.fingerprint_type || 'METADATA_CANONICAL',
        isMatch ? 'Cryptographic SHA-256 fingerprint verified intact' : 'CRITICAL INTEGRITY MISMATCH: Content diverged from recorded digest',
        req.ip || '127.0.0.1'
      ]
    );

    // 3. Update master evidence integrity status and verification timestamp
    await execute(
      `UPDATE evidence 
       SET integrity_status = ?, last_verified_at = ? 
       WHERE evidence_id = ?`,
      [integrityStatus, verifiedAt, evidenceId]
    );

    // 4. Record chained audit event for the verification attempt
    const [priorLogs] = await execute(
      'SELECT current_event_hash FROM evidence_audit_logs WHERE evidence_id = ? ORDER BY created_at ASC, audit_id ASC',
      [evidenceId]
    );
    const prevEventHash = (priorLogs && priorLogs.length > 0)
      ? priorLogs[priorLogs.length - 1].current_event_hash
      : cryptoService.GENESIS_HASH;

    const eventTime = new Date().toISOString();
    const verificationReason = `Cryptographic integrity verification completed with status: ${matchStatus}`;
    const eventHash = cryptoService.calculateEventHash({
      previous_event_hash: prevEventHash,
      evidence_id: evidenceId,
      case_id: ev.case_id,
      officer_id: officerId,
      action_type: 'INTEGRITY_VERIFIED',
      created_at: eventTime,
      previous_state_hash: '',
      current_state_hash: recalculatedHash,
      reason_for_change: verificationReason
    });

    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, 
        previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, 
        canonical_payload, reason_for_change, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        ev.case_id,
        officerId,
        'INTEGRITY_VERIFIED',
        JSON.stringify({ recorded_hash: recordedHash }),
        JSON.stringify({ recalculated_hash: recalculatedHash, match_status: matchStatus }),
        '',
        recalculatedHash,
        prevEventHash,
        eventHash,
        cryptoService.canonicalize({ match_status: matchStatus, recalculated_hash: recalculatedHash }),
        verificationReason,
        req.ip || '127.0.0.1',
        eventTime
      ]
    );

    res.json({
      success: true,
      data: {
        evidence_id: evidenceId,
        tracking_code: ev.tracking_code,
        match_status: matchStatus,
        integrity_status: integrityStatus,
        recorded_hash: recordedHash,
        recalculated_hash: recalculatedHash,
        fingerprint_algorithm: ev.fingerprint_algorithm || 'SHA-256',
        fingerprint_type: ev.fingerprint_type || 'METADATA_CANONICAL',
        verified_at: verifiedAt,
        academic_disclaimer: 'ACADEMIC NOTICE: SHA-256 fingerprint verification confirms bit-level mathematical consistency with recorded state. It does NOT constitute legal admissibility, judicial certification, or proof of real-world authenticity.'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves historical versions for an evidence record.
 */
exports.getEvidenceVersions = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);

    const [rows] = await execute(
      `SELECT v.*, o.full_name AS modified_by_officer_name, o.badge_number AS modified_by_badge
       FROM evidence_versions v
       LEFT JOIN officers o ON v.modified_by_officer_id = o.officer_id
       WHERE v.evidence_id = ?
       ORDER BY v.version_number ASC`,
      [evidenceId]
    );

    res.json({
      success: true,
      total_versions: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves the cryptographically chained audit history for an evidence item and runs chain verification.
 */
exports.getEvidenceAuditChain = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);

    const [logs] = await execute(
      `SELECT a.*, o.full_name AS officer_name, o.badge_number AS officer_badge
       FROM evidence_audit_logs a
       LEFT JOIN officers o ON a.officer_id = o.officer_id
       WHERE a.evidence_id = ?
       ORDER BY a.created_at ASC, a.audit_id ASC`,
      [evidenceId]
    );

    // Run cryptographic verification of the hash chain
    const chainVerification = cryptoService.verifyAuditChain(logs);

    res.json({
      success: true,
      chain_status: chainVerification,
      audit_events: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies the cryptographic audit hash chain for an evidence record.
 */
exports.verifyAuditChainEndpoint = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);

    const [logs] = await execute(
      `SELECT * FROM evidence_audit_logs 
       WHERE evidence_id = ? 
       ORDER BY created_at ASC, audit_id ASC`,
      [evidenceId]
    );

    const result = cryptoService.verifyAuditChain(logs);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Searches evidence records by keyword, category, and verification status.
 */
exports.searchEvidence = async (req, res, next) => {
  try {
    const { q, category, verification_status, case_id } = req.query;
    let sql = `
      SELECT e.*, c.case_number, c.title AS case_title 
      FROM evidence e
      LEFT JOIN cases c ON e.case_id = c.case_id
      WHERE e.is_archived = 0
    `;
    const params = [];

    if (case_id) {
      sql += ' AND e.case_id = ?';
      params.push(case_id);
    }
    if (category) {
      sql += ' AND e.category = ?';
      params.push(category);
    }
    if (verification_status) {
      sql += ' AND e.verification_status = ?';
      params.push(verification_status);
    }
    if (q) {
      sql += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.tracking_code LIKE ? OR e.source LIKE ?)';
      const queryPattern = `%${q}%`;
      params.push(queryPattern, queryPattern, queryPattern, queryPattern);
    }

    sql += ' ORDER BY e.created_at DESC';

    const [rows] = await execute(sql, params);

    res.json({
      success: true,
      total_matches: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Establishes an explicit relational connection between evidence and entities.
 */
exports.addRelationship = async (req, res, next) => {
  try {
    const {
      case_id,
      source_type,
      source_id,
      target_type,
      target_id,
      relation_type,
      confidence_weight,
      relationship_nature,
      notes
    } = req.body;

    if (!case_id || !source_type || !source_id || !target_type || !target_id || !relation_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Incomplete relationship specification.' }
      });
    }

    const weight = confidence_weight !== undefined ? confidence_weight : 0.50;
    const nature = relationship_nature || 'UNVERIFIED_OBSERVATION';

    const [result] = await execute(
      `INSERT INTO evidence_relationships 
       (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature, notes, discovered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OFFICER_MANUAL')`,
      [case_id, source_type, source_id, target_type, target_id, relation_type, weight, nature, notes || null]
    );

    res.status(201).json({
      success: true,
      data: {
        relationship_id: result.insertId,
        relation_type,
        relationship_nature: nature,
        confidence_weight: weight
      }
    });
  } catch (error) {
    next(error);
  }
};
