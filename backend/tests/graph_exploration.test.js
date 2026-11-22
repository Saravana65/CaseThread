/**
 * @file graph_exploration.test.js
 * @description Comprehensive automated integration test suite for Phase 6:
 * Evidence Relationship Network & Graph Exploration. Tests C-Engine topology generation,
 * BFS shortest path discovery, BFS neighborhood exploration, DFS connected components,
 * isolated node detection, and relational edge persistence.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'casethread_graph_test_jwt_secret_2026!';

const app = require('../server');
const { execute } = require('../database/connection');

let server;
let baseUrl;
let authToken;
let testCaseId;
let suspectNodeId;
let evidenceNodeId;

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

describe('Phase 6: Evidence Relationship Network & Graph Exploration Suite', () => {
  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    authToken = jwt.sign(
      { officer_id: 1, badge_number: 'DET-8841', role: 'LEAD_OFFICER', full_name: 'Det. Alexander Cross' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Seed test case with entities, evidence, and relationships
    const [caseRes] = await execute(
      `INSERT INTO cases (case_number, title, description, status, priority, lead_officer_id)
       VALUES ('CAS-P6-001', 'Operation Nightwatch Relational Graph', 'Testing C graph algorithms and UI topology', 'OPEN', 'CRITICAL', 1)`
    );
    testCaseId = caseRes.insertId;

    const [sRes] = await execute(
      `INSERT INTO suspects (case_id, full_name, alias, phone_number, identification_status)
       VALUES (?, 'Sergei Rostova', 'The Ghost', '9102938475', 'IDENTIFIED')`,
      [testCaseId]
    );
    suspectNodeId = sRes.insertId;

    const [eRes] = await execute(
      `INSERT INTO evidence (case_id, tracking_code, title, category, description, collection_location, source, entered_by_officer_id, verification_status)
       VALUES (?, 'EVD-CCTV-P6', 'Pier 9 Loading Bay Camera', 'CCTV', 'Timestamped footage of suspect vehicle departure', 'Pier 9 Gate', 'Harbor Security Cam', 1, 'CONFIRMED_FACT')`,
      [testCaseId]
    );
    evidenceNodeId = eRes.insertId;

    // Insert an isolated evidence record (degree 0)
    await execute(
      `INSERT INTO evidence 
       (case_id, tracking_code, title, category, description, collection_location, source, entered_by_officer_id, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testCaseId, 'EVD-ISO-P6', 'Unmatched Tire Tread Mold', 'PHYSICAL', 'Cast of tire tracks from north service road lacking registered vehicle match', 'Service Road', 'Crime Scene Tech', 1, 'UNVERIFIED_OBSERVATION']
    );

    // Connect suspect to Pier 9 evidence
    await execute(
      `INSERT INTO evidence_relationships 
       (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [testCaseId, 'SUSPECT', suspectNodeId, 'EVIDENCE', evidenceNodeId, 'DEPICTED_IN', 0.95, 'CONFIRMED_FACT']
    );
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // 1. Full Graph Topology from C Engine
  test('1. GET /api/v1/cases/:caseId/graph - returns C Engine graph topology with nodes, edges and metrics', async () => {
    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const d = res.body.data;
    assert.ok(d.nodes.length >= 3, 'Must contain suspect, evidence, and isolated evidence nodes');
    assert.ok(d.edges.length >= 1, 'Must contain relationship edge');
    assert.ok(Array.isArray(d.connected_components));
    assert.ok(Array.isArray(d.isolated_nodes));
    assert.ok(d.isolated_nodes.length >= 1, 'Must identify isolated tire tread evidence');
  });

  // 2. Filtered Node Retrieval
  test('2. GET /api/v1/cases/:caseId/graph/nodes?type=SUSPECT - filters nodes by entity type', async () => {
    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph/nodes?type=SUSPECT`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.nodes.length >= 1);
    res.body.data.nodes.forEach(n => {
      assert.equal(n.entity_type, 'SUSPECT');
    });
  });

  // 3. Filtered Edge Retrieval
  test('3. GET /api/v1/cases/:caseId/graph/edges?relation_type=DEPICTED_IN - filters edges by relation type', async () => {
    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph/edges?relation_type=DEPICTED_IN`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.edges.length >= 1);
    res.body.data.edges.forEach(e => {
      assert.equal(e.relation_type, 'DEPICTED_IN');
    });
  });

  // 4. Shortest Path Finder via C BFS
  test('4. GET /api/v1/cases/:caseId/graph/path - calculates shortest path between records via C BFS', async () => {
    // Look up node IDs from full graph
    const gRes = await request('GET', `/api/v1/cases/${testCaseId}/graph`, {
      Authorization: `Bearer ${authToken}`
    });
    const nodes = gRes.body.data.nodes;
    const sNode = nodes.find(n => n.entity_type === 'SUSPECT');
    const eNode = nodes.find(n => n.entity_type === 'EVIDENCE' && !n.is_isolated);

    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph/path?source=${sNode.node_id}&target=${eNode.node_id}`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const pathData = res.body.data.path;
    assert.equal(pathData.found, true);
    assert.equal(pathData.path_length, 2);
    assert.ok(Array.isArray(pathData.steps));
    assert.equal(pathData.steps.length, 2);
  });

  // 5. Neighborhood Exploration via C BFS
  test('5. GET /api/v1/cases/:caseId/graph/explore/:nodeId?depth=2 - explores local neighborhood in C', async () => {
    const gRes = await request('GET', `/api/v1/cases/${testCaseId}/graph`, {
      Authorization: `Bearer ${authToken}`
    });
    const sNode = gRes.body.data.nodes.find(n => n.entity_type === 'SUSPECT');

    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph/explore/${sNode.node_id}?depth=2`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const neighborhood = res.body.data.neighborhood;
    assert.ok(neighborhood.explored_count >= 1);
    assert.ok(Array.isArray(neighborhood.subgraph_nodes));
  });

  // 6. Connected Components via C DFS
  test('6. GET /api/v1/cases/:caseId/graph/components - partitions graph into DFS clusters', async () => {
    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph/components`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.total_components >= 1);
    assert.ok(Array.isArray(res.body.data.components));
  });

  // 7. Isolated Evidence Detection
  test('7. GET /api/v1/cases/:caseId/graph/isolated - identifies degree 0 isolated records', async () => {
    const res = await request('GET', `/api/v1/cases/${testCaseId}/graph/isolated`, {
      Authorization: `Bearer ${authToken}`
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.total_isolated >= 1);
    const isolated = res.body.data.isolated_nodes;
    assert.ok(isolated.some(n => n.tracking_code === 'EVD-ISO-P6' || n.label.includes('Tire Tread')));
  });

  // 8. Relational Edge Persistence
  test('8. POST /api/v1/cases/:caseId/graph/edges - persists verified relationship with confidence weight', async () => {
    const payload = {
      source_type: 'EVIDENCE',
      source_id: evidenceNodeId,
      target_type: 'EVIDENCE',
      target_id: evidenceNodeId + 1,
      relation_type: 'CORROBORATES_LOCATION',
      confidence_weight: 0.88,
      relationship_nature: 'CONFIRMED_FACT',
      notes: 'Investigator established forensic link during crime scene analysis'
    };

    const res = await request('POST', `/api/v1/cases/${testCaseId}/graph/edges`, {
      Authorization: `Bearer ${authToken}`
    }, payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.relationship_id);
    assert.equal(res.body.data.relation_type, 'CORROBORATES_LOCATION');
    assert.equal(res.body.data.confidence_weight, 0.88);
  });
});
