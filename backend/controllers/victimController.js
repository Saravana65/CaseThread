/**
 * @file victimController.js
 * @description Victim records management.
 */

const { execute } = require('../database/connection');

exports.addVictim = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId || req.body.case_id, 10);
    const { full_name, age, gender, contact_info, residence_address, condition_status, statement } = req.body;

    const [caseExists] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const [result] = await execute(
      `INSERT INTO victims 
       (case_id, full_name, age, gender, contact_info, residence_address, condition_status, statement)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        full_name,
        age || null,
        gender || 'UNKNOWN',
        contact_info || null,
        residence_address || null,
        condition_status || 'SAFE',
        statement || null
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        victim_id: result.insertId,
        case_id: caseId,
        full_name,
        condition_status: condition_status || 'SAFE'
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.listVictimsByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const [rows] = await execute('SELECT * FROM victims WHERE case_id = ? ORDER BY created_at DESC', [caseId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getVictimById = async (req, res, next) => {
  try {
    const victimId = parseInt(req.params.id, 10);
    const [rows] = await execute('SELECT * FROM victims WHERE victim_id = ?', [victimId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'VICTIM_NOT_FOUND', message: `Victim ID ${victimId} not found.` }
      });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};
