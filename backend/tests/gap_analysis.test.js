/**
 * @file gap_analysis.test.js
 * @brief Automated test suite for Phase 12 Evidence Gap Intelligence & Assistant.
 * @project CASETHREAD
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');
const { execute, testConnection } = require('../database/connection');

let baseUrl;
let authToken = '';
let testCaseId = 13; // Uses seeded demo case or falls back
let evidenceAId = 0;
let evidenceBId = 0;
let evidenceDisconnectedId = 0;

before(async () => {
  await testConnection();

  // Find demo case or create temporary case
  const [cases] = await execute("SELECT case_id FROM cases WHERE case_number = 'CASE-DEMO-2026-CAMPUS' LIMIT 1");
  if (cases.length > 0) {
    testCaseId = cases[0].case_id;
  } else {
    testCaseId = 1;
  }

  // Get evidence options for testCaseId
  const [evList] = await execute("SELECT evidence_id, tracking_code FROM evidence WHERE case_id = ? ORDER BY evidence_id ASC", [testCaseId]);
  assert.ok(evList.length >= 2, 'Need at least 2 evidence records for testing');
  evidenceAId = evList[0].evidence_id;
  evidenceBId = evList.length >= 4 ? evList[3].evidence_id : evList[1].evidence_id;
  evidenceDisconnectedId = evList[evList.length - 1].evidence_id;

  // Obtain auth token for DET-8841
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badge_number: 'DET-8841', password: 'Password123!' })
  });
  const loginJson = await loginRes.json();
  authToken = loginJson.data?.token || '';
  assert.ok(authToken, 'Failed to obtain JWT auth token for DET-8841');
});

describe('Phase 12: Evidence Gap Intelligence & Assistant Test Suite', () => {
  // Test 1: Evidence Options
  test('1. GET /evidence-options returns formatted list of evidence for case', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/cases/${testCaseId}/evidence-options`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.items), 'Must return items array');
    assert.ok(json.data.items.length >= 2);
    assert.ok(json.data.items[0].tracking_code, 'Item must have tracking_code');
  });

  // Test 2: Connected Path Analysis
  test('2. POST /analyze finds documented multi-hop path and generates step explanations', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        caseId: testCaseId,
        evidenceAId,
        evidenceBId,
        mode: 'FULL_DIAGNOSTIC'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.path_analysis, 'Must include path_analysis');
    assert.equal(json.data.path_analysis.found, true);
    assert.ok(json.data.path_analysis.path_length >= 1);
    assert.ok(Array.isArray(json.data.path_analysis.explanations));
    assert.ok(json.data.path_analysis.explanations.length >= 1);
    assert.ok(json.data.path_analysis.explanations[0].explanation_text, 'Must include human-readable explanation');
    assert.ok(json.data.assistant_synthesis.summary, 'Must include assistant summary');
  });

  // Test 3: Disconnected Gap Analysis & Candidate Link Discovery
  test('3. POST /analyze detects disconnected gap and synthesizes rule-based candidate links', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        caseId: testCaseId,
        evidenceAId,
        evidenceBId: evidenceDisconnectedId,
        mode: 'FULL_DIAGNOSTIC'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.path_analysis.found, false, 'Must identify disconnected gap');
    assert.equal(json.data.assistant_synthesis.status, 'DISCONNECTED_GAP');
    assert.ok(Array.isArray(json.data.candidate_links), 'Must return candidate_links array');
    assert.ok(Array.isArray(json.data.investigative_questions), 'Must return investigative_questions');
    assert.ok(json.data.investigative_questions.length >= 1);
  });

  // Test 4: Native C BFS Execution Performance
  test('4. Native C BFS execution returns sub-50ms latency and valid trace steps', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        caseId: testCaseId,
        evidenceAId,
        evidenceBId
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    const metrics = json.data.path_analysis.execution_metrics;
    assert.ok(metrics, 'Must return execution metrics');
    assert.ok(metrics.execution_ms < 50.0, 'Native C BFS must complete in under 50ms');
    assert.ok(json.data.assistant_synthesis.algorithmic_explanation.includes('Breadth-First Search'));
  });

  // Test 5: Candidate Review Workflow (Mark for Investigation)
  test('5. POST /review records investigator candidate decision and creates audit log', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        caseId: testCaseId,
        sourceEvidenceId: evidenceAId,
        targetEvidenceId: evidenceDisconnectedId,
        candidateRule: 'RULE_SHARED_LOCATION',
        decision: 'INVESTIGATE',
        decisionReason: 'Potential mechanical override key linkage to lab access door',
        notes: 'Detectives instructed to dust keybox #2 for fingerprints'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.review_id, 'Must return generated review_id');
    assert.equal(json.data.decision, 'INVESTIGATE');

    // Verify persistence in MySQL
    const [rows] = await execute(
      'SELECT * FROM evidence_gap_candidate_reviews WHERE review_id = ?',
      [json.data.review_id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].review_decision, 'INVESTIGATE');
  });

  // Test 6: Candidate Confirmation Workflow
  test('6. POST /review with CONFIRMED creates relationship edge in evidence_relationships', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        caseId: testCaseId,
        sourceEvidenceId: evidenceAId,
        targetEvidenceId: evidenceDisconnectedId,
        candidateRule: 'RULE_SHARED_LOCATION',
        decision: 'CONFIRMED',
        decisionReason: 'Forensic touch DNA confirmed presence of Devon Kross on keybox peg',
        notes: 'Verified direct relationship created by detective authorization'
      })
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.decision, 'CONFIRMED');
    assert.ok(json.data.confirmed_edge_id, 'Must return created edge ID');

    // Verify in evidence_relationships
    const [edges] = await execute(
      'SELECT * FROM evidence_relationships WHERE relationship_id = ?',
      [json.data.confirmed_edge_id]
    );
    assert.equal(edges.length, 1);
    assert.equal(edges[0].relationship_nature, 'CONFIRMED_FACT');

    // Clean up test edge so demo remains pristine
    await execute('DELETE FROM evidence_relationships WHERE relationship_id = ?', [json.data.confirmed_edge_id]);
  });

  // Test 7: Retrieve Candidate Reviews History
  test('7. GET /reviews/:caseId retrieves historical candidate review audit records', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/reviews/${testCaseId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.reviews));
    assert.ok(json.data.reviews.length >= 1);
  });

  // Test 8: Input Validation & Edge Cases
  test('8. Rejects invalid parameters and non-existent evidence IDs gracefully', async () => {
    // Missing body parameters
    const res1 = await fetch(`${baseUrl}/gap-analysis/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ caseId: testCaseId })
    });
    assert.equal(res1.status, 400);

    // Non-existent evidence ID
    const res2 = await fetch(`${baseUrl}/gap-analysis/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ caseId: testCaseId, evidenceAId: 99999, evidenceBId })
    });
    assert.equal(res2.status, 404);
  });

  // Test 9: Security & Authentication Enforcement
  test('9. Rejects unauthorized access without JWT token', async () => {
    const res = await fetch(`${baseUrl}/gap-analysis/cases/${testCaseId}/evidence-options`);
    assert.equal(res.status, 401);
  });
});
