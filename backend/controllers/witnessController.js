/**
 * @file witnessController.js
 * @description Witness testimonies and credibility scoring.
 */

const { execute } = require('../database/connection');

exports.addWitness = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId || req.body.case_id, 10);
    const { full_name, contact_phone, statement, credibility_score, statement_timestamp, statement_location } = req.body;

    const [caseExists] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const score = credibility_score !== undefined ? parseFloat(credibility_score) : 0.80;

    const [result] = await execute(
      `INSERT INTO witnesses 
       (case_id, full_name, contact_phone, statement, credibility_score, statement_timestamp, statement_location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        full_name,
        contact_phone || null,
        statement,
        score,
        statement_timestamp || null,
        statement_location || null
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        witness_id: result.insertId,
        case_id: caseId,
        full_name,
        credibility_score: score
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.listWitnessesByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const [rows] = await execute('SELECT * FROM witnesses WHERE case_id = ? ORDER BY created_at DESC', [caseId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getWitnessById = async (req, res, next) => {
  try {
    const witnessId = parseInt(req.params.id, 10);
    const [rows] = await execute('SELECT * FROM witnesses WHERE witness_id = ?', [witnessId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WITNESS_NOT_FOUND', message: `Witness ID ${witnessId} not found.` }
      });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};
