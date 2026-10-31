/**
 * @file suspectController.js
 * @description Suspect and person-of-interest management.
 */

const { execute } = require('../database/connection');

exports.addSuspect = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId || req.body.case_id, 10);
    const { full_name, alias, age, gender, phone_number, identifying_features, last_known_address, status, notes } = req.body;

    const [caseExists] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const [result] = await execute(
      `INSERT INTO suspects 
       (case_id, full_name, alias, age, gender, phone_number, identifying_features, last_known_address, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        full_name,
        alias || null,
        age || null,
        gender || 'UNKNOWN',
        phone_number || null,
        identifying_features || null,
        last_known_address || null,
        status || 'PERSON_OF_INTEREST',
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        suspect_id: result.insertId,
        case_id: caseId,
        full_name,
        status: status || 'PERSON_OF_INTEREST'
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.listSuspectsByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const [rows] = await execute('SELECT * FROM suspects WHERE case_id = ? ORDER BY created_at DESC', [caseId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getSuspectById = async (req, res, next) => {
  try {
    const suspectId = parseInt(req.params.id, 10);
    const [rows] = await execute('SELECT * FROM suspects WHERE suspect_id = ?', [suspectId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SUSPECT_NOT_FOUND', message: `Suspect ID ${suspectId} not found.` }
      });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};
