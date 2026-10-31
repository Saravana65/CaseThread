/**
 * @file GraphCanvas.js
 * @description High-performance interactive SVG graph canvas with force-directed physics,
 *              zooming, panning, node dragging, path highlights, and forensic styling.
 * @project CASETHREAD
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// Entity Color Palette
const ENTITY_CONFIG = {
  SUSPECT: { color: '#e53935', glow: 'rgba(229, 57, 53, 0.4)', icon: '👤', label: 'Suspect' },
  VICTIM: { color: '#1e88e5', glow: 'rgba(30, 136, 229, 0.4)', icon: '🛡️', label: 'Victim' },
  WITNESS: { color: '#ffb300', glow: 'rgba(255, 179, 0, 0.4)', icon: '👁️', label: 'Witness' },
  VEHICLE: { color: '#8e24aa', glow: 'rgba(142, 36, 170, 0.4)', icon: '🚗', label: 'Vehicle' },
  LOCATION: { color: '#43a047', glow: 'rgba(67, 160, 71, 0.4)', icon: '📍', label: 'Location' },
  CCTV: { color: '#00acc1', glow: 'rgba(0, 172, 193, 0.4)', icon: '📹', label: 'CCTV Feed' },
  PHONE: { color: '#d81b60', glow: 'rgba(216, 27, 96, 0.4)', icon: '📱', label: 'Phone Record' },
  EVIDENCE: { color: '#fb8c00', glow: 'rgba(251, 140, 0, 0.4)', icon: '📁', label: 'Evidence' },
  UNKNOWN: { color: '#78909c', glow: 'rgba(120, 144, 156, 0.4)', icon: '❓', label: 'Unknown' }
};

export default function GraphCanvas({
  nodes = [],
  edges = [],
  selectedNode = null,
  selectedEdge = null,
  highlightedPath = null,
  highlightedComponent = null,
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
  const visibleNodes = nodes.filter(n => {
    const type = (n.entity_type || 'UNKNOWN').toUpperCase();
    if (filterTypes[type] === false) return false;
    return true;
  });

  const visibleNodeIds = new Set(visibleNodes.map(n => n.node_id));

  const visibleEdges = edges.filter(e => {
    if (!visibleNodeIds.has(e.source_id) || !visibleNodeIds.has(e.target_id)) return false;
    const origin = (e.relationship_nature || '').toUpperCase();
    if (filterOrigins[origin] === false) return false;
    return true;
  });

  // Initialize node layout positions
  useEffect(() => {
    if (nodes.length === 0) return;

    setPositions(prev => {
      const updated = { ...prev };
      const width = containerRef.current ? containerRef.current.clientWidth : 800;
      const height = containerRef.current ? containerRef.current.clientHeight : 600;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;

      nodes.forEach((node, idx) => {
        if (!updated[node.node_id]) {
          const angle = (idx / nodes.length) * 2 * Math.PI;
          updated[node.node_id] = {
            x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
            y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 50,
            vx: 0,
            vy: 0
          };
        }
      });
      return updated;
    });
  }, [nodes]);

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
            const minDist = 120;

            if (dist < 400) {
              const force = (minDist * minDist) / (dist * dist);
              const fx = (dx / dist) * force * 15;
              const fy = (dy / dist) * force * 15;

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
          if (!posA || !posB) continue;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 160;
          const displacement = dist - targetDist;
          const k = 0.04 * (edge.confidence_weight || 0.7);

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

          // Gentle pull to center
          pos.vx += (cx - pos.x) * 0.003;
          pos.vy += (cy - pos.y) * 0.003;

          // Apply velocity with damping
          pos.vx *= 0.85;
          pos.vy *= 0.85;
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
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
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

  // Reset view to center
  const resetView = () => {
    setTransform({ x: 0, y: 0, k: 1 });
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
        height: '620px',
        backgroundColor: '#070a0e',
        position: 'relative',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'grab',
        borderRadius: '6px',
        border: '1px solid var(--border-default)',
        userSelect: 'none'
      }}
    >
      {/* Canvas Floating Controls */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        gap: '6px',
        zIndex: 10,
        backgroundColor: 'rgba(13, 17, 23, 0.85)',
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(8px)'
      }}>
        <button
          onClick={() => setTransform(p => ({ ...p, k: Math.min(4.0, p.k * 1.2) }))}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
          title="Zoom In"
        >
          ➕
        </button>
        <button
          onClick={() => setTransform(p => ({ ...p, k: Math.max(0.2, p.k * 0.8) }))}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
          title="Zoom Out"
        >
          ➖
        </button>
        <button
          onClick={resetView}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
          title="Center Canvas"
        >
          ⛶ Reset
        </button>
        <button
          onClick={() => setIsSimulating(p => !p)}
          className={isSimulating ? "btn-secondary" : "btn-primary"}
          style={{ padding: '4px 8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
          title="Toggle Physics Engine"
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
          {/* Subtle Grid Pattern */}
          <pattern id="forensic-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
          </pattern>

          {/* Node Glow Filters */}
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#e53935" floodOpacity="0.6" />
          </filter>
          <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ffd700" floodOpacity="0.8" />
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

            const isSelected = selectedEdge && selectedEdge.edge_id === edge.edge_id;
            const inPath = isEdgeInPath(edge);

            // Edge styling based on nature / verification
            let strokeColor = '#484f58';
            let strokeDasharray = 'none';
            let strokeWidth = Math.max(1.5, (edge.confidence_weight || 0.6) * 3);

            if (edge.relationship_nature === 'DIRECTLY_DOCUMENTED') {
              strokeColor = '#58a6ff';
            } else if (edge.relationship_nature === 'DATA_DERIVED') {
              strokeColor = '#3fb950';
            } else if (edge.relationship_nature === 'SUGGESTED_FOR_VERIFICATION') {
              strokeColor = '#d29922';
              strokeDasharray = '6,4';
            } else if (edge.relationship_nature === 'UNVERIFIED') {
              strokeColor = '#f85149';
              strokeDasharray = '3,3';
            }

            if (inPath) {
              strokeColor = '#ffd700';
              strokeWidth = 4;
              strokeDasharray = 'none';
            } else if (isSelected) {
              strokeColor = '#ff7b72';
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
                style={{ cursor: 'pointer' }}
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeOpacity={inPath || isSelected ? 1 : 0.65}
                />
                {/* Edge Type Label */}
                <rect
                  x={midX - 35}
                  y={midY - 9}
                  width="70"
                  height="18"
                  rx="3"
                  fill="rgba(13, 17, 23, 0.85)"
                  stroke={strokeColor}
                  strokeWidth="0.8"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fill={inPath ? '#ffd700' : '#8b949e'}
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {edge.relation_type?.slice(0, 12)}
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

            const typeConfig = ENTITY_CONFIG[(node.entity_type || '').toUpperCase()] || ENTITY_CONFIG.UNKNOWN;
            const isIsolated = node.is_isolated || node.degree === 0;

            const nodeRadius = isSelected ? 24 : inPath ? 22 : 18;

            return (
              <g
                key={`node-${node.node_id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.node_id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Halo Glow for Selection or Path */}
                {(isSelected || inPath || inComponent) && (
                  <circle
                    r={nodeRadius + 8}
                    fill="none"
                    stroke={inPath ? '#ffd700' : isSelected ? '#ff5252' : typeConfig.color}
                    strokeWidth="2"
                    strokeDasharray={isSelected ? 'none' : '4,3'}
                    opacity="0.8"
                  />
                )}

                {/* Base Node Circle */}
                <circle
                  r={nodeRadius}
                  fill="#161b22"
                  stroke={typeConfig.color}
                  strokeWidth={isSelected ? 3 : 2}
                  filter={isSelected ? 'url(#glow-red)' : inPath ? 'url(#glow-gold)' : undefined}
                />

                {/* Icon Marker */}
                <text
                  textAnchor="middle"
                  dy="5"
                  fontSize={isSelected ? '14' : '11'}
                  style={{ pointerEvents: 'none' }}
                >
                  {typeConfig.icon}
                </text>

                {/* Isolated Node Badge */}
                {isIsolated && (
                  <circle
                    cx={nodeRadius - 4}
                    cy={-nodeRadius + 4}
                    r="4.5"
                    fill="#d32f2f"
                    stroke="#090c10"
                    strokeWidth="1.5"
                  />
                )}

                {/* Text Label Below Node */}
                <text
                  y={nodeRadius + 14}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#c9d1d9'}
                  fontSize="10"
                  fontWeight={isSelected ? '700' : '500'}
                  fontFamily="var(--font-sans)"
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#090c10',
                    strokeWidth: '3px',
                    strokeLinejoin: 'round'
                  }}
                >
                  {node.label?.length > 18 ? node.label.slice(0, 16) + '...' : node.label}
                </text>

                {/* Subtitle / Entity Type Pill */}
                <text
                  y={nodeRadius + 25}
                  textAnchor="middle"
                  fill={typeConfig.color}
                  fontSize="7.5"
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.5px"
                  style={{
                    paintOrder: 'stroke',
                    stroke: '#090c10',
                    strokeWidth: '2.5px'
                  }}
                >
                  {node.entity_type} {node.degree !== undefined ? `• ${node.degree}` : ''}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
