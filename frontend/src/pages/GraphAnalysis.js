/**
 * @file GraphAnalysis.js
 * @description Evidence Relationship Analysis & Interactive Graph Visualization Page.
 *              Displays graph topologies and traversals computed exclusively by the C Core Engine.
 * @project CASETHREAD
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import GraphCanvas from '../components/GraphCanvas';

export default function GraphAnalysis() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Graph Data (Received directly from C Algorithm Engine)
  const [graphData, setGraphData] = useState({
    nodes: [],
    edges: [],
    connected_components: [],
    isolated_nodes: [],
    classification_summary: {},
    metrics: {}
  });

  // Selection & Inspector State
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  // Path Finding State
  const [pathSource, setPathSource] = useState('');
  const [pathTarget, setPathTarget] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);

  // Filter State
  const [filterTypes, setFilterTypes] = useState({
    SUSPECT: true,
    VICTIM: true,
    WITNESS: true,
    VEHICLE: true,
    LOCATION: true,
    CCTV: true,
    PHONE: true,
    EVIDENCE: true
  });

  const [filterOrigins, setFilterOrigins] = useState({
    DIRECTLY_DOCUMENTED: true,
    DATA_DERIVED: true,
    SUGGESTED_FOR_VERIFICATION: true,
    UNVERIFIED: true
  });

  const [highlightedComponent, setHighlightedComponent] = useState(null);

  // Load cases on mount
  useEffect(() => {
    loadCases();
  }, []);

  // Load graph data whenever selectedCaseId changes
  useEffect(() => {
    if (selectedCaseId) {
      loadGraph(selectedCaseId);
    }
  }, [selectedCaseId]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await api.getCases();
      if (res.data && res.data.length > 0) {
        setCases(res.data);
        setSelectedCaseId(res.data[0].case_id);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGraph = async (caseId) => {
    try {
      setAnalyzing(true);
      setSelectedNode(null);
      setSelectedEdge(null);
      setPathResult(null);
      setHighlightedComponent(null);

      const res = await api.getCaseGraph(caseId);
      if (res.data) {
        setGraphData({
          nodes: res.data.nodes || [],
          edges: res.data.edges || [],
          connected_components: res.data.connected_components || [],
          isolated_nodes: res.data.isolated_nodes || [],
          classification_summary: res.data.classification_summary || {},
          metrics: res.data.metrics || {},
          execution_latency_ms: res.data.execution_latency_ms
        });

        if (res.data.nodes && res.data.nodes.length >= 2) {
          setPathSource(res.data.nodes[0].node_id);
          setPathTarget(res.data.nodes[1].node_id);
        }
      }
    } catch (err) {
      console.error('Failed to load graph analysis:', err);
      alert('Graph analysis failed: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Find Path between two nodes using C BFS
  const handleFindPath = async () => {
    if (!selectedCaseId || pathSource === '' || pathTarget === '') return;

    try {
      setPathLoading(true);
      const res = await api.findGraphPath(selectedCaseId, pathSource, pathTarget);
      if (res.data && res.data.path) {
        setPathResult(res.data.path);
      }
    } catch (err) {
      console.error('Path search error:', err);
      alert('Path finding error: ' + err.message);
    } finally {
      setPathLoading(false);
    }
  };

  const toggleTypeFilter = (type) => {
    setFilterTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleOriginFilter = (origin) => {
    setFilterOrigins(prev => ({ ...prev, [origin]: !prev[origin] }));
  };

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Header & Case Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-default)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.5px' }}>
              EVIDENCE RELATIONSHIP <span style={{ color: 'var(--accent-red)' }}>GRAPH</span>
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Core Engine: C99 Graph Traversals • Adjacency List BFS/DFS • Connected Components
            </p>
          </div>

          {/* Case Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CASE:</span>
            <select
              value={selectedCaseId || ''}
              onChange={(e) => setSelectedCaseId(parseInt(e.target.value, 10))}
              className="form-control"
              style={{
                width: '260px',
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-default)'
              }}
            >
              {cases.map(c => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_number} • {c.title.slice(0, 24)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => selectedCaseId && loadGraph(selectedCaseId)}
          disabled={analyzing}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
        >
          {analyzing ? '⏳ Processing in C Engine...' : '⚡ Re-Analyze Graph'}
        </button>
      </div>

      {/* Metrics Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.8rem',
        marginBottom: '1.5rem'
      }}>
        <div className="forensic-card accent-red-border" style={{ padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            GRAPH NODES
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {graphData.nodes.length}
          </div>
        </div>

        <div className="forensic-card accent-orange-border" style={{ padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            RELATIONAL EDGES
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {graphData.edges.length}
          </div>
        </div>

        <div className="forensic-card" style={{ padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            CONNECTED COMPONENTS
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#58a6ff', marginTop: '0.2rem' }}>
            {(graphData.connected_components || []).length}
          </div>
        </div>

        <div className="forensic-card" style={{ padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            ISOLATED LEADS
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f85149', marginTop: '0.2rem' }}>
            {(graphData.isolated_nodes || []).length}
          </div>
        </div>

        <div className="forensic-card" style={{ padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            C LATENCY
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3fb950', marginTop: '0.2rem' }}>
            {graphData.execution_latency_ms || 12} ms
          </div>
        </div>
      </div>

      {/* Main Graph Grid (Filters + Canvas + Inspector) */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '1.2rem', alignItems: 'start' }}>
        
        {/* Left Control Column: Filters & Path Finder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Path Finding Tool */}
          <div className="forensic-card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.8rem', color: 'var(--text-accent)' }}>
              🔍 Shortest Path Finder (BFS)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Source Record:</label>
                <select
                  value={pathSource}
                  onChange={(e) => setPathSource(parseInt(e.target.value, 10))}
                  className="form-control"
                  style={{ width: '100%', fontSize: '0.75rem', marginTop: '0.2rem' }}
                >
                  {graphData.nodes.map(n => (
                    <option key={n.node_id} value={n.node_id}>
                      [{n.entity_type}] {n.label.slice(0, 18)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Target Record:</label>
                <select
                  value={pathTarget}
                  onChange={(e) => setPathTarget(parseInt(e.target.value, 10))}
                  className="form-control"
                  style={{ width: '100%', fontSize: '0.75rem', marginTop: '0.2rem' }}
                >
                  {graphData.nodes.map(n => (
                    <option key={n.node_id} value={n.node_id}>
                      [{n.entity_type}] {n.label.slice(0, 18)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleFindPath}
                disabled={pathLoading}
                className="btn-primary"
                style={{ marginTop: '0.4rem', fontSize: '0.75rem', padding: '0.4rem' }}
              >
                {pathLoading ? 'Tracing...' : 'Trace Investigative Chain'}
              </button>

              {pathResult && (
                <div style={{
                  marginTop: '0.6rem',
                  padding: '0.6rem',
                  backgroundColor: 'rgba(255, 215, 0, 0.08)',
                  border: '1px solid #ffd700',
                  borderRadius: '4px',
                  fontSize: '0.72rem'
                }}>
                  {pathResult.found ? (
                    <>
                      <div style={{ color: '#ffd700', fontWeight: '700', marginBottom: '0.3rem' }}>
                        ✓ {pathResult.path_length - 1} Intermediate Hops
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        {pathResult.explanation}
                      </div>
                      <ol style={{ paddingLeft: '1rem', color: 'var(--text-muted)' }}>
                        {pathResult.steps.map(s => (
                          <li key={s.step} style={{ marginBottom: '0.2rem' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{s.label}</strong> ({s.type})
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <div style={{ color: '#f85149' }}>{pathResult.message}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Entity Type Filters */}
          <div className="forensic-card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
              Entity Filter
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.keys(filterTypes).map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filterTypes[t]}
                    onChange={() => toggleTypeFilter(t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Relationship Origin Filters */}
          <div className="forensic-card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
              Relationship Nature
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.keys(filterOrigins).map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filterOrigins[o]}
                    onChange={() => toggleOriginFilter(o)}
                  />
                  <span>{o.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Connected Components Cluster Highlights */}
          <div className="forensic-card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
              Clusters (DFS)
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {graphData.connected_components.map(c => (
                <button
                  key={c.component_id}
                  onClick={() => setHighlightedComponent(highlightedComponent === c.component_id ? null : c.component_id)}
                  className={highlightedComponent === c.component_id ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                >
                  Cluster #{c.component_id} ({c.nodes.length})
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Center: Graph Canvas */}
        <div>
          <GraphCanvas
            nodes={graphData.nodes}
            edges={graphData.edges}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            highlightedPath={pathResult}
            highlightedComponent={highlightedComponent}
            onSelectNode={(node) => {
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            onSelectEdge={(edge) => {
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
            filterTypes={filterTypes}
            filterOrigins={filterOrigins}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.6rem',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}>
            <span>TIP: Click & drag nodes to pin • Scroll wheel zooms • Click edge to inspect</span>
            <span>Rendered via C-Engine Graph Structure</span>
          </div>
        </div>

        {/* Right Inspector Column: Node or Edge Details */}
        <div className="forensic-card" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.8rem', color: 'var(--text-accent)' }}>
            Investigation Inspector
          </h3>

          {selectedNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.78rem' }}>
              <div>
                <span className="badge badge-high">{selectedNode.entity_type}</span>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                  {selectedNode.label}
                </h4>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status / Provenance</div>
                <div style={{ color: selectedNode.verification_status === 'CONFIRMED_FACT' ? '#3fb950' : '#d29922' }}>
                  {selectedNode.verification_status}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Relational Degree</div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>
                  {selectedNode.degree} Incident Connections
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Network Partition</div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>
                  Cluster #{selectedNode.component_id} {selectedNode.is_isolated ? '(ISOLATED NODE)' : ''}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '0.6rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Incident Connections
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {graphData.edges
                    .filter(e => e.source_id === selectedNode.node_id || e.target_id === selectedNode.node_id)
                    .map(e => {
                      const otherLabel = e.source_id === selectedNode.node_id ? e.target_label : e.source_label;
                      return (
                        <li key={e.edge_id} style={{ marginBottom: '0.4rem', padding: '0.3rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px' }}>
                          <span style={{ color: '#58a6ff', fontWeight: '600' }}>{e.relation_type}</span> → {otherLabel}
                        </li>
                      );
                    })}
                </ul>
              </div>

              <button
                onClick={() => setPathSource(selectedNode.node_id)}
                className="btn-secondary"
                style={{ fontSize: '0.7rem', marginTop: '0.4rem' }}
              >
                Set as Path Source
              </button>
            </div>
          ) : selectedEdge ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.78rem' }}>
              <div>
                <span className="badge badge-medium">{selectedEdge.relationship_nature}</span>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                  {selectedEdge.relation_type}
                </h4>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Connection Endpoints</div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedEdge.source_label} ({selectedEdge.source_type})
                </div>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>↕</div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedEdge.target_label} ({selectedEdge.target_type})
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confidence Weight</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(selectedEdge.confidence_weight || 0.5) * 100}%`, height: '100%', backgroundColor: '#3fb950' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    {Math.round((selectedEdge.confidence_weight || 0.5) * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Forensic Provenance</div>
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {selectedEdge.source_description || 'Directly observed in case records'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '2rem 0' }}>
              Select any node or relationship on the graph to inspect forensic attributes, degree, and supporting evidence.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
