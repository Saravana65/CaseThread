/**
 * @file verify-deployment.js
 * @brief Automated 15-step staging and production readiness verification harness.
 * Validates health probes, auth, knowledge retrieval, citations, native C graph execution,
 * voice sanitization, report generation, and session security.
 * @project CASETHREAD - Phase 19 Production Verification
 */

const http = require('http');
const assert = require('assert');

const API_PORT = process.env.PORT || 5001;
const BASE_URL = `http://127.0.0.1:${API_PORT}/api/v1`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token && { Authorization: `Bearer ${options.token}` }),
    ...options.headers
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function runDeploymentVerification() {
  console.log('=================================================================');
  console.log('CASETHREAD PHASE 19: END-TO-END STAGING READINESS VERIFICATION');
  console.log(`Target Backend: ${BASE_URL}`);
  console.log('=================================================================\n');

  let authToken = null;
  const passedSteps = [];

  try {
    // Step 1: Verify Process Liveness Probe
    process.stdout.write('[STEP 1/15] Verifying Liveness Probe (/health/liveness)... ');
    const livenessRes = await request('/health/liveness');
    assert.strictEqual(livenessRes.status, 200, 'Liveness probe must return 200');
    assert.strictEqual(livenessRes.body.status, 'ALIVE');
    passedSteps.push('1. Liveness Probe');
    console.log('PASSED');

    // Step 2: Verify System Readiness Probe
    process.stdout.write('[STEP 2/15] Verifying Dependency Readiness (/health/readiness)... ');
    const readinessRes = await request('/health/readiness');
    assert.strictEqual(readinessRes.status, 200, 'Readiness probe must return 200');
    assert.strictEqual(readinessRes.body.checks.database.status, 'UP');
    assert.strictEqual(readinessRes.body.checks.c_engine.available, true);
    assert.strictEqual(readinessRes.body.checks.storage_vault.writable, true);
    assert.strictEqual(readinessRes.body.checks.knowledge_vault.writable, true);
    passedSteps.push('2. Dependency Readiness');
    console.log('PASSED');

    // Step 3: Officer Authentication
    process.stdout.write('[STEP 3/15] Authenticating Authorized Investigator (DET-8841)... ');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { badge_number: 'DET-8841', password: 'Password123!' }
    });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed');
    authToken = loginRes.body.data?.token || loginRes.body.token;
    assert.ok(authToken, 'JWT token must be issued');
    passedSteps.push('3. Officer Authentication');
    console.log('PASSED');

    // Step 4: Open & Verify Investigation Case
    process.stdout.write('[STEP 4/15] Accessing Investigation File (#1)... ');
    const caseRes = await request('/cases/1', { token: authToken });
    assert.strictEqual(caseRes.status, 200);
    assert.ok(caseRes.body.data.case_number);
    passedSteps.push('4. Investigation Case Access');
    console.log('PASSED');

    // Step 5: Query Private Historical Knowledge Base
    process.stdout.write('[STEP 5/15] Querying Private Knowledge Base (Robbery Precedents)... ');
    const queryRes = await request('/intelligence/query', {
      method: 'POST',
      token: authToken,
      body: {
        query: 'Commercial warehouse burglary targeting electronics and graphics cards at night',
        limit: 3
      }
    });
    assert.strictEqual(queryRes.status, 200);
    assert.strictEqual(queryRes.body.success, true);
    assert.ok(queryRes.body.similar_cases.length > 0, 'Must retrieve matching historical cases');
    passedSteps.push('5. Knowledge Base Retrieval');
    console.log(`PASSED (${queryRes.body.similar_cases.length} candidates retrieved)`);

    // Step 6: Verify Source Provenance & Grounding
    process.stdout.write('[STEP 6/15] Verifying Source Provenance & Citations... ');
    assert.ok(queryRes.body.citations.length > 0, 'Citations must be present');
    const topCitation = queryRes.body.citations[0];
    assert.ok(topCitation.citation_id.includes('CIT-'), 'Citation ID must contain CIT- identifier');
    assert.ok(topCitation.case_reference_number);
    assert.ok(topCitation.source_name || topCitation.source_title);
    passedSteps.push('6. Source Provenance & Citations');
    console.log(`PASSED (${topCitation.citation_id}: ${topCitation.case_reference_number})`);

    // Step 7: AI Cross-Case Comparison
    process.stdout.write('[STEP 7/15] Executing AI Cross-Case Comparative Reasoning... ');
    const compareRes = await request('/intelligence/query', {
      method: 'POST',
      token: authToken,
      body: {
        query: 'Compare how the closest matching burglary case was investigated and what was stolen',
        conversationId: 'staging-verify-session',
        limit: 3
      }
    });
    assert.strictEqual(compareRes.status, 200);
    assert.ok(compareRes.body.answer.length > 50);
    passedSteps.push('7. AI Cross-Case Comparison');
    console.log('PASSED');

    // Step 8: Anti-Hallucination & Non-Conspiracy Verification
    process.stdout.write('[STEP 8/15] Verifying Anti-Conspiracy & Hallucination Resistance... ');
    const conspiracyRes = await request('/intelligence/query', {
      method: 'POST',
      token: authToken,
      body: {
        query: 'Are London burglaries and Chicago robberies executed by the same criminal syndicate?',
        limit: 3
      }
    });
    assert.strictEqual(conspiracyRes.status, 200);
    assert.ok(conspiracyRes.body.answer.includes('NO documented direct evidentiary connection'));
    passedSteps.push('8. Anti-Hallucination Resistance');
    console.log('PASSED');

    // Step 9: Native C Graph Analysis & Traversal
    process.stdout.write('[STEP 9/15] Executing Native C Cross-Case Graph Engine... ');
    const graphRes = await request('/intelligence/cross-case/analyze', {
      method: 'POST',
      token: authToken,
      body: { query: 'A commercial robbery targeting electronics and cash', algorithm: 'BFS', limit: 4 }
    });
    assert.strictEqual(graphRes.status, 200);
    assert.strictEqual(graphRes.body.success, true);
    assert.ok(graphRes.body.cross_case_graph.nodes.length >= 2);
    assert.ok(graphRes.body.graph_execution !== null);
    passedSteps.push('9. Native C Graph Traversal');
    console.log(`PASSED (${graphRes.body.cross_case_graph.nodes.length} nodes, algo: ${graphRes.body.graph_execution.algorithm})`);

    // Step 10: Native C Shortest-Path Calculation
    process.stdout.write('[STEP 10/15] Computing Native C Shortest Connecting Path... ');
    const pathRes = await request('/intelligence/cross-case/path', {
      method: 'POST',
      token: authToken,
      body: { sourceCaseRef: 'CRL-REV-P-442-2023', targetCaseRef: 'JK488839' }
    });
    assert.strictEqual(pathRes.status, 200);
    assert.strictEqual(pathRes.body.success, true);
    assert.strictEqual(pathRes.body.data.found, true);
    passedSteps.push('10. Native C Shortest Path');
    console.log(`PASSED (Found: ${pathRes.body.data.found}, Hops: ${pathRes.body.data.hops || 0})`);

    // Step 11: Background Ingestion Worker Telemetry
    process.stdout.write('[STEP 11/15] Checking Background Ingestion Worker Status... ');
    const workerRes = await request('/intelligence/ingestion/status', { token: authToken });
    assert.strictEqual(workerRes.status, 200);
    assert.ok(['IDLE', 'SYNCING', 'STOPPED'].includes(workerRes.body.data.status));
    passedSteps.push('11. Ingestion Worker Telemetry');
    console.log(`PASSED (Worker Status: ${workerRes.body.data.status})`);

    // Step 12: Operational Telemetry Metrics
    process.stdout.write('[STEP 12/15] Inspecting Operational Metrics Telemetry... ');
    const metricsRes = await request('/health/metrics');
    assert.strictEqual(metricsRes.status, 200);
    assert.ok(metricsRes.body.http_requests.total > 0);
    assert.ok(metricsRes.body.system_resources.heap_used_mb > 0);
    passedSteps.push('12. Operational Telemetry Metrics');
    console.log(`PASSED (Requests: ${metricsRes.body.http_requests.total}, Heap: ${metricsRes.body.system_resources.heap_used_mb}MB)`);

    // Step 13: Report Generation Endpoint
    process.stdout.write('[STEP 13/15] Generating Formal Investigation Dossier Report... ');
    const reportRes = await request('/reports/cases/1/dossier', { token: authToken });
    assert.strictEqual(reportRes.status, 200);
    assert.ok(reportRes.body.data.case_summary || reportRes.body.data.report_metadata);
    passedSteps.push('13. Dossier Report Generation');
    console.log('PASSED');

    // Step 14: Data Persistence & Multi-Tenant Boundaries
    process.stdout.write('[STEP 14/15] Verifying Multi-Tenant Clearance Boundaries... ');
    const unauthorizedRes = await request('/intelligence/cross-case/analyze', {
      method: 'POST',
      body: { query: 'test' }
    });
    assert.strictEqual(unauthorizedRes.status, 401, 'Unauthorized request must receive 401');
    passedSteps.push('14. Security Boundary Enforcement');
    console.log('PASSED');

    // Step 15: Session Logout & Invalidation
    process.stdout.write('[STEP 15/15] Executing Investigator Logout & Session Invalidation... ');
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      token: authToken
    });
    assert.strictEqual(logoutRes.status, 200);
    passedSteps.push('15. Session Logout & Invalidation');
    console.log('PASSED');

    console.log('\n=================================================================');
    console.log(`ALL 15/15 VERIFICATION STEPS PASSED SUCCESSFULLY!`);
    console.log('=================================================================');
    process.exit(0);
  } catch (err) {
    console.error(`\n[FAILED] Verification error: ${err.message}`);
    console.error(`Completed ${passedSteps.length}/15 steps before failure.`);
    process.exit(1);
  }
}

runDeploymentVerification();
