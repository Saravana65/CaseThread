/**
 * @file frontend_workflow.test.js
 * @description End-to-End Integration Tests for the complete Frontend Workflow:
 * Login -> Profile -> Dashboard Case Roster -> Create Case -> Add Evidence -> Audit Logging -> C Engine Analysis -> Logout.
 * @project CASETHREAD
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';

const app = require('../server');

let server;
let baseUrl;
let sessionToken = null;
let loggedOfficer = null;
let createdCaseId = null;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('CASETHREAD - Complete Frontend Integration Workflow', () => {
  // 1. Unauthorized Access Protection
  test('1. Rejects unauthenticated case and evidence creation with 401', async () => {
    const unauthCase = await fetch(`${baseUrl}/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized Case' })
    });
    assert.strictEqual(unauthCase.status, 401, 'Should reject unauthenticated case creation');

    const unauthEvidence = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized Evidence' })
    });
    assert.strictEqual(unauthEvidence.status, 401, 'Should reject unauthenticated evidence submission');
  });

  // 2. Invalid Credentials Handling
  test('2. Rejects login with invalid badge or password combination', async () => {
    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        badge_number: 'DET-8841',
        password: 'IncorrectPassword999!'
      })
    });
    assert.strictEqual(badLogin.status, 401);
    const body = await badLogin.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
  });

  // 3. Officer Login
  test('3. Officer logs in successfully with valid credentials', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        badge_number: 'DET-8841',
        password: 'Password123!'
      })
    });

    assert.strictEqual(loginRes.status, 200);
    const body = await loginRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token, 'Must return signed JWT session token');
    assert.strictEqual(body.data.officer.badge_number, 'DET-8841');
    assert.strictEqual(body.data.officer.role, 'LEAD_OFFICER');

    sessionToken = body.data.token;
    loggedOfficer = body.data.officer;
  });

  // 4. Authenticated Officer Profile Retrieval
  test('4. Retrieves authenticated officer profile via /auth/profile', async () => {
    const profileRes = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert.strictEqual(profileRes.status, 200);
    const body = await profileRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.badge_number, loggedOfficer.badge_number);
    assert.strictEqual(body.data.officer_id, loggedOfficer.officer_id);
  });

  // 5. Dashboard Cases Retrieval
  test('5. Loads active cases roster for dashboard', async () => {
    const casesRes = await fetch(`${baseUrl}/cases`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert.strictEqual(casesRes.status, 200);
    const body = await casesRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data), 'Cases data must be an array');
    assert.ok(body.data.length >= 1, 'Should contain at least initial demo case');
  });

  // 6. Create New Case
  test('6. Officer creates new investigation case via /cases', async () => {
    const newCasePayload = {
      case_number: 'CASE-2026-9042',
      title: 'The Waterfront Warehouse Cargo Theft',
      description: 'Coordinated heist of precision optical instrumentation from Cargo Shed B.',
      incident_location: 'Pier 14, Commercial Waterfront Docks',
      incident_date: '2026-10-20 03:15:00',
      priority: 'CRITICAL',
      status: 'OPEN'
    };

    const createRes = await fetch(`${baseUrl}/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(newCasePayload)
    });

    assert.strictEqual(createRes.status, 201);
    const body = await createRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.case_number, 'CASE-2026-9042');
    assert.strictEqual(body.data.title, newCasePayload.title);
    assert.strictEqual(body.data.priority, 'CRITICAL');
    assert.ok(body.data.case_id > 0);

    createdCaseId = body.data.case_id;
  });

  // 6b. Duplicate Case Number Conflict Handling
  test('6b. Rejects duplicate case file number with 409 Conflict', async () => {
    const duplicateRes = await fetch(`${baseUrl}/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        case_number: 'CASE-2026-9042',
        title: 'Duplicate Heist Attempt',
        incident_location: 'Pier 14',
        incident_date: '2026-10-20 04:00:00'
      })
    });

    assert.strictEqual(duplicateRes.status, 409);
    const body = await duplicateRes.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_CASE_NUMBER');
  });

  // 6c. Case Input Validation
  test('6c. Rejects case creation with missing required fields with 400 Validation Error', async () => {
    const invalidRes = await fetch(`${baseUrl}/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        case_number: '',
        title: ''
      })
    });

    assert.strictEqual(invalidRes.status, 400);
    const body = await invalidRes.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 7. Case Appears in Dashboard Roster
  test('7. Newly created case appears in the active roster', async () => {
    const listRes = await fetch(`${baseUrl}/cases`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    const body = await listRes.json();
    const foundCase = body.data.find(c => c.case_id === createdCaseId || c.case_number === 'CASE-2026-9042');
    assert.ok(foundCase, 'Created case must be present in case roster');
    assert.strictEqual(foundCase.title, 'The Waterfront Warehouse Cargo Theft');
  });

  // 8. Add Forensic Evidence
  test('8. Officer ingests confirmed fact evidence record via /evidence', async () => {
    const evidencePayload = {
      case_id: createdCaseId,
      tracking_code: 'EVD-2026-9042-01',
      title: 'Pier 14 Security Gate Cam Footage',
      category: 'CCTV',
      description: '4K video footage showing dark van entering Pier 14 gate at 03:12:45 AM.',
      source: 'Port Security Server #3',
      collection_location: 'Pier 14 Main Security Checkpoint',
      collected_at: '2026-10-20 03:12:45',
      verification_status: 'CONFIRMED_FACT',
      reliability_assessment: 'HIGH',
      chain_of_custody_notes: 'Retrieved directly by Detective Cross via cryptographic checksum'
    };

    const evRes = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(evidencePayload)
    });

    assert.strictEqual(evRes.status, 201);
    const body = await evRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.tracking_code, 'EVD-2026-9042-01');
    assert.strictEqual(body.data.verification_status, 'CONFIRMED_FACT');
  });

  // 8b. Duplicate Tracking Code Handling
  test('8b. Rejects duplicate evidence tracking code with 409 Conflict', async () => {
    const dupEvidence = {
      case_id: createdCaseId,
      tracking_code: 'EVD-2026-9042-01',
      title: 'Duplicate Tracking Code Entry',
      category: 'CCTV',
      description: 'Attempting duplicate submission',
      source: 'CSI Tech'
    };

    const dupRes = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(dupEvidence)
    });

    assert.strictEqual(dupRes.status, 409);
    const body = await dupRes.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_TRACKING_CODE');
  });

  // 8c. Evidence Validation
  test('8c. Rejects evidence submission with missing required fields with 400 Validation Error', async () => {
    const invalidRes = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        case_id: createdCaseId,
        tracking_code: 'EVD-INVALID-001',
        category: 'INVALID_CATEGORY_NAME'
      })
    });

    assert.strictEqual(invalidRes.status, 400);
    const body = await invalidRes.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 8d. Ingest HYPOTHESIS Evidence with Structured Telemetry Metadata
  test('8d. Ingests HYPOTHESIS evidence with structured telemetry metadata_json', async () => {
    const hypothesisPayload = {
      case_id: createdCaseId,
      tracking_code: 'EVD-2026-9042-HYP',
      title: 'Investigator Working Theory: Secondary Exit Conduit',
      category: 'LOCATION',
      description: 'Hypothesized covert escape route through drainage conduit.',
      source: 'Detective Cross Investigative Hypothesis',
      verification_status: 'HYPOTHESIS',
      reliability_assessment: 'QUESTIONABLE',
      metadata_json: { conduit_diameter: '1.2m', drainage_basin: 'South Industrial' }
    };

    const res = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(hypothesisPayload)
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.verification_status, 'HYPOTHESIS');
  });

  // 9. Evidence Appears in Case Dossier
  test('9. Ingested evidence appears in case dossier details', async () => {
    const dossierRes = await fetch(`${baseUrl}/cases/${createdCaseId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert.strictEqual(dossierRes.status, 200);
    const body = await dossierRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.evidence));
    assert.strictEqual(body.data.evidence.length, 2);
    const confirmedEv = body.data.evidence.find(e => e.tracking_code === 'EVD-2026-9042-01');
    const hypothesisEv = body.data.evidence.find(e => e.tracking_code === 'EVD-2026-9042-HYP');
    assert.ok(confirmedEv, 'CONFIRMED_FACT evidence must be present in dossier');
    assert.strictEqual(confirmedEv.verification_status, 'CONFIRMED_FACT');
    assert.ok(hypothesisEv, 'HYPOTHESIS evidence must be present in dossier');
    assert.strictEqual(hypothesisEv.verification_status, 'HYPOTHESIS');
  });

  // 10. Add Unverified Observation & Run C-Engine Pipeline
  test('10. Ingests unverified tip and runs C DSA Engine analysis pipeline', async () => {
    // Add second unverified observation to trigger gap analysis
    const unverifiedEvidence = {
      case_id: createdCaseId,
      tracking_code: 'EVD-2026-9042-02',
      title: 'Anonymous phone tip regarding getaway vessel',
      category: 'PHONE_RECORD',
      description: 'Caller reported boat departing south dock without navigation lights.',
      source: 'Harbor Control 911 Call',
      collection_location: 'South Marina Slip 4',
      collected_at: '2026-10-20 03:45:00',
      verification_status: 'UNVERIFIED_OBSERVATION',
      reliability_assessment: 'LOW'
    };

    const ev2Res = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(unverifiedEvidence)
    });
    assert.strictEqual(ev2Res.status, 201);

    // Run C-Engine Analysis
    const analysisRes = await fetch(`${baseUrl}/analysis/cases/${createdCaseId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });

    assert.strictEqual(analysisRes.status, 200);
    const analysisBody = await analysisRes.json();
    assert.strictEqual(analysisBody.success, true);
    const result = analysisBody.data.analysis || analysisBody.data;
    assert.ok(result.metrics, 'C Engine metrics must be present');
    assert.ok(Array.isArray(result.evidence_gaps), 'Identified evidence gaps must be an array');
    assert.ok(result.evidence_gaps.length >= 1, 'Should flag unverified observation gap');
  });

  // 11. Logout & Session Termination
  test('11. Session termination rejects subsequent unauthorized requests', async () => {
    // Simulate frontend logout by clearing token
    sessionToken = null;

    const unauthRes = await fetch(`${baseUrl}/cases/${createdCaseId}`);
    assert.strictEqual(unauthRes.status, 401, 'Request without token must be rejected with 401');
  });
});
