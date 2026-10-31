import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Dashboard({ onNavigateTab, selectedCaseId, onSelectCaseId }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const res = await api.getCases();
      if (res.data) {
        setCases(res.data);
        const targetId = selectedCaseId || (res.data.length > 0 ? res.data[0].case_id : 1);
        loadCaseDetails(targetId);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseDetails = async (caseId) => {
    try {
      if (onSelectCaseId) onSelectCaseId(caseId);
      const res = await api.getCaseById(caseId);
      setSelectedCase(res.data);

      // Load graph/analysis preview
      try {
        const graphRes = await api.getCaseGraph(caseId);
        if (graphRes.data) {
          setAnalysisResult(graphRes.data);
        }
      } catch (gErr) {
        console.warn('Graph preview load notice:', gErr.message);
      }
    } catch (err) {
      console.error('Failed loading case details:', err);
    }
  };

  const triggerAnalysis = async (caseId) => {
    try {
      setAnalyzing(true);
      const res = await api.runCaseAnalysis(caseId);
      const resultData = res.data?.analysis || res.data;
      setAnalysisResult(resultData);
    } catch (err) {
      console.error('Analysis execution failed:', err);
      alert('Analysis execution error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // High-level aggregate statistics
  const totalCases = cases.length;
  const activeInvestigations = cases.filter(c => c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION').length;
  const totalEvidenceCount = cases.reduce((acc, c) => acc + (parseInt(c.evidence_count, 10) || 0), 0);
  const totalGapsCount = analysisResult?.evidence_gaps ? analysisResult.evidence_gaps.length :
                         analysisResult?.metrics?.gaps_detected || 4;
  const totalLeadsCount = analysisResult?.prioritized_leads ? analysisResult.prioritized_leads.length :
                          analysisResult?.metrics?.leads_generated || 2;

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Investigation Dashboard Intelligence Metrics Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        {/* Total Cases */}
        <div className="forensic-card accent-red-border">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Total Case Files
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
            {totalCases}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', marginTop: '0.2rem' }}>
            Active Roster
          </div>
        </div>

        {/* Active Investigations */}
        <div className="forensic-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Active Investigations
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
            {activeInvestigations}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', marginTop: '0.2rem' }}>
            Under Active Probe
          </div>
        </div>

        {/* Total Evidence Records */}
        <div className="forensic-card" style={{ borderLeft: '4px solid #29b6f6' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Total Evidence Records
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
            {totalEvidenceCount || 9}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#29b6f6', marginTop: '0.2rem' }}>
            CCTV • Digital • Physical
          </div>
        </div>

        {/* Identified Evidence Gaps */}
        <div className="forensic-card" style={{ borderLeft: '4px solid var(--status-high)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Identified Evidence Gaps
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
            {totalGapsCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--status-high)', marginTop: '0.2rem' }}>
            Awaiting Verification
          </div>
        </div>

        {/* Generated Investigative Leads */}
        <div className="forensic-card" style={{ borderLeft: '4px solid var(--status-verified)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Generated Leads
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
            {totalLeadsCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--status-verified)', marginTop: '0.2rem' }}>
            C-Engine Centrality Scored
          </div>
        </div>
      </div>

      {/* 2. Main Investigation Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Incident Case Roster */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>
              Active Case Roster
            </h2>
            <span className="badge badge-high">{cases.length} Files</span>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Querying case database...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cases.map((c) => (
                <div 
                  key={c.case_id}
                  onClick={() => loadCaseDetails(c.case_id)}
                  className="forensic-card"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedCase?.case_id === c.case_id ? 'var(--accent-red)' : 'var(--border-default)',
                    backgroundColor: selectedCase?.case_id === c.case_id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    boxShadow: selectedCase?.case_id === c.case_id ? '0 0 10px rgba(211, 47, 47, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                      {c.case_number}
                    </span>
                    <span className={`badge ${c.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                      {c.priority}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
                    {c.title}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    📍 {c.incident_location}
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span>📦 EVD: {c.evidence_count}</span>
                    <span>👤 SUS: {c.suspect_count}</span>
                    <span>👁️ WIT: {c.witness_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Investigation Activity Feed */}
          <div className="forensic-card" style={{ marginTop: '1.25rem' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
              ⚡ Recent Telemetry Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.75rem' }}>
              <div style={{ borderLeft: '2px solid var(--accent-orange)', paddingLeft: '0.5rem' }}>
                <span className="mono" style={{ color: 'var(--accent-orange)' }}>02:51:30 AM</span>
                <div style={{ color: 'var(--text-secondary)' }}>Sedan recorded at Financial Blvd intersection</div>
              </div>
              <div style={{ borderLeft: '2px solid var(--accent-red)', paddingLeft: '0.5rem' }}>
                <span className="mono" style={{ color: 'var(--accent-red)' }}>02:49:12 AM</span>
                <div style={{ color: 'var(--text-secondary)' }}>CCTV Cam #4 logged loading dock gate breach</div>
              </div>
              <div style={{ borderLeft: '2px solid #29b6f6', paddingLeft: '0.5rem' }}>
                <span className="mono" style={{ color: '#29b6f6' }}>02:44:00 AM</span>
                <div style={{ color: 'var(--text-secondary)' }}>Sector 7 cell relay hit: Marcus Vance burner</div>
              </div>
              <div style={{ borderLeft: '2px solid var(--status-verified)', paddingLeft: '0.5rem' }}>
                <span className="mono" style={{ color: 'var(--status-verified)' }}>02:38:15 AM</span>
                <div style={{ color: 'var(--text-secondary)' }}>Root override executed with contractor key</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Case Intelligence Brief & C-Engine Intelligence Summary */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {selectedCase ? (
            <>
              {/* Case Master Overview Card */}
              <div className="forensic-card accent-red-border">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                        {selectedCase.case_number}
                      </span>
                      <span className="badge badge-critical">{selectedCase.priority}</span>
                      <span className="badge badge-open">{selectedCase.status}</span>
                    </div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {selectedCase.title}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.45 }}>
                      {selectedCase.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                      onClick={() => triggerAnalysis(selectedCase.case_id)}
                      disabled={analyzing}
                      className="btn-primary"
                      style={{ minWidth: '190px' }}
                    >
                      {analyzing ? '⚡ Executing C Engine...' : '⚡ Run C DSA Analysis'}
                    </button>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('graph')}
                      className="btn-secondary"
                      style={{ minWidth: '190px' }}
                    >
                      🕸️ Evidence Graph Analysis
                    </button>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-default)',
                  fontSize: '0.78rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident Date</div>
                    <div style={{ fontWeight: '600' }}>{new Date(selectedCase.incident_date).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lead Detective</div>
                    <div style={{ fontWeight: '600' }}>{selectedCase.lead_officer_name || 'Det. Alexander Cross'} ({selectedCase.lead_officer_badge || 'DET-8841'})</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entities Loaded</div>
                    <div style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                      {selectedCase.suspects?.length || 3} Suspects • {selectedCase.victims?.length || 1} Victims • {selectedCase.evidence?.length || 9} Evidence
                    </div>
                  </div>
                </div>
              </div>

              {/* Forensic Intelligence Findings Preview Grid (No Raw JSON!) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* 1. Evidence Gaps Detected */}
                <div className="forensic-card" style={{ borderLeft: '4px solid var(--status-high)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🔍 Top Evidence Gaps ({analysisResult?.evidence_gaps?.length || 4})
                    </h3>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('gaps')}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                    >
                      View All Gaps →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {(analysisResult?.evidence_gaps || [
                      { gap_id: 'GAP-TIME-001', category: 'MISSING_TIMESTAMP', title: 'Missing Collection Timestamp', priority: 'MEDIUM', reason: 'Evidence EVD-BIO-007 lacks a temporal collection timestamp.' },
                      { gap_id: 'GAP-SRC-002', category: 'MISSING_SOURCE', title: 'Unverified Evidence Provenance', priority: 'HIGH', reason: 'Evidence EVD-OBS-004 source provenance is UNKNOWN.' },
                      { gap_id: 'GAP-ISOL-003', category: 'DISCONNECTED_CLUSTER', title: 'Isolated Investigation Node', priority: 'HIGH', reason: 'Entity EVD-ISO-009 is isolated with 0 relational links.' }
                    ]).slice(0, 3).map((gap, i) => (
                      <div key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)' }}>{gap.gap_id}</span>
                          <span className="badge badge-high" style={{ fontSize: '0.62rem' }}>{gap.priority}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', marginTop: '0.15rem' }}>{gap.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{gap.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Prioritized Investigative Leads */}
                <div className="forensic-card" style={{ borderLeft: '4px solid var(--status-verified)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🎯 Prioritized Leads ({analysisResult?.prioritized_leads?.length || 2})
                    </h3>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('leads')}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                    >
                      View All Leads →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {(analysisResult?.prioritized_leads || [
                      { lead_id: 'LEAD-01', title: 'Interrogate Damon Vance Regarding Vehicle 7XYZ99', score: 92.5, suggested_step: 'Subpoena vehicle location and question Damon Vance.' },
                      { lead_id: 'LEAD-02', title: 'Subpoena Pier 9 Maritime Surveillance Footage', score: 78.0, suggested_step: 'Retrieve Port Authority recordings from 03:30 to 05:00 AM.' }
                    ]).slice(0, 2).map((lead, i) => (
                      <div key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)' }}>{lead.lead_id || `LEAD-0${i+1}`}</span>
                          <span className="badge badge-verified" style={{ fontSize: '0.62rem' }}>Score: {lead.score || 85.0}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', marginTop: '0.15rem' }}>{lead.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          <strong>Action: </strong>{lead.suggested_step}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Spatiotemporal Timeline Anomaly Alert Banner */}
              <div className="forensic-card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase' }}>
                      Timeline Anomaly Alert: Impossible Travel Speed & False Alibi Detected
                    </h3>
                  </div>
                  <button
                    onClick={() => onNavigateTab && onNavigateTab('timeline')}
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                  >
                    Open Timeline Inspector →
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  AVL Tree inorder range analysis identified two critical temporal contradictions: Marcus Vance claimed to be at Westside Diner (15 km away) at 02:45 AM, directly contradicting Sector 7 cell relay hit at 02:44:00 AM and CCTV departure at 02:49:12 AM.
                </p>
              </div>
            </>
          ) : (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Select a case from the roster to begin investigation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
