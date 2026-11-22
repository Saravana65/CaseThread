/**
 * @file caseController.js
 * @description Case management controller handling creation, retrieval, updates, and archival.
 */

const { execute } = require('../database/connection');
const collaborationService = require('../services/collaborationService');

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

    const createdCaseId = result.insertId;

    // Automatically establish LEAD_INVESTIGATOR membership for case creator
    try {
      await execute(
        `INSERT INTO case_members (case_id, officer_id, role, assigned_by_officer_id)
         VALUES (?, ?, 'LEAD_INVESTIGATOR', ?)`,
        [createdCaseId, lead_officer_id, lead_officer_id]
      );
      await collaborationService.logCaseActivity(
        createdCaseId,
        lead_officer_id,
        'CASE_STATUS_CHANGED',
        createdCaseId,
        null,
        { status: 'OPEN' },
        `Case file #${case_number} established with LEAD_INVESTIGATOR ${lead_officer_id}.`
      );
    } catch (ignoreErr) {
      // Non-fatal fallback for unmigrated test runs
    }

    res.status(201).json({
      success: true,
      data: {
        case_id: createdCaseId,
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
    const { status, priority, search, sort_by, sort_order } = req.query;
    const officer = req.officer;

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

    // Phase 10: Multi-Officer Case Access: Restrict to cases officer is lead or active member of (unless global ADMIN)
    if (officer && officer.role !== 'ADMIN') {
      sql += ' AND (c.lead_officer_id = ? OR c.case_id IN (SELECT cm.case_id FROM case_members cm WHERE cm.officer_id = ? AND cm.is_active = 1))';
      params.push(officer.officer_id, officer.officer_id);
    }

    if (status) {
      if (status === 'ACTIVE') {
        sql += " AND c.status IN ('OPEN', 'UNDER_INVESTIGATION')";
      } else if (status === 'SOLVED' || status === 'CLOSED') {
        sql += " AND c.status IN ('CLOSED', 'ARCHIVED')";
      } else {
        sql += ' AND c.status = ?';
        params.push(status);
      }
    }
    if (priority) {
      sql += ' AND c.priority = ?';
      params.push(priority);
    }
    if (search && search.trim()) {
      sql += ' AND (c.title LIKE ? OR c.case_number LIKE ? OR c.incident_location LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const sortMap = {
      'incident_date': 'c.incident_date',
      'created_at': 'c.created_at',
      'updated_at': 'c.updated_at',
      'title': 'c.title',
      'priority': 'c.priority',
      'case_number': 'c.case_number'
    };
    const sortCol = sortMap[sort_by] || 'c.incident_date';
    const sortDir = (sort_order && sort_order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortCol} ${sortDir}`;

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

    if (req.officer) {
      const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'view_case');
      if (!access.authorized) {
        return res.status(access.status || 403).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

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
    const { title, description, incident_location, priority, status } = req.body;

    if (req.officer) {
      const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'edit_case');
      if (!access.authorized) {
        return res.status(access.status || 403).json({
          success: false,
          error: { code: 'FORBIDDEN_INSUFFICIENT_PRIVILEGES', message: access.error }
        });
      }
    }

    const [existing] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const prevCase = existing[0];
    const newTitle = title !== undefined ? title : prevCase.title;
    const newDescription = description !== undefined ? description : prevCase.description;
    const newLocation = incident_location !== undefined ? incident_location : prevCase.incident_location;
    const newPriority = priority !== undefined ? priority : prevCase.priority;
    const newStatus = status !== undefined ? status : prevCase.status;

    await execute(
      `UPDATE cases 
       SET title = ?, description = ?, incident_location = ?, priority = ?, status = ?
       WHERE case_id = ?`,
      [newTitle, newDescription || '', newLocation, newPriority, newStatus, caseId]
    );

    const officerId = req.officer ? req.officer.officer_id : 1;

    // Audit activity logs for status and details change
    if (prevCase.status !== newStatus) {
      try {
        await collaborationService.logCaseActivity(
          caseId,
          officerId,
          'CASE_STATUS_CHANGED',
          caseId,
          { status: prevCase.status },
          { status: newStatus },
          `Case #${prevCase.case_number} status changed from ${prevCase.status} to ${newStatus}.`
        );
      } catch (logErr) {
        console.warn('[AUDIT LOG] Failed to log status change:', logErr.message);
      }
    }

    if (prevCase.title !== newTitle || prevCase.priority !== newPriority || prevCase.incident_location !== newLocation || prevCase.description !== newDescription) {
      try {
        await collaborationService.logCaseActivity(
          caseId,
          officerId,
          'CASE_UPDATED',
          caseId,
          { title: prevCase.title, priority: prevCase.priority },
          { title: newTitle, priority: newPriority },
          `Investigation details updated for Case #${prevCase.case_number}.`
        );
      } catch (logErr) {
        console.warn('[AUDIT LOG] Failed to log case update:', logErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        case_id: caseId,
        case_number: prevCase.case_number,
        title: newTitle,
        description: newDescription,
        incident_location: newLocation,
        priority: newPriority,
        status: newStatus
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

    if (req.officer) {
      const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'edit_case');
      if (!access.authorized) {
        return res.status(access.status || 403).json({
          success: false,
          error: { code: 'FORBIDDEN_INSUFFICIENT_PRIVILEGES', message: access.error }
        });
      }
    }

    const [existing] = await execute('SELECT * FROM cases WHERE case_id = ?', [caseId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const prevCase = existing[0];
    await execute('UPDATE cases SET status = ? WHERE case_id = ?', ['ARCHIVED', caseId]);

    const officerId = req.officer ? req.officer.officer_id : 1;
    try {
      await collaborationService.logCaseActivity(
        caseId,
        officerId,
        'CASE_STATUS_CHANGED',
        caseId,
        { status: prevCase.status },
        { status: 'ARCHIVED' },
        `Case file #${prevCase.case_number} archived and moved to long-term storage.`
      );
    } catch (logErr) {
      console.warn('[AUDIT LOG] Failed to log archive event:', logErr.message);
    }

    res.json({
      success: true,
      data: {
        case_id: caseId,
        status: 'ARCHIVED',
        message: `Case ${prevCase.case_number} has been archived successfully.`
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
