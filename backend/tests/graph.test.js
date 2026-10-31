/**
 * @file graph.test.js
 * @description Automated integration tests for Phase 4 Graph Analysis APIs and C Engine integration.
 * @project CASETHREAD
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';

const app = require('../server');
const { execute } = require('../database/connection');
const jwt = require('jsonwebtoken');

let server;
let baseUrl;
let authToken;
let testCaseId;
let suspectId;
let vehicleId;
let locationId;
let evidenceId;

const JWT_SECRET = process.env.JWT_SECRET || 'casethread_super_secure_jwt_dev_key_2026';

before(async () => {
  // Start ephemeral HTTP server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // Generate test officer JWT
  authToken = jwt.sign(
    { officer_id: 1, badge_number: 'TEST-007', role: 'LEAD_OFFICER' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Setup test case records in memory store / MySQL
  const [caseRes] = await execute(
    `INSERT INTO cases (case_number, title, description, status, priority, lead_officer_id)
     VALUES ('CAS-GRAPH-001', 'Graph Intelligence Testing', 'Case testing multi-hop relational discovery', 'OPEN', 'CRITICAL', 1)`
  );
  testCaseId = caseRes.insertId;

  const [sRes] = await execute(
    `INSERT INTO suspects (case_id, full_name, alias, phone_number, identification_status)
     VALUES (?, 'Vikram Singh', 'Vicky', '9876543210', 'IDENTIFIED')`,
    [testCaseId]
  );
  suspectId = sRes.insertId;

  const [evRes] = await execute(
    `INSERT INTO evidence (case_id, tracking_code, title, category, description, collection_location, source, entered_by_officer_id, verification_status)
     VALUES (?, 'EVD-CCTV-99', 'Port CCTV Footage', 'CCTV', 'Captures getaway vehicle at Dock 9', 'Warehouse Dock 9', 'Port Security Camera', 1, 'CONFIRMED_FACT')`,
    [testCaseId]
  );
  evidenceId = evRes.insertId;

  // Add recorded relationship
  await execute(
    `INSERT INTO evidence_relationships 
     (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [testCaseId, 'SUSPECT', suspectId, 'EVIDENCE', evidenceId, 'DEPICTED_IN', 0.90, 'CONFIRMED_FACT']
  );
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('CASETHREAD Phase 4 - Evidence Graph Analysis APIs', () => {
  test('1. GET /cases/:caseId/graph returns full C-Engine analyzed graph', async () => {
    const res = await fetch(`${baseUrl}/cases/${testCaseId}/graph`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.nodes.length >= 2, 'Graph contains at least suspect and evidence nodes');
    assert.ok(json.data.edges.length >= 1, 'Graph contains relational edges');
    assert.ok(json.data.classification_summary, 'Includes classification summary');
    assert.equal(typeof json.data.classification_summary.directly_documented, 'number');
  });

  test('2. GET /cases/:caseId/graph/nodes retrieves filtered nodes', async () => {
    const res = await fetch(`${baseUrl}/cases/${testCaseId}/graph/nodes?type=SUSPECT`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.nodes.every(n => n.entity_type === 'SUSPECT'), 'All returned nodes are SUSPECT');
  });

  test('3. GET /cases/:caseId/graph/edges retrieves filtered edges', async () => {
    const res = await fetch(`${baseUrl}/cases/${testCaseId}/graph/edges?relation_type=DEPICTED_IN`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.edges.length >= 1, 'Contains DEPICTED_IN edge');
    assert.equal(json.data.edges[0].relation_type, 'DEPICTED_IN');
  });

  test('4. GET /cases/:caseId/graph/path finds shortest path via C BFS', async () => {
    const res = await fetch(
      `${baseUrl}/cases/${testCaseId}/graph/path?source_id=${suspectId}&source_type=SUSPECT&target_id=${evidenceId}&target_type=EVIDENCE`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.path.found, 'Path was found between suspect and evidence');
    assert.equal(json.data.path.path_length, 2, 'Direct connection is 2 vertices / 1 hop');
  });

  test('5. GET /cases/:caseId/graph/explore/:nodeId explores neighborhood via C BFS', async () => {
    const res = await fetch(`${baseUrl}/cases/${testCaseId}/graph/explore/0?depth=2`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.neighborhood.explored_count >= 1, 'Neighborhood exploration returned reachable nodes');
  });

  test('6. GET /cases/:caseId/graph/components returns connected components', async () => {
    const res = await fetch(`${baseUrl}/cases/${testCaseId}/graph/components`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.components.length >= 1, 'At least 1 connected component returned');
  });

  test('7. POST /cases/:caseId/graph/edges persists new relationship to MySQL', async () => {
    const newRelPayload = {
      source_type: 'SUSPECT',
      source_id: suspectId,
      target_type: 'LOCATION',
      target_id: 99,
      relation_type: 'SIGHTED_NEAR',
      confidence_weight: 0.85,
      relationship_nature: 'CONFIRMED_FACT',
      notes: 'Investigator logged sighting'
    };

    const res = await fetch(`${baseUrl}/cases/${testCaseId}/graph/edges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(newRelPayload)
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.relationship_id, 'Relationship ID generated');
    assert.equal(json.data.relation_type, 'SIGHTED_NEAR');
  });
});
