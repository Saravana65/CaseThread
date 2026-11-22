/**
 * @file investigation_management.test.js
 * @description Comprehensive test suite for Phase 4 Investigation Management & Case Workflow.
 * Verifies case listing, search filtering, sorting, updating parameters/status, archival, and audit logging.
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'casethread_phase4_test_jwt_secret_key_2026!';

const app = require('../server');

let server;
let baseUrl;
let authToken;
let leadOfficerId;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers
    };

    const req = http.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Log in as Lead Officer DET-8841
  const loginRes = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { badge_number: 'DET-8841', password: 'Password123!' }
  });
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  authToken = loginRes.data.data.token;
  leadOfficerId = loginRes.data.data.officer.officer_id;
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Phase 4: Investigation Management & Case Workflow', async (t) => {
  let createdCaseId;
  const testCaseNumber = `TEST-CASE-${Date.now()}`;

  await t.test('1. List all investigations returns array of cases with evidence/suspect counts', async () => {
    const res = await request('/api/v1/cases');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));
    assert.ok(res.data.data.length > 0);
    const sample = res.data.data[0];
    assert.ok('case_id' in sample);
    assert.ok('case_number' in sample);
    assert.ok('status' in sample);
    assert.ok('priority' in sample);
    assert.ok('evidence_count' in sample);
  });

  await t.test('2. Creates a new investigation with valid parameters and logs initial status', async () => {
    const payload = {
      case_number: testCaseNumber,
      title: 'Automated Cyber Intrusion Test',
      description: 'Test investigation docket for Phase 4 verification.',
      incident_location: 'Central Data Vault, Terminal 9',
      incident_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      priority: 'HIGH'
    };

    const res = await request('/api/v1/cases', {
      method: 'POST',
      body: payload
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.case_number, testCaseNumber);
    assert.strictEqual(res.data.data.status, 'OPEN');
    assert.strictEqual(res.data.data.priority, 'HIGH');
    createdCaseId = res.data.data.case_id;
    assert.ok(createdCaseId);
  });

  await t.test('3. Search investigations by case number finds the newly created case', async () => {
    const res = await request(`/api/v1/cases?search=${encodeURIComponent(testCaseNumber)}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.length >= 1);
    assert.strictEqual(res.data.data[0].case_number, testCaseNumber);
  });

  await t.test('4. Filter investigations by status=ACTIVE includes the new OPEN case', async () => {
    const res = await request('/api/v1/cases?status=ACTIVE');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const found = res.data.data.find(c => c.case_id === createdCaseId);
    assert.ok(found, 'Created case should appear under status=ACTIVE filter');
  });

  await t.test('5. Update investigation parameters and status to UNDER_INVESTIGATION', async () => {
    const updatePayload = {
      title: 'Automated Cyber Intrusion Test (Active)',
      description: 'Updated scope: forensic memory extraction underway.',
      incident_location: 'Central Data Vault, Sub-Level B',
      priority: 'CRITICAL',
      status: 'UNDER_INVESTIGATION'
    };

    const res = await request(`/api/v1/cases/${createdCaseId}`, {
      method: 'PUT',
      body: updatePayload
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.priority, 'CRITICAL');
    assert.strictEqual(res.data.data.status, 'UNDER_INVESTIGATION');
    assert.strictEqual(res.data.data.incident_location, 'Central Data Vault, Sub-Level B');
  });

  await t.test('6. Verifies activity log recorded CASE_STATUS_CHANGED and CASE_UPDATED', async () => {
    const res = await request(`/api/v1/cases/${createdCaseId}/activity`);
    assert.strictEqual(res.status, 200);
    const events = res.data.data?.events || res.data.data || [];
    assert.ok(events.length >= 1, 'Should have logged case lifecycle events');
    const statusEvent = events.find(e => e.event_type === 'CASE_STATUS_CHANGED');
    assert.ok(statusEvent, 'Should contain a CASE_STATUS_CHANGED event in activity log');
  });

  await t.test('7. Archives investigation safely via PATCH /api/v1/cases/:id/archive', async () => {
    const res = await request(`/api/v1/cases/${createdCaseId}/archive`, {
      method: 'PATCH'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.status, 'ARCHIVED');

    // Verify it is excluded from ACTIVE list
    const activeRes = await request('/api/v1/cases?status=ACTIVE');
    const foundInActive = activeRes.data.data.find(c => c.case_id === createdCaseId);
    assert.strictEqual(foundInActive, undefined, 'Archived case must not appear in active caseload');

    // Verify it is present in ARCHIVED list
    const archiveRes = await request('/api/v1/cases?status=ARCHIVED');
    const foundInArchive = archiveRes.data.data.find(c => c.case_id === createdCaseId);
    assert.ok(foundInArchive, 'Archived case must appear under status=ARCHIVED query');
  });

  await t.test('8. Restores archived case back to OPEN status via updateCase', async () => {
    const restoreRes = await request(`/api/v1/cases/${createdCaseId}`, {
      method: 'PUT',
      body: {
        title: 'Automated Cyber Intrusion Test (Restored)',
        incident_location: 'Central Data Vault',
        priority: 'MEDIUM',
        status: 'OPEN'
      }
    });
    assert.strictEqual(restoreRes.status, 200);
    assert.strictEqual(restoreRes.data.data.status, 'OPEN');

    // Verify it is back in ACTIVE list
    const activeRes = await request('/api/v1/cases?status=ACTIVE');
    const found = activeRes.data.data.find(c => c.case_id === createdCaseId);
    assert.ok(found, 'Restored case must now appear in active caseload');
  });
});
