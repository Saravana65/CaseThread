/**
 * @file leadController.js
 * @description Investigative lead management and priority action items.
 */

const { execute } = require('../database/connection');

exports.addLead = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId || req.body.case_id, 10);
    const { title, hypothesis, recommended_action, lead_status, priority_score, assigned_officer_id, source_gap_type } = req.body;

    const [caseExists] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const status = lead_status || 'OPEN';
    const score = priority_score !== undefined ? parseFloat(priority_score) : 50.00;
    const gapType = source_gap_type || 'MANUAL_DETECTIVE_ENTRY';

    const [result] = await execute(
      `INSERT INTO investigation_leads 
       (case_id, title, hypothesis, recommended_action, lead_status, priority_score, assigned_officer_id, source_gap_type, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OFFICER_MANUAL')`,
      [
        caseId,
        title,
        hypothesis,
        recommended_action,
        status,
        score,
        assigned_officer_id || null,
        gapType
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        lead_id: result.insertId,
        case_id: caseId,
        title,
        lead_status: status,
        priority_score: score
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.listLeadsByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const { status } = req.query;

    let sql = `
      SELECT l.*, o.full_name AS assigned_officer_name, o.badge_number AS assigned_badge
      FROM investigation_leads l
      LEFT JOIN officers o ON l.assigned_officer_id = o.officer_id
      WHERE l.case_id = ?
    `;
    const params = [caseId];

    if (status) {
      sql += ' AND l.lead_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY l.priority_score DESC, l.created_at DESC';

    const [rows] = await execute(sql, params);

    res.json({
      success: true,
      total_leads: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLeadStatus = async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const { lead_status } = req.body;

    const validStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'VERIFIED_LEAD', 'DISPROVED', 'CLOSED'];
    if (!validStatuses.includes(lead_status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Invalid lead status. Must be one of: ${validStatuses.join(', ')}` }
      });
    }

    const [existing] = await execute('SELECT lead_id FROM investigation_leads WHERE lead_id = ?', [leadId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'LEAD_NOT_FOUND', message: `Lead ID ${leadId} does not exist.` }
      });
    }

    await execute('UPDATE investigation_leads SET lead_status = ? WHERE lead_id = ?', [lead_status, leadId]);

    res.json({
      success: true,
      data: {
        lead_id: leadId,
        lead_status,
        message: 'Lead status updated successfully.'
      }
    });
  } catch (error) {
    next(error);
  }
};
