import React, { useState, useEffect } from 'react';
import api from '../services/api';
import CreateCaseModal from '../components/CreateCaseModal';
import AddEvidenceModal from '../components/AddEvidenceModal';
import {
  CasesIcon,
  ActiveIcon,
  SolvedIcon,
  VaultIcon,
  GraphIcon,
  GapsIcon,
  LeadsIcon,
  TimelineIcon,
  PlusIcon,
  SearchIcon,
  ActivityIcon,
  ShieldCheckIcon,
  ReportIcon
} from '../components/icons/Icons';

export default function Dashboard({
  onNavigateTab,
  selectedCaseId,
  onSelectCaseId,
  caseFilter = 'ALL',
  onOpenCreateCase
}) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [currentFilter, setCurrentFilter] = useState(caseFilter || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cached officer for personalized investigator greeting
  const officer = (() => {
    try {
      const raw = localStorage.getItem('casethread_officer');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  })();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const currentDateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  useEffect(() => {
    if (caseFilter) {
      setCurrentFilter(caseFilter);
    }
  }, [caseFilter]);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async (preferredCaseId) => {
    try {
      setLoading(true);
      const res = await api.getCases();
      if (res.data) {
        setCases(res.data);
        const targetId = preferredCaseId || selectedCaseId || (res.data.length > 0 ? res.data[0].case_id : null);
        if (targetId) {
          await loadCaseDetails(targetId);
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
      if (onSelectCaseId) onSelectCaseId(caseId);
      const res = await api.getCaseById(caseId);
      setSelectedCase(res.data);

      // Load real graph & C-engine analysis preview
      try {
        const graphRes = await api.getCaseGraph(caseId);
        if (graphRes.data) {
          setAnalysisResult(graphRes.data);
        } else {
          setAnalysisResult(null);
        }
      } catch (gErr) {
        console.warn('Graph preview load notice:', gErr.message);
        setAnalysisResult(null);
      }

      // Load real investigation activity telemetry
      await loadCaseActivity(caseId);
    } catch (err) {
      console.error('Failed loading case details:', err);
    }
  };

  const loadCaseActivity = async (caseId) => {
    try {
      setLoadingActivity(true);
      const res = await api.getCaseActivity(caseId, { limit: 8 });
      if (res?.data?.events) {
        setActivities(res.data.events);
      } else if (Array.isArray(res?.data)) {
        setActivities(res.data);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.warn('Case activity load notice:', err.message);
      setActivities([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleCaseCreated = async (newCase) => {
    const newId = newCase?.case_id;
    if (newId && onSelectCaseId) {
      onSelectCaseId(newId);
    }
    await loadCases(newId);
  };

  const handleEvidenceAdded = async () => {
    if (selectedCase?.case_id) {
      await loadCaseDetails(selectedCase.case_id);
      await loadCases(selectedCase.case_id);
    }
  };

  const triggerAnalysis = async (caseId) => {
    try {
      setAnalyzing(true);
      const res = await api.runCaseAnalysis(caseId);
      const resultData = res.data?.analysis || res.data;
      setAnalysisResult(resultData);
      // Reload activity to capture the analysis execution log
      await loadCaseActivity(caseId);
    } catch (err) {
      console.error('Analysis execution failed:', err);
      alert('Analysis execution error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // High-level aggregate statistics (strictly real data, 0 if empty)
  const totalCases = cases.length;
  const activeInvestigations = cases.filter(c => c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION').length;
  const solvedInvestigations = cases.filter(c => c.status === 'CLOSED' || c.status === 'ARCHIVED').length;
  const totalEvidenceCount = cases.reduce((acc, c) => acc + (parseInt(c.evidence_count, 10) || 0), 0);
  const totalGapsCount = analysisResult?.evidence_gaps ? analysisResult.evidence_gaps.length :
                         (analysisResult?.metrics?.gaps_detected ?? 0);
  const totalLeadsCount = analysisResult?.prioritized_leads ? analysisResult.prioritized_leads.length :
                          (analysisResult?.metrics?.leads_generated ?? 0);

  // Filter and search cases
  const filteredCases = cases.filter((c) => {
    const matchesFilter =
      currentFilter === 'ALL' ? true :
      currentFilter === 'ACTIVE' ? (c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION') :
      currentFilter === 'SOLVED' ? (c.status === 'CLOSED' || c.status === 'ARCHIVED') : true;

    if (!matchesFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.case_number && c.case_number.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.incident_location && c.incident_location.toLowerCase().includes(q))
    );
  });

  const getEventTypeBadgeClass = (type) => {
    switch (type) {
      case 'EVIDENCE_REVIEWED':
      case 'EVIDENCE_VERIFIED':
        return 'badge-verified';
      case 'EVIDENCE_ADDED':
      case 'FILE_UPLOADED':
        return 'badge-high';
      case 'TASK_COMPLETED':
        return 'badge-low';
      case 'RELATIONSHIP_CREATED':
        return 'badge-open';
      default:
        return 'badge-high';
    }
  };

  const formatActivityTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0.5rem 1.5rem 2.5rem' }}>
      {/* =========================================================================
          1. COMMAND CENTER HEADER (Apple-Inspired Minimalism)
          ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1.25rem',
        marginBottom: '1.75rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <h1 style={{
              fontSize: '1.65rem',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              {getGreeting()}, {officer?.full_name ? officer.full_name.split(' ')[0] : 'Investigator'}
            </h1>
            {officer?.badge_number && (
              <span className="mono" style={{
                fontSize: '0.72rem',
                color: 'var(--accent-primary)',
                backgroundColor: 'var(--accent-primary-dim)',
                padding: '0.15rem 0.55rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(77, 131, 247, 0.25)',
                fontWeight: '600'
              }}>
                {officer.badge_number}
              </span>
            )}
          </div>
          <p style={{
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>Command Center</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span>Evidence Gap Detection & Investigation Operations</span>
          </p>
        </div>

        {/* Header Actions & Live Date Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.85rem',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-control)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)'
          }}>
            <span style={{ color: 'var(--accent-primary)' }}>📅</span>
            <span>{currentDateFormatted}</span>
          </div>

          <button
            onClick={() => onOpenCreateCase ? onOpenCreateCase() : setIsCreateModalOpen(true)}
            className="btn-primary"
            style={{ padding: '0.5rem 1.15rem' }}
            title="Create a new forensic investigation docket"
          >
            <PlusIcon size={16} />
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. METRIC SUMMARY ROW (Referencing Reference Images 1 & 2)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        {/* Metric 1: Total Case Files */}
        <div className="forensic-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
              Total Investigations
            </span>
            <CasesIcon size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {totalCases}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{cases.length}</span>
            <span>registered in bureau</span>
          </div>
        </div>

        {/* Metric 2: Active Investigations */}
        <div className="forensic-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
              Active Probes
            </span>
            <ActiveIcon size={16} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {activeInvestigations}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--status-success)',
              boxShadow: '0 0 6px var(--status-success)'
            }}></span>
            <span>{totalCases > 0 ? Math.round((activeInvestigations / totalCases) * 100) : 0}% active caseload</span>
          </div>
        </div>

        {/* Metric 3: Total Evidence Records */}
        <div className="forensic-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
              Cataloged Evidence
            </span>
            <VaultIcon size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {totalEvidenceCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span>Digital • Physical • CCTV</span>
          </div>
        </div>

        {/* Metric 4: Identified Evidence Gaps */}
        <div className="forensic-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
              Evidence Gaps
            </span>
            <GapsIcon size={16} color="var(--status-warning)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {totalGapsCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--status-warning)' }}>
            <span>C-Engine audit detected</span>
          </div>
        </div>

        {/* Metric 5: Generated Prioritized Leads */}
        <div className="forensic-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
              Prioritized Leads
            </span>
            <LeadsIcon size={16} color="var(--status-success)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {totalLeadsCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--status-success)' }}>
            <span>Max-heap scored paths</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN COMMAND WORKSPACE (2-Column Grid: Roster + Intelligence Center)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 370px) minmax(0, 1fr)',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* -----------------------------------------------------------------------
            LEFT COLUMN: Investigation Roster & Search
            ----------------------------------------------------------------------- */}
        <section>
          {/* Header & Filter Row */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CasesIcon size={16} color="var(--text-secondary)" />
                <h2 style={{
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  letterSpacing: '0.01em',
                  margin: 0
                }}>
                  Investigation Roster
                </h2>
              </div>
              <span className="badge badge-medium" style={{ fontSize: '0.65rem' }}>
                {filteredCases.length} / {cases.length}
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="search"
                placeholder="Search case #, title, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: '2.1rem',
                  fontSize: '0.78rem',
                  height: '34px',
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-default)'
                }}
              />
            </div>

            {/* Status Segment Control */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-input)',
              padding: '2px',
              borderRadius: 'var(--radius-control)',
              border: '1px solid var(--border-default)'
            }}>
              <button
                onClick={() => setCurrentFilter('ALL')}
                style={{
                  flex: 1,
                  background: currentFilter === 'ALL' ? 'var(--bg-elevated)' : 'transparent',
                  color: currentFilter === 'ALL' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                All ({cases.length})
              </button>
              <button
                onClick={() => setCurrentFilter('ACTIVE')}
                style={{
                  flex: 1,
                  background: currentFilter === 'ACTIVE' ? 'var(--bg-elevated)' : 'transparent',
                  color: currentFilter === 'ACTIVE' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Active ({activeInvestigations})
              </button>
              <button
                onClick={() => setCurrentFilter('SOLVED')}
                style={{
                  flex: 1,
                  background: currentFilter === 'SOLVED' ? 'var(--bg-elevated)' : 'transparent',
                  color: currentFilter === 'SOLVED' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Closed ({solvedInvestigations})
              </button>
            </div>
          </div>

          {/* Cases List */}
          {loading ? (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Accessing case repository...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No investigations matching filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredCases.map((c) => {
                const isSelected = selectedCase?.case_id === c.case_id;
                return (
                  <div
                    key={c.case_id}
                    onClick={() => loadCaseDetails(c.case_id)}
                    className="forensic-card"
                    style={{
                      cursor: 'pointer',
                      padding: '0.95rem 1.15rem',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                      backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                      boxShadow: isSelected ? '0 0 0 1px var(--accent-primary), 0 4px 12px rgba(77, 131, 247, 0.12)' : 'none',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span className="mono" style={{
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}>
                        {c.case_number}
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <span className={`badge ${c.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`} style={{ fontSize: '0.62rem' }}>
                          {c.priority}
                        </span>
                        <span className="badge badge-medium" style={{ fontSize: '0.62rem' }}>
                          {c.status}
                        </span>
                      </div>
                    </div>

                    <h3 style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      margin: '0 0 0.25rem 0',
                      lineHeight: 1.35
                    }}>
                      {c.title}
                    </h3>

                    {c.incident_location && (
                      <div style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        marginBottom: '0.5rem'
                      }}>
                        <span>📍</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.incident_location}
                        </span>
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)',
                      paddingTop: '0.45rem',
                      borderTop: '1px solid var(--border-subtle)'
                    }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <span>📦 {c.evidence_count} evd</span>
                        <span>👤 {c.suspect_count || 0} sus</span>
                        <span>👁️ {c.witness_count || 0} wit</span>
                      </div>
                      <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {c.incident_date ? new Date(c.incident_date).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* -----------------------------------------------------------------------
            RIGHT COLUMN: Selected Investigation Command Center
            ----------------------------------------------------------------------- */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {selectedCase ? (
            <>
              {/* 1. Case Master Overview Card */}
              <div className="forensic-card" style={{
                borderLeft: selectedCase.priority === 'CRITICAL' ? '3px solid var(--status-danger)' : '3px solid var(--accent-primary)',
                padding: '1.4rem 1.6rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span className="mono" style={{
                        fontSize: '0.8rem',
                        color: 'var(--accent-primary)',
                        fontWeight: '700'
                      }}>
                        {selectedCase.case_number}
                      </span>
                      <span className={`badge ${selectedCase.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                        {selectedCase.priority}
                      </span>
                      <span className="badge badge-open">
                        {selectedCase.status}
                      </span>
                    </div>
                    <h2 style={{
                      fontSize: '1.35rem',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      margin: '0 0 0.45rem 0'
                    }}>
                      {selectedCase.title}
                    </h2>
                    <p style={{
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: 0
                    }}>
                      {selectedCase.description || 'No detailed docket description provided.'}
                    </p>
                  </div>

                  {/* Quick Action Dock */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    minWidth: '190px'
                  }}>
                    <button
                      onClick={() => setIsAddEvidenceOpen(true)}
                      className="btn-primary"
                      style={{ width: '100%' }}
                      title="Add Evidence to this Investigation"
                    >
                      <PlusIcon size={15} />
                      <span>Add Evidence</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('graph')}
                      className="btn-secondary"
                      style={{ width: '100%' }}
                    >
                      <GraphIcon size={15} />
                      <span>Evidence Graph</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('dossier')}
                      className="btn-secondary"
                      style={{ width: '100%' }}
                    >
                      <ReportIcon size={15} />
                      <span>Full Case Dossier</span>
                    </button>
                  </div>
                </div>

                {/* Case Metadata Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      Incident Date & Time
                    </div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                      {selectedCase.incident_date ? new Date(selectedCase.incident_date).toLocaleString() : 'Not Specified'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      Lead Detective
                    </div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                      {selectedCase.lead_officer_name || 'Det. Alexander Cross'} ({selectedCase.lead_officer_badge || 'DET-8841'})
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      Incident Location
                    </div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                      {selectedCase.incident_location || 'Jurisdiction Core'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      Entities Ingested
                    </div>
                    <div className="mono" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
                      {(selectedCase.evidence ? selectedCase.evidence.length : 0)} Evidence • {(selectedCase.suspects ? selectedCase.suspects.length : 0)} Suspects
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Registered Forensic Evidence Preview Section */}
              <div className="forensic-card">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.85rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <VaultIcon size={16} color="var(--accent-primary)" />
                    <h3 style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      margin: 0
                    }}>
                      Registered Evidence ({selectedCase.evidence ? selectedCase.evidence.length : 0})
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setIsAddEvidenceOpen(true)}
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', height: '30px', padding: '0 0.65rem' }}
                    >
                      <PlusIcon size={13} />
                      <span>Add Evidence</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('dossier')}
                      className="btn-outline"
                      style={{ fontSize: '0.72rem', height: '30px', padding: '0 0.65rem' }}
                    >
                      View Dossier →
                    </button>
                  </div>
                </div>

                {(!selectedCase.evidence || selectedCase.evidence.length === 0) ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '1.5rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-control)',
                    border: '1px dashed var(--border-default)'
                  }}>
                    No forensic evidence items logged yet for this case docket.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                    {selectedCase.evidence.slice(0, 4).map((e) => {
                      const isFact = e.verification_status === 'CONFIRMED_FACT';
                      return (
                        <div
                          key={e.evidence_id}
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-control)',
                            border: '1px solid var(--border-default)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                              {e.tracking_code}
                            </span>
                            <span className={`badge ${isFact ? 'badge-verified' : 'badge-unverified'}`} style={{ fontSize: '0.62rem' }}>
                              {e.verification_status ? e.verification_status.replace(/_/g, ' ') : 'OBSERVATION'}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {e.title}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>{e.category}</span>
                            {e.source && <span> • {e.source}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedCase.evidence && selectedCase.evidence.length > 4 && (
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    textAlign: 'right',
                    marginTop: '0.6rem'
                  }}>
                    + {selectedCase.evidence.length - 4} more items cataloged in full dossier
                  </div>
                )}
              </div>

              {/* 3. Real Telemetry & Investigation Activity Stream */}
              <div className="forensic-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ActivityIcon size={16} color="var(--accent-primary)" />
                    <h3 style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      margin: 0
                    }}>
                      Investigation Telemetry & Activity Stream
                    </h3>
                  </div>
                  <button
                    onClick={() => onNavigateTab && onNavigateTab('collaboration')}
                    className="btn-outline"
                    style={{ fontSize: '0.72rem', height: '30px', padding: '0 0.65rem' }}
                  >
                    View Collaboration Log →
                  </button>
                </div>

                {loadingActivity ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
                    Loading telemetry events...
                  </div>
                ) : activities.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '1.5rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-control)',
                    border: '1px dashed var(--border-default)'
                  }}>
                    No activity logs recorded yet for this investigation.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {activities.map((act) => (
                      <div
                        key={act.activity_id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          padding: '0.65rem 0.85rem',
                          backgroundColor: 'var(--bg-input)',
                          borderRadius: 'var(--radius-control)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`badge ${getEventTypeBadgeClass(act.event_type)}`} style={{ fontSize: '0.62rem' }}>
                              {act.event_type ? act.event_type.replace(/_/g, ' ') : 'EVENT'}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                              {act.event_description}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            by <span style={{ color: 'var(--text-secondary)' }}>{act.actor_name || 'Officer'}</span> ({act.actor_badge || 'LEAD'})
                          </div>
                        </div>

                        <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatActivityTime(act.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. C-Engine Findings: Evidence Gaps & Prioritized Leads Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* 4A. Evidence Gaps */}
                <div className="forensic-card" style={{ borderLeft: '3px solid var(--status-warning)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <GapsIcon size={16} color="var(--status-warning)" />
                      <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        Identified Evidence Gaps ({analysisResult?.evidence_gaps ? analysisResult.evidence_gaps.length : 0})
                      </h3>
                    </div>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('gaps')}
                      className="btn-outline"
                      style={{ fontSize: '0.7rem', height: '28px', padding: '0 0.55rem' }}
                    >
                      All Gaps →
                    </button>
                  </div>

                  {(!analysisResult?.evidence_gaps || analysisResult.evidence_gaps.length === 0) ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '1.25rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontStyle: 'italic',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: 'var(--radius-control)'
                    }}>
                      No evidence gaps detected by C-Engine for this case docket.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {analysisResult.evidence_gaps.slice(0, 3).map((gap, i) => (
                        <div
                          key={gap.gap_id || i}
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            padding: '0.65rem 0.8rem',
                            borderRadius: 'var(--radius-control)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--status-warning)', fontWeight: '600' }}>
                              {gap.gap_id}
                            </span>
                            <span className={`badge ${gap.priority === 'HIGH' ? 'badge-critical' : 'badge-high'}`} style={{ fontSize: '0.6rem' }}>
                              {gap.priority || 'MEDIUM'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                            {gap.title}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            {gap.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4B. Prioritized Leads */}
                <div className="forensic-card" style={{ borderLeft: '3px solid var(--status-success)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <LeadsIcon size={16} color="var(--status-success)" />
                      <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        Prioritized Leads ({analysisResult?.prioritized_leads ? analysisResult.prioritized_leads.length : 0})
                      </h3>
                    </div>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('leads')}
                      className="btn-outline"
                      style={{ fontSize: '0.7rem', height: '28px', padding: '0 0.55rem' }}
                    >
                      All Leads →
                    </button>
                  </div>

                  {(!analysisResult?.prioritized_leads || analysisResult.prioritized_leads.length === 0) ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '1.25rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontStyle: 'italic',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: 'var(--radius-control)'
                    }}>
                      No prioritized leads generated yet for this case docket.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {analysisResult.prioritized_leads.slice(0, 3).map((lead, i) => (
                        <div
                          key={lead.lead_id || i}
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            padding: '0.65rem 0.8rem',
                            borderRadius: 'var(--radius-control)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--status-success)', fontWeight: '600' }}>
                              {lead.lead_id || `LEAD-0${i + 1}`}
                            </span>
                            <span className="badge badge-verified" style={{ fontSize: '0.6rem' }}>
                              Score: {lead.score || 85.0}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                            {lead.title}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            <strong>Action: </strong>{lead.suggested_step || lead.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. C-Engine Spatiotemporal Timeline Anomalies (Only shown when real anomalies are detected) */}
              {analysisResult?.timeline_anomalies && analysisResult.timeline_anomalies.length > 0 && (
                <div className="forensic-card" style={{ borderLeft: '3px solid var(--status-danger)' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.65rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TimelineIcon size={16} color="var(--status-danger)" />
                      <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        Spatiotemporal Anomaly Alert: Contradictory Movement Detected ({analysisResult.timeline_anomalies.length})
                      </h3>
                    </div>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('timeline')}
                      className="btn-outline"
                      style={{ fontSize: '0.7rem', height: '28px', padding: '0 0.55rem' }}
                    >
                      Open Timeline Inspector →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {analysisResult.timeline_anomalies.map((ano, i) => (
                      <div
                        key={ano.anomaly_id || i}
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-control)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ color: 'var(--status-danger)', fontWeight: '600', marginBottom: '0.2rem' }}>
                          {ano.anomaly_type ? ano.anomaly_type.replace(/_/g, ' ') : 'ANOMALY DETECTED'}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.35rem 0', lineHeight: 1.45 }}>
                          {ano.explanation}
                        </p>
                        {ano.suggested_check && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <strong>Check: </strong>{ano.suggested_check}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. C-Engine Trigger / Re-run Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--border-default)',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <ShieldCheckIcon size={16} color="var(--status-success)" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    C99 Algorithmic Engine: Connected Components, AVL Tree Spatiotemporal Range & Max-Heap Centrality.
                  </span>
                </div>
                <button
                  onClick={() => triggerAnalysis(selectedCase.case_id)}
                  disabled={analyzing}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', height: '32px' }}
                >
                  {analyzing ? (
                    <>
                      <span className="spinner" style={{ width: 12, height: 12 }}></span>
                      <span>Computing Graph...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Re-Run C-Engine Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-muted)' }}>
              <CasesIcon size={32} color="var(--border-highlight)" />
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Select an investigation from the roster to inspect forensic telemetry.
              </div>
            </div>
          )}
        </section>
      </div>

      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCaseCreated={handleCaseCreated}
      />

      <AddEvidenceModal
        isOpen={isAddEvidenceOpen}
        onClose={() => setIsAddEvidenceOpen(false)}
        caseId={selectedCase?.case_id}
        caseNumber={selectedCase?.case_number}
        cases={cases}
        onEvidenceAdded={handleEvidenceAdded}
      />
    </div>
  );
}
