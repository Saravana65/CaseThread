/**
 * @file GraphCanvas.js
 * @description High-performance interactive SVG graph canvas with force-directed physics,
 *              zooming, panning, node dragging, neighbor focus dimming, path highlights,
 *              and Apple-inspired forensic styling.
 * @project CASETHREAD - Phase 6 Evidence Relationship Network
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// Restrained, Accessible Forensic Node Color Palette
const ENTITY_CONFIG = {
  SUSPECT: { color: '#EF4444', border: '#F87171', bg: '#1C1214', icon: '👤', label: 'Suspect' },
  VICTIM: { color: '#F59E0B', border: '#FBBF24', bg: '#1B170E', icon: '🛡️', label: 'Victim' },
  WITNESS: { color: '#10B981', border: '#34D399', bg: '#0E1A16', icon: '👁️', label: 'Witness' },
  EVIDENCE: { color: '#3B82F6', border: '#60A5FA', bg: '#101726', icon: '📁', label: 'Evidence' },
  LOCATION: { color: '#8B5CF6', border: '#A78BFA', bg: '#171224', icon: '📍', label: 'Location' },
  VEHICLE: { color: '#64748B', border: '#94A3B8', bg: '#14171F', icon: '🚗', label: 'Vehicle' },
  CCTV: { color: '#06B6D4', border: '#22D3EE', bg: '#0D1A20', icon: '📹', label: 'CCTV' },
  PHONE: { color: '#EC4899', border: '#F472B6', bg: '#1D1219', icon: '📱', label: 'Phone' },
  UNKNOWN: { color: '#94A3B8', border: '#CBD5E1', bg: '#14171F', icon: '❓', label: 'Entity' }
};

export default function GraphCanvas({
  nodes = [],
  edges = [],
  selectedNode = null,
  selectedEdge = null,
  highlightedPath = null,
  highlightedComponent = null,
  searchQuery = '',
  onSelectNode,
  onSelectEdge,
  filterTypes = {},
  filterOrigins = {}
}) {
  const containerRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState(null);
  const [isSimulating, setIsSimulating] = useState(true);

  // Filter nodes & edges according to active criteria
  const visibleNodes = useMemo(() => {
    return nodes.filter(n => {
      const type = (n.entity_type || 'UNKNOWN').toUpperCase();
      if (filterTypes[type] === false) return false;
      return true;
    });
  }, [nodes, filterTypes]);

  const visibleNodeIds = useMemo(() => {
    return new Set(visibleNodes.map(n => n.node_id));
  }, [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter(e => {
      if (!visibleNodeIds.has(e.source_id) || !visibleNodeIds.has(e.target_id)) return false;
      const origin = (e.relationship_nature || '').toUpperCase();
      if (filterOrigins[origin] === false) return false;
      return true;
    });
  }, [edges, visibleNodeIds, filterOrigins]);

  // Compute 1-Hop Neighbors of Selected Node for Focus Mode
  const neighborNodeIds = useMemo(() => {
    if (!selectedNode) return null;
    const set = new Set([selectedNode.node_id]);
    visibleEdges.forEach(e => {
      if (e.source_id === selectedNode.node_id) set.add(e.target_id);
      if (e.target_id === selectedNode.node_id) set.add(e.source_id);
    });
    return set;
  }, [selectedNode, visibleEdges]);

  // Initialize node layout positions (concentric cluster layout)
  useEffect(() => {
    if (nodes.length === 0) return;

    setPositions(prev => {
      const updated = { ...prev };
      const width = containerRef.current ? containerRef.current.clientWidth : 800;
      const height = containerRef.current ? containerRef.current.clientHeight : 600;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.38;

      nodes.forEach((node, idx) => {
        if (!updated[node.node_id]) {
          const angle = (idx / nodes.length) * 2 * Math.PI;
          updated[node.node_id] = {
            x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
            y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
            vx: 0,
            vy: 0
          };
        }
      });
      return updated;
    });
  }, [nodes]);

  // Center on node if search query matches
  useEffect(() => {
    if (!searchQuery.trim() || visibleNodes.length === 0) return;
    const q = searchQuery.toLowerCase();
    const matched = visibleNodes.find(n =>
      (n.label && n.label.toLowerCase().includes(q)) ||
      (n.tracking_code && n.tracking_code.toLowerCase().includes(q)) ||
      (String(n.node_id) === q)
    );

    if (matched && positions[matched.node_id]) {
      const pos = positions[matched.node_id];
      const width = containerRef.current ? containerRef.current.clientWidth : 800;
      const height = containerRef.current ? containerRef.current.clientHeight : 600;

      setTransform(prev => ({
        ...prev,
        x: width / 2 - pos.x * prev.k,
        y: height / 2 - pos.y * prev.k
      }));

      if (onSelectNode) {
        onSelectNode(matched);
      }
    }
  }, [searchQuery, visibleNodes, positions, onSelectNode]);

  // Force-Directed Physics Simulation Step
  useEffect(() => {
    if (!isSimulating || visibleNodes.length === 0) return;

    let animId;
    const tick = () => {
      setPositions(prev => {
        const next = {};
        const width = containerRef.current ? containerRef.current.clientWidth : 800;
        const height = containerRef.current ? containerRef.current.clientHeight : 600;
        const cx = width / 2;
        const cy = height / 2;

        visibleNodes.forEach(n => {
          const p = prev[n.node_id] || { x: cx, y: cy, vx: 0, vy: 0 };
          next[n.node_id] = { ...p };
        });

        // 1. Repulsion between all node pairs
        const nList = visibleNodes;
        for (let i = 0; i < nList.length; i++) {
          for (let j = i + 1; j < nList.length; j++) {
            const idA = nList[i].node_id;
            const idB = nList[j].node_id;
            const posA = next[idA];
            const posB = next[idB];
            if (!posA || !posB) continue;

            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = 130;

            if (dist < 450) {
              const force = (minDist * minDist) / (dist * dist);
              const fx = (dx / dist) * force * 14;
              const fy = (dy / dist) * force * 14;

              if (draggedNode !== idA) {
                posA.vx -= fx;
                posA.vy -= fy;
              }
              if (draggedNode !== idB) {
                posB.vx += fx;
                posB.vy += fy;
              }
            }
          }
        }

        // 2. Spring attraction along visible edges
        visibleEdges.forEach(edge => {
          const posA = next[edge.source_id];
          const posB = next[edge.target_id];
          if (!posA || !posB) return;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 160;
          const displacement = dist - targetDist;
          const k = 0.035 * (edge.confidence_weight || 0.7);

          const fx = (dx / dist) * displacement * k;
          const fy = (dy / dist) * displacement * k;

          if (draggedNode !== edge.source_id) {
            posA.vx += fx;
            posA.vy += fy;
          }
          if (draggedNode !== edge.target_id) {
            posB.vx -= fx;
            posB.vy -= fy;
          }
        });

        // 3. Center gravity & velocity dampening
        visibleNodes.forEach(n => {
          const id = n.node_id;
          if (draggedNode === id) return;
          const pos = next[id];
          if (!pos) return;

          pos.vx += (cx - pos.x) * 0.0025;
          pos.vy += (cy - pos.y) * 0.0025;

          pos.vx *= 0.86;
          pos.vy *= 0.86;
          pos.x += pos.vx;
          pos.y += pos.vy;
        });

        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isSimulating, visibleNodes, visibleEdges, draggedNode]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setTransform(prev => ({
      ...prev,
      k: Math.max(0.2, Math.min(4.0, prev.k * zoomFactor))
    }));
  };

  // Background Pan Start
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.id === 'canvas-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  // Mouse Move: Pan or Node Drag
  const handleMouseMove = (e) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    } else if (draggedNode !== null) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
      const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

      setPositions(prev => ({
        ...prev,
        [draggedNode]: { x: mouseX, y: mouseY, vx: 0, vy: 0 }
      }));
    }
  };

  // Mouse Up: End pan or drag
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    if (onSelectNode) {
      const nodeObj = nodes.find(n => n.node_id === nodeId);
      onSelectNode(nodeObj);
    }
  };

  // Fit View / Reset to center
  const resetView = () => {
    setTransform({ x: 0, y: 0, k: 1 });
  };

  // Fit all nodes into viewport
  const fitToViewport = () => {
    if (visibleNodes.length === 0 || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    visibleNodes.forEach(n => {
      const p = positions[n.node_id];
      if (p) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    });

    if (minX === Infinity) return;

    const graphW = Math.max(maxX - minX + 160, 200);
    const graphH = Math.max(maxY - minY + 160, 200);
    const scale = Math.min(width / graphW, height / graphH, 1.2);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setTransform({
      x: width / 2 - midX * scale,
      y: height / 2 - midY * scale,
      k: scale
    });
  };

  // Is node in active highlighted path?
  const isNodeInPath = (nodeId) => {
    if (!highlightedPath || !highlightedPath.steps) return false;
    return highlightedPath.steps.some(s => s.node_id === nodeId);
  };

  // Is edge in active highlighted path?
  const isEdgeInPath = (edge) => {
    if (!highlightedPath || !highlightedPath.steps) return false;
    const steps = highlightedPath.steps;
    for (let i = 0; i < steps.length - 1; i++) {
      const a = steps[i].node_id;
      const b = steps[i + 1].node_id;
      if ((edge.source_id === a && edge.target_id === b) || (edge.source_id === b && edge.target_id === a)) {
        return true;
      }
    }
    return false;
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        width: '100%',
        height: '660px',
        backgroundColor: '#090D16',
        position: 'relative',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'grab',
        borderRadius: '14px',
        border: '1px solid var(--border-default)',
        userSelect: 'none',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.04)'
      }}
    >
      {/* Canvas Floating Controls (Apple Minimalist Pills) */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        zIndex: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        padding: '5px 8px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <button
          onClick={() => setTransform(p => ({ ...p, k: Math.min(4.0, p.k * 1.2) }))}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '6px' }}
          title="Zoom In (+)"
        >
          ➕
        </button>
        <button
          onClick={() => setTransform(p => ({ ...p, k: Math.max(0.2, p.k * 0.8) }))}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '6px' }}
          title="Zoom Out (-)"
        >
          ➖
        </button>
        <button
          onClick={fitToViewport}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}
          title="Fit Graph to Viewport"
        >
          ⛶ Fit
        </button>
        <button
          onClick={resetView}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}
          title="Reset Zoom & Pan"
        >
          Reset
        </button>
        <button
          onClick={() => setIsSimulating(p => !p)}
          className={isSimulating ? "btn-secondary" : "btn-primary"}
          style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600' }}
          title="Toggle Force-Directed Physics Engine"
        >
          {isSimulating ? '⏸ Freeze' : '▶ Physics'}
        </button>
      </div>

      {/* Main SVG Render Surface */}
      <svg
        id="canvas-bg"
        width="100%"
        height="100%"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          {/* Subtle Grid Dot Pattern */}
          <pattern id="forensic-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="18" cy="18" r="1" fill="rgba(255, 255, 255, 0.08)" />
          </pattern>

          {/* Node Glow Filters */}
          <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FBBF24" floodOpacity="0.8" />
          </filter>
          <filter id="glow-select" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3B82F6" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Background Grid */}
        <rect id="canvas-bg" width="100%" height="100%" fill="url(#forensic-grid)" />

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* 1. Render Edges */}
          {visibleEdges.map(edge => {
            const p1 = positions[edge.source_id];
            const p2 = positions[edge.target_id];
            if (!p1 || !p2) return null;

            const isSelected = selectedEdge && (
              selectedEdge.edge_id === edge.edge_id ||
              (selectedEdge.source_id === edge.source_id && selectedEdge.target_id === edge.target_id)
            );
            const inPath = isEdgeInPath(edge);

            // Neighbor Focus Dimming: If a node is selected, dim edges not connected to it
            const isIncidentToSelection = selectedNode && (
              edge.source_id === selectedNode.node_id || edge.target_id === selectedNode.node_id
            );
            const isDimmed = selectedNode && !isIncidentToSelection && !inPath;

            // Edge styling based on nature / verification
            let strokeColor = '#334155'; // Slate dark default
            let strokeDasharray = 'none';
            let strokeWidth = Math.max(1.5, (edge.confidence_weight || 0.6) * 3);

            if (edge.relationship_nature === 'DIRECTLY_DOCUMENTED' || edge.verification_status === 'CONFIRMED_FACT') {
              strokeColor = '#3B82F6'; // Blue solid
            } else if (edge.relationship_nature === 'DATA_DERIVED') {
              strokeColor = '#10B981'; // Emerald dashed
              strokeDasharray = '6,4';
            } else if (edge.relationship_nature === 'SUGGESTED_FOR_VERIFICATION') {
              strokeColor = '#F59E0B'; // Amber dotted
              strokeDasharray = '4,4';
            } else if (edge.relationship_nature === 'UNVERIFIED') {
              strokeColor = '#EC4899'; // Pink dotted
              strokeDasharray = '3,3';
            }

            if (inPath) {
              strokeColor = '#FBBF24'; // Vivid Gold
              strokeWidth = 4;
              strokeDasharray = 'none';
            } else if (isSelected) {
              strokeColor = '#60A5FA';
              strokeWidth = 3.5;
            }

            // Midpoint for relationship label
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g
                key={`edge-${edge.edge_id || `${edge.source_id}-${edge.target_id}`}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectEdge) onSelectEdge(edge);
                }}
                style={{
                  cursor: 'pointer',
                  opacity: isDimmed ? 0.12 : inPath || isSelected ? 1 : 0.75,
                  transition: 'opacity 0.2s ease'
                }}
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                />
                {/* Edge Type Label Badge */}
                <rect
                  x={midX - 36}
                  y={midY - 9}
                  width="72"
                  height="18"
                  rx="4"
                  fill="rgba(10, 15, 26, 0.9)"
                  stroke={strokeColor}
                  strokeWidth="0.8"
                />
                <text
                  x={midX}
                  y={midY + 3.5}
                  textAnchor="middle"
                  fill={inPath ? '#FBBF24' : isSelected ? '#93C5FD' : '#94A3B8'}
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {edge.relation_type?.replace(/_/g, ' ').slice(0, 12)}
                </text>
              </g>
            );
          })}

          {/* 2. Render Nodes */}
          {visibleNodes.map(node => {
            const pos = positions[node.node_id];
            if (!pos) return null;

            const isSelected = selectedNode && selectedNode.node_id === node.node_id;
            const inPath = isNodeInPath(node.node_id);
            const inComponent = highlightedComponent !== null && node.component_id === highlightedComponent;

            // Neighbor Focus Dimming: If a node is selected, dim nodes that are NOT in neighbor set
            const isNeighbor = neighborNodeIds && neighborNodeIds.has(node.node_id);
            const isDimmed = selectedNode && !isNeighbor && !inPath;

            const typeConfig = ENTITY_CONFIG[(node.entity_type || '').toUpperCase()] || ENTITY_CONFIG.UNKNOWN;
            const isIsolated = node.is_isolated || node.degree === 0;

            const nodeRadius = isSelected ? 22 : inPath ? 20 : 17;

            return (
              <g
                key={`node-${node.node_id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.node_id)}
                style={{
                  cursor: 'pointer',
                  opacity: isDimmed ? 0.15 : 1,
                  transition: 'opacity 0.2s ease'
                }}
              >
                {/* Halo Glow for Selection or Path */}
                {(isSelected || inPath || inComponent) && (
                  <circle
                    r={nodeRadius + 7}
                    fill="none"
                    stroke={inPath ? '#FBBF24' : isSelected ? '#60A5FA' : typeConfig.color}
                    strokeWidth="2"
                    strokeDasharray={isSelected ? 'none' : '3,3'}
                    opacity="0.9"
                  />
                )}

                {/* Base Node Circle */}
                <circle
                  r={nodeRadius}
                  fill={typeConfig.bg}
                  stroke={typeConfig.color}
                  strokeWidth={isSelected ? 2.5 : 1.75}
                  filter={isSelected ? 'url(#glow-select)' : inPath ? 'url(#glow-gold)' : undefined}
                />

                {/* Central Icon Marker */}
                <text
                  textAnchor="middle"
                  dy="4.5"
                  fontSize={isSelected ? '13' : '11'}
                  style={{ pointerEvents: 'none' }}
                >
                  {typeConfig.icon}
                </text>

                {/* Degree Badge Pill */}
                {node.degree !== undefined && (
                  <g transform={`translate(${nodeRadius - 2}, ${-nodeRadius + 2})`}>
                    <circle
                      r="7.5"
                      fill={isIsolated ? '#EF4444' : '#1E293B'}
                      stroke={isIsolated ? '#F87171' : 'rgba(255, 255, 255, 0.15)'}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="2.5"
                      fill="#FFFFFF"
                      fontSize="7.5"
                      fontWeight="700"
                      fontFamily="var(--font-mono)"
                    >
                      {node.degree}
                    </text>
                  </g>
                )}

                {/* Text Label Below Node with Background Halo */}
                <text
                  y={nodeRadius + 14}
                  textAnchor="middle"
                  fill={isSelected ? '#FFFFFF' : '#E2E8F0'}
                  fontSize="10"
                  fontWeight={isSelected ? '700' : '600'}
                  fontFamily="var(--font-sans)"
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#090D16',
                    strokeWidth: '3.5px',
                    strokeLinejoin: 'round'
                  }}
                >
                  {node.label?.length > 20 ? node.label.slice(0, 18) + '...' : node.label}
                </text>

                {/* Subtitle / Entity Type Pill */}
                <text
                  y={nodeRadius + 25}
                  textAnchor="middle"
                  fill={typeConfig.color}
                  fontSize="7.5"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.4px"
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#090D16',
                    strokeWidth: '2.5px'
                  }}
                >
                  {node.entity_type} {node.tracking_code ? `• ${node.tracking_code}` : ''}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
