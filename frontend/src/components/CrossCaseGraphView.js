/**
 * @file CrossCaseGraphView.js
 * @brief Interactive Cross-Case Relationship Graph & Native C Algorithm Visualizer.
 * Renders genuine historical cases and shared attribute nodes with distinct visual link styles
 * (documented direct vs shared attribute vs candidate similarity), interactive node inspection,
 * path highlighting via native C shortest path, and transparent pattern metrics.
 * @project CASETHREAD
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  GraphIcon,
  ShieldCheckIcon,
  RefreshIcon,
  CheckIcon
} from './icons/Icons';

export default function CrossCaseGraphView({
  initialQuery = 'robbery burglary electronics cash',
  selectedCaseId = null,
  onSelectCase = null,
  isEmbedded = false
}) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [patterns, setPatterns] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [algorithm, setAlgorithm] = useState('BFS');
  const [activeAlgorithmResult, setActiveAlgorithmResult] = useState(null);
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Shortest path runner state
  const [pathSource, setPathSource] = useState('');
  const [pathTarget, setPathTarget] = useState('');
  const [highlightedPathNodes, setHighlightedPathNodes] = useState(new Set());
  const [pathResult, setPathResult] = useState(null);

  // SVG Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  const fetchCrossCaseAnalysis = async (algo = algorithm) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('casethread_token') || sessionStorage.getItem('casethread_token');
      const response = await fetch('/api/v1/intelligence/cross-case/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          query: initialQuery,
          caseId: selectedCaseId,
          algorithm: algo,
          filters: {
            country: filterCountry !== 'ALL' ? filterCountry : undefined,
            crimeCategory: filterCategory !== 'ALL' ? filterCategory : undefined
          },
          limit: 8
        })
      });

      const data = await response.json();
      if (data.success && data.cross_case_graph) {
        setGraphData(data.cross_case_graph);
        setPatterns(data.patterns_detected || []);
        setActiveAlgorithmResult(data.graph_execution);

        // Pre-fill path sources if historical cases exist
        const cases = data.cross_case_graph.nodes.filter(n => n.type === 'HISTORICAL_CASE');
        if (cases.length >= 2) {
          setPathSource(cases[0].case_reference_number);
          setPathTarget(cases[1].case_reference_number);
        }
      }
    } catch (err) {
      console.error('Failed to load cross-case graph:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCrossCaseAnalysis();
  }, [filterCountry, filterCategory]);

  // Compute 2D coordinates for nodes using a radial / force-directed heuristic
  const layoutNodes = () => {
    const width = 860;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;

    const caseNodes = graphData.nodes.filter(n => n.type === 'HISTORICAL_CASE');
    const attributeNodes = graphData.nodes.filter(n => n.type !== 'HISTORICAL_CASE');

    const positioned = [];

    // Place attribute nodes in an inner circle
    const attrRadius = Math.min(centerX, centerY) * 0.45;
    attributeNodes.forEach((node, i) => {
      const angle = (i / Math.max(1, attributeNodes.length)) * 2 * Math.PI;
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * attrRadius,
        y: centerY + Math.sin(angle) * attrRadius
      });
    });

    // Place historical case nodes in an outer orbit
    const caseRadius = Math.min(centerX, centerY) * 0.85;
    caseNodes.forEach((node, i) => {
      const angle = (i / Math.max(1, caseNodes.length)) * 2 * Math.PI + 0.3;
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * caseRadius,
        y: centerY + Math.sin(angle) * caseRadius
      });
    });

    return positioned;
  };

  const positionedNodes = layoutNodes();
  const nodeMap = new Map(positionedNodes.map(n => [n.id, n]));

  // Handle native C Shortest Path calculation
  const handleFindPath = async () => {
    if (!pathSource || !pathTarget) return;
    try {
      const token = localStorage.getItem('casethread_token') || sessionStorage.getItem('casethread_token');
      const response = await fetch('/api/v1/intelligence/cross-case/path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          sourceCaseRef: pathSource,
          targetCaseRef: pathTarget
        })
      });

      const resJson = await response.json();
      if (resJson.success && resJson.data?.found) {
        setPathResult(resJson.data);
        const pathNodeLabels = new Set(resJson.data.path_nodes.map(pn => pn.label));
        const matchedIds = new Set();
        positionedNodes.forEach(pn => {
          if (pathNodeLabels.has(pn.label) || pathNodeLabels.has(pn.case_reference_number)) {
            matchedIds.add(pn.id);
          }
        });
        setHighlightedPathNodes(matchedIds);
      } else {
        setPathResult(resJson.data || { found: false, message: 'No connecting path found.' });
        setHighlightedPathNodes(new Set());
      }
    } catch (e) {
      console.error('Failed to compute path:', e);
    }
  };

  // SVG Mouse Drag for Pan & Zoom
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'circle' || e.target.tagName === 'text') return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Node styling helper
  const getNodeColor = (node) => {
    if (highlightedPathNodes.has(node.id)) return '#F59E0B'; // Amber highlight for shortest path
    switch (node.type) {
      case 'HISTORICAL_CASE':
        return '#3B82F6'; // Royal Blue
      case 'PROPERTY_CATEGORY':
        return '#06B6D4'; // Electric Cyan
      case 'CRIME_CATEGORY':
        return '#8B5CF6'; // Purple
      case 'PREMISES_TYPE':
        return '#10B981'; // Emerald
      case 'INVESTIGATIVE_METHOD':
        return '#EC4899'; // Pink / Rose
      case 'JURISDICTION':
        return '#64748B'; // Slate
      default:
        return '#38BDF8';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#090D16',
        color: '#E2E8F0',
        borderRadius: '12px',
        border: '1px solid #1E293B',
        overflow: 'hidden',
        height: isEmbedded ? '540px' : 'calc(100vh - 120px)'
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}
          >
            <GraphIcon size={16} color="#60A5FA" />
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#60A5FA' }}>
              CROSS-CASE GRAPH INTELLIGENCE
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
            Nodes: <strong style={{ color: '#F8FAFC' }}>{graphData.nodes.length}</strong> • Edges:{' '}
            <strong style={{ color: '#F8FAFC' }}>{graphData.edges.length}</strong>
          </span>

          {activeAlgorithmResult?.execution_latency_ms !== undefined && (
            <span style={{ fontSize: '0.72rem', color: '#34D399', fontFamily: 'monospace' }}>
              [Native C {activeAlgorithmResult.algorithm || algorithm}: {activeAlgorithmResult.execution_latency_ms}ms]
            </span>
          )}
        </div>

        {/* Algorithm Dispatcher & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={algorithm}
            onChange={(e) => {
              setAlgorithm(e.target.value);
              fetchCrossCaseAnalysis(e.target.value);
            }}
            style={{
              backgroundColor: '#1E293B',
              color: '#CBD5E1',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem'
            }}
            title="Select Native C Graph Algorithm"
          >
            <option value="BFS">Native C: Breadth-First Search (BFS)</option>
            <option value="DFS">Native C: Depth-First Search (DFS)</option>
            <option value="CONNECTED_COMPONENTS">Native C: Connected Components</option>
            <option value="SHORTEST_PATH">Native C: Shortest Path</option>
          </select>

          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            style={{
              backgroundColor: '#1E293B',
              color: '#CBD5E1',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem'
            }}
          >
            <option value="ALL">All Jurisdictions</option>
            <option value="India">India</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="United States">United States</option>
          </select>

          <button
            onClick={() => fetchCrossCaseAnalysis()}
            disabled={isLoading}
            style={{
              backgroundColor: '#1E293B',
              color: '#CBD5E1',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshIcon size={12} />
            <span>{isLoading ? 'Running C Engine...' : 'Re-run Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Main View Area: Graph Canvas + Sidebar Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>
        {/* SVG Graph Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            position: 'relative',
            backgroundColor: '#060A12',
            cursor: isPanning ? 'grabbing' : 'grab',
            overflow: 'hidden'
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 860 520"
            style={{ display: 'block' }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Background Radar Rings */}
              <circle cx="430" cy="260" r="150" fill="none" stroke="rgba(51, 65, 85, 0.3)" strokeDasharray="4 6" />
              <circle cx="430" cy="260" r="230" fill="none" stroke="rgba(51, 65, 85, 0.2)" strokeDasharray="8 8" />

              {/* Render Graph Edges */}
              {graphData.edges.map((edge) => {
                const s = nodeMap.get(edge.source_id);
                const t = nodeMap.get(edge.target_id);
                if (!s || !t) return null;

                const isHighlighted =
                  highlightedPathNodes.has(s.id) && highlightedPathNodes.has(t.id);

                let strokeColor = 'rgba(100, 116, 139, 0.4)';
                let strokeDash = 'none';

                if (isHighlighted) {
                  strokeColor = '#F59E0B';
                } else if (edge.relationship_nature === 'RECORDED_DIRECT') {
                  strokeColor = '#34D399'; // Solid Green for Direct Links
                  strokeDash = 'none';
                } else if (edge.relationship_nature === 'SHARED_ATTRIBUTE') {
                  strokeColor = '#38BDF8'; // Dashed Cyan for Shared Attributes
                  strokeDash = '5 4';
                } else {
                  strokeColor = '#94A3B8'; // Dotted Gray for Derived
                  strokeDash = '2 3';
                }

                return (
                  <g key={edge.id} onClick={() => setSelectedEdge(edge)} style={{ cursor: 'pointer' }}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={strokeColor}
                      strokeWidth={isHighlighted ? 3 : 1.5}
                      strokeDasharray={strokeDash}
                    />
                  </g>
                );
              })}

              {/* Render Graph Nodes */}
              {positionedNodes.map((node) => {
                const isCase = node.type === 'HISTORICAL_CASE';
                const nodeColor = getNodeColor(node);
                const isSelected = selectedNode?.id === node.id;
                const isPathMember = highlightedPathNodes.has(node.id);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => {
                      setSelectedNode(node);
                      if (isCase && onSelectCase && node.document_id) {
                        onSelectCase(node.document_id);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Outer glow ring if selected or on shortest path */}
                    {(isSelected || isPathMember) && (
                      <circle
                        r={isCase ? 22 : 16}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth="2"
                        opacity="0.8"
                        style={{ animation: 'pulse 1.5s infinite' }}
                      />
                    )}

                    {/* Node Core */}
                    <circle
                      r={isCase ? 14 : 10}
                      fill={nodeColor}
                      stroke="#0F172A"
                      strokeWidth="2"
                    />

                    {/* Node Label Text */}
                    <text
                      y={isCase ? 24 : 18}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize={isCase ? '10px' : '8.5px'}
                      fontWeight={isCase ? '700' : '500'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Canvas Floating Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(4px)',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #1E293B',
              fontSize: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: '700', color: '#94A3B8', marginBottom: '2px' }}>GRAPH LEGEND</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
              <span>Historical Case Precedent</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06B6D4' }} />
              <span>Targeted Property Node</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '2px', backgroundColor: '#38BDF8', borderTop: '1px dashed #38BDF8' }} />
              <span>Shared Attribute (Typology Only)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '2px', backgroundColor: '#34D399' }} />
              <span>Direct Link (Verified Connection)</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Details, Shortest Path Tool, Detected Patterns */}
        <div
          style={{
            backgroundColor: '#0B1120',
            borderLeft: '1px solid #1E293B',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto'
          }}
        >
          {/* Native C Shortest Path Finder */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#111827',
              borderRadius: '8px',
              border: '1px solid #1F2937'
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#60A5FA', marginBottom: '8px' }}>
              Native C Shortest Path Tracer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                placeholder="Source Case (e.g. CRL-REV-P-442-2023)"
                value={pathSource}
                onChange={(e) => setPathSource(e.target.value)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: '#F8FAFC',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace'
                }}
              />
              <input
                type="text"
                placeholder="Target Case (e.g. JK488839)"
                value={pathTarget}
                onChange={(e) => setPathTarget(e.target.value)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: '#F8FAFC',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={handleFindPath}
                style={{
                  marginTop: '4px',
                  padding: '6px 10px',
                  backgroundColor: '#0284C7',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Trace Path via C BFS
              </button>
            </div>

            {pathResult && (
              <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#93C5FD' }}>
                {pathResult.found ? (
                  <div>
                    ✓ Connected in <strong>{pathResult.hops} hops</strong> ({pathResult.execution_ms}ms).
                    <div style={{ marginTop: '4px', color: '#CBD5E1' }}>
                      Path: {pathResult.path_nodes?.map(pn => pn.label).join(' ➔ ')}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#F87171' }}>✗ {pathResult.message || 'No connecting path found.'}</div>
                )}
              </div>
            )}
          </div>

          {/* Node / Edge Inspector */}
          {selectedNode ? (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#111827',
                borderRadius: '8px',
                border: '1px solid #1F2937'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ShieldCheckIcon size={16} color="#38BDF8" />
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#F8FAFC' }}>
                  Node Details: {selectedNode.label}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>Type:</strong> {selectedNode.type}</div>
                {selectedNode.country && <div><strong>Jurisdiction:</strong> {selectedNode.country} ({selectedNode.jurisdiction})</div>}
                {selectedNode.crime_subtype && <div><strong>Offense:</strong> {selectedNode.crime_subtype}</div>}
                {selectedNode.stolen_property && <div><strong>Property:</strong> {selectedNode.stolen_property}</div>}
                {selectedNode.case_outcome && <div><strong>Outcome:</strong> {selectedNode.case_outcome}</div>}
                {selectedNode.citation_id && <div><strong>Citation:</strong> <span style={{ color: '#60A5FA', fontFamily: 'monospace' }}>[{selectedNode.citation_id}]</span></div>}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center', padding: '12px' }}>
              Click any node or edge to inspect documented forensic attributes and source citations.
            </div>
          )}

          {/* Detected Crime Patterns */}
          {patterns.length > 0 && (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px' }}>
                Discovered Crime Patterns ({patterns.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {patterns.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px',
                      backgroundColor: '#111827',
                      borderRadius: '6px',
                      border: '1px solid #1F2937',
                      fontSize: '0.72rem'
                    }}
                  >
                    <div style={{ fontWeight: '700', color: '#38BDF8', marginBottom: '4px' }}>
                      {p.pattern_name} ({p.frequency_count} cases)
                    </div>
                    <div style={{ color: '#CBD5E1', marginBottom: '6px', lineHeight: 1.3 }}>
                      {p.pattern_description}
                    </div>
                    <div style={{ color: '#F59E0B', fontSize: '0.68rem', fontStyle: 'italic' }}>
                      Notice: {p.forensic_limitations}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
