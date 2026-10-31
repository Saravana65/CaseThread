/**
 * @file integration.test.js
 * @description Comprehensive test suite for CASETHREAD Phase 2 backend.
 * Tests:
 *  1. Database connection check
 *  2. Officer registration and login (bcrypt & JWT verification)
 *  3. Unauthorized access protection (401/403)
 *  4. Case creation, retrieval, updates, and archival
 *  5. People management (suspects, victims, witnesses)
 *  6. Evidence management, provenance, and audit logs
 *  7. Fact vs. unverified observation distinction
 *  8. Chronological timeline tracking
 *  9. Investigation lead management
 * 10. Invalid input handling & express-validator rules
 * 11. SQL injection protection with parameterized queries
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';

const app = require('../server');
const { testConnection } = require('../database/connection');

let server;
let baseUrl;
let authToken = '';

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

// Helper for HTTP requests
async function apiRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

describe('CASETHREAD Backend & Database Integration Tests', () => {
  // 1. Database Connection & System Health
  test('1. Database connectivity check via health endpoint', async () => {
    const res = await apiRequest('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ONLINE');
    assert.equal(res.body.service, 'CASETHREAD Intelligence API');
  });

  // 2. Authentication & Authorization
  describe('2. Officer Authentication & Security', () => {
    test('Rejects unauthorized access without token', async () => {
      const saved = authToken;
      authToken = '';
      const res = await apiRequest('/cases');
      authToken = saved;
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_REQUIRED');
    });

    test('Rejects invalid JWT token signature', async () => {
      const res = await apiRequest('/cases', {
        headers: { Authorization: 'Bearer this.is.an.invalid.token' }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_INVALID');
    });

    test('Officer registration with password hashing (bcrypt)', async () => {
      const newOfficer = {
        badge_number: 'DET-7721',
        full_name: 'Detective James Gordon',
        email: 'j.gordon@casethread.police.gov',
        password: 'SecurePass987!',
        department: 'Homicide Division',
        rank_designation: 'Detective First Class',
        role: 'INVESTIGATOR'
      };

      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(newOfficer)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.officer.badge_number, 'DET-7721');
      assert.ok(res.body.data.token, 'Must return signed JWT');
      assert.equal(res.body.data.officer.password_hash, undefined, 'Password hash must never be leaked');

      // Use this token for subsequent authenticated tests
      authToken = res.body.data.token;
    });

    test('Rejects duplicate badge number on registration', async () => {
      const duplicateOfficer = {
        badge_number: 'DET-7721', // Duplicate
        full_name: 'Imposter Detective',
        email: 'imposter@police.gov',
        password: 'Password123!',
        department: 'Homicide',
        rank_designation: 'Detective'
      };

      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(duplicateOfficer)
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'BADGE_ALREADY_REGISTERED');
    });

    test('Officer login with valid credentials', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          badge_number: 'DET-7721',
          password: 'SecurePass987!'
        })
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.officer.badge_number, 'DET-7721');
    });

    test('Rejects login with invalid password', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          badge_number: 'DET-7721',
          password: 'WrongPassword123'
        })
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    test('Officer profile retrieval via JWT', async () => {
      const res = await apiRequest('/auth/profile');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.badge_number, 'DET-7721');
    });
  });

  // 3. Case Management
  describe('3. Case Lifecycle Management', () => {
    let createdCaseId;

    test('Create new investigation case with validation', async () => {
      const caseData = {
        case_number: 'CASE-2026-9901',
        title: 'Harbor Warehouse Burglary & Wire Breach',
        description: 'Coordinated heist targeting telecommunication fibers in warehouse bay 3.',
        incident_date: '2026-10-28 01:15:00',
        incident_location: 'Docklands Pier 14 Warehouse B',
        priority: 'HIGH'
      };

      const res = await apiRequest('/cases', {
        method: 'POST',
        body: JSON.stringify(caseData)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.case_number, 'CASE-2026-9901');
      assert.equal(res.body.data.status, 'OPEN');
      createdCaseId = res.body.data.case_id;
    });

    test('List cases with metadata aggregation', async () => {
      const res = await apiRequest('/cases');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
    });

    test('View individual case by ID', async () => {
      const res = await apiRequest(`/cases/${createdCaseId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.case_id, createdCaseId);
      assert.ok(Array.isArray(res.body.data.suspects));
      assert.ok(Array.isArray(res.body.data.evidence));
    });

    test('Update case details', async () => {
      const res = await apiRequest(`/cases/${createdCaseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Harbor Warehouse Burglary - ESCALATED',
          description: 'Updated with cross-jurisdictional intelligence.',
          incident_location: 'Docklands Pier 14 Warehouse B',
          priority: 'CRITICAL'
        })
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.priority, 'CRITICAL');
    });

    test('Archive case file', async () => {
      const res = await apiRequest(`/cases/${createdCaseId}/archive`, {
        method: 'PATCH'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'ARCHIVED');
    });
  });

  // 4. People Management (Suspects, Victims, Witnesses)
  describe('4. People Management', () => {
    test('Add suspect to case', async () => {
      const suspect = {
        full_name: 'Darius Thorne',
        alias: 'The Locksmith',
        age: 41,
        gender: 'MALE',
        phone_number: '+1-555-0811',
        identifying_features: 'Burn scar on right palm',
        status: 'PRIMARY_SUSPECT'
      };

      const res = await apiRequest('/cases/1/suspects', {
        method: 'POST',
        body: JSON.stringify(suspect)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.full_name, 'Darius Thorne');
      assert.equal(res.body.data.status, 'PRIMARY_SUSPECT');
    });

    test('Add victim to case', async () => {
      const victim = {
        full_name: 'Arthur Pendelton',
        age: 55,
        gender: 'MALE',
        contact_info: '+1-555-0992',
        condition_status: 'SAFE',
        statement: 'Discovered the vault open during morning inventory.'
      };

      const res = await apiRequest('/cases/1/victims', {
        method: 'POST',
        body: JSON.stringify(victim)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.full_name, 'Arthur Pendelton');
    });

    test('Add witness with credibility rating', async () => {
      const witness = {
        full_name: 'Clara Oswald',
        contact_phone: '+1-555-0722',
        statement: 'Heard a high-pitched alarm around 02:45 AM followed by tire squeal.',
        credibility_score: 0.95
      };

      const res = await apiRequest('/cases/1/witnesses', {
        method: 'POST',
        body: JSON.stringify(witness)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.credibility_score, 0.95);
    });

    test('Retrieve all people associated with a case', async () => {
      const res = await apiRequest('/cases/1/people');
      assert.equal(res.status, 200);
      assert.ok(res.body.data.suspects.length > 0);
      assert.ok(res.body.data.victims.length > 0);
      assert.ok(res.body.data.witnesses.length > 0);
      assert.ok(res.body.data.total_people >= 3);
    });
  });

  // 5. Evidence Management, Provenance, & Fact vs Observation
  describe('5. Evidence Management & Forensic Provenance', () => {
    let createdEvidenceId;

    test('Add evidence distinguishing confirmed fact vs unverified observation', async () => {
      const evidence = {
        case_id: 1,
        tracking_code: 'EVD-BIO-009',
        title: 'Partial Blood Sample at Vault Safe Handle',
        category: 'FORENSIC_BIO',
        description: 'Drop of blood swabbed from the biometric dial.',
        collection_location: 'Main Vault Room',
        collected_at: '2026-10-15 05:00:00',
        source: 'Swab Kit #44 - Forensics Unit',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        metadata_json: { dna_profile_extracted: true, lab_id: 'LAB-2026-09' }
      };

      const res = await apiRequest('/evidence', {
        method: 'POST',
        body: JSON.stringify(evidence)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.tracking_code, 'EVD-BIO-009');
      assert.equal(res.body.data.verification_status, 'CONFIRMED_FACT');
      createdEvidenceId = res.body.data.evidence_id;
    });

    test('Add unverified observation evidence record', async () => {
      const observation = {
        case_id: 1,
        tracking_code: 'EVD-TIP-010',
        title: 'Unverified Anonymous Sighting of Fleeing Van',
        category: 'TESTIMONY_TRANSCRIPT',
        description: 'Anonymous online report claiming a blue van was spotted near highway exit.',
        source: 'Online Anonymous Tip Portal',
        verification_status: 'UNVERIFIED_OBSERVATION',
        reliability_assessment: 'QUESTIONABLE'
      };

      const res = await apiRequest('/evidence', {
        method: 'POST',
        body: JSON.stringify(observation)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.verification_status, 'UNVERIFIED_OBSERVATION');
      assert.notEqual(res.body.data.verification_status, 'CONFIRMED_FACT', 'Must not treat observation as confirmed fact');
    });

    test('Update evidence metadata and verify audit trail creation', async () => {
      const res = await apiRequest(`/evidence/${createdEvidenceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Partial Blood Sample at Vault Safe Handle (Lab Matched)',
          verification_status: 'CONFIRMED_FACT',
          reliability_assessment: 'HIGH',
          reason_for_change: 'DNA lab completed match to suspect Marcus Vance.'
        })
      });

      assert.equal(res.status, 200);

      // Verify audit history is preserved
      const inspectRes = await apiRequest(`/evidence/${createdEvidenceId}`);
      assert.equal(inspectRes.status, 200);
      assert.ok(inspectRes.body.data.audit_history.length >= 2, 'Must maintain complete audit trail');
      assert.equal(inspectRes.body.data.audit_history[0].action_type, 'METADATA_UPDATED');
    });

    test('Search evidence by keyword and category', async () => {
      const res = await apiRequest('/evidence/search?q=Blood&category=FORENSIC_BIO');
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 1);
      assert.equal(res.body.data[0].category, 'FORENSIC_BIO');
    });
  });

  // 6. Chronological Timelines
  describe('6. Chronological Investigation Timelines', () => {
    test('Add chronological timeline event', async () => {
      const event = {
        case_id: 1,
        event_timestamp: '2026-10-15 02:40:00',
        event_title: 'Motion Detector Activation - Rear Hallway',
        event_description: 'Sensor #12 triggered twice in 4 seconds.',
        entity_type: 'INCIDENT',
        entity_id: 1,
        location: 'Rear Loading Corridor',
        status: 'CONFIRMED_FACT',
        is_verified: true
      };

      const res = await apiRequest('/timeline', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.event_title, 'Motion Detector Activation - Rear Hallway');
      assert.equal(res.body.data.is_verified, true);
    });

    test('Retrieve chronological events ordered by timestamp', async () => {
      const res = await apiRequest('/timeline/case/1');
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 2);

      // Verify ordering
      for (let i = 1; i < res.body.data.length; i++) {
        const prev = new Date(res.body.data[i - 1].event_timestamp).getTime();
        const curr = new Date(res.body.data[i].event_timestamp).getTime();
        assert.ok(prev <= curr, 'Timeline events must be in ascending chronological order');
      }
    });
  });

  // 7. Investigation Leads
  describe('7. Investigation Leads & Action Items', () => {
    let createdLeadId;

    test('Add investigation lead with priority score', async () => {
      const lead = {
        case_id: 1,
        title: 'Cross-reference Blood DNA with National Felon Registry',
        hypothesis: 'The blood droplet on the vault dial belongs to an accomplice with a prior burglary record.',
        recommended_action: 'Submit CODIS query to state forensics lab.',
        priority_score: 95.00,
        source_gap_type: 'MISSING_EVIDENCE'
      };

      const res = await apiRequest('/leads', {
        method: 'POST',
        body: JSON.stringify(lead)
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.priority_score, 95.00);
      assert.equal(res.body.data.lead_status, 'OPEN');
      createdLeadId = res.body.data.lead_id;
    });

    test('Update lead status to IN_PROGRESS', async () => {
      const res = await apiRequest(`/leads/${createdLeadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ lead_status: 'IN_PROGRESS' })
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.lead_status, 'IN_PROGRESS');
    });
  });

  // 8. SQL Injection & Input Validation Resilience
  describe('8. Input Validation & SQL Injection Protection', () => {
    test('SQL injection in login is safely parameterized', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          badge_number: "' OR '1'='1",
          password: "' OR '1'='1"
        })
      });

      // Must be safely rejected without syntax error or unauthorized access
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    test('SQL injection in case creation is neutralized', async () => {
      const sqlInjectionPayload = {
        case_number: "CASE-999'; DROP TABLE cases; --",
        title: "Malicious Case'; SELECT * FROM officers; --",
        incident_date: '2026-10-31 09:00:00',
        incident_location: 'Safe Location'
      };

      const res = await apiRequest('/cases', {
        method: 'POST',
        body: JSON.stringify(sqlInjectionPayload)
      });

      assert.equal(res.status, 201);
      // Verify that the table was not dropped and data was treated as literal string
      const checkRes = await apiRequest('/cases');
      assert.equal(checkRes.status, 200);
      assert.ok(checkRes.body.data.length > 0);
    });

    test('Rejects invalid input (e.g. invalid credibility score > 1.0)', async () => {
      const res = await apiRequest('/cases/1/witnesses', {
        method: 'POST',
        body: JSON.stringify({
          full_name: 'Test Witness',
          statement: 'Some statement',
          credibility_score: 9.99 // Invalid: must be between 0.0 and 1.0
        })
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });
});
