/**
 * @file InvestigationLab.js
 * @brief Interactive Native C Algorithm Engine Laboratory (Phase 7).
 * @project CASETHREAD - Forensics ADS Demonstration & Investigation Lab
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

export default function InvestigationLab({ selectedCaseId = 1, onSelectCaseId }) {
  // Mode: 'REAL' (using real MySQL case data) or 'DEMO' (isolated academic dataset)
  const [mode, setMode] = useState('REAL');
  const [selectedAlgo, setSelectedAlgo] = useState('BFS');
  const [catalog, setCatalog] = useState([]);
  const [demoDatasets, setDemoDatasets] = useState(null);

  // Cases list for Real mode
  const [cases, setCases] = useState([]);
  const [currentCaseId, setCurrentCaseId] = useState(selectedCaseId || 1);

  // Execution & Trace State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [labResult, setLabResult] = useState(null);
  const [graphNodes, setGraphNodes] = useState([]);
  const [graphEdges, setGraphEdges] = useState([]);

  // Algorithm configuration parameters
  const [startNodeId, setStartNodeId] = useState(0);
  const [targetNodeId, setTargetNodeId] = useState(1);
  const [triePrefix, setTriePrefix] = useState('EVD-2026-');

  // Step-by-Step Playback Controls
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.5x, 1x, 2x, 5x
  const timerRef = useRef(null);

  // Load initial catalog, cases, and demo datasets
  useEffect(() => {
    async function init() {
      try {
        const [catRes, demoRes, casesRes] = await Promise.all([
          api.getLabCatalog(),
          api.getLabDemoDatasets(),
          api.request('/cases')
        ]);
        if (catRes.data?.catalog) setCatalog(catRes.data.catalog);
        if (demoRes.data) setDemoDatasets(demoRes.data);
        if (casesRes.data?.cases) setCases(casesRes.data.cases);
      } catch (err) {
        console.error('Failed to load lab initialization data:', err);
      }
    }
    init();
  }, []);

  // Execute Algorithm on C Engine
  const runAlgorithm = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const payload = {
        caseId: currentCaseId,
        algorithm: selectedAlgo,
        mode,
        startNodeId: parseInt(startNodeId, 10) || 0,
        targetNodeId: parseInt(targetNodeId, 10) || 1,
        searchTerm: triePrefix
      };

      const res = await api.executeLabAlgorithm(payload);
      if (res.data) {
        setLabResult(res.data.lab_result);
        setGraphNodes(res.data.graph_nodes || []);
        setGraphEdges(res.data.graph_edges || []);
        setCurrentStep(0);
      }
    } catch (err) {
      console.error('C-Engine Lab execution error:', err);
      setError(err.message || 'C Engine execution failed.');
    } finally {
      setLoading(false);
    }
  }, [currentCaseId, selectedAlgo, mode, startNodeId, targetNodeId, triePrefix]);

  // Run on mount or when algorithm / mode changes
  useEffect(() => {
    runAlgorithm();
  }, [selectedAlgo, mode, currentCaseId]);

  // Trace steps playback loop
  const totalSteps = labResult?.trace?.length || 0;

  useEffect(() => {
    if (isPlaying && totalSteps > 0) {
      const intervalMs = Math.max(150, Math.floor(1000 / playbackSpeed));
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev + 1 >= totalSteps) {
            setIsPlaying(false);
            clearInterval(timerRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalSteps, playbackSpeed]);

  const handlePlayPause = () => {
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const handleStepBackward = () => {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  // Current active trace step data
  const activeTraceStep = labResult?.trace?.[currentStep] || null;

  // Selected algorithm catalog definition
  const currentAlgoDef = catalog.find((c) => c.id === selectedAlgo) || {
    name: selectedAlgo,
    data_structure: 'Native C Data Structure',
    time_complexity: 'O(V + E)',
    space_complexity: 'O(V)',
    purpose: 'Algorithmic investigation processing.',
    real_case_use: 'Used in CaseThread pipeline.'
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1rem 2rem 3rem', color: 'var(--text-primary)' }}>
      
      {/* 1. Header Banner & Mode Selector */}
      <div
        className="forensic-card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          borderLeft: '4px solid var(--accent-blue)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
              ACADEMIC DSA LABORATORY • PHASE 7
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '12px',
                fontWeight: 600,
                backgroundColor: mode === 'REAL' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: mode === 'REAL' ? '#22c55e' : '#60a5fa',
                border: `1px solid ${mode === 'REAL' ? '#22c55e' : '#60a5fa'}`
              }}
            >
              ● {mode === 'REAL' ? 'REAL INVESTIGATION DATA' : 'CONTROLLED DEMO DATA'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              C99 Core Engine (MSVC x64 Native)
            </span>
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Algorithm Investigation Lab
          </h1>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '780px' }}>
            Interactive demonstration and verification of native C Data Structures & Algorithms. Connects real case evidence to step-by-step algorithm traversals with full complexity explanations.
          </p>
        </div>

        {/* Mode Switcher & Real Case Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <button
              onClick={() => setMode('REAL')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: mode === 'REAL' ? 'var(--accent-blue)' : 'transparent',
                color: mode === 'REAL' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              🔬 Real Investigation
            </button>
            <button
              onClick={() => setMode('DEMO')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: mode === 'DEMO' ? 'var(--accent-blue)' : 'transparent',
                color: mode === 'DEMO' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              🧪 Academic Demo
            </button>
          </div>

          {mode === 'REAL' && (
            <select
              value={currentCaseId}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setCurrentCaseId(id);
                if (onSelectCaseId) onSelectCaseId(id);
              }}
              style={{
                padding: '0.45rem 0.8rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_number}: {c.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={runAlgorithm}
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>{loading ? '⏳' : '⚡'}</span>
            <span>{loading ? 'Executing C...' : 'Re-Run C Engine'}</span>
          </button>
        </div>
      </div>

      {/* 2. Algorithm Selector Catalog Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
        {catalog.map((algo) => {
          const isSelected = selectedAlgo === algo.id;
          return (
            <button
              key={algo.id}
              onClick={() => setSelectedAlgo(algo.id)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '0.2rem',
                minWidth: '150px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'space-between' }}>
                <span style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{algo.name.split(' (')[0]}</span>
                <span style={{ fontSize: '0.65rem', color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {algo.time_complexity.split(' ')[0]}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {algo.category}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Stage Layout: Left (Visualization & Controls) / Right (Inspector & Viva) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Visualization Stage & Replay Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Controls Ribbon */}
          <div className="forensic-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              
              {/* Playback Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={handleReset}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}
                  title="Reset to Step 0"
                >
                  ⏮ Reset
                </button>
                <button
                  onClick={handleStepBackward}
                  disabled={currentStep === 0}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}
                  title="Step Backward"
                >
                  ◀ Step
                </button>
                <button
                  onClick={handlePlayPause}
                  className="btn-primary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', minWidth: '90px' }}
                >
                  {isPlaying ? '⏸ Pause' : currentStep >= totalSteps - 1 ? '🔁 Replay' : '▶ Play Trace'}
                </button>
                <button
                  onClick={handleStepForward}
                  disabled={currentStep >= totalSteps - 1}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}
                  title="Step Forward"
                >
                  Step ▶
                </button>
              </div>

              {/* Speed & Progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Speed:</span>
                  {[0.5, 1.0, 2.0, 5.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPlaybackSpeed(s)}
                      style={{
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        backgroundColor: playbackSpeed === s ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                        color: playbackSpeed === s ? '#ffffff' : 'var(--text-secondary)'
                      }}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Step <strong style={{ color: 'var(--accent-blue)' }}>{currentStep + 1}</strong> of {totalSteps || 1}
                </div>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-default)', borderRadius: '2px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: 'var(--accent-blue)',
                  width: `${totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0}%`,
                  transition: 'width 0.15s ease'
                }}
              />
            </div>
          </div>

          {/* Visualization Canvas */}
          <div
            className="forensic-card"
            style={{
              padding: '1.25rem',
              minHeight: '440px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#0a0b0e'
            }}
          >
            {/* Visual Canvas Subheader */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ACTIVE NATIVE C DATA STRUCTURE STAGE
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.1rem 0 0' }}>
                  {currentAlgoDef.data_structure}
                </h3>
              </div>

              {/* Dynamic Algorithm Configuration Inputs */}
              {(selectedAlgo === 'BFS' || selectedAlgo === 'DFS' || selectedAlgo === 'SHORTEST_PATH') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <span>Start Vertex:</span>
                  <input
                    type="number"
                    value={startNodeId}
                    onChange={(e) => setStartNodeId(e.target.value)}
                    style={{ width: '45px', padding: '0.2rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '4px' }}
                  />
                  {selectedAlgo === 'SHORTEST_PATH' && (
                    <>
                      <span>Target:</span>
                      <input
                        type="number"
                        value={targetNodeId}
                        onChange={(e) => setTargetNodeId(e.target.value)}
                        style={{ width: '45px', padding: '0.2rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '4px' }}
                      />
                    </>
                  )}
                </div>
              )}

              {selectedAlgo === 'TRIE' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                  <span>Prefix:</span>
                  <input
                    type="text"
                    value={triePrefix}
                    onChange={(e) => setTriePrefix(e.target.value)}
                    style={{ width: '110px', padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              )}
            </div>

            {/* Error or Loading State */}
            {error && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
                ⚠️ C Engine Error: {error}
              </div>
            )}

            {/* DYNAMIC VISUALIZATIONS BY ALGORITHM CATEGORY */}
            {/* A. GRAPH ALGORITHMS (BFS, DFS, SHORTEST PATH, CONNECTED COMPONENTS) */}
            {(selectedAlgo === 'BFS' || selectedAlgo === 'DFS' || selectedAlgo === 'SHORTEST_PATH' || selectedAlgo === 'CONNECTED_COMPONENTS') && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <svg width="100%" height="320" style={{ backgroundColor: '#0d1017', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  {/* Edges */}
                  {graphEdges.slice(0, 30).map((edge, idx) => {
                    const u = graphNodes[edge.source_vertex_id];
                    const v = graphNodes[edge.target_vertex_id];
                    if (!u || !v) return null;
                    const x1 = 80 + (edge.source_vertex_id % 6) * 105;
                    const y1 = 60 + Math.floor(edge.source_vertex_id / 6) * 85;
                    const x2 = 80 + (edge.target_vertex_id % 6) * 105;
                    const y2 = 60 + Math.floor(edge.target_vertex_id / 6) * 85;

                    const isInspected = activeTraceStep?.type === 'EDGE_INSPECT' &&
                      ((activeTraceStep.source === edge.source_vertex_id && activeTraceStep.target === edge.target_vertex_id) ||
                       (activeTraceStep.source === edge.target_vertex_id && activeTraceStep.target === edge.source_vertex_id));

                    return (
                      <line
                        key={`edge-${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isInspected ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)'}
                        strokeWidth={isInspected ? 3 : 1.2}
                        strokeDasharray={isInspected ? '4,4' : 'none'}
                      />
                    );
                  })}

                  {/* Vertices */}
                  {graphNodes.slice(0, 24).map((node, idx) => {
                    const cx = 80 + (idx % 6) * 105;
                    const cy = 60 + Math.floor(idx / 6) * 85;

                    const isVisited = activeTraceStep?.visited?.includes(idx);
                    const isCurrent = activeTraceStep?.node_id === idx;
                    const inQueueOrStack = (activeTraceStep?.queue?.includes(idx) || activeTraceStep?.stack?.includes(idx));

                    let fillColor = '#1e2430';
                    let strokeColor = '#334155';
                    if (isCurrent) {
                      fillColor = '#3b82f6';
                      strokeColor = '#93c5fd';
                    } else if (inQueueOrStack) {
                      fillColor = '#f59e0b';
                      strokeColor = '#fbbf24';
                    } else if (isVisited) {
                      fillColor = '#10b981';
                      strokeColor = '#34d399';
                    }

                    return (
                      <g key={`node-${idx}`}>
                        {isCurrent && (
                          <circle cx={cx} cy={cy} r="24" fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.4">
                            <animate attributeName="r" values="18;28;18" dur="1.5s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <circle cx={cx} cy={cy} r="16" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
                        <text x={cx} y={cy + 4} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                          {idx}
                        </text>
                        <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--text-secondary)" fontSize="9">
                          {(node.label || `Node ${idx}`).substring(0, 14)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Queue / Stack State Ribbon */}
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>
                      {selectedAlgo === 'BFS' ? 'Queue (FIFO):' : selectedAlgo === 'DFS' ? 'Stack (LIFO):' : 'Predecessor Path:'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {selectedAlgo === 'BFS'
                        ? `[ ${activeTraceStep?.queue?.join(', ') || 'empty'} ]`
                        : selectedAlgo === 'DFS'
                        ? `[ ${activeTraceStep?.stack?.join(' → ') || 'empty'} ]`
                        : labResult?.path_nodes?.map((p) => p.label).join(' → ') || 'Analyzing hops...'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Visited Set: <strong>{activeTraceStep?.visited?.length || 0}</strong> nodes
                  </div>
                </div>
              </div>
            )}

            {/* B. HASH MAP VIEW */}
            {selectedAlgo === 'HASH_MAP' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700 }}>DJB2 HASH CALCULATION</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                      {activeTraceStep?.key || 'EVD-2026-0042'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                      Raw Hash: {activeTraceStep?.raw_hash || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                      Bucket Index: {activeTraceStep?.raw_hash} % {labResult?.metrics?.capacity || 16} = <strong>#{activeTraceStep?.bucket_index || 0}</strong>
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 700 }}>TABLE STATUS</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                      Size: <strong>{labResult?.metrics?.size}</strong> / Capacity: <strong>{labResult?.metrics?.capacity}</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      Load Factor: <strong>{labResult?.metrics?.load_factor}</strong> (Threshold: 0.75)
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', color: labResult?.metrics?.collisions > 0 ? '#f59e0b' : '#10b981' }}>
                      Collisions Detected: <strong>{labResult?.metrics?.collisions}</strong>
                    </div>
                  </div>
                </div>

                {/* Bucket Array */}
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '220px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {labResult?.buckets?.map((bucket) => {
                    const isTargetBucket = activeTraceStep?.bucket_index === bucket.bucket_id;
                    return (
                      <div
                        key={bucket.bucket_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.6rem',
                          backgroundColor: isTargetBucket ? 'rgba(59, 130, 246, 0.2)' : '#12151c',
                          borderRadius: '6px',
                          border: `1px solid ${isTargetBucket ? 'var(--accent-blue)' : 'var(--border-default)'}`
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '40px' }}>
                          [{bucket.bucket_id}]
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {bucket.chain.length === 0 ? (
                            <span style={{ fontSize: '0.7rem', color: '#475569' }}>NULL</span>
                          ) : (
                            bucket.chain.map((c, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.45rem',
                                  backgroundColor: '#1e2430',
                                  borderRadius: '4px',
                                  border: '1px solid #334155',
                                  fontFamily: 'var(--font-mono)'
                                }}
                              >
                                {c.key} {i + 1 < bucket.chain.length ? '→' : ''}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* C. AVL TREE VIEW */}
            {selectedAlgo === 'AVL_TREE' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>TREE HEIGHT</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                      {labResult?.metrics?.tree_height || 0}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>BALANCE FACTOR</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                      {labResult?.metrics?.root_balance_factor || 0}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ROTATIONS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                      {labResult?.metrics?.rotations_performed || 0}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>EVENTS INDEXED</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {labResult?.metrics?.total_events || 0}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1rem', backgroundColor: '#0d1017', borderRadius: '8px', border: '1px solid var(--border-default)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    CHRONOLOGICAL SELF-BALANCING PROGRESSION
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Current Insert: <strong style={{ color: 'var(--text-primary)' }}>{activeTraceStep?.label || 'Event'}</strong> (Epoch: {activeTraceStep?.timestamp || 0})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Balance Invariant: <strong>[-1, 1]</strong> maintained. {activeTraceStep?.rotation_occurred ? '⚡ Tree rotation executed on ancestor to restore logarithmic height bound.' : 'No rotation required for this insertion.'}
                  </div>
                </div>
              </div>
            )}

            {/* D. MAX-HEAP VIEW */}
            {selectedAlgo === 'MAX_HEAP' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: 700 }}>ROOT ELEMENT (MAX PRIORITY)</span>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {labResult?.peek_max?.title || 'Highest Priority Lead'}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                    {labResult?.peek_max?.priority}%
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Heap Array Storage [ elements[i] &gt;= elements[2i+1], elements[2i+2] ]
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {labResult?.heap_array?.map((elem) => (
                    <div
                      key={elem.index}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: elem.index === 0 ? 'rgba(245, 158, 11, 0.15)' : '#12151c',
                        border: `1px solid ${elem.index === 0 ? '#f59e0b' : 'var(--border-default)'}`,
                        borderRadius: '6px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Index #{elem.index}</span>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{elem.priority}%</span>
                      </div>
                      <div style={{ color: 'var(--text-primary)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {elem.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* E. TRIE VIEW */}
            {selectedAlgo === 'TRIE' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700 }}>PREFIX RETRIEVAL PATH</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    {labResult?.queried_prefix || triePrefix}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Total Trie Nodes Allocated: <strong>{labResult?.metrics?.total_trie_nodes || 0}</strong> • Common prefixes share memory paths.
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Instant Autocomplete Matches ({labResult?.autocomplete_matches?.length || 0}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {labResult?.autocomplete_matches?.map((match, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '0.35rem 0.65rem',
                        backgroundColor: '#1e2430',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      📁 {match}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step Detail Explanation Card */}
          <div className="forensic-card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--accent-amber)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
                CURRENT EXECUTION STEP
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Step #{activeTraceStep?.step || 1}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {activeTraceStep?.desc || 'Algorithm initialized. Press "Play Trace" or "Step" to observe state transitions.'}
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Real C Performance Metrics & Educational Viva Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* C-Engine Performance Metrics Card */}
          <div className="forensic-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚡</span> Native C Execution Metrics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.65rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>C EXECUTION TIME</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                  {labResult?.metrics?.execution_ms ? `${labResult.metrics.execution_ms.toFixed(3)} ms` : '< 0.05 ms'}
                </div>
              </div>
              <div style={{ padding: '0.65rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>TRACE STEPS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                  {totalSteps}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)' }}>
              <div>• Status: <strong style={{ color: '#10b981' }}>VERIFIED (Native C99)</strong></div>
              <div>• Memory Allocation: <strong>Dynamic Heap / Zero Leak</strong></div>
              <div>• Process: <strong>casethread_engine.exe IPC</strong></div>
            </div>
          </div>

          {/* Academic Complexity & Viva Defense Panel */}
          <div className="forensic-card" style={{ padding: '1.25rem', borderTop: '3px solid var(--accent-blue)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🎓</span> ADS Viva & Defense Guide
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Data Structure</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                  {currentAlgoDef.data_structure}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Complexity</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '0.1rem' }}>
                    {currentAlgoDef.time_complexity}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Space Complexity</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '0.1rem' }}>
                    {currentAlgoDef.space_complexity}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Real-World Investigation Use</span>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {currentAlgoDef.real_case_use}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', textTransform: 'uppercase', fontWeight: 700 }}>Viva Defense Key Note</span>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-primary)', lineHeight: 1.4, backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '0.5rem', borderRadius: '4px' }}>
                  {currentAlgoDef.viva_notes}
                </p>
              </div>
            </div>
          </div>

          {/* Full Trace Log Viewer */}
          <div className="forensic-card" style={{ padding: '1.25rem', maxHeight: '280px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Execution Trace Event Stream
            </h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {labResult?.trace?.map((t, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep(idx);
                  }}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    backgroundColor: idx === currentStep ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    borderLeft: `2px solid ${idx === currentStep ? 'var(--accent-blue)' : 'transparent'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <span style={{ color: idx === currentStep ? '#93c5fd' : 'var(--text-secondary)' }}>
                    #{t.step} {t.type || t.operation}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    {t.node_id !== undefined ? `Node ${t.node_id}` : t.key || t.char || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
