/**
 * @file algorithm_lab.test.js
 * @brief Automated test suite for Phase 7: Native C Algorithm Engine & Interactive Investigation Lab.
 * @project CASETHREAD
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';

const app = require('../server');
const { execute } = require('../database/connection');
const { JWT_SECRET } = require('../middleware/auth');

let server;
let baseUrl;
let authToken = '';
let testCaseId;

before(async () => {
  authToken = jwt.sign(
    { officer_id: 1, badge_number: 'DET-LAB-01', role: 'LEAD_INVESTIGATOR' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  // Seed test case and evidence for real investigation tests
  const [caseRes] = await execute(
    'INSERT INTO cases (title, case_number, status, priority, lead_officer_id) VALUES (?, ?, ?, ?, ?)',
    ['Lab Test Investigation: Sector 9 Vault Breached', 'CASE-2026-LAB01', 'ACTIVE', 'HIGH', 1]
  );
  testCaseId = caseRes.insertId;

  await execute('INSERT INTO suspects (case_id, full_name, alias) VALUES (?, ?, ?)',
    [testCaseId, 'Marcus Vance', 'The Ghost']);
  await execute('INSERT INTO suspects (case_id, full_name, alias) VALUES (?, ?, ?)',
    [testCaseId, 'Elena Rostova', 'Cipher']);

  const [eRes1] = await execute('INSERT INTO evidence (case_id, tracking_code, title, category, collection_location, is_archived) VALUES (?, ?, ?, ?, ?, ?)',
    [testCaseId, 'EVD-LAB-01', 'Cell Tower Log Sector 7', 'DIGITAL', 'Tower 7 East', 0]);
  const [eRes2] = await execute('INSERT INTO evidence (case_id, tracking_code, title, category, collection_location, is_archived) VALUES (?, ?, ?, ?, ?, ?)',
    [testCaseId, 'EVD-LAB-02', 'Discarded Burner SIM', 'DIGITAL', 'Harbour Pier 4', 0]);

  await execute('INSERT INTO evidence_relationships (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [testCaseId, 'SUSPECT', 1, 'EVIDENCE', eRes1.insertId, 'COMMUNICATION', 0.92, 'DIRECT_PHYSICAL']);
  await execute('INSERT INTO evidence_relationships (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [testCaseId, 'EVIDENCE', eRes1.insertId, 'SUSPECT', 2, 'SAME_LOCATION', 0.85, 'DIRECT_PHYSICAL']);
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function api(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

describe('Phase 7: Native C Algorithm Engine & Investigation Lab', () => {

  test('1. GET /api/v1/lab/catalog returns 8 verified algorithms with complexity metrics', async () => {
    const res = await api('/lab/catalog');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.total_algorithms, 8);

    const catalog = res.body.data.catalog;
    const ids = catalog.map(c => c.id);
    assert.ok(ids.includes('BFS'));
    assert.ok(ids.includes('DFS'));
    assert.ok(ids.includes('SHORTEST_PATH'));
    assert.ok(ids.includes('CONNECTED_COMPONENTS'));
    assert.ok(ids.includes('HASH_MAP'));
    assert.ok(ids.includes('TRIE'));
    assert.ok(ids.includes('AVL_TREE'));
    assert.ok(ids.includes('MAX_HEAP'));

    // Check theoretical complexity and viva explanations
    const bfs = catalog.find(c => c.id === 'BFS');
    assert.equal(bfs.time_complexity, 'O(V + E)');
    assert.equal(bfs.space_complexity, 'O(V)');
    assert.equal(bfs.verified, true);
  });

  test('2. GET /api/v1/lab/demo-datasets returns isolated academic demonstration datasets', async () => {
    const res = await api('/lab/demo-datasets');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.graph);
    assert.ok(res.body.data.hash_keys.length >= 7);
    assert.ok(res.body.data.avl_timestamps.length >= 7);
    assert.ok(res.body.data.heap_leads.length >= 7);
    assert.ok(res.body.data.trie_words.length >= 7);
  });

  test('3. POST /api/v1/lab/execute BFS runs native C queue exploration with trace steps', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        caseId: testCaseId,
        algorithm: 'BFS',
        mode: 'REAL',
        startNodeId: 0
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.algorithm, 'BFS');

    const lab = res.body.data.lab_result;
    assert.equal(lab.status, 'SUCCESS');
    assert.equal(lab.algorithm, 'BFS');
    assert.ok(Array.isArray(lab.trace));
    assert.ok(lab.trace.length > 0);

    // Verify first step is QUEUE_ENQUEUE
    const step1 = lab.trace[0];
    assert.equal(step1.type, 'QUEUE_ENQUEUE');
    assert.ok(step1.queue.includes(0));

    // Verify metrics
    assert.ok(lab.metrics);
    assert.ok(lab.metrics.nodes_total > 0);
    assert.ok(lab.metrics.queue_operations > 0);
    assert.ok(typeof lab.metrics.execution_ms === 'number');
  });

  test('4. POST /api/v1/lab/execute DFS runs native C stack traversal with backtrack logging', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        caseId: testCaseId,
        algorithm: 'DFS',
        mode: 'REAL',
        startNodeId: 0
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.algorithm, 'DFS');

    const lab = res.body.data.lab_result;
    assert.equal(lab.status, 'SUCCESS');
    assert.ok(Array.isArray(lab.trace));

    // Verify stack push and stack operations
    const pushStep = lab.trace.find(s => s.type === 'STACK_PUSH');
    assert.ok(pushStep, 'Must contain STACK_PUSH trace step');
    assert.ok(lab.metrics.stack_operations > 0);
  });

  test('5. POST /api/v1/lab/execute Shortest Path discovers hop chain via C BFS predecessor tree', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        caseId: testCaseId,
        algorithm: 'SHORTEST_PATH',
        mode: 'REAL',
        startNodeId: 0,
        targetNodeId: 1
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const lab = res.body.data.lab_result;
    assert.equal(lab.algorithm, 'SHORTEST_PATH');
    assert.ok(typeof lab.found === 'boolean');
    assert.ok(Array.isArray(lab.trace));
  });

  test('6. POST /api/v1/lab/execute Connected Components partitions graph and flags isolated leads', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        caseId: testCaseId,
        algorithm: 'CONNECTED_COMPONENTS',
        mode: 'REAL'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const lab = res.body.data.lab_result;
    assert.equal(lab.algorithm, 'CONNECTED_COMPONENTS');
    assert.ok(Array.isArray(lab.components));
    assert.ok(lab.num_components > 0);
    assert.ok(Array.isArray(lab.isolated_leads));
  });

  test('7. POST /api/v1/lab/execute Hash Map computes real DJB2 hashes and bucket distribution', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        algorithm: 'HASH_MAP',
        mode: 'DEMO'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const lab = res.body.data.lab_result;
    assert.equal(lab.algorithm, 'HASH_MAP');
    assert.ok(lab.hash_function.includes('DJB2'));
    assert.ok(Array.isArray(lab.trace));
    assert.ok(Array.isArray(lab.buckets));
    assert.ok(lab.metrics.capacity >= 16);
    assert.ok(lab.metrics.size > 0);

    // Verify raw hash is a non-zero 32-bit unsigned integer
    const firstInsert = lab.trace[0];
    assert.ok(firstInsert.raw_hash > 0);
    assert.ok(firstInsert.bucket_index < lab.metrics.capacity);
  });

  test('8. POST /api/v1/lab/execute AVL Tree calculates heights, balance factors and rotations', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        algorithm: 'AVL_TREE',
        mode: 'DEMO'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const lab = res.body.data.lab_result;
    assert.equal(lab.algorithm, 'AVL_TREE');
    assert.ok(Array.isArray(lab.trace));
    assert.ok(lab.metrics.tree_height > 0);
    assert.ok(lab.metrics.root_balance_factor >= -1 && lab.metrics.root_balance_factor <= 1);
  });

  test('9. POST /api/v1/lab/execute Max-Heap logs priority bubble-up and extract-max ordering', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        algorithm: 'MAX_HEAP',
        mode: 'DEMO'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const lab = res.body.data.lab_result;
    assert.equal(lab.algorithm, 'MAX_HEAP');
    assert.ok(Array.isArray(lab.trace));
    assert.ok(Array.isArray(lab.heap_array));
    assert.ok(lab.peek_max.priority >= 90.0);
  });

  test('10. POST /api/v1/lab/execute Trie traverses prefix characters and autocompletes matches', async () => {
    const res = await api('/lab/execute', {
      method: 'POST',
      body: JSON.stringify({
        algorithm: 'TRIE',
        mode: 'DEMO',
        searchTerm: 'EVD-2026-'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const lab = res.body.data.lab_result;
    assert.equal(lab.algorithm, 'TRIE');
    assert.equal(lab.queried_prefix, 'EVD-2026-');
    assert.ok(Array.isArray(lab.trace));
    assert.ok(Array.isArray(lab.autocomplete_matches));
    assert.ok(lab.autocomplete_matches.length >= 3);
  });
});
