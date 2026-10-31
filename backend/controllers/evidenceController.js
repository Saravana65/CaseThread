/**
 * @file evidenceController.js
 * @description Evidence lifecycle management, provenance tracking, and immutable audit logging.
 */

const { execute, withTransaction } = require('../database/connection');

/**
 * Adds a new evidence record with full provenance tracking and immutable initial audit entry.
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
      metadata_json
    } = req.body;

    const officer_id = req.officer ? req.officer.officer_id : 1;

    // Check if tracking code is already used
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
    const metadataStr = metadata_json ? JSON.stringify(metadata_json) : null;

    // Insert evidence record
    const [result] = await execute(
      `INSERT INTO evidence 
       (case_id, tracking_code, title, category, description, collection_location, collected_at, 
        source, related_entity_ids, verification_status, reliability_assessment, file_reference, 
        entered_by_officer_id, chain_of_custody_notes, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        metadataStr
      ]
    );

    const evidenceId = result.insertId;

    // Record in immutable audit log
    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, reason_for_change, ip_address)
       VALUES (?, ?, ?, 'CREATED', NULL, ?, 'Initial forensic evidence ingestion', ?)`,
      [
        evidenceId,
        case_id,
        officer_id,
        JSON.stringify({ tracking_code, title, category, verification, reliability, source }),
        req.ip || '127.0.0.1'
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
        reliability_assessment: reliability
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all active evidence records for a specific case.
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
 * Retrieves a single evidence item with its complete audit trail.
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
       ORDER BY a.created_at DESC`,
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
 * Updates evidence metadata and persists an immutable audit entry.
 */
exports.updateEvidence = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.id, 10);
    const { title, description, verification_status, reliability_assessment, metadata_json, reason_for_change } = req.body;
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
    const newMetaStr = metadata_json ? JSON.stringify(metadata_json) : prev.metadata_json;

    await execute(
      `UPDATE evidence 
       SET title = ?, description = ?, verification_status = ?, reliability_assessment = ?, metadata_json = ?
       WHERE evidence_id = ?`,
      [newTitle, newDesc, newVerification, newReliability, newMetaStr, evidenceId]
    );

    // Audit log
    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, reason_for_change, ip_address)
       VALUES (?, ?, ?, 'METADATA_UPDATED', ?, ?, ?, ?)`,
      [
        evidenceId,
        prev.case_id,
        officer_id,
        JSON.stringify({ title: prev.title, verification_status: prev.verification_status, reliability: prev.reliability_assessment }),
        JSON.stringify({ title: newTitle, verification_status: newVerification, reliability: newReliability }),
        reason_for_change || 'Routine evidence update',
        req.ip || '127.0.0.1'
      ]
    );

    res.json({
      success: true,
      data: {
        evidence_id: evidenceId,
        title: newTitle,
        verification_status: newVerification,
        reliability_assessment: newReliability
      }
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
