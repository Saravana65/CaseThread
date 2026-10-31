const cEngineService = require('../services/cEngineService');

async function testIPC() {
  console.log('Testing C Engine IPC bridge from Node.js...');

  const samplePayload = {
    case_id: 42,
    entities: [
      { id: 1, type: 'SUSPECT', label: 'Vikram Singh' },
      { id: 2, type: 'SUSPECT', label: 'Rohan Sharma' },
      { id: 3, type: 'VEHICLE', label: 'Black Sedan DL-01-AB-1234' },
      { id: 4, type: 'LOCATION', label: 'Warehouse Dock 9' }
    ],
    evidence: [
      {
        id: 101,
        title: 'CCTV footage Dock 9',
        category: 'CCTV',
        timestamp: 1715000000,
        source: 'Port Security Camera 4',
        location: 'Warehouse Dock 9',
        verification_status: 'CONFIRMED_FACT',
        reliability_score: 0.95,
        entity_ids: [1, 3]
      },
      {
        id: 102,
        title: 'Anonymous tip claiming suspect fled',
        category: 'WITNESS_STATEMENT',
        timestamp: 1715000060, // 60 seconds later
        source: '',            // Missing source gap
        location: 'Highway Junction 50km away', // High speed anomaly
        verification_status: 'UNVERIFIED_OBSERVATION', // Gap
        reliability_score: 0.3,
        entity_ids: [1]
      }
    ],
    relationships: [
      { source_id: 1, target_id: 3, relationship_type: 'OPERATED', confidence: 0.9 },
      { source_id: 2, target_id: 3, relationship_type: 'PASSENGER', confidence: 0.85 },
      { source_id: 3, target_id: 4, relationship_type: 'LOCATED_AT', confidence: 0.95 }
    ],
    timeline: [
      { id: 1, timestamp: 1715000000, description: 'Vehicle spotted at Dock 9', location: 'Dock 9', entity_id: 3 },
      { id: 2, timestamp: 1715000060, description: 'Spotted at Highway Junction', location: 'Highway Junction', entity_id: 1 }
    ],
    query: {
      action: 'FIND_PATH',
      source_id: 1,
      source_type: 'SUSPECT',
      target_id: 4,
      target_type: 'LOCATION'
    }
  };

  try {
    const result = await cEngineService.runAnalysis(samplePayload);
    console.log('[SUCCESS] C Engine IPC analysis succeeded!');
    console.log('Engine Version:', result.engine_version);
    console.log('Graph Nodes Count:', (result.graph_nodes || []).length);
    console.log('Graph Edges Count:', (result.graph_edges || []).length);
    console.log('Classification Summary:', JSON.stringify(result.classification_summary, null, 2));
    console.log('Query Result (Shortest Path):', JSON.stringify(result.query_result, null, 2));
    console.log('Detected Gaps Count:', (result.evidence_gaps || []).length);
    console.log('Connected Components Count:', (result.connected_components || []).length);
    console.log('Isolated Nodes Count:', (result.isolated_nodes || []).length);
    return true;
  } catch (err) {
    console.error('[ERROR] C Engine IPC failed:', err);
    process.exit(1);
  }
}

testIPC();
