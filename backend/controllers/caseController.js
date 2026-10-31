/**
 * @file caseController.js
 * @description Case management controller handling creation, retrieval, updates, and archival.
 */

const { execute } = require('../database/connection');

/**
 * Creates a new case file.
 * Uses parameterized queries to eliminate SQL injection vulnerabilities.
 */
exports.createCase = async (req, res, next) => {
  try {
    const { case_number, title, description, incident_date, incident_location, priority } = req.body;
    const lead_officer_id = req.officer ? req.officer.officer_id : (req.body.lead_officer_id || 1);

    // Verify uniqueness of case number
    const [existing] = await execute('SELECT case_id FROM cases WHERE case_number = ?', [case_number]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CASE_NUMBER', message: `Case number ${case_number} already exists.` }
      });
    }

    const casePriority = priority || 'MEDIUM';

    const [result] = await execute(
      `INSERT INTO cases (case_number, title, description, incident_date, incident_location, lead_officer_id, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [case_number, title, description || '', incident_date, incident_location, lead_officer_id, casePriority]
    );

    res.status(201).json({
      success: true,
      data: {
        case_id: result.insertId,
        case_number,
        title,
        priority: casePriority,
        status: 'OPEN'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all non-archived cases (or filtered by status).
 */
exports.listCases = async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    let sql = `
      SELECT 
        c.case_id, c.case_number, c.title, c.description, c.incident_date, 
        c.incident_location, c.priority, c.status, c.created_at, c.updated_at,
        o.full_name AS lead_officer_name, o.badge_number AS lead_officer_badge,
        (SELECT COUNT(*) FROM evidence e WHERE e.case_id = c.case_id AND e.is_archived = 0) AS evidence_count,
        (SELECT COUNT(*) FROM suspects s WHERE s.case_id = c.case_id) AS suspect_count,
        (SELECT COUNT(*) FROM witnesses w WHERE w.case_id = c.case_id) AS witness_count
      FROM cases c
      LEFT JOIN officers o ON c.lead_officer_id = o.officer_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND c.priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY c.incident_date DESC';

    const [rows] = await execute(sql, params);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single case with all its connected entities.
 */
exports.getCaseById = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);

    const [cases] = await execute(
      `SELECT c.*, o.full_name AS lead_officer_name, o.badge_number AS lead_officer_badge 
       FROM cases c 
       LEFT JOIN officers o ON c.lead_officer_id = o.officer_id 
       WHERE c.case_id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const currentCase = cases[0];

    // Concurrently load associated case elements
    const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
    const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [caseId]);
    const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [caseId]);
    const [evidence] = await execute('SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0', [caseId]);
    const [relationships] = await execute('SELECT * FROM evidence_relationships WHERE case_id = ?', [caseId]);
    const [timelines] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [caseId]);
    const [leads] = await execute('SELECT * FROM investigation_leads WHERE case_id = ? ORDER BY priority_score DESC', [caseId]);

    res.json({
      success: true,
      data: {
        ...currentCase,
        suspects,
        victims,
        witnesses,
        evidence,
        relationships,
        timelines,
        leads
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates case details.
 */
exports.updateCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { title, description, incident_location, priority } = req.body;

    const [existing] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    await execute(
      `UPDATE cases 
       SET title = ?, description = ?, incident_location = ?, priority = ?
       WHERE case_id = ?`,
      [title, description || '', incident_location, priority || 'MEDIUM', caseId]
    );

    res.json({
      success: true,
      data: {
        case_id: caseId,
        title,
        priority
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archives a case.
 */
exports.archiveCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);

    const [existing] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    await execute('UPDATE cases SET status = ? WHERE case_id = ?', ['ARCHIVED', caseId]);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        status: 'ARCHIVED',
        message: `Case ${caseId} has been archived successfully.`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Aggregates all people associated with a case (suspects, victims, witnesses).
 */
exports.getPeopleByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id, 10);

    const [cases] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
    const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [caseId]);
    const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [caseId]);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        total_people: suspects.length + victims.length + witnesses.length,
        suspects,
        victims,
        witnesses
      }
    });
  } catch (error) {
    next(error);
  }
};
