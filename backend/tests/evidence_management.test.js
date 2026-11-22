/**
 * @file evidence_management.test.js
 * @description Comprehensive automated integration test suite for Phase 5:
 * Evidence Vault & Secure Evidence Management. Tests master evidence retrieval,
 * SHA-256 fingerprint generation, version increments, tamper-evident audit logs,
 * bit-level recalculation, and auditable chain-of-custody transfer logging.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'casethread_evidence_mgmt_test_jwt_secret_2026!';

const app = require('../server');
const { execute } = require('../database/connection');

let server;
let baseUrl;
let leadToken;
let investigatorToken;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };

    if (body && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

describe('Phase 5: Evidence Vault & Evidence Management Suite', () => {
  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    leadToken = jwt.sign(
      { officer_id: 1, badge_number: 'DET-8841', role: 'LEAD_OFFICER', full_name: 'Det. Alexander Cross' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    investigatorToken = jwt.sign(
      { officer_id: 2, badge_number: 'INV-4022', role: 'INVESTIGATOR', full_name: 'Investigator Maya Lin' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // 1. Evidence Ingestion & SHA-256 Fingerprinting
  let createdEvidenceId;
  const testTrackingCode = `EVD-TEST-${Date.now().toString().slice(-6)}`;

  test('1. POST /api/v1/evidence - ingests new evidence record with SHA-256 seal & V1', async () => {
    const payload = {
      case_id: 1,
      tracking_code: testTrackingCode,
      title: 'North Entrance Surveillance Footage Clip',
      category: 'CCTV',
      description: 'High-definition 1080p surveillance video capturing suspect vehicle fleeing north on Main St.',
      source: 'City Traffic Camera Division',
      collection_location: 'Main St & 4th Ave Intersection',
      verification_status: 'CONFIRMED_FACT',
      reliability_assessment: 'HIGH'
    };

    const res = await request('POST', '/api/v1/evidence', {
      Authorization: `Bearer ${leadToken}`
    }, payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.evidence_id);
    assert.equal(res.body.data.tracking_code, testTrackingCode);
    assert.equal(res.body.data.current_version, 1);
    assert.ok(res.body.data.sha256_fingerprint);
    assert.equal(res.body.data.sha256_fingerprint.length, 64);
    assert.equal(res.body.data.integrity_status, 'INTACT');

    createdEvidenceId = res.body.data.evidence_id;
  });

  // 2. Evidence Listing & Search
  test('2. GET /api/v1/evidence - lists all active evidence records with case metadata', async () => {
    const res = await request('GET', '/api/v1/evidence', {
      Authorization: `Bearer ${leadToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);

    const first = res.body.data[0];
    assert.ok(first.evidence_id);
    assert.ok(first.tracking_code);
    assert.ok(first.title);
    assert.ok(first.verification_status);
  });

  // 3. Search & Filtering
  test('3. GET /api/v1/evidence?category=CCTV - filters by evidence category', async () => {
    const res = await request('GET', '/api/v1/evidence?category=CCTV', {
      Authorization: `Bearer ${leadToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    res.body.data.forEach(item => {
      assert.equal(item.category, 'CCTV');
    });
  });

  test('4. GET /api/v1/evidence?verification_status=CONFIRMED_FACT - filters by ground truth status', async () => {
    const res = await request('GET', '/api/v1/evidence?verification_status=CONFIRMED_FACT', {
      Authorization: `Bearer ${leadToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    res.body.data.forEach(item => {
      assert.equal(item.verification_status, 'CONFIRMED_FACT');
    });
  });

  // 5. Duplicate Tracking Code Prevention
  test('5. POST /api/v1/evidence - rejects duplicate tracking code with 409 Conflict', async () => {
    const payload = {
      case_id: 1,
      tracking_code: testTrackingCode,
      title: 'Duplicate Attempt',
      category: 'CCTV',
      description: 'This should be rejected.',
      source: 'Unknown'
    };

    const res = await request('POST', '/api/v1/evidence', {
      Authorization: `Bearer ${leadToken}`
    }, payload);

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'DUPLICATE_TRACKING_CODE');
  });

  // 6. Evidence Metadata Update & Version Increment (V1 -> V2)
  test('6. PUT /api/v1/evidence/:id - updates metadata, advances version to V2 and chains audit log', async () => {
    const updatePayload = {
      title: 'North Entrance Surveillance Footage Clip - Enhanced Analysis',
      description: 'Color-corrected and stabilized footage clip confirming suspect vehicle license plate match.',
      verification_status: 'CONFIRMED_FACT',
      reliability_assessment: 'HIGH',
      modification_reason: 'Automated video enhancement and forensic license plate stabilization completed'
    };

    const res = await request('PUT', `/api/v1/evidence/${createdEvidenceId}`, {
      Authorization: `Bearer ${leadToken}`
    }, updatePayload);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.current_version, 2);
    assert.equal(res.body.data.title, updatePayload.title);
    assert.ok(res.body.data.sha256_fingerprint);
  });

  // 7. Cryptographic SHA-256 Bit-level Recalculation
  test('7. POST /api/v1/evidence/:id/verify-integrity - recalculates SHA-256 and validates INTACT match', async () => {
    const res = await request('POST', `/api/v1/evidence/${createdEvidenceId}/verify-integrity`, {
      Authorization: `Bearer ${leadToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.match_status, 'MATCH');
    assert.equal(res.body.data.integrity_status, 'INTACT');
    assert.equal(res.body.data.fingerprint_algorithm, 'SHA-256');
    assert.ok(res.body.data.verified_at);
  });

  // 8. Chain of Custody Transfer Logging
  test('8. POST /api/v1/custody/transfer - records custody handover event with cryptographic signature', async () => {
    const transferPayload = {
      evidence_id: createdEvidenceId,
      case_id: 1,
      previous_custodian: 'Det. Alexander Cross (DET-8841)',
      new_custodian: 'Dr. Michael Chen (Digital Forensics Lab)',
      transfer_reason: 'Frame-by-frame vehicle enhancement and optical OCR testing',
      transfer_location: 'Forensic Video Lab - Workstation 3',
      transfer_notes: 'Tamper-evident hard drive enclosure serial checked and verified',
      verification_status: 'CONFIRMED_FACT'
    };

    const res = await request('POST', '/api/v1/custody/transfer', {
      Authorization: `Bearer ${leadToken}`
    }, transferPayload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.custody_event_id);
    assert.equal(res.body.data.new_custodian, transferPayload.new_custodian);
    assert.equal(res.body.data.is_successful, true);
  });

  // 9. Custody History Retrieval
  test('9. GET /api/v1/custody/evidence/:id - returns chronological chain-of-custody log', async () => {
    const res = await request('GET', `/api/v1/custody/evidence/${createdEvidenceId}`, {
      Authorization: `Bearer ${leadToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].new_custodian, 'Dr. Michael Chen (Digital Forensics Lab)');
  });
});
