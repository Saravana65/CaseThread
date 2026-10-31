/**
 * @file timelineController.js
 * @description Chronological investigation timeline event management.
 */

const { execute } = require('../database/connection');

exports.addEvent = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId || req.body.case_id, 10);
    const {
      event_timestamp,
      event_title,
      event_description,
      entity_type,
      entity_id,
      location,
      source_evidence_id,
      status,
      is_verified
    } = req.body;

    const [caseExists] = await execute('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID ${caseId} does not exist.` }
      });
    }

    const eventStatus = status || 'UNVERIFIED_OBSERVATION';
    const verified = is_verified ? 1 : 0;

    const [result] = await execute(
      `INSERT INTO investigation_timelines 
       (case_id, event_timestamp, event_title, event_description, entity_type, entity_id, location, source_evidence_id, status, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        event_timestamp,
        event_title,
        event_description || null,
        entity_type,
        entity_id,
        location || null,
        source_evidence_id || null,
        eventStatus,
        verified
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        timeline_id: result.insertId,
        case_id: caseId,
        event_timestamp,
        event_title,
        status: eventStatus,
        is_verified: !!verified
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTimelineByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);

    const [rows] = await execute(
      `SELECT t.*, e.tracking_code AS source_evidence_tracking
       FROM investigation_timelines t
       LEFT JOIN evidence e ON t.source_evidence_id = e.evidence_id
       WHERE t.case_id = ?
       ORDER BY t.event_timestamp ASC`,
      [caseId]
    );

    res.json({
      success: true,
      total_events: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};
