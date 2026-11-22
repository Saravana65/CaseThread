/**
 * @file labController.js
 * @brief Controller for the Native C Investigation Lab (Phase 7).
 * @project CASETHREAD - Forensic Investigation Intelligence System
 */

const { execute } = require('../database/connection');
const cEngineService = require('../services/cEngineService');

// Static catalog of implemented algorithms
const ALGORITHM_CATALOG = [
  {
    id: 'BFS',
    name: 'Breadth-First Search (BFS)',
    category: 'Graph Exploration',
    data_structure: 'FIFO Queue & Adjacency List',
    purpose: 'Level-by-level exploration of entity connections and discovery of nearest evidentiary links.',
    real_case_use: 'Identifies immediate 1-hop and 2-hop criminal associates, communications, and co-locations from a person of interest.',
    time_complexity: 'O(V + E)',
    space_complexity: 'O(V)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Uses a FIFO queue to discover all vertices at distance k before moving to distance k+1. Guaranteed to visit vertices in non-decreasing order of hop distance.'
  },
  {
    id: 'DFS',
    name: 'Depth-First Search (DFS)',
    category: 'Graph Exploration',
    data_structure: 'LIFO Call Stack & Adjacency List',
    purpose: 'Deep branch traversal to uncover extended chains of custody, accomplice trees, and cyclical relationships.',
    real_case_use: 'Detects circular money laundering transactions and cyclical alibi references.',
    time_complexity: 'O(V + E)',
    space_complexity: 'O(V)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Explores as deep as possible along each branch before backtracking. Backtracking occurs when a vertex has no unvisited incident neighbors.'
  },
  {
    id: 'SHORTEST_PATH',
    name: 'Unweighted Shortest Path (BFS)',
    category: 'Path Analysis',
    data_structure: 'BFS Queue with Predecessor Array',
    purpose: 'Finds the minimum number of evidentiary hops connecting two disparate entities in the case network.',
    real_case_use: 'Establishes direct provenance chain between an unidentified victim and a prime suspect via intermediary items.',
    time_complexity: 'O(V + E)',
    space_complexity: 'O(V)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Maintains a parent array parent[v] = u during BFS traversal. When target is dequeued, the optimal path is reconstructed backwards.'
  },
  {
    id: 'CONNECTED_COMPONENTS',
    name: 'Connected Components & Isolated Leads',
    category: 'Graph Partitioning',
    data_structure: 'DFS Disjoint Graph Traversal',
    purpose: 'Partitions case graph into disconnected subgraphs and identifies uncorroborated evidence items (degree 0).',
    real_case_use: 'Flags evidence islands and ensures isolated leads receive detective follow-up.',
    time_complexity: 'O(V + E)',
    space_complexity: 'O(V)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Iterates through all vertices; if a vertex is unvisited, initiates a full DFS traversal marking all reachable vertices with that component ID.'
  },
  {
    id: 'HASH_MAP',
    name: 'Separate-Chaining Hash Map (DJB2)',
    category: 'Hashing & Indexing',
    data_structure: 'Array of Singly Linked Bucket Chains',
    purpose: 'O(1) average-time indexing and retrieval of evidence records, vehicle plates, and phone numbers.',
    real_case_use: 'Instant lookup of physical evidence barcodes (e.g. EVD-2026-0042) without scanning database tables.',
    time_complexity: 'O(1) average, O(N) worst case',
    space_complexity: 'O(Capacity + N)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Uses Daniel J. Bernstein DJB2 hash algorithm (hash = ((hash << 5) + hash) + c). Collisions are resolved using separate chaining linked lists. Resizes when load factor > 0.75.'
  },
  {
    id: 'TRIE',
    name: 'Forensic Identifier Prefix Tree (Trie)',
    category: 'String Searching & Autocomplete',
    data_structure: '128-Way ASCII Retrieval Tree',
    purpose: 'Prefix searching and autocompletion of evidence serials, suspect callsigns, and case docket numbers.',
    real_case_use: 'Instantly matches partial evidence codes (e.g., "EVD-2026-") and autocomplete suspect names in field reports.',
    time_complexity: 'O(L) insert/search, O(P + K) prefix completion',
    space_complexity: 'O(Alphabet * L * N)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Each tree node represents a character. Common prefixes share paths, minimizing redundant storage and enabling optimal O(L) searches independent of database size.'
  },
  {
    id: 'AVL_TREE',
    name: 'Self-Balancing AVL Tree',
    category: 'Balanced Trees',
    data_structure: 'Binary Search Tree with Height-Balanced Invariant',
    purpose: 'Strict O(log N) chronological event indexing, time-range queries, and spatiotemporal anomaly detection.',
    real_case_use: 'Detects impossible travel velocities between two chronological incidents (alibi contradiction).',
    time_complexity: 'O(log N) guaranteed for Search/Insert, O(log N + K) for Range Query',
    space_complexity: 'O(N)',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Enforces Balance Factor balance(node) = height(left) - height(right) in [-1, 1]. Rotations (LL, RR, LR, RL) automatically rebalance the tree upon insertion.'
  },
  {
    id: 'MAX_HEAP',
    name: 'Binary Max-Heap Priority Queue',
    category: 'Priority Queues',
    data_structure: 'Array-Based Complete Binary Tree',
    purpose: 'Logarithmic extraction of top-priority investigative leads and evidence collection tasks.',
    real_case_use: 'Ensures detective attention is strictly allocated to the highest-confidence actionable leads first.',
    time_complexity: 'O(log N) Insert/Extract-Max, O(1) Peek-Max',
    space_complexity: 'O(N) contiguous array',
    verified: true,
    interactive_demo: true,
    viva_notes: 'Maintains Max-Heap Property: elements[parent] >= elements[child] for all nodes. Sift-up and sift-down maintain the property in O(log N).'
  }
];

// Controlled demonstration datasets for academic demonstration
const DEMO_DATASETS = {
  graph: {
    case_id: 9999,
    case_metadata: { title: 'DEMO CASE: Downtown Jewelry Heist', case_number: 'CASE-DEMO-01' },
    entities: [
      { id: 1, type: 'SUSPECT', label: 'Vincent Specter Kane' },
      { id: 2, type: 'SUSPECT', label: 'Elena Rostova (Getaway Driver)' },
      { id: 3, type: 'VICTIM', label: 'Arthur Pendelton (Jewelry Owner)' },
      { id: 4, type: 'WITNESS', label: 'Marcus Vance (Night Guard)' },
      { id: 5, type: 'VEHICLE', label: 'Black Sedan (Plate 7XYZ99)' },
      { id: 6, type: 'LOCATION', label: 'Depository Vault B' },
      { id: 7, type: 'EVIDENCE', label: 'Discarded Burner Phone' },
      { id: 8, type: 'EVIDENCE', label: 'Isolated Anonymous Tip Note' }
    ],
    evidence: [
      { id: 101, tracking_code: 'EVD-DEMO-01', title: 'Cut Padlock', category: 'PHYSICAL', location: 'Vault B' },
      { id: 102, tracking_code: 'EVD-DEMO-02', title: 'Cell Tower Sector 4 Ping', category: 'DIGITAL', location: 'Tower 4' },
      { id: 103, tracking_code: 'EVD-DEMO-03', title: 'Tire Tread Casting', category: 'PHYSICAL', location: 'Alleyway' }
    ],
    relationships: [
      { id: 1, source_type: 'SUSPECT', source_id: 1, target_type: 'SUSPECT', target_id: 2, relation_type: 'PHONE_COMMUNICATION', confidence_weight: 0.95 },
      { id: 2, source_type: 'SUSPECT', source_id: 2, target_type: 'VEHICLE', target_id: 5, relation_type: 'VEHICLE_OPERATOR', confidence_weight: 0.90 },
      { id: 3, source_type: 'VEHICLE', source_id: 5, target_type: 'LOCATION', target_id: 6, relation_type: 'PROXIMITY_CCTV', confidence_weight: 0.88 },
      { id: 4, source_type: 'LOCATION', source_id: 6, target_type: 'VICTIM', target_id: 3, relation_type: 'CRIME_SCENE', confidence_weight: 1.0 },
      { id: 5, source_type: 'SUSPECT', source_id: 1, target_type: 'EVIDENCE', target_id: 7, relation_type: 'FINGERPRINT_MATCH', confidence_weight: 0.92 },
      { id: 6, source_type: 'WITNESS', source_id: 4, target_type: 'SUSPECT', target_id: 1, relation_type: 'VISUAL_IDENTIFICATION', confidence_weight: 0.75 }
      // Node 8 (Isolated Anonymous Tip Note) is intentionally left isolated (degree 0) for component testing
    ],
    timeline: [
      { event_id: 1, timestamp_epoch: 1700000000, entity_type: 'LOCATION', location: 'Vault B', is_verified: true },
      { event_id: 2, timestamp_epoch: 1700000600, entity_type: 'VEHICLE', location: 'Alleyway', is_verified: true },
      { event_id: 3, timestamp_epoch: 1700001200, entity_type: 'SUSPECT', location: 'Highway North', is_verified: false }
    ]
  },
  hash_keys: [
    'EVD-2026-0042',
    'EVD-2026-0043',
    'SUS-MARCUS',
    'SUS-VALENTINE',
    'PLATE-7XYZ99',
    'LOC-VAULT-7',
    'PHONE-555-0199',
    'COLLISION-A',
    'COLLISION-B'
  ],
  avl_timestamps: [
    { timestamp: 1000, label: '01:00 AM - Security Patrol Departs' },
    { timestamp: 2000, label: '01:16 AM - Main Power Generator Cut' },
    { timestamp: 3000, label: '01:33 AM - Vault Thermal Sensor Disabled' },
    { timestamp: 1500, label: '01:08 AM - Perimeter Motion Trigger' },
    { timestamp: 2500, label: '01:25 AM - Loading Bay Door Forced' },
    { timestamp: 500,  label: '00:52 AM - Exterior Camera Spray-Painted' },
    { timestamp: 250,  label: '00:45 AM - Unknown Vehicle Enters Alley' }
  ],
  heap_leads: [
    { priority: 95.0, title: 'Execute Emergency Search Warrant on Depository Safehouse' },
    { priority: 91.0, title: 'Cross-reference Vehicle Plate 7XYZ99 Toll Records' },
    { priority: 88.5, title: 'Subpoena Cell Tower Sector 7 Dump' },
    { priority: 73.5, title: 'Interrogate Keycard Access Holder #8814' },
    { priority: 62.0, title: 'Analyze Hardware Firmware on CCTV DVR Unit' },
    { priority: 54.0, title: 'Re-interview Night Guard Marcus Vance' },
    { priority: 45.0, title: 'Review Pawn Shop Ledger Discrepancies' }
  ],
  trie_words: [
    'EVD-2026-001',
    'EVD-2026-002',
    'EVD-2026-015',
    'EVD-2026-042',
    'SUS-MARCUS',
    'SUS-MARIA',
    'SUS-MICHAEL',
    'LOC-VAULT-A',
    'LOC-VAULT-B',
    'LOC-HARBOUR'
  ]
};

/**
 * GET /api/v1/lab/catalog
 * Returns the catalog of verified C engine algorithms.
 */
exports.getCatalog = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        total_algorithms: ALGORITHM_CATALOG.length,
        catalog: ALGORITHM_CATALOG
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/lab/demo-datasets
 * Returns controlled demonstration datasets for laboratory experiments.
 */
exports.getDemoDatasets = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: DEMO_DATASETS
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/lab/execute
 * Dispatches an algorithm run to the native C engine with trace capture.
 */
exports.executeAlgorithm = async (req, res, next) => {
  try {
    const {
      caseId = 1,
      algorithm = 'BFS',
      mode = 'REAL',
      startNodeId = 0,
      targetNodeId = 1,
      searchTerm = '',
      operation = 'EXECUTE'
    } = req.body;

    let payload;

    if (mode === 'DEMO') {
      // Use clean, isolated demo dataset
      payload = JSON.parse(JSON.stringify(DEMO_DATASETS.graph));
    } else {
      // Use real MySQL investigation records
      const targetCaseId = parseInt(caseId, 10) || 1;
      const [cases] = await execute('SELECT * FROM cases WHERE case_id = ?', [targetCaseId]);
      if (!cases || cases.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'CASE_NOT_FOUND', message: `Investigation docket #${targetCaseId} was not found.` }
        });
      }

      const [suspects] = await execute('SELECT * FROM suspects WHERE case_id = ?', [targetCaseId]);
      const [victims] = await execute('SELECT * FROM victims WHERE case_id = ?', [targetCaseId]);
      const [witnesses] = await execute('SELECT * FROM witnesses WHERE case_id = ?', [targetCaseId]);
      const [evidence] = await execute('SELECT * FROM evidence WHERE case_id = ? AND is_archived = 0', [targetCaseId]);
      const [relationships] = await execute('SELECT * FROM evidence_relationships WHERE case_id = ?', [targetCaseId]);
      const [timeline] = await execute('SELECT * FROM investigation_timelines WHERE case_id = ? ORDER BY event_timestamp ASC', [targetCaseId]);

      payload = {
        case_id: targetCaseId,
        case_metadata: cases[0],
        entities: [
          ...suspects.map(s => ({ id: s.suspect_id, type: 'SUSPECT', label: s.full_name, alias: s.alias })),
          ...victims.map(v => ({ id: v.victim_id, type: 'VICTIM', label: v.full_name })),
          ...witnesses.map(w => ({ id: w.witness_id, type: 'WITNESS', label: w.full_name }))
        ],
        evidence: evidence.map(e => ({
          id: e.evidence_id,
          tracking_code: e.tracking_code,
          category: e.category,
          title: e.title,
          location: e.collection_location,
          timestamp: e.collected_at ? Math.floor(new Date(e.collected_at).getTime() / 1000) : 0
        })),
        relationships: relationships.map(r => ({
          id: r.relationship_id,
          source_type: r.source_type,
          source_id: r.source_id,
          target_type: r.target_type,
          target_id: r.target_id,
          relation_type: r.relation_type,
          confidence_weight: parseFloat(r.confidence_weight || 0.5)
        })),
        timeline: timeline.map(t => ({
          event_id: t.timeline_id,
          timestamp_epoch: Math.floor(new Date(t.event_timestamp).getTime() / 1000),
          location: t.location,
          is_verified: !!t.is_verified
        }))
      };
    }

    // Attach lab query parameters for the C Algorithm Engine
    payload.lab_query = {
      algorithm,
      mode,
      start_node_id: parseInt(startNodeId, 10) || 0,
      target_node_id: parseInt(targetNodeId, 10) || 1,
      search_term: searchTerm || '',
      operation
    };

    // Dispatch payload to compiled C engine executable
    const engineResults = await cEngineService.runAnalysis(payload);

    res.json({
      success: true,
      data: {
        engine_version: engineResults.engine_version,
        case_id: payload.case_id,
        mode,
        algorithm,
        lab_result: engineResults.lab_result || { status: 'COMPLETE', message: 'Algorithm executed cleanly.' },
        graph_nodes: engineResults.graph_nodes || [],
        graph_edges: engineResults.graph_edges || []
      }
    });
  } catch (error) {
    next(error);
  }
};
