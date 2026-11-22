/**
 * @file timeline_analysis.test.js
 * @brief Automated Unit & Integration Test Suite for CaseThread Phase 8:
 *        Investigative Timeline, Contradiction Analysis, and Gap Detection.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execute, testConnection } = require('../database/connection');
const timelineController = require('../controllers/timelineController');

describe('Phase 8: Investigative Timeline & Contradiction Analysis Engine', () => {
  let activeCaseId = 1;

  before(async () => {
    await testConnection();
    const [cases] = await execute('SELECT case_id FROM cases ORDER BY case_id ASC LIMIT 1');
    if (cases && cases.length > 0) {
      activeCaseId = cases[0].case_id;
    }
  });

  test('1. Consolidated timeline retrieval contains records from multiple docket tables', async () => {
    let responseData = null;
    const req = { params: { caseId: activeCaseId }, query: { sort: 'ASC' } };
    const res = {
      json: (d) => { responseData = d; }
    };

    await timelineController.getCaseTimeline(req, res, (err) => { if (err) throw err; });

    assert.ok(responseData, 'Response data must be returned');
    assert.equal(responseData.success, true);
    assert.ok(responseData.data.total_events > 0, 'Must have consolidated events');
    assert.ok(Array.isArray(responseData.data.events), 'Events must be an array');

    const sourceTables = new Set(responseData.data.events.map(e => e.source_table));
    assert.ok(sourceTables.has('investigation_timelines'), 'Must include investigation_timelines records');
    assert.ok(sourceTables.has('evidence'), 'Must include evidence recovery records');
  });

  test('2. Event precision classification tags EXACT and UNKNOWN timestamps correctly', async () => {
    let responseData = null;
    const req = { params: { caseId: activeCaseId }, query: {} };
    const res = {
      json: (d) => { responseData = d; }
    };

    await timelineController.getCaseTimeline(req, res, (err) => { if (err) throw err; });

    const exactEvents = responseData.data.events.filter(e => e.precision === 'EXACT');
    const unknownEvents = responseData.data.events.filter(e => e.precision === 'UNKNOWN');

    assert.ok(exactEvents.length > 0, 'Must have EXACT precision records');
    exactEvents.forEach(e => {
      assert.notEqual(e.timestamp_epoch, null, 'EXACT events must have epoch seconds');
      assert.ok(e.display_time.includes(':'), 'EXACT events must have HH:MM:SS');
    });

    if (unknownEvents.length > 0) {
      unknownEvents.forEach(e => {
        assert.equal(e.timestamp_epoch, null, 'UNKNOWN events must have null epoch');
        assert.equal(e.precision, 'UNKNOWN');
      });
    }
  });

  test('3. Category and Precision filtering works accurately', async () => {
    let categoryData = null;
    const catReq = { params: { caseId: activeCaseId }, query: { category: 'EVIDENCE_COLLECTION' } };
    const catRes = { json: (d) => { categoryData = d; } };

    await timelineController.getCaseTimeline(catReq, catRes, (err) => { if (err) throw err; });
    assert.ok(categoryData.data.events.every(e => e.category === 'EVIDENCE_COLLECTION'), 'All filtered events must match EVIDENCE_COLLECTION');

    let exactData = null;
    const exactReq = { params: { caseId: activeCaseId }, query: { precision: 'EXACT' } };
    const exactRes = { json: (d) => { exactData = d; } };

    await timelineController.getCaseTimeline(exactReq, exactRes, (err) => { if (err) throw err; });
    assert.ok(exactData.data.events.every(e => e.precision === 'EXACT'), 'All filtered events must match EXACT');
  });

  test('4. Chronological sorting orders events deterministically in ASC and DESC', async () => {
    let ascData = null;
    const ascReq = { params: { caseId: activeCaseId }, query: { sort: 'ASC' } };
    const ascRes = { json: (d) => { ascData = d; } };
    await timelineController.getCaseTimeline(ascReq, ascRes, (err) => { if (err) throw err; });

    const ascDated = ascData.data.events.filter(e => e.timestamp_epoch !== null);
    for (let i = 0; i < ascDated.length - 1; i++) {
      assert.ok(ascDated[i].timestamp_epoch <= ascDated[i + 1].timestamp_epoch, 'ASC sort must be non-decreasing');
    }

    let descData = null;
    const descReq = { params: { caseId: activeCaseId }, query: { sort: 'DESC' } };
    const descRes = { json: (d) => { descData = d; } };
    await timelineController.getCaseTimeline(descReq, descRes, (err) => { if (err) throw err; });

    const descDated = descData.data.events.filter(e => e.timestamp_epoch !== null);
    for (let i = 0; i < descDated.length - 1; i++) {
      assert.ok(descDated[i].timestamp_epoch >= descDated[i + 1].timestamp_epoch, 'DESC sort must be non-increasing');
    }
  });

  test('5. Configurable Time Gap Detection flags intervals exceeding threshold', async () => {
    let analysisData = null;
    const req = { params: { caseId: activeCaseId }, query: { gap_threshold_hours: '2' } };
    const res = { json: (d) => { analysisData = d; } };

    await timelineController.getTimelineAnalysis(req, res, (err) => { if (err) throw err; });

    assert.ok(analysisData.success, 'Analysis response must succeed');
    assert.ok(Array.isArray(analysisData.data.gaps), 'Gaps must be returned as array');
    assert.equal(analysisData.data.summary.gap_threshold_hours, 2);

    if (analysisData.data.gaps.length > 0) {
      analysisData.data.gaps.forEach(gap => {
        assert.ok(gap.duration_hours >= 2, 'Gap duration must be >= threshold');
        assert.ok(gap.start_event, 'Gap must have start_event');
        assert.ok(gap.end_event, 'Gap must have end_event');
        assert.ok(gap.questions.length > 0, 'Gap must generate investigative questions');
      });
    }
  });

  test('6. Contradiction Engine detects Rule D Spatiotemporal Velocity Violations via C engine', async () => {
    let analysisData = null;
    const req = { params: { caseId: activeCaseId }, query: {} };
    const res = { json: (d) => { analysisData = d; } };

    await timelineController.getTimelineAnalysis(req, res, (err) => { if (err) throw err; });

    const ruleDAnomalies = analysisData.data.contradictions.filter(c => c.rule_code === 'RULE_D_CHRONOLOGY_ANOMALY');
    assert.ok(ruleDAnomalies.length > 0, 'Must detect Rule D spatiotemporal anomalies in Case #1');
    assert.equal(ruleDAnomalies[0].severity, 'CRITICAL');
    assert.ok(ruleDAnomalies[0].explanation.includes('Physically improbable transit interval'));
    assert.ok(ruleDAnomalies[0].suggested_questions.length > 0);
  });

  test('7. Contradiction Engine detects Rule E Missing Timestamp anomalies', async () => {
    let analysisData = null;
    const req = { params: { caseId: activeCaseId }, query: {} };
    const res = { json: (d) => { analysisData = d; } };

    await timelineController.getTimelineAnalysis(req, res, (err) => { if (err) throw err; });

    const ruleEAnomalies = analysisData.data.contradictions.filter(c => c.rule_code === 'RULE_E_MISSING_TIMESTAMP');
    assert.ok(ruleEAnomalies.length > 0, 'Must detect Rule E missing timestamps for undated evidence');
    assert.equal(ruleEAnomalies[0].rule_code, 'RULE_E_MISSING_TIMESTAMP');
    assert.ok(ruleEAnomalies[0].why_needs_review.includes('Without timestamp data'));
  });

  test('8. Investigative Questions synthesized with priorities and contexts', async () => {
    let analysisData = null;
    const req = { params: { caseId: activeCaseId }, query: { gap_threshold: '2' } };
    const res = { json: (d) => { analysisData = d; } };

    await timelineController.getTimelineAnalysis(req, res, (err) => { if (err) throw err; });

    const questions = analysisData.data.investigation_questions;
    assert.ok(Array.isArray(questions));
    assert.ok(questions.length > 0, 'Must generate investigation questions');
    assert.ok(questions.some(q => q.priority === 'CRITICAL'), 'Must include critical priority questions');
    questions.forEach(q => {
      assert.ok(q.question.length > 10, 'Question must have descriptive text');
      assert.ok(q.source_rule, 'Question must reference source rule');
    });
  });

  test('9. Insertion of new verified timeline event succeeds and updates timeline', async () => {
    const testTitle = `Unit Test Sighting ${Date.now()}`;
    const testTime = new Date().toISOString();

    let addResult = null;
    const addReq = {
      params: { caseId: activeCaseId },
      body: {
        event_title: testTitle,
        event_timestamp: testTime,
        entity_type: 'SUSPECT',
        location: 'Test Location Checkpoint #9',
        event_description: 'Automated verification event for unit test suite.',
        is_verified: 1
      }
    };
    const addRes = {
      status: (code) => ({
        json: (d) => { addResult = d; }
      })
    };

    await timelineController.addTimelineEvent(addReq, addRes, (err) => { if (err) throw err; });

    assert.ok(addResult);
    assert.equal(addResult.success, true);
    assert.ok(addResult.data.timeline_id > 0);

    // Verify it now appears in timeline
    let timelineData = null;
    const fetchReq = { params: { caseId: activeCaseId }, query: { search: testTitle } };
    const fetchRes = { json: (d) => { timelineData = d; } };

    await timelineController.getCaseTimeline(fetchReq, fetchRes, (err) => { if (err) throw err; });

    const createdEvent = timelineData.data.events.find(e => e.title === testTitle);
    assert.ok(createdEvent, 'New event must appear in search results');
    assert.ok(createdEvent.is_verified, 'Created event must be verified');

    // Clean up test event from database
    await execute('DELETE FROM investigation_timelines WHERE timeline_id = ?', [addResult.data.timeline_id]);
  });
});
