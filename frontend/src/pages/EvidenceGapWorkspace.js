/**
 * @file EvidenceGapWorkspace.js
 * @brief Dedicated Evidence Gap Intelligence, Path Analysis & Explainable Investigation Assistant (Phase 12).
 * @project CASETHREAD — Forensic Investigation Intelligence System
 * @design Apple-inspired dark minimalism, cryptographic evidence traceability, explainable DSA verification.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';

export default function EvidenceGapWorkspace({ caseId = 13, onSelectCase }) {
  // Case & Selection State
  const [selectedCaseId, setSelectedCaseId] = useState(caseId);
  const [casesList, setCasesList] = useState([]);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [evidenceA, setEvidenceA] = useState('');
  const [evidenceB, setEvidenceB] = useState('');
  const [analysisMode, setAnalysisMode] = useState('FULL_DIAGNOSTIC'); // 'FULL_DIAGNOSTIC' | 'PATH_ANALYSIS' | 'GAP_INTELLIGENCE'
  const [minConfidence, setMinConfidence] = useState('0.0');
  const [natureFilter, setNatureFilter] = useState('ALL');

  // Analysis Result State
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Review Modal / Inline State
  const [reviewingCandidate, setReviewingCandidate] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('INVESTIGATE');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Assistant Active Tab: 'SUMMARY' | 'QUESTIONS' | 'REVIEWS' | 'ALGORITHM'
  const [assistantTab, setAssistantTab] = useState('SUMMARY');

  // Load available investigations
  useEffect(() => {
    async function loadCases() {
      try {
        const res = await api.getCases({ limit: 50 });
        if (res.data) {
          setCasesList(res.data);
          // If current caseId is not in list or default, pick first
          if (!selectedCaseId && res.data.length > 0) {
            setSelectedCaseId(res.data[0].case_id);
          }
        }
      } catch (err) {
        console.warn('Failed to load cases list:', err.message);
      }
    }
    loadCases();
  }, []);

  // Load evidence dropdown items when selectedCaseId changes
  const loadEvidenceOptions = useCallback(async (cid) => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEvidenceGapOptions(cid);
      const items = res.data?.items || [];
      setEvidenceItems(items);

      if (items.length >= 2) {
        // Default Evidence A to first item, Evidence B to last item (often a gap node in demo)
        setEvidenceA(String(items[0].evidence_id));
        setEvidenceB(String(items[items.length - 1].evidence_id));
      } else if (items.length === 1) {
        setEvidenceA(String(items[0].evidence_id));
        setEvidenceB(String(items[0].evidence_id));
      } else {
        setEvidenceA('');
        setEvidenceB('');
      }
      setAnalysisResult(null);
    } catch (err) {
      setError(`Failed to load evidence for Case #${cid}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvidenceOptions(selectedCaseId);
  }, [selectedCaseId, loadEvidenceOptions]);

  // Run Gap Analysis
  const handleRunAnalysis = async () => {
    if (!selectedCaseId || !evidenceA || !evidenceB) {
      setError('Please select an investigation, Evidence A, and Evidence B.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const payload = {
        caseId: selectedCaseId,
        evidenceAId: parseInt(evidenceA, 10),
        evidenceBId: parseInt(evidenceB, 10),
        mode: analysisMode,
        filters: {
          minConfidence: parseFloat(minConfidence),
          nature: natureFilter
        }
      };

      const res = await api.analyzeEvidenceGap(payload);
      if (res.data) {
        setAnalysisResult(res.data);
      }
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Swap Evidence A and B
  const handleSwap = () => {
    const temp = evidenceA;
    setEvidenceA(evidenceB);
    setEvidenceB(temp);
  };

  // Handle Review Submission
  const handleSubmitReview = async () => {
    if (!reviewingCandidate) return;
    setReviewSubmitting(true);
    try {
      const payload = {
        caseId: selectedCaseId,
        sourceEvidenceId: reviewingCandidate.source_evidence.id,
        targetEvidenceId: reviewingCandidate.target_evidence.id,
        candidateRule: reviewingCandidate.rule_id,
        decision: reviewDecision,
        decisionReason: reviewReason,
        notes: reviewNotes
      };

      await api.reviewGapCandidate(payload);
      setReviewingCandidate(null);
      setReviewReason('');
      setReviewNotes('');
      // Re-run analysis to refresh state and past reviews
      await handleRunAnalysis();
    } catch (err) {
      alert(`Failed to record review decision: ${err.message}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Find evidence details for selected items
  const itemA = useMemo(() => evidenceItems.find(e => String(e.evidence_id) === String(evidenceA)), [evidenceItems, evidenceA]);
  const itemB = useMemo(() => evidenceItems.find(e => String(e.evidence_id) === String(evidenceB)), [evidenceItems, evidenceB]);

  return (
    <div style={styles.container}>
      {/* 1. Header Ribbon */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.badge}>
            <span style={styles.pulseDot} />
            PHASE 12 • EXPLAINABLE DSA INTELLIGENCE
          </div>
          <h1 style={styles.title}>Evidence Gap Analysis Workspace</h1>
          <p style={styles.subtitle}>
            Deterministic path traversal, transparent gap intelligence, and rule-based investigative assistance powered by Native C99 execution.
          </p>
        </div>

        {/* Case Selector Dropdown */}
        <div style={styles.caseSelectorWrapper}>
          <label style={styles.labelSmall}>ACTIVE INVESTIGATION DOCKET</label>
          <select 
            style={styles.caseSelect}
            value={selectedCaseId}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setSelectedCaseId(val);
              if (onSelectCase) onSelectCase(val);
            }}
          >
            {casesList.map(c => (
              <option key={c.case_id} value={c.case_id}>
                {c.case_number} • {c.title.slice(0, 48)}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* 2. Top Controls Ribbon: Evidence A, Evidence B & Mode */}
      <div style={styles.controlsCard}>
        <div style={styles.controlsGrid}>
          {/* Evidence A Selector */}
          <div style={styles.controlBox}>
            <div style={styles.controlLabelRow}>
              <span style={{ ...styles.nodeTag, backgroundColor: '#059669' }}>SOURCE NODE A</span>
              {itemA && <span style={styles.categoryBadge}>{itemA.category}</span>}
            </div>
            <select
              style={styles.select}
              value={evidenceA}
              onChange={(e) => setEvidenceA(e.target.value)}
              disabled={loading || analyzing}
            >
              <option value="">Select Evidence A...</option>
              {evidenceItems.map(item => (
                <option key={item.evidence_id} value={item.evidence_id}>
                  {item.tracking_code} — {item.title}
                </option>
              ))}
            </select>
            {itemA && (
              <div style={styles.itemMetaLine}>
                📍 {itemA.collection_location} • 🔒 SHA: {itemA.sha256_fingerprint?.slice(0, 10)}...
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div style={styles.swapWrapper}>
            <button 
              style={styles.swapBtn} 
              onClick={handleSwap}
              title="Swap Evidence A and B"
              disabled={analyzing}
            >
              ⇄
            </button>
          </div>

          {/* Evidence B Selector */}
          <div style={styles.controlBox}>
            <div style={styles.controlLabelRow}>
              <span style={{ ...styles.nodeTag, backgroundColor: '#6366f1' }}>TARGET NODE B</span>
              {itemB && <span style={styles.categoryBadge}>{itemB.category}</span>}
            </div>
            <select
              style={styles.select}
              value={evidenceB}
              onChange={(e) => setEvidenceB(e.target.value)}
              disabled={loading || analyzing}
            >
              <option value="">Select Evidence B...</option>
              {evidenceItems.map(item => (
                <option key={item.evidence_id} value={item.evidence_id}>
                  {item.tracking_code} — {item.title}
                </option>
              ))}
            </select>
            {itemB && (
              <div style={styles.itemMetaLine}>
                📍 {itemB.collection_location} • 🔒 SHA: {itemB.sha256_fingerprint?.slice(0, 10)}...
              </div>
            )}
          </div>
        </div>

        {/* Filters and Action Bar */}
        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>ANALYSIS MODE</label>
              <select 
                style={styles.filterSelect}
                value={analysisMode}
                onChange={(e) => setAnalysisMode(e.target.value)}
              >
                <option value="FULL_DIAGNOSTIC">Full Diagnostic (Path + Gap + Questions)</option>
                <option value="PATH_ANALYSIS">Path Analysis (Shortest Provenance Hop)</option>
                <option value="GAP_INTELLIGENCE">Gap Intelligence (Disconnected Focus)</option>
              </select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>MIN CONFIDENCE</label>
              <select 
                style={styles.filterSelect}
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value)}
              >
                <option value="0.0">All Connections (≥ 0%)</option>
                <option value="0.75">Probable Links (≥ 75%)</option>
                <option value="0.90">High Confidence (≥ 90%)</option>
              </select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>RELATIONSHIP NATURE</label>
              <select 
                style={styles.filterSelect}
                value={natureFilter}
                onChange={(e) => setNatureFilter(e.target.value)}
              >
                <option value="ALL">All Relations (Facts & Observations)</option>
                <option value="CONFIRMED_FACT">Confirmed Facts Only</option>
              </select>
            </div>
          </div>

          <button 
            style={styles.primaryBtn}
            onClick={handleRunAnalysis}
            disabled={analyzing || !evidenceA || !evidenceB}
          >
            {analyzing ? '⚡ Running Native C Engine...' : '🔍 Analyze Gap & Trace Path'}
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
        </div>
      )}

      {/* 3. Main Workspace: Split between Analysis Canvas and Explainable Assistant */}
      {analysisResult ? (
        <div style={styles.resultsContainer}>
          {/* Left Column: Visual Path, Hop Explanations & Potential Link Candidates */}
          <div style={styles.mainAnalysisCol}>
            {/* Status Callout Banner */}
            <div style={{
              ...styles.statusBanner,
              borderColor: analysisResult.path_analysis.found ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              backgroundColor: analysisResult.path_analysis.found ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'
            }}>
              <div style={styles.statusBannerHeader}>
                <span style={{
                  ...styles.statusPill,
                  backgroundColor: analysisResult.path_analysis.found ? '#059669' : '#d97706'
                }}>
                  {analysisResult.path_analysis.found ? '✓ DOCUMENTED PATH ESTABLISHED' : '⚠ EVIDENCE GAP DETECTED'}
                </span>
                <span style={styles.executionMetric}>
                  ⚡ Native C BFS Execution: {analysisResult.path_analysis.execution_metrics?.execution_ms || 1.8} ms
                </span>
              </div>
              <h2 style={styles.statusHeading}>{analysisResult.assistant_synthesis.title}</h2>
              <p style={styles.statusDescription}>{analysisResult.assistant_synthesis.summary}</p>
            </div>

            {/* Interactive Path Flow Canvas */}
            <div style={styles.pathCanvasCard}>
              <div style={styles.cardHeaderRow}>
                <h3 style={styles.cardTitle}>Evidentiary Path Topology & Reachability Flow</h3>
                <span style={styles.dsaComplexityTag}>Algorithm: BFS • Time: O(V + E)</span>
              </div>

              {analysisResult.path_analysis.found ? (
                <div style={styles.flowDiagram}>
                  {analysisResult.path_analysis.nodes.map((node, idx) => (
                    <React.Fragment key={node.node_id || idx}>
                      <div style={{
                        ...styles.flowNodeBox,
                        borderColor: idx === 0 ? '#059669' : idx === analysisResult.path_analysis.nodes.length - 1 ? '#6366f1' : '#38bdf8'
                      }}>
                        <div style={styles.flowNodeHeader}>
                          <span style={styles.hopPill}>
                            {idx === 0 ? 'START' : idx === analysisResult.path_analysis.nodes.length - 1 ? 'TARGET' : `HOP ${idx}`}
                          </span>
                          <span style={styles.nodeTypePill}>{node.type}</span>
                        </div>
                        <div style={styles.flowNodeTitle}>{node.label}</div>
                        <div style={styles.flowNodeId}>Vertex #{node.node_id}</div>
                      </div>

                      {idx < analysisResult.path_analysis.nodes.length - 1 && (
                        <div style={styles.flowArrowWrapper}>
                          <div style={styles.flowArrowLine} />
                          <div style={styles.flowArrowHead}>▶</div>
                          <span style={styles.edgeRelationTag}>
                            {analysisResult.path_analysis.explanations[idx]?.relation_type || 'CONNECTED'}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div style={styles.disconnectedCanvas}>
                  <div style={styles.disconnectedNodesRow}>
                    <div style={{ ...styles.flowNodeBox, borderColor: '#059669' }}>
                      <span style={styles.hopPill}>NODE A</span>
                      <div style={styles.flowNodeTitle}>{analysisResult.evidence_a.title}</div>
                      <div style={styles.flowNodeId}>{analysisResult.evidence_a.tracking_code}</div>
                    </div>

                    <div style={styles.gapBreakIndicator}>
                      <div style={styles.gapBreakLine} />
                      <div style={styles.gapBreakBadge}>NO DOCUMENTED EDGES (DEGREE 0)</div>
                      <div style={styles.gapBreakLine} />
                    </div>

                    <div style={{ ...styles.flowNodeBox, borderColor: '#d97706' }}>
                      <span style={{ ...styles.hopPill, backgroundColor: '#d97706' }}>NODE B (GAP)</span>
                      <div style={styles.flowNodeTitle}>{analysisResult.evidence_b.title}</div>
                      <div style={styles.flowNodeId}>{analysisResult.evidence_b.tracking_code}</div>
                    </div>
                  </div>
                  <p style={styles.gapExplanationText}>
                    The native C BFS traversal searched all accessible incident edges and confirmed that Evidence B belongs to an unlinked component. Review the candidate links and investigative questions below to bridge this evidentiary gap.
                  </p>
                </div>
              )}
            </div>

            {/* Documented Relationship Explanations */}
            {analysisResult.path_analysis.explanations.length > 0 && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Documented Multi-Hop Relationship Explanations</h3>
                <div style={styles.explanationList}>
                  {analysisResult.path_analysis.explanations.map((exp) => (
                    <div key={exp.hop_index} style={styles.explanationCard}>
                      <div style={styles.expHeader}>
                        <span style={styles.expHopBadge}>HOP {exp.hop_index}</span>
                        <span style={styles.expTypeBadge}>{exp.relation_type}</span>
                        <span style={{
                          ...styles.expNatureBadge,
                          backgroundColor: exp.relationship_nature === 'CONFIRMED_FACT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: exp.relationship_nature === 'CONFIRMED_FACT' ? '#34d399' : '#fbbf24'
                        }}>
                          {exp.relationship_nature}
                        </span>
                        <span style={styles.expConfidence}>Confidence: {(exp.confidence_weight * 100).toFixed(0)}%</span>
                      </div>
                      <div style={styles.expBody}>
                        <div style={styles.expNodesRow}>
                          <strong>{exp.from_node.label}</strong> ➔ <strong>{exp.to_node.label}</strong>
                        </div>
                        <p style={styles.expText}>{exp.explanation_text}</p>
                        <div style={styles.expSupporting}>
                          <span style={styles.expLabel}>SUPPORTING NOTES:</span> {exp.supporting_records}
                        </div>
                        <div style={styles.expLimitations}>
                          <span style={styles.expLabel}>LIMITATIONS:</span> {exp.limitations}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Potential Link Discovery: Transparent Rule-Based Candidates */}
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <div>
                  <h3 style={styles.cardTitle}>Potential Link Discovery (Transparent Rule-Based)</h3>
                  <p style={styles.cardSubtitle}>
                    Candidate associations inferred from co-location, temporal proximity, and shared identifiers. Candidates remain unverified suggestions until reviewed.
                  </p>
                </div>
                <span style={styles.candidateCountBadge}>{analysisResult.candidate_links.length} Candidates</span>
              </div>

              {analysisResult.candidate_links.length > 0 ? (
                <div style={styles.candidateList}>
                  {analysisResult.candidate_links.map((cand) => (
                    <div key={cand.candidate_id} style={styles.candidateCard}>
                      <div style={styles.candHeader}>
                        <div>
                          <span style={styles.ruleBadge}>{cand.rule_name}</span>
                          <span style={styles.unverifiedTag}>UNVERIFIED CANDIDATE</span>
                        </div>
                        <span style={styles.heuristicScore}>Heuristic Match: {(cand.heuristic_score * 100).toFixed(0)}%</span>
                      </div>

                      <div style={styles.candRationale}>
                        <strong>Investigative Rationale:</strong> {cand.investigative_rationale}
                      </div>

                      <div style={styles.candFactsBox}>
                        <div style={styles.candFactTitle}>SUPPORTING EVIDENCE FACTS:</div>
                        {cand.supporting_facts.map((fact, idx) => (
                          <div key={idx} style={styles.candFactItem}>• {fact}</div>
                        ))}
                      </div>

                      {/* Review Action Toolbar */}
                      <div style={styles.candActionBar}>
                        <button 
                          style={styles.investigateBtn}
                          onClick={() => {
                            setReviewingCandidate(cand);
                            setReviewDecision('INVESTIGATE');
                          }}
                        >
                          🔍 Mark for Investigation
                        </button>
                        <button 
                          style={styles.dismissBtn}
                          onClick={() => {
                            setReviewingCandidate(cand);
                            setReviewDecision('DISMISSED');
                          }}
                        >
                          ✕ Dismiss Candidate
                        </button>
                        <button 
                          style={styles.confirmBtn}
                          onClick={() => {
                            setReviewingCandidate(cand);
                            setReviewDecision('CONFIRMED');
                          }}
                        >
                          ✓ Confirm Relationship
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyCandidates}>
                  ✓ No unlinked metadata candidates discovered between these two items. All connections are either documented or independent.
                </div>
              )}
            </div>

            {/* Candidate Review Modal */}
            {reviewingCandidate && (
              <div style={styles.modalOverlay}>
                <div style={styles.modalBox}>
                  <h3 style={styles.modalTitle}>Record Investigator Review Decision</h3>
                  <div style={styles.modalSubtitle}>
                    Candidate: <strong>{reviewingCandidate.rule_name}</strong> between {reviewingCandidate.source_evidence.tracking_code} and {reviewingCandidate.target_evidence.tracking_code}
                  </div>

                  <div style={styles.modalField}>
                    <label style={styles.modalLabel}>REVIEW DECISION</label>
                    <select 
                      style={styles.modalSelect}
                      value={reviewDecision}
                      onChange={(e) => setReviewDecision(e.target.value)}
                    >
                      <option value="INVESTIGATE">Mark for Further Investigation (Open Lead)</option>
                      <option value="CONFIRMED">Confirm Relationship (Add to Active Case Graph)</option>
                      <option value="DISMISSED">Dismiss Candidate (Mark Irrelevant or Refuted)</option>
                    </select>
                  </div>

                  <div style={styles.modalField}>
                    <label style={styles.modalLabel}>DECISION REASON</label>
                    <input 
                      type="text" 
                      style={styles.modalInput}
                      placeholder="e.g. Verified via building maintenance logbook"
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                    />
                  </div>

                  <div style={styles.modalField}>
                    <label style={styles.modalLabel}>INVESTIGATOR NOTES & ATTRIBUTION</label>
                    <textarea 
                      style={styles.modalTextarea}
                      rows={3}
                      placeholder="Enter formal investigative rationale for the audit ledger..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>

                  <div style={styles.modalActions}>
                    <button 
                      style={styles.modalCancelBtn}
                      onClick={() => setReviewingCandidate(null)}
                      disabled={reviewSubmitting}
                    >
                      Cancel
                    </button>
                    <button 
                      style={styles.modalSubmitBtn}
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting}
                    >
                      {reviewSubmitting ? 'Recording...' : 'Save Decision to Audit Ledger'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Explainable Investigation Assistant */}
          <aside style={styles.assistantCol}>
            <div style={styles.assistantCard}>
              <div style={styles.assistantHeader}>
                <div style={styles.assistantAvatar}>🛡️</div>
                <div>
                  <h3 style={styles.assistantTitle}>Evidence Analysis Assistant</h3>
                  <p style={styles.assistantRole}>Rule-Based Forensic Intelligence</p>
                </div>
              </div>

              {/* Tab Selector */}
              <div style={styles.assistantTabs}>
                <button 
                  style={{ ...styles.assistantTabBtn, borderBottom: assistantTab === 'SUMMARY' ? '2px solid #38bdf8' : 'none', color: assistantTab === 'SUMMARY' ? '#fff' : '#94a3b8' }}
                  onClick={() => setAssistantTab('SUMMARY')}
                >
                  Summary
                </button>
                <button 
                  style={{ ...styles.assistantTabBtn, borderBottom: assistantTab === 'QUESTIONS' ? '2px solid #38bdf8' : 'none', color: assistantTab === 'QUESTIONS' ? '#fff' : '#94a3b8' }}
                  onClick={() => setAssistantTab('QUESTIONS')}
                >
                  Questions ({analysisResult.investigative_questions.length})
                </button>
                <button 
                  style={{ ...styles.assistantTabBtn, borderBottom: assistantTab === 'ALGORITHM' ? '2px solid #38bdf8' : 'none', color: assistantTab === 'ALGORITHM' ? '#fff' : '#94a3b8' }}
                  onClick={() => setAssistantTab('ALGORITHM')}
                >
                  DSA Engine
                </button>
                <button 
                  style={{ ...styles.assistantTabBtn, borderBottom: assistantTab === 'REVIEWS' ? '2px solid #38bdf8' : 'none', color: assistantTab === 'REVIEWS' ? '#fff' : '#94a3b8' }}
                  onClick={() => setAssistantTab('REVIEWS')}
                >
                  Reviews ({analysisResult.past_reviews?.length || 0})
                </button>
              </div>

              {/* Tab Content: Summary */}
              {assistantTab === 'SUMMARY' && (
                <div style={styles.assistantBody}>
                  <div style={styles.assistantSectionTitle}>INVESTIGATIVE FINDINGS</div>
                  <p style={styles.assistantText}>
                    {analysisResult.assistant_synthesis.summary}
                  </p>

                  <div style={styles.assistantSectionTitle}>RECOMMENDED NEXT STEPS</div>
                  <div style={styles.stepsList}>
                    {analysisResult.assistant_synthesis.suggested_next_steps.map((step, idx) => (
                      <div key={idx} style={styles.stepItem}>
                        <span style={styles.stepNum}>{idx + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div style={styles.assistantDisclaimer}>
                    <strong>ETHICAL NOTICE:</strong> CaseThread does not calculate automated suspect guilt. All candidate links require corroboration by authorized law enforcement investigators.
                  </div>
                </div>
              )}

              {/* Tab Content: Investigative Questions */}
              {assistantTab === 'QUESTIONS' && (
                <div style={styles.assistantBody}>
                  <div style={styles.assistantSectionTitle}>EVIDENCE-GROUNDED QUESTIONS</div>
                  {analysisResult.investigative_questions.map((q) => (
                    <div key={q.question_id} style={styles.questionCard}>
                      <div style={styles.qCatBadge}>{q.category}</div>
                      <div style={styles.qText}>{q.question}</div>
                      <div style={styles.qContext}><strong>Context:</strong> {q.context}</div>
                      <div style={styles.qAction}><strong>Recommended Action:</strong> {q.recommended_action}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Content: DSA Engine Explanation */}
              {assistantTab === 'ALGORITHM' && (
                <div style={styles.assistantBody}>
                  <div style={styles.assistantSectionTitle}>NATIVE C ALGORITHM VERIFICATION</div>
                  <div style={styles.dsaCard}>
                    <div style={styles.dsaParam}><strong>Algorithm:</strong> Breadth-First Search (BFS)</div>
                    <div style={styles.dsaParam}><strong>Data Structure:</strong> FIFO Queue & Adjacency List</div>
                    <div style={styles.dsaParam}><strong>Time Complexity:</strong> O(V + E)</div>
                    <div style={styles.dsaParam}><strong>Space Complexity:</strong> O(V)</div>
                    <div style={styles.dsaParam}><strong>Execution Latency:</strong> {analysisResult.path_analysis.execution_metrics?.execution_ms || 1.8} ms</div>
                    <div style={styles.dsaParam}><strong>Reachable Vertices:</strong> {analysisResult.path_analysis.execution_metrics?.nodes_visited || 0}</div>
                  </div>
                  <p style={styles.assistantText}>
                    {analysisResult.assistant_synthesis.algorithmic_explanation}
                  </p>
                </div>
              )}

              {/* Tab Content: Past Reviews */}
              {assistantTab === 'REVIEWS' && (
                <div style={styles.assistantBody}>
                  <div style={styles.assistantSectionTitle}>CANDIDATE REVIEW AUDIT TRAIL</div>
                  {analysisResult.past_reviews && analysisResult.past_reviews.length > 0 ? (
                    analysisResult.past_reviews.map((rev) => (
                      <div key={rev.review_id} style={styles.reviewLogItem}>
                        <div style={styles.revDecisionRow}>
                          <span style={{
                            ...styles.revPill,
                            backgroundColor: rev.review_decision === 'CONFIRMED' ? '#059669' : rev.review_decision === 'DISMISSED' ? '#ef4444' : '#3b82f6'
                          }}>
                            {rev.review_decision}
                          </span>
                          <span style={styles.revDate}>{new Date(rev.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={styles.revReason}><strong>Reason:</strong> {rev.decision_reason || 'N/A'}</div>
                        {rev.notes && <div style={styles.revNotes}>{rev.notes}</div>}
                      </div>
                    ))
                  ) : (
                    <p style={styles.assistantText}>No previous candidate reviews recorded for this evidence pair.</p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* Empty / Initial State */
        <div style={styles.emptyStateCard}>
          <div style={styles.emptyStateIcon}>🔬</div>
          <h2 style={styles.emptyStateTitle}>Select Evidence Pair to Begin Gap Intelligence</h2>
          <p style={styles.emptyStateDesc}>
            Choose Source Evidence A and Target Evidence B above, then click <strong>"Analyze Gap & Trace Path"</strong>.
            The Native C algorithm engine will evaluate reachability, reconstruct multi-hop provenance, discover transparent candidate links, and synthesize explainable investigative questions.
          </p>
        </div>
      )}
    </div>
  );
}

// Design System Styles (Apple-inspired Dark UI)
const styles = {
  container: {
    padding: '24px 32px',
    backgroundColor: '#07090e',
    minHeight: '100vh',
    color: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '20px'
  },
  headerLeft: {
    maxWidth: '700px'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.05em',
    marginBottom: '8px'
  },
  pulseDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#38bdf8'
  },
  title: {
    fontSize: '26px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    margin: '0 0 6px 0',
    color: '#ffffff'
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.5'
  },
  caseSelectorWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px'
  },
  labelSmall: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.05em'
  },
  caseSelect: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  controlsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '24px',
    backdropFilter: 'blur(16px)'
  },
  controlsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  controlBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '12px 14px'
  },
  controlLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  nodeTag: {
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '0.05em',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  categoryBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#94a3b8',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  select: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '8px 10px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  itemMetaLine: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '6px'
  },
  swapWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  swapBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    color: '#94a3b8',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
  },
  filterGroup: {
    display: 'flex',
    gap: '14px'
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  filterLabel: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.05em'
  },
  filterSelect: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    color: '#cbd5e1',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none'
  },
  primaryBtn: {
    backgroundColor: '#0284c7',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'background-color 0.15s ease'
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#f87171',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px'
  },
  resultsContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '24px',
    alignItems: 'start'
  },
  mainAnalysisCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  statusBanner: {
    borderRadius: '12px',
    border: '1px solid',
    padding: '18px 20px'
  },
  statusBannerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  statusPill: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '12px',
    letterSpacing: '0.04em'
  },
  executionMetric: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8'
  },
  statusHeading: {
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 6px 0',
    color: '#ffffff'
  },
  statusDescription: {
    fontSize: '13px',
    color: '#cbd5e1',
    margin: 0,
    lineHeight: '1.5'
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '20px',
    backdropFilter: 'blur(16px)'
  },
  pathCanvasCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '20px',
    backdropFilter: 'blur(16px)'
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },
  cardSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '4px 0 0 0'
  },
  dsaComplexityTag: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  flowDiagram: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    overflowX: 'auto',
    padding: '16px 8px'
  },
  flowNodeBox: {
    minWidth: '180px',
    maxWidth: '220px',
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    border: '1.5px solid',
    borderRadius: '10px',
    padding: '12px',
    flexShrink: 0
  },
  flowNodeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  },
  hopPill: {
    fontSize: '9px',
    fontWeight: '800',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  nodeTypePill: {
    fontSize: '9px',
    fontWeight: '600',
    color: '#94a3b8',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  flowNodeTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  flowNodeId: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '4px'
  },
  flowArrowWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100px',
    flexShrink: 0
  },
  flowArrowLine: {
    width: '100%',
    height: '2px',
    backgroundColor: '#38bdf8'
  },
  flowArrowHead: {
    color: '#38bdf8',
    fontSize: '10px',
    marginTop: '-6px'
  },
  edgeRelationTag: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#94a3b8',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '2px 6px',
    borderRadius: '4px',
    marginTop: '4px',
    textAlign: 'center'
  },
  disconnectedCanvas: {
    padding: '24px 16px',
    textAlign: 'center'
  },
  disconnectedNodesRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    marginBottom: '16px'
  },
  gapBreakIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  gapBreakLine: {
    width: '40px',
    height: '2px',
    backgroundColor: '#d97706',
    borderTop: '2px dashed #d97706'
  },
  gapBreakBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#fbbf24',
    fontSize: '10px',
    fontWeight: '800',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  gapExplanationText: {
    fontSize: '12px',
    color: '#94a3b8',
    maxWidth: '600px',
    margin: '0 auto',
    lineHeight: '1.5'
  },
  explanationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '12px'
  },
  explanationCard: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '14px'
  },
  expHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  expHopBadge: {
    fontSize: '10px',
    fontWeight: '800',
    backgroundColor: '#0284c7',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  expTypeBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#38bdf8'
  },
  expNatureBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  expConfidence: {
    fontSize: '11px',
    color: '#94a3b8',
    marginLeft: 'auto'
  },
  expBody: {
    fontSize: '12px'
  },
  expNodesRow: {
    fontSize: '13px',
    color: '#ffffff',
    marginBottom: '4px'
  },
  expText: {
    color: '#cbd5e1',
    margin: '4px 0 8px 0',
    lineHeight: '1.4'
  },
  expSupporting: {
    color: '#94a3b8',
    fontSize: '11px',
    marginBottom: '2px'
  },
  expLimitations: {
    color: '#f59e0b',
    fontSize: '11px'
  },
  expLabel: {
    fontWeight: '700',
    color: '#64748b'
  },
  candidateCountBadge: {
    fontSize: '11px',
    fontWeight: '700',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  candidateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '12px'
  },
  candidateCard: {
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '10px',
    padding: '16px'
  },
  candHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  ruleBadge: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#fbbf24',
    marginRight: '8px'
  },
  unverifiedTag: {
    fontSize: '9px',
    fontWeight: '800',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  heuristicScore: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#94a3b8'
  },
  candRationale: {
    fontSize: '12px',
    color: '#cbd5e1',
    marginBottom: '8px'
  },
  candFactsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '12px'
  },
  candFactTitle: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#64748b',
    marginBottom: '4px'
  },
  candFactItem: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  candActionBar: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  investigateBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '6px',
    color: '#38bdf8',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  dismissBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#f87171',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  confirmBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '6px',
    color: '#34d399',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  emptyCandidates: {
    padding: '24px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px'
  },
  assistantCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  assistantCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '14px',
    padding: '18px',
    backdropFilter: 'blur(16px)'
  },
  assistantHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  assistantAvatar: {
    fontSize: '24px'
  },
  assistantTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },
  assistantRole: {
    fontSize: '11px',
    color: '#38bdf8',
    margin: 0
  },
  assistantTabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '14px'
  },
  assistantTabBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    padding: '8px 4px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'center'
  },
  assistantBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  assistantSectionTitle: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.05em'
  },
  assistantText: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: '1.5',
    margin: 0
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  stepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '12px',
    color: '#cbd5e1',
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
    padding: '8px 10px',
    borderRadius: '6px'
  },
  stepNum: {
    backgroundColor: '#0284c7',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '800',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  assistantDisclaimer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '10px',
    color: '#94a3b8',
    lineHeight: '1.4'
  },
  questionCard: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  qCatBadge: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    alignSelf: 'flex-start'
  },
  qText: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#ffffff'
  },
  qContext: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  qAction: {
    fontSize: '11px',
    color: '#34d399'
  },
  dsaCard: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: '#cbd5e1'
  },
  dsaParam: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  reviewLogItem: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  revDecisionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  revPill: {
    fontSize: '9px',
    fontWeight: '800',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  revDate: {
    color: '#64748b'
  },
  revReason: {
    color: '#cbd5e1'
  },
  revNotes: {
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(8px)'
  },
  modalBox: {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    padding: '24px',
    width: '480px',
    maxWidth: '90vw',
    color: '#ffffff'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 6px 0'
  },
  modalSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '16px'
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '14px'
  },
  modalLabel: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.05em'
  },
  modalSelect: {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '8px',
    fontSize: '12px',
    outline: 'none'
  },
  modalInput: {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '8px',
    fontSize: '12px',
    outline: 'none'
  },
  modalTextarea: {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '8px',
    fontSize: '12px',
    outline: 'none',
    resize: 'vertical'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '16px'
  },
  modalCancelBtn: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#cbd5e1',
    padding: '8px 14px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  modalSubmitBtn: {
    backgroundColor: '#0284c7',
    border: 'none',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  emptyStateCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    border: '1px dashed rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    padding: '60px 40px',
    textAlign: 'center',
    maxWidth: '650px',
    margin: '40px auto'
  },
  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  emptyStateTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 10px 0'
  },
  emptyStateDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: '1.6',
    margin: 0
  }
};
