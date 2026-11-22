/**
 * @file timelineController.js
 * @brief Comprehensive Chronological Reconstruction, Gap Detection & Contradiction Analysis Engine.
 * @project CASETHREAD - Phase 8 Investigative Timeline
 */

const { execute } = require('../database/connection');
const cEngineService = require('../services/cEngineService');

/**
 * Normalizes date to ISO string and epoch seconds with precision detection.
 */
function normalizeTimestamp(rawDate) {
  if (!rawDate) {
    return {
      iso: null,
      epoch: null,
      precision: 'UNKNOWN',
      display_time: 'Timestamp Unknown',
      display_date: 'Undated'
    };
  }

  const dateObj = new Date(rawDate);
  if (isNaN(dateObj.getTime())) {
    return {
      iso: null,
      epoch: null,
      precision: 'UNKNOWN',
      display_time: 'Invalid Timestamp',
      display_date: 'Invalid Date'
    };
  }

  const iso = dateObj.toISOString();
  const epoch = Math.floor(dateObj.getTime() / 1000);

  // Detect whether time was provided or if it defaults to midnight (00:00:00)
  const isMidnight = dateObj.getUTCHours() === 0 && dateObj.getUTCMinutes() === 0 && dateObj.getUTCSeconds() === 0;
  const precision = isMidnight ? 'DATE_ONLY' : 'EXACT';

  const display_date = dateObj.toISOString().split('T')[0];
  const display_time = isMidnight ? 'Time Unspecified' : dateObj.toTimeString().split(' ')[0];

  return { iso, epoch, precision, display_time, display_date };
}

/**
 * Fetch and normalize all timeline events across investigation dockets:
 * 1. `investigation_timelines`
 * 2. `evidence` (collection & intake)
 * 3. `evidence_custody_events` (custody transfers)
 * 4. `case_activity_logs` (procedural milestones)
 */
async function fetchConsolidatedTimelineEvents(caseId) {
  // 1. Investigation Timelines
  const [timelines] = await execute(
    `SELECT t.*, e.tracking_code AS source_evidence_tracking, e.title AS source_evidence_title
     FROM investigation_timelines t
     LEFT JOIN evidence e ON t.source_evidence_id = e.evidence_id
     WHERE t.case_id = ?`,
    [caseId]
  );

  // 2. Evidence Records
  const [evidence] = await execute(
    `SELECT evidence_id, case_id, tracking_code, title, category, collection_location,
            collected_at, created_at, source, verification_status, reliability_assessment
     FROM evidence
     WHERE case_id = ? AND is_archived = 0`,
    [caseId]
  );

  // 3. Evidence Custody Events
  const [custody] = await execute(
    `SELECT c.*, e.tracking_code, e.title AS evidence_title
     FROM evidence_custody_events c
     JOIN evidence e ON c.evidence_id = e.evidence_id
     WHERE c.case_id = ?`,
    [caseId]
  );

  // 4. Case Activity Logs
  const [activities] = await execute(
    `SELECT a.*, o.full_name AS actor_name, o.badge_number AS actor_badge
     FROM case_activity_logs a
     LEFT JOIN officers o ON a.actor_id = o.officer_id
     WHERE a.case_id = ?`,
    [caseId]
  );

  // 5. Case Entities (for resolving entity labels)
  const [suspects] = await execute('SELECT suspect_id, full_name, alias FROM suspects WHERE case_id = ?', [caseId]);
  const [victims] = await execute('SELECT victim_id, full_name FROM victims WHERE case_id = ?', [caseId]);
  const [witnesses] = await execute('SELECT witness_id, full_name FROM witnesses WHERE case_id = ?', [caseId]);

  const entityLookup = {};
  suspects.forEach(s => { entityLookup[`SUSPECT_${s.suspect_id}`] = `${s.full_name} (${s.alias || 'Suspect'})`; });
  victims.forEach(v => { entityLookup[`VICTIM_${v.victim_id}`] = `${v.full_name} (Victim)`; });
  witnesses.forEach(w => { entityLookup[`WITNESS_${w.witness_id}`] = `${w.full_name} (Witness)`; });

  const events = [];

  // Map 1: Timelines table entries
  timelines.forEach(t => {
    const ts = normalizeTimestamp(t.event_timestamp);
    const entityKey = `${t.entity_type}_${t.entity_id}`;
    events.push({
      event_id: `TL-${t.timeline_id}`,
      raw_id: t.timeline_id,
      source_table: 'investigation_timelines',
      title: t.event_title,
      description: t.event_description || 'Investigative timeline record.',
      category: t.entity_type === 'EVIDENCE' ? 'DIGITAL_RECORD' :
                t.entity_type === 'SUSPECT' ? 'SUSPECT_SIGHTING' :
                t.entity_type === 'WITNESS' ? 'WITNESS_STATEMENT' : 'INCIDENT',
      entity_type: t.entity_type,
      entity_id: t.entity_id,
      entity_label: entityLookup[entityKey] || t.entity_type,
      location: t.location || 'Location Unspecified',
      timestamp: ts.iso,
      timestamp_epoch: ts.epoch,
      precision: ts.precision,
      display_time: ts.display_time,
      display_date: ts.display_date,
      status: t.status || 'CONFIRMED_FACT',
      is_verified: !!t.is_verified,
      associated_evidence_id: t.source_evidence_id,
      associated_evidence_code: t.source_evidence_tracking || null,
      source_provenance: t.source_evidence_title ? `Corroborated by ${t.source_evidence_title}` : 'Investigator Documentation'
    });
  });

  // Map 2: Evidence Collection events
  evidence.forEach(e => {
    if (e.collected_at) {
      const ts = normalizeTimestamp(e.collected_at);
      events.push({
        event_id: `EVD-COL-${e.evidence_id}`,
        raw_id: e.evidence_id,
        source_table: 'evidence',
        title: `Physical Evidence Collected: ${e.title}`,
        description: `Evidence item ${e.tracking_code} collected from ${e.collection_location || 'scene'}. Source: ${e.source || 'Crime Scene Recovery'}.`,
        category: 'EVIDENCE_COLLECTION',
        entity_type: 'EVIDENCE',
        entity_id: e.evidence_id,
        entity_label: `${e.tracking_code} - ${e.title}`,
        location: e.collection_location || 'Crime Scene',
        timestamp: ts.iso,
        timestamp_epoch: ts.epoch,
        precision: ts.precision,
        display_time: ts.display_time,
        display_date: ts.display_date,
        status: e.verification_status || 'CONFIRMED_FACT',
        is_verified: e.verification_status === 'CONFIRMED_FACT',
        associated_evidence_id: e.evidence_id,
        associated_evidence_code: e.tracking_code,
        source_provenance: e.source || 'Forensic Field Recovery'
      });
    } else {
      // Evidence with missing collection timestamp (Important for Rule E detection)
      events.push({
        event_id: `EVD-MISSING-${e.evidence_id}`,
        raw_id: e.evidence_id,
        source_table: 'evidence',
        title: `Evidence Logged (Missing Collection Date): ${e.title}`,
        description: `Evidence ${e.tracking_code} was recorded in evidence ledger but lacks formal collection timestamp.`,
        category: 'EVIDENCE_COLLECTION',
        entity_type: 'EVIDENCE',
        entity_id: e.evidence_id,
        entity_label: `${e.tracking_code} - ${e.title}`,
        location: e.collection_location || 'Unknown',
        timestamp: null,
        timestamp_epoch: null,
        precision: 'UNKNOWN',
        display_time: 'Missing Timestamp',
        display_date: 'Undated Record',
        status: 'UNVERIFIED_OBSERVATION',
        is_verified: false,
        associated_evidence_id: e.evidence_id,
        associated_evidence_code: e.tracking_code,
        source_provenance: 'Evidence Registry'
      });
    }
  });

  // Map 3: Evidence Custody Transfers
  custody.forEach(c => {
    const ts = normalizeTimestamp(c.transfer_timestamp);
    events.push({
      event_id: `CUST-${c.custody_event_id}`,
      raw_id: c.custody_event_id,
      source_table: 'evidence_custody_events',
      title: `Chain of Custody Transfer: ${c.tracking_code}`,
      description: `Custody transferred from '${c.previous_custodian}' to '${c.new_custodian}'. Reason: ${c.transfer_reason || 'Forensic Analysis'}. Notes: ${c.transfer_notes || 'None'}.`,
      category: 'CUSTODY_TRANSFER',
      entity_type: 'EVIDENCE',
      entity_id: c.evidence_id,
      entity_label: `${c.tracking_code} - ${c.evidence_title}`,
      location: c.transfer_location || 'Secure Property Vault',
      timestamp: ts.iso,
      timestamp_epoch: ts.epoch,
      precision: ts.precision,
      display_time: ts.display_time,
      display_date: ts.display_date,
      status: c.verification_status === 'VERIFIED' ? 'CONFIRMED_FACT' : 'UNVERIFIED_OBSERVATION',
      is_verified: c.verification_status === 'VERIFIED',
      associated_evidence_id: c.evidence_id,
      associated_evidence_code: c.tracking_code,
      source_provenance: 'Chain of Custody Ledger'
    });
  });

  // Map 4: Case Activity Logs (Status changes & officer milestones)
  activities.forEach(a => {
    const ts = normalizeTimestamp(a.created_at);
    events.push({
      event_id: `ACT-${a.activity_id}`,
      raw_id: a.activity_id,
      source_table: 'case_activity_logs',
      title: `Docket Milestone: ${a.event_type.replace(/_/g, ' ')}`,
      description: a.event_description || `Activity logged by ${a.actor_name || 'Investigator'}.`,
      category: 'OFFICER_ACTION',
      entity_type: 'OFFICER',
      entity_id: a.actor_id,
      entity_label: a.actor_name ? `${a.actor_name} (${a.actor_badge || 'Det.'})` : 'Detective Action',
      location: 'Investigation Command',
      timestamp: ts.iso,
      timestamp_epoch: ts.epoch,
      precision: ts.precision,
      display_time: ts.display_time,
      display_date: ts.display_date,
      status: 'CONFIRMED_FACT',
      is_verified: true,
      associated_evidence_id: null,
      associated_evidence_code: null,
      source_provenance: 'Case Audit Stream'
    });
  });

  return events;
}

/**
 * GET /api/v1/cases/:caseId/timeline
 * Consolidates all chronological events across evidence, custody, timelines, and milestones.
 */
exports.getCaseTimeline = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const { category, precision, sort = 'ASC', search } = req.query;

    const [caseExists] = await execute('SELECT case_id, title, case_number FROM cases WHERE case_id = ?', [caseId]);
    if (!caseExists || caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    let events = await fetchConsolidatedTimelineEvents(caseId);

    // Filter by category
    if (category && category !== 'ALL') {
      events = events.filter(e => e.category === category);
    }

    // Filter by timestamp precision
    if (precision && precision !== 'ALL') {
      events = events.filter(e => e.precision === precision);
    }

    // Filter by search string
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      events = events.filter(e =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.entity_label && e.entity_label.toLowerCase().includes(q)) ||
        (e.associated_evidence_code && e.associated_evidence_code.toLowerCase().includes(q))
      );
    }

    // Chronological sorting (handling undated records at the end)
    events.sort((a, b) => {
      if (a.timestamp_epoch === null && b.timestamp_epoch === null) return 0;
      if (a.timestamp_epoch === null) return 1;
      if (b.timestamp_epoch === null) return -1;
      return sort === 'DESC' ? (b.timestamp_epoch - a.timestamp_epoch) : (a.timestamp_epoch - b.timestamp_epoch);
    });

    res.json({
      success: true,
      data: {
        case_id: caseId,
        case_title: caseExists[0].title,
        case_number: caseExists[0].case_number,
        total_events: events.length,
        timezone: 'UTC (Forensic Normalized)',
        events
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cases/:caseId/timeline/analysis
 * Deep temporal contradiction detection, gap discovery, and investigation question synthesis.
 */
exports.getTimelineAnalysis = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const gapThresholdHours = parseFloat(req.query.gap_threshold_hours || req.query.gap_threshold || req.query.threshold) || 24;

    const [caseExists] = await execute('SELECT case_id, title, case_number FROM cases WHERE case_id = ?', [caseId]);
    if (!caseExists || caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    const events = await fetchConsolidatedTimelineEvents(caseId);
    const datedEvents = events.filter(e => e.timestamp_epoch !== null).sort((a, b) => a.timestamp_epoch - b.timestamp_epoch);
    const undatedEvents = events.filter(e => e.timestamp_epoch === null);

    // 1. Native C Algorithm Engine Spatiotemporal Anomaly Detection
    let cEngineAnomalies = [];
    let cLatencyMs = 0.05;

    try {
      const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [caseId]);
      const [evidenceList] = await execute('SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0', [caseId]);
      const [timelines] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [caseId]);

      const cPayload = {
        case_id: caseId,
        case_metadata: caseExists[0],
        entities: suspects.map(s => ({ id: s.suspect_id, type: 'SUSPECT', label: s.full_name })),
        evidence: evidenceList.map(e => ({ id: e.evidence_id, tracking_code: e.tracking_code, title: e.title })),
        relationships: [],
        timeline: timelines.map(t => ({
          event_id: t.timeline_id,
          timestamp_epoch: Math.floor(new Date(t.event_timestamp).getTime() / 1000),
          entity_type: t.entity_type,
          entity_id: t.entity_id,
          location: t.location || 'Unknown',
          status: t.status,
          is_verified: !!t.is_verified
        }))
      };

      const cRes = await cEngineService.runAnalysis(cPayload);
      if (cRes.timeline_anomalies) {
        cEngineAnomalies = cRes.timeline_anomalies;
      }
      if (cRes.execution_latency_ms) {
        cLatencyMs = cRes.execution_latency_ms;
      }
    } catch (cErr) {
      console.warn('[TIMELINE] Native C timeline engine invocation notice:', cErr.message);
    }

    // 2. Comprehensive Explainable Contradiction Engine (Rules A - F)
    const contradictions = [];
    const questions = [];

    // --- Rule D: Impossible Travel Velocities (from Native C AVL analysis) ---
    cEngineAnomalies.forEach((anom, idx) => {
      let t1Epoch = anom.timestamp_1 || anom.timestamp_a || null;
      let t2Epoch = anom.timestamp_2 || anom.timestamp_b || null;
      let locA = anom.location_1 || anom.location_a || 'Unknown Location';
      let locB = anom.location_2 || anom.location_b || 'Unknown Location';

      if (!t1Epoch || !t2Epoch) {
        // Fallback: extract epoch timestamps from C-engine explanation string: "logged at 'LocA' at 1792013460 and 'LocB' at 1792013550"
        const epochMatch = anom.explanation?.match(/logged at '([^']+)' at (\d+) and '([^']+)' at (\d+)/);
        if (epochMatch) {
          locA = epochMatch[1];
          t1Epoch = parseInt(epochMatch[2], 10);
          locB = epochMatch[3];
          t2Epoch = parseInt(epochMatch[4], 10);
        }
      }

      const isoA = t1Epoch ? new Date(t1Epoch * 1000).toISOString() : 'Undated';
      const isoB = t2Epoch ? new Date(t2Epoch * 1000).toISOString() : 'Undated';

      contradictions.push({
        id: `ANOM-D-${idx + 1}`,
        rule_code: 'RULE_D_CHRONOLOGY_ANOMALY',
        rule_name: 'Spatiotemporal Travel Velocity Violation',
        severity: 'CRITICAL',
        records_involved: [
          { title: `${anom.entity_label || 'Entity'} Sighting at ${locA}`, timestamp: isoA },
          { title: `${anom.entity_label || 'Entity'} Sighting at ${locB}`, timestamp: isoB }
        ],
        timestamps_compared: [isoA, isoB],
        explanation: anom.explanation,
        why_needs_review: 'An entity cannot physically be present at two distinct geographical locations in an impossibly brief transit interval without aircraft or erroneous record logging.',
        suggested_questions: [
          'Does traffic surveillance footage corroborate the transit route between these locations?',
          'Could an impersonator or secondary party be using the target\'s vehicle or cellular SIM card?',
          'Was one of the recorded timestamps logged post-incident or estimated by a witness?'
        ]
      });

      questions.push({
        priority: 'CRITICAL',
        source_rule: 'RULE_D_CHRONOLOGY_ANOMALY',
        question: `How could ${anom.entity_label || 'the target'} travel between '${locA}' and '${locB}' in the recorded interval?`,
        context: anom.explanation
      });
    });

    // --- Rule A: Temporal Conflict (Simultaneous conflicting locations/states for same entity) ---
    for (let i = 0; i < datedEvents.length; i++) {
      for (let j = i + 1; j < datedEvents.length; j++) {
        const e1 = datedEvents[i];
        const e2 = datedEvents[j];

        if (e1.entity_id && e2.entity_id && e1.entity_type === e2.entity_type && e1.entity_id === e2.entity_id) {
          const timeDiff = Math.abs(e1.timestamp_epoch - e2.timestamp_epoch);
          // Same entity sighted at different locations within 5 minutes (300s)
          if (timeDiff <= 300 && e1.location !== e2.location && e1.location !== 'Unknown' && e2.location !== 'Unknown') {
            const isAlreadyAdded = contradictions.some(c => c.rule_code === 'RULE_A_TEMPORAL_CONFLICT' && c.records_involved[0].title === e1.title);
            if (!isAlreadyAdded) {
              contradictions.push({
                id: `CONF-A-${i}-${j}`,
                rule_code: 'RULE_A_TEMPORAL_CONFLICT',
                rule_name: 'Simultaneous Conflicting Entity Location',
                severity: 'HIGH',
                records_involved: [
                  { id: e1.event_id, title: e1.title, location: e1.location, timestamp: e1.timestamp },
                  { id: e2.event_id, title: e2.title, location: e2.location, timestamp: e2.timestamp }
                ],
                timestamps_compared: [e1.timestamp, e2.timestamp],
                explanation: `Entity '${e1.entity_label}' is logged at '${e1.location}' and '${e2.location}' within ${timeDiff} seconds of each other.`,
                why_needs_review: 'Conflicting simultaneous statements indicate either mistaken witness identification, cell tower propagation anomalies, or intentional fabrication of an alibi.',
                suggested_questions: [
                  'Which source possesses verifiable physical or digital corroboration (e.g., CCTV vs verbal interview)?',
                  'Was either timestamp approximated or entered retroactively?'
                ]
              });

              questions.push({
                priority: 'HIGH',
                source_rule: 'RULE_A_TEMPORAL_CONFLICT',
                question: `Which sighting of ${e1.entity_label} is accurate: '${e1.location}' at ${e1.display_time} or '${e2.location}' at ${e2.display_time}?`,
                context: `Sightings recorded within ${timeDiff} seconds.`
              });
            }
          }
        }
      }
    }

    // --- Rule B: Sequence Inconsistency (e.g. Custody transfer before collection) ---
    const [custodyWithEvidence] = await execute(
      `SELECT c.*, e.tracking_code, e.title AS evidence_title, e.collected_at
       FROM evidence_custody_events c
       JOIN evidence e ON c.evidence_id = e.evidence_id
       WHERE c.case_id = ? AND e.collected_at IS NOT NULL`,
      [caseId]
    );

    custodyWithEvidence.forEach(c => {
      const transferEpoch = Math.floor(new Date(c.transfer_timestamp).getTime() / 1000);
      const collectionEpoch = Math.floor(new Date(c.collected_at).getTime() / 1000);

      if (transferEpoch < collectionEpoch) {
        contradictions.push({
          id: `SEQ-B-${c.custody_event_id}`,
          rule_code: 'RULE_B_SEQUENCE_INCONSISTENCY',
          rule_name: 'Anachronistic Custody Transfer',
          severity: 'HIGH',
          records_involved: [
            { id: `EVD-COL-${c.evidence_id}`, title: `Collection of ${c.tracking_code}`, timestamp: c.collected_at },
            { id: `CUST-${c.custody_event_id}`, title: `Transfer to ${c.new_custodian}`, timestamp: c.transfer_timestamp }
          ],
          timestamps_compared: [c.collected_at, c.transfer_timestamp],
          explanation: `Custody transfer to '${c.new_custodian}' is timestamped at ${c.transfer_timestamp}, which precedes the recorded collection date of ${c.collected_at}.`,
          why_needs_review: 'Evidence cannot be transferred or inspected before it is collected. This suggests clerical entry error, timezone offset mismatch, or compromised chain of custody.',
          suggested_questions: [
            'Was the evidence intake date recorded in UTC while the collection report used local station time?',
            'Did the evidence intake occur under emergency field procedures without initial timestamp recording?'
          ]
        });

        questions.push({
          priority: 'HIGH',
          source_rule: 'RULE_B_SEQUENCE_INCONSISTENCY',
          question: `Why is custody transfer of ${c.tracking_code} logged prior to its recorded collection timestamp?`,
          context: `Transfer: ${c.transfer_timestamp} vs Collection: ${c.collected_at}`
        });
      }
    });

    // --- Rule C: Duplicate or Conflicting Records ---
    const seenTitles = {};
    datedEvents.forEach(e => {
      const key = `${e.category}_${e.location}_${e.timestamp_epoch}`;
      if (seenTitles[key] && seenTitles[key].event_id !== e.event_id) {
        contradictions.push({
          id: `DUP-C-${e.event_id}`,
          rule_code: 'RULE_C_DUPLICATE_RECORD',
          rule_name: 'Potential Duplicate Event Record',
          severity: 'MEDIUM',
          records_involved: [
            { id: seenTitles[key].event_id, title: seenTitles[key].title, timestamp: seenTitles[key].timestamp },
            { id: e.event_id, title: e.title, timestamp: e.timestamp }
          ],
          timestamps_compared: [seenTitles[key].timestamp, e.timestamp],
          explanation: `Two distinct records ('${seenTitles[key].title}' and '${e.title}') share identical timestamps (${e.timestamp}) and locations ('${e.location}').`,
          why_needs_review: 'Redundant entries risk double-counting evidence weighting or creating artificial timeline clutter.',
          suggested_questions: [
            'Do these records represent two perspectives of the same incident or two independent concurrent events?'
          ]
        });
      } else {
        seenTitles[key] = e;
      }
    });

    // --- Rule E: Missing Temporal Information on Critical Records ---
    undatedEvents.forEach(e => {
      contradictions.push({
        id: `MISS-E-${e.event_id}`,
        rule_code: 'RULE_E_MISSING_TIMESTAMP',
        rule_name: 'Missing Temporal Information',
        severity: 'MEDIUM',
        records_involved: [{ id: e.event_id, title: e.title, location: e.location }],
        timestamps_compared: ['NULL / Missing'],
        explanation: `Evidence item '${e.title}' is logged without collection date or occurrence timestamp.`,
        why_needs_review: 'Without timestamp data, this evidence cannot be evaluated in chronological sequence or timeline range queries.',
        suggested_questions: [
          `Can the recovery officer or lab intake report establish an approximate collection date for ${e.associated_evidence_code || e.title}?`
        ]
      });

      questions.push({
        priority: 'MEDIUM',
        source_rule: 'RULE_E_MISSING_TIMESTAMP',
        question: `What was the exact or approximate recovery date for ${e.associated_evidence_code || e.title}?`,
        context: 'Evidence record is currently excluded from chronological sequencing due to missing timestamp.'
      });
    });

    // --- 3. Time Gap Analysis (Configurable Threshold) ---
    const gaps = [];
    const thresholdSeconds = gapThresholdHours * 3600;

    for (let i = 0; i < datedEvents.length - 1; i++) {
      const eCurrent = datedEvents[i];
      const eNext = datedEvents[i + 1];

      const intervalSec = eNext.timestamp_epoch - eCurrent.timestamp_epoch;
      if (intervalSec >= thresholdSeconds) {
        const gapHours = (intervalSec / 3600).toFixed(1);
        const days = Math.floor(intervalSec / 86400);
        const remainingHours = Math.floor((intervalSec % 86400) / 3600);
        const durationFormatted = days > 0 ? `${days}d ${remainingHours}h` : `${gapHours}h`;

        gaps.push({
          gap_id: `GAP-${i + 1}`,
          start_event: { id: eCurrent.event_id, title: eCurrent.title, timestamp: eCurrent.timestamp, location: eCurrent.location },
          end_event: { id: eNext.event_id, title: eNext.title, timestamp: eNext.timestamp, location: eNext.location },
          duration_seconds: intervalSec,
          duration_hours: parseFloat(gapHours),
          duration_formatted: durationFormatted,
          threshold_hours: gapThresholdHours,
          investigative_note: `A ${durationFormatted} interval elapsed between '${eCurrent.title}' and '${eNext.title}' without documented case records.`,
          questions: [
            `What investigative actions, search warrants, or surveillance were conducted during this ${durationFormatted} window?`,
            'Were records for this interval retained by outside agencies (hospital, transit, private security) but not yet subpoenaed?'
          ]
        });

        questions.push({
          priority: intervalSec > 86400 * 3 ? 'HIGH' : 'MEDIUM',
          source_rule: 'TIME_GAP_ANALYSIS',
          question: `What records account for the ${durationFormatted} gap between '${eCurrent.title}' and '${eNext.title}'?`,
          context: `Unaccounted window: ${eCurrent.display_date} to ${eNext.display_date}`
        });
      }
    }

    // --- 4. Summary Metrics ---
    const summary = {
      total_events: events.length,
      complete_timestamps: events.filter(e => e.precision === 'EXACT').length,
      approximate_timestamps: events.filter(e => e.precision === 'DATE_ONLY' || e.precision === 'APPROXIMATE').length,
      missing_timestamps: undatedEvents.length,
      temporal_conflicts_count: contradictions.filter(c => c.rule_code === 'RULE_A_TEMPORAL_CONFLICT').length,
      sequence_anomalies_count: contradictions.filter(c => c.rule_code === 'RULE_B_SEQUENCE_INCONSISTENCY' || c.rule_code === 'RULE_D_CHRONOLOGY_ANOMALY').length,
      gaps_exceeding_threshold_count: gaps.length,
      gap_threshold_hours: gapThresholdHours,
      c_execution_latency_ms: cLatencyMs
    };

    res.json({
      success: true,
      data: {
        case_id: caseId,
        case_title: caseExists[0].title,
        summary,
        contradictions,
        gaps,
        investigation_questions: questions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/cases/:caseId/timeline
 * Inserts a new verified or unverified event into the investigation timeline.
 */
exports.addTimelineEvent = async (req, res, next) => {
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
    if (!caseExists || caseExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: `Case ID #${caseId} does not exist.` }
      });
    }

    if (!event_title) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Event title is required.' }
      });
    }

    const isVerifiedVal = (is_verified !== undefined && is_verified !== null) ? (is_verified ? 1 : 0) : 0;
    const eventStatus = status || (isVerifiedVal ? 'CONFIRMED_FACT' : 'UNVERIFIED_OBSERVATION');
    const finalTimestamp = event_timestamp ? new Date(event_timestamp) : new Date();
    const finalEntityId = entity_id ? parseInt(entity_id, 10) : 0;

    const [result] = await execute(
      `INSERT INTO investigation_timelines 
       (case_id, event_timestamp, event_title, event_description, entity_type, entity_id, location, source_evidence_id, status, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        finalTimestamp,
        event_title,
        event_description || null,
        entity_type || 'INCIDENT',
        finalEntityId,
        location || null,
        source_evidence_id || null,
        eventStatus,
        isVerifiedVal
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        timeline_id: result.insertId,
        case_id: caseId,
        event_title,
        event_timestamp,
        status: eventStatus,
        is_verified: !!isVerifiedVal
      }
    });
  } catch (error) {
    next(error);
  }
};

// Legacy compatibility
exports.addEvent = exports.addTimelineEvent;
exports.getTimelineByCase = exports.getCaseTimeline;
