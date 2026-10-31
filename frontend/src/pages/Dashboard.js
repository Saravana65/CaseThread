import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Dashboard({ onNavigateToGraph }) {
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
        if (res.data.length > 0) {
          loadCaseDetails(res.data[0].case_id);
        }
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseDetails = async (caseId) => {
    try {
      const res = await api.getCaseById(caseId);
      setSelectedCase(res.data);
    } catch (err) {
      console.error('Failed loading case details:', err);
    }
  };

  const triggerAnalysis = async (caseId) => {
    try {
      setAnalyzing(true);
      const res = await api.runCaseAnalysis(caseId);
      setAnalysisResult(res.data?.analysis || res.data);
    } catch (err) {
      console.error('Analysis execution failed:', err);
      alert('Analysis execution error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Intelligence Metrics Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="forensic-card accent-red-border">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Active Investigations
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {cases.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', marginTop: '0.4rem' }}>
            Major Crimes Jurisdiction
          </div>
        </div>

        <div className="forensic-card accent-orange-border">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Core Engine DSA
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.4rem' }}>
            C Native Subsystem
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', marginTop: '0.4rem', fontFamily: 'var(--font-mono)' }}>
            AVL-Trees • Graphs • HashMaps
          </div>
        </div>

        <div className="forensic-card">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            IPC Communication
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.4rem' }}>
            JSON Stdin / Stdout
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--status-verified)', marginTop: '0.4rem', fontFamily: 'var(--font-mono)' }}>
            Status: Synchronized
          </div>
        </div>
      </div>

      {/* Main Workspace Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem' }}>
        {/* Left Column: Case Navigator */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
              Incident Roster
            </h2>
            <span className="badge badge-high">{cases.length} Cases</span>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Querying case database...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cases.map((c) => (
                <div 
                  key={c.case_id}
                  onClick={() => {
                    loadCaseDetails(c.case_id);
                    setAnalysisResult(null);
                  }}
                  className="forensic-card"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedCase?.case_id === c.case_id ? 'var(--accent-red)' : 'var(--border-default)',
                    backgroundColor: selectedCase?.case_id === c.case_id ? 'var(--bg-card-hover)' : 'var(--bg-card)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-orange)' }}>
                      {c.case_number}
                    </span>
                    <span className={`badge ${c.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                      {c.priority}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginTop: '0.4rem', color: 'var(--text-primary)' }}>
                    {c.title}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    {new Date(c.incident_date).toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.7rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span>EVD: {c.evidence_count}</span>
                    <span>SUS: {c.suspect_count}</span>
                    <span>WIT: {c.witness_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Case Deep Inspection & DSA Analysis Panel */}
        <section>
          {selectedCase ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Case Header Details */}
              <div className="forensic-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-orange)' }}>
                      CASE FILE: {selectedCase.case_number}
                    </div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: '700', marginTop: '0.2rem' }}>
                      {selectedCase.title}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                      {selectedCase.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      onClick={() => triggerAnalysis(selectedCase.case_id)}
                      disabled={analyzing}
                      className="btn-primary"
                      style={{ minWidth: '180px' }}
                    >
                      {analyzing ? 'Executing C Engine...' : 'Run DSA Analysis'}
                    </button>
                    {onNavigateToGraph && (
                      <button
                        onClick={onNavigateToGraph}
                        className="btn-secondary"
                        style={{ minWidth: '180px', fontSize: '0.8rem' }}
                      >
                        🕸️ Explore Case Graph
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident Location</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{selectedCase.incident_location}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lead Detective</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{selectedCase.lead_officer_name} ({selectedCase.lead_officer_badge})</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Investigation Status</div>
                    <span className="badge badge-open">{selectedCase.status}</span>
                  </div>
                </div>
              </div>

              {/* Forensic Intelligence Output Section */}
              <div className="forensic-card accent-red-border">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    C Engine Algorithm Output
                  </h3>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)' }}>
                    ARCH-MODULE: BFS / DFS / AVL / HASHMAP
                  </span>
                </div>

                {analysisResult ? (
                  <div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                      <span className="badge badge-open">Status: {analysisResult.status}</span>
                      <span className="badge badge-medium">Engine: {analysisResult.engine_version}</span>
                    </div>
                    <pre style={{
                      backgroundColor: 'var(--bg-input)',
                      padding: '1rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-default)',
                      overflowX: 'auto',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {JSON.stringify(analysisResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', borderRadius: '4px' }}>
                    Click &ldquo;Run DSA Analysis&rdquo; to dispatch case evidence into the native C Core Engine over standard I/O IPC.
                  </div>
                )}
              </div>

              {/* Evidence Registry Preview */}
              <div className="forensic-card">
                <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>
                  Logged Evidence Items ({selectedCase.evidence ? selectedCase.evidence.length : 0})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {selectedCase.evidence && selectedCase.evidence.map((item) => (
                    <div key={item.evidence_id} style={{
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-orange)' }}>
                        {item.tracking_code} • {item.category}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', marginTop: '0.2rem' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Select an investigation case file from the roster to inspect records and run graph analysis.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
