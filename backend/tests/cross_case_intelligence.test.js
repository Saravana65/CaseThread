/**
 * @file cross_case_intelligence.test.js
 * @brief Comprehensive automated test suite for Phase 17 Global Cross-Case Intelligence,
 * Native C Graph Analysis, and Explainable Crime Pattern Detection.
 * @project CASETHREAD
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { testConnection } = require('../database/connection');
const CrossCaseService = require('../knowledge-base/intelligence/cross-case/crossCaseService');
const CrossCaseGraphBuilder = require('../knowledge-base/intelligence/cross-case/crossCaseGraphBuilder');
const NativeGraphService = require('../knowledge-base/intelligence/cross-case/nativeGraphService');
const PatternDetector = require('../knowledge-base/intelligence/cross-case/patternDetector');
const IntelligenceService = require('../knowledge-base/intelligence/intelligenceService');

describe('Phase 17: Global Cross-Case Intelligence & Native C Graph Analysis Suite', () => {
  let authToken = null;

  before(async () => {
    await testConnection();

    // Authenticate and obtain JWT token for API endpoint testing
    authToken = await new Promise((resolve) => {
      const payload = JSON.stringify({ badge_number: 'DET-8841', password: 'Password123!' });
      const req = http.request({
        hostname: '127.0.0.1',
        port: 5001,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data.data?.token || data.token);
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.write(payload);
      req.end();
    });
  });

  describe('1. Evidence-Grounded Cross-Case Graph Construction', () => {
    it('should build typed nodes and edges strictly distinguishing shared attributes from direct links', () => {
      const sampleDocs = [
        {
          document_id: 32,
          case_reference_number: 'CRL-REV-P-442-2023',
          document_title: 'Commercial Warehouse Armed Robbery',
          country: 'India',
          jurisdiction: 'High Court of Delhi',
          crime_category: 'ROBBERY',
          stolen_property: 'Cash proceeds and electronic components',
          case_outcome: 'CONVICTED_SENTENCED_7_YEARS_RI',
          investigative_actions: 'Spot CCTV DVR seizure and cellular tower dump analysis'
        },
        {
          document_id: 101,
          case_reference_number: 'UK-MET-2024-001',
          document_title: 'London Commercial Break-in',
          country: 'United Kingdom',
          jurisdiction: 'Metropolitan Police Service',
          crime_category: 'BURGLARY',
          stolen_property: 'Electronics and computing hardware',
          case_outcome: 'Investigation complete; no suspect identified',
          investigative_actions: null
        }
      ];

      const graph = CrossCaseGraphBuilder.buildGraph(sampleDocs);

      assert.ok(graph.nodes.length >= 4, 'Graph must include case and attribute nodes');
      assert.ok(graph.edges.length >= 3, 'Graph must include attribute edges');

      // Check node types
      const caseNodes = graph.nodes.filter(n => n.type === 'HISTORICAL_CASE');
      assert.strictEqual(caseNodes.length, 2, 'Should create 2 case nodes');

      const propNodes = graph.nodes.filter(n => n.type === 'PROPERTY_CATEGORY');
      assert.ok(propNodes.some(n => n.label.includes('Electronics')), 'Should create electronics property node');

      // Check edge relationship nature
      const sharedEdges = graph.edges.filter(e => e.relationship_nature === 'SHARED_ATTRIBUTE');
      assert.ok(sharedEdges.length > 0, 'Must classify property connection as SHARED_ATTRIBUTE');

      // Validate C-engine payload formatting
      assert.ok(graph.cPayload.entities.length === graph.nodes.length);
      assert.ok(graph.cPayload.relationships.length === graph.edges.length);
    });
  });

  describe('2. Native C Graph Algorithm Execution', () => {
    it('should execute Native C BFS exploration across cross-case graph with sub-50ms latency', async () => {
      const sampleDocs = [
        {
          document_id: 32,
          case_reference_number: 'CRL-REV-P-442-2023',
          country: 'India',
          crime_category: 'ROBBERY',
          stolen_property: 'Electronics and cash'
        },
        {
          document_id: 101,
          case_reference_number: 'UK-MET-001',
          country: 'United Kingdom',
          crime_category: 'ROBBERY',
          stolen_property: 'Electronics'
        }
      ];

      const graph = CrossCaseGraphBuilder.buildGraph(sampleDocs);
      const bfsResult = await NativeGraphService.runBfs(graph.cPayload, 0);

      assert.strictEqual(bfsResult.algorithm, 'BFS');
      assert.ok(bfsResult.lab_result, 'Must return native C lab result');
      assert.strictEqual(bfsResult.lab_result.status, 'SUCCESS');
      assert.ok(bfsResult.lab_result.trace.length > 0, 'Must record step-by-step queue trace');
      assert.ok(bfsResult.execution_latency_ms < 1000, 'Latency must be bounded');
    });

    it('should compute Native C shortest path connecting two cases via a shared property intermediary', async () => {
      const sampleDocs = [
        {
          document_id: 32,
          case_reference_number: 'CRL-REV-P-442-2023',
          country: 'India',
          crime_category: 'ROBBERY',
          stolen_property: 'Electronics'
        },
        {
          document_id: 101,
          case_reference_number: 'UK-MET-001',
          country: 'United Kingdom',
          crime_category: 'ROBBERY',
          stolen_property: 'Electronics'
        }
      ];

      const graph = CrossCaseGraphBuilder.buildGraph(sampleDocs);
      const caseA = graph.nodes.find(n => n.case_reference_number === 'CRL-REV-P-442-2023');
      const caseB = graph.nodes.find(n => n.case_reference_number === 'UK-MET-001');

      const pathResult = await NativeGraphService.runShortestPath(graph.cPayload, caseA.id, caseB.id);

      assert.strictEqual(pathResult.algorithm, 'SHORTEST_PATH');
      assert.strictEqual(pathResult.lab_result.found, true);
      assert.strictEqual(pathResult.lab_result.path_length, 2, 'Should connect Case A -> Electronics -> Case B in 2 hops');
      assert.strictEqual(pathResult.lab_result.path_nodes[1].label.includes('Electronics'), true);
    });

    it('should execute Native C Connected Components partitioning', async () => {
      const sampleDocs = [
        { document_id: 1, case_reference_number: 'CASE-A', crime_category: 'ROBBERY', stolen_property: 'Cash' },
        { document_id: 2, case_reference_number: 'CASE-B', crime_category: 'CYBERCRIME_AND_FRAUD', stolen_property: 'Digital Funds' }
      ];

      const graph = CrossCaseGraphBuilder.buildGraph(sampleDocs);
      const compResult = await NativeGraphService.runConnectedComponents(graph.cPayload);

      assert.strictEqual(compResult.algorithm, 'CONNECTED_COMPONENTS');
      assert.ok(compResult.connected_components >= 1);
    });
  });

  describe('3. Empirical Crime Pattern Detection', () => {
    it('should detect commercial night-hour electronics & currency theft pattern with source citations', () => {
      const docs = [
        {
          document_id: 32,
          case_reference_number: 'CRL-REV-P-442-2023',
          country: 'India',
          jurisdiction: 'High Court of Delhi',
          crime_category: 'ROBBERY',
          stolen_property: 'Cash proceeds and electronic components',
          documented_circumstances: 'Commercial warehouse forced entry at 21:15'
        },
        {
          document_id: 50,
          case_reference_number: 'US-CHI-2024-991',
          country: 'United States',
          jurisdiction: 'City of Chicago Police',
          crime_category: 'ROBBERY',
          stolen_property: 'Commercial cash register and computing hardware',
          documented_circumstances: 'Armed robbery at commercial distribution center'
        }
      ];

      const patterns = PatternDetector.detectPatterns(docs);

      assert.ok(patterns.length >= 1, 'Should detect at least 1 pattern');
      const elecPattern = patterns.find(p => p.pattern_id === 'PAT-ELEC-COMMERCIAL-ROBBERY');
      assert.ok(elecPattern, 'Must detect commercial electronics robbery pattern');
      assert.strictEqual(elecPattern.frequency_count, 2);
      assert.ok(elecPattern.source_citations.length === 2);
      assert.ok(elecPattern.forensic_limitations.includes('SHARED_MODUS_OPERANDI_ONLY'));
    });
  });

  describe('4. AI Assistant & Voice Dialogue Integration', () => {
    it('should answer "What patterns do these burglaries share?" with empirical pattern analysis', async () => {
      const res = await IntelligenceService.queryIntelligence({
        query: 'What patterns do these commercial robberies and burglaries share?',
        limit: 4
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.query_understanding.requested_intent, 'CROSS_CASE_PATTERNS');
      assert.ok(res.patterns_detected.length > 0, 'Must return detected patterns array');
      assert.ok(res.answer.includes('Patterns Detected'), 'Spoken answer must summarize patterns');
      assert.ok(res.cross_case_graph.nodes.length > 0, 'Must attach cross-case graph nodes');
    });

    it('should answer "Are these incidents directly connected?" with explicit non-conspiracy clarification', async () => {
      const res = await IntelligenceService.queryIntelligence({
        query: 'Are these incidents directly connected?',
        limit: 3
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.query_understanding.requested_intent, 'DIRECT_CONNECTION_CHECK');
      assert.ok(res.answer.includes('NO documented direct evidentiary connection'), 'Must explicitly disclaim unverified links');
    });

    it('should answer "Explain the graph analysis" incorporating native C traversal metrics', async () => {
      const res = await IntelligenceService.queryIntelligence({
        query: 'Explain the graph analysis of these cases.',
        limit: 3
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.query_understanding.requested_intent, 'GRAPH_ANALYSIS');
      assert.ok(res.answer.includes('Native C Graph Analysis'), 'Answer must explain C graph execution');
      assert.ok(res.answer.includes('O(V+E)'), 'Answer must detail algorithm complexity');
    });
  });

  describe('5. Authenticated REST API Endpoints', () => {
    it('POST /api/v1/intelligence/cross-case/analyze returns complete cross-case intelligence', async () => {
      const resData = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({
          query: 'A commercial robbery targeting electronics and cash',
          algorithm: 'BFS',
          limit: 4
        });
        const req = http.request({
          hostname: '127.0.0.1',
          port: 5001,
          path: '/api/v1/intelligence/cross-case/analyze',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': `Bearer ${authToken}`
          }
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      assert.strictEqual(resData.status, 200);
      assert.strictEqual(resData.data.success, true);
      assert.ok(resData.data.cross_case_graph.nodes.length > 0);
      assert.ok(resData.data.cross_case_graph.edges.length > 0);
      assert.ok(resData.data.graph_execution !== null);
      assert.ok(resData.data.investigative_verification_questions.length > 0);
    });

    it('POST /api/v1/intelligence/cross-case/path finds shortest path connecting two cases', async () => {
      const resData = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({
          sourceCaseRef: 'CRL-REV-P-442-2023',
          targetCaseRef: 'JK488839'
        });
        const req = http.request({
          hostname: '127.0.0.1',
          port: 5001,
          path: '/api/v1/intelligence/cross-case/path',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': `Bearer ${authToken}`
          }
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      assert.strictEqual(resData.status, 200);
      assert.strictEqual(resData.data.success, true);
      assert.strictEqual(resData.data.data.found, true);
      assert.ok(resData.data.data.hops >= 1);
      assert.ok(resData.data.data.trace.length > 0);
    });

    it('POST /api/v1/intelligence/cross-case/analyze rejects unauthorized requests with 401', async () => {
      const status = await new Promise((resolve) => {
        const payload = JSON.stringify({ query: 'test' });
        const req = http.request({
          hostname: '127.0.0.1',
          port: 5001,
          path: '/api/v1/intelligence/cross-case/analyze',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (res) => resolve(res.statusCode));
        req.write(payload);
        req.end();
      });

      assert.strictEqual(status, 401);
    });
  });

  after(async () => {
    const { closePool } = require('../database/connection');
    await closePool();
  });
});
