import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import CreateCaseModal from '../components/CreateCaseModal';
import EditCaseModal from '../components/EditCaseModal';
import {
  CasesIcon,
  PlusIcon,
  SearchIcon,
  ActiveIcon,
  SolvedIcon,
  VaultIcon,
  OfficersIcon,
  ReportIcon,
  ChevronLeft,
  ChevronRight
} from '../components/icons/Icons';

export default function Investigations({
  onSelectCaseId,
  onNavigateTab,
  selectedCaseId,
  initialFilter = 'ALL',
  onOpenCreateCase
}) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('incident_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [archivingCase, setArchivingCase] = useState(null);
  const [archivingInProgress, setArchivingInProgress] = useState(false);

  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    loadInvestigations();
  }, []);

  const loadInvestigations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCases();
      if (res && res.data) {
        setCases(res.data);
      } else {
        setCases([]);
      }
    } catch (err) {
      console.error('Failed to load investigations:', err);
      setError(err.message || 'Unable to connect to investigation repository.');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort calculations
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Status Filter
      if (statusFilter === 'ACTIVE') {
        if (c.status !== 'OPEN' && c.status !== 'UNDER_INVESTIGATION') return false;
      } else if (statusFilter === 'CLOSED') {
        if (c.status !== 'CLOSED') return false;
      } else if (statusFilter === 'ARCHIVED') {
        if (c.status !== 'ARCHIVED') return false;
      }

      // Priority Filter
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) {
        return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = c.case_number && c.case_number.toLowerCase().includes(q);
        const matchTitle = c.title && c.title.toLowerCase().includes(q);
        const matchLoc = c.incident_location && c.incident_location.toLowerCase().includes(q);
        const matchOfficer = c.lead_officer_name && c.lead_officer_name.toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchLoc && !matchOfficer) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'incident_desc':
          return new Date(b.incident_date || 0) - new Date(a.incident_date || 0);
        case 'incident_asc':
          return new Date(a.incident_date || 0) - new Date(b.incident_date || 0);
        case 'title_asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'title_desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'priority_desc': {
          const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (rank[b.priority] || 0) - (rank[a.priority] || 0);
        }
        case 'case_number':
          return (a.case_number || '').localeCompare(b.case_number || '');
        default:
          return 0;
      }
    });
  }, [cases, statusFilter, priorityFilter, searchQuery, sortBy]);

  // Aggregate counts
  const totalCount = cases.length;
  const activeCount = cases.filter(c => c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION').length;
  const closedCount = cases.filter(c => c.status === 'CLOSED').length;
  const archivedCount = cases.filter(c => c.status === 'ARCHIVED').length;

  // Pagination slice
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage) || 1;
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage]);

  const handleOpenDossier = (caseId) => {
    if (onSelectCaseId) {
      onSelectCaseId(caseId);
    }
    if (onNavigateTab) {
      onNavigateTab('dossier');
    }
  };

  const handleCaseCreated = async (newCase) => {
    await loadInvestigations();
    if (newCase?.case_id) {
      handleOpenDossier(newCase.case_id);
    }
  };

  const handleCaseUpdated = async () => {
    await loadInvestigations();
  };

  const handleArchiveConfirm = async () => {
    if (!archivingCase) return;
    try {
      setArchivingInProgress(true);
      await api.archiveCase(archivingCase.case_id);
      setArchivingCase(null);
      await loadInvestigations();
    } catch (err) {
      console.error('Failed to archive case:', err);
      alert('Archival error: ' + err.message);
    } finally {
      setArchivingInProgress(false);
    }
  };

  const handleRestoreCase = async (c) => {
    try {
      await api.updateCase(c.case_id, {
        title: c.title,
        incident_location: c.incident_location,
        priority: c.priority,
        status: 'OPEN'
      });
      await loadInvestigations();
    } catch (err) {
      console.error('Failed to restore case:', err);
      alert('Restore error: ' + err.message);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setSortBy('incident_desc');
    setCurrentPage(1);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0.5rem 1.5rem 2.5rem' }}>
      {/* =========================================================================
          1. PAGE HEADER
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
            <CasesIcon size={22} color="var(--accent-primary)" />
            <h1 style={{
              fontSize: '1.65rem',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Investigations Directory
            </h1>
            <span className="badge badge-high" style={{ fontSize: '0.68rem' }}>
              {filteredCases.length} Displayed
            </span>
          </div>
          <p style={{
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            Manage active case files, browse forensic archives, filter operational statuses, and launch new investigation threads.
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => onOpenCreateCase ? onOpenCreateCase() : setIsCreateModalOpen(true)}
          className="btn-primary"
          style={{ padding: '0.5rem 1.15rem' }}
          title="Create a new forensic investigation case file"
        >
          <PlusIcon size={16} />
          <span>New Investigation</span>
        </button>
      </div>

      {/* =========================================================================
          2. SUMMARY KPI CHIPS
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div
          onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
          className="forensic-card"
          style={{
            cursor: 'pointer',
            padding: '0.85rem 1.15rem',
            borderColor: statusFilter === 'ALL' ? 'var(--accent-primary)' : 'var(--border-default)',
            backgroundColor: statusFilter === 'ALL' ? 'var(--bg-card-hover)' : 'var(--bg-card)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Total Registered
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            All bureau case records
          </div>
        </div>

        <div
          onClick={() => { setStatusFilter('ACTIVE'); setCurrentPage(1); }}
          className="forensic-card"
          style={{
            cursor: 'pointer',
            padding: '0.85rem 1.15rem',
            borderColor: statusFilter === 'ACTIVE' ? 'var(--accent-primary)' : 'var(--border-default)',
            backgroundColor: statusFilter === 'ACTIVE' ? 'var(--bg-card-hover)' : 'var(--bg-card)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Active Probes
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--status-success)', marginTop: '0.2rem' }}>
            Open & Under Investigation
          </div>
        </div>

        <div
          onClick={() => { setStatusFilter('CLOSED'); setCurrentPage(1); }}
          className="forensic-card"
          style={{
            cursor: 'pointer',
            padding: '0.85rem 1.15rem',
            borderColor: statusFilter === 'CLOSED' ? 'var(--accent-primary)' : 'var(--border-default)',
            backgroundColor: statusFilter === 'CLOSED' ? 'var(--bg-card-hover)' : 'var(--bg-card)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Closed Dockets
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {closedCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Resolved investigations
          </div>
        </div>

        <div
          onClick={() => { setStatusFilter('ARCHIVED'); setCurrentPage(1); }}
          className="forensic-card"
          style={{
            cursor: 'pointer',
            padding: '0.85rem 1.15rem',
            borderColor: statusFilter === 'ARCHIVED' ? 'var(--accent-primary)' : 'var(--border-default)',
            backgroundColor: statusFilter === 'ARCHIVED' ? 'var(--bg-card-hover)' : 'var(--bg-card)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Archived Files
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {archivedCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Preserved long-term storage
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. SEARCH, FILTER & SORT TOOLBAR
          ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.85rem',
        marginBottom: '1.25rem',
        padding: '0.85rem 1.15rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-card)'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
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
            placeholder="Search by case #, title, location, detective..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              paddingLeft: '2.1rem',
              fontSize: '0.8125rem',
              height: '36px',
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-default)'
            }}
          />
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Status Segment */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-input)',
            padding: '2px',
            borderRadius: 'var(--radius-control)',
            border: '1px solid var(--border-default)'
          }}>
            {[
              { id: 'ALL', label: `All (${totalCount})` },
              { id: 'ACTIVE', label: `Active (${activeCount})` },
              { id: 'CLOSED', label: `Closed (${closedCount})` },
              { id: 'ARCHIVED', label: `Archived (${archivedCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                style={{
                  background: statusFilter === tab.id ? 'var(--bg-elevated)' : 'transparent',
                  color: statusFilter === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.72rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
            style={{
              fontSize: '0.78rem',
              height: '36px',
              width: 'auto',
              padding: '0.4rem 0.85rem',
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-default)'
            }}
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              fontSize: '0.78rem',
              height: '36px',
              width: 'auto',
              padding: '0.4rem 0.85rem',
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-default)'
            }}
          >
            <option value="incident_desc">Incident Date (Newest)</option>
            <option value="incident_asc">Incident Date (Oldest)</option>
            <option value="priority_desc">Priority (Highest first)</option>
            <option value="title_asc">Title (A to Z)</option>
            <option value="case_number">Case Number</option>
          </select>

          {(searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || sortBy !== 'incident_desc') && (
            <button
              onClick={resetFilters}
              className="btn-ghost"
              style={{ fontSize: '0.75rem', height: '36px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. INVESTIGATIONS ROSTER TABLE / CARDS
          ========================================================================= */}
      {loading ? (
        <div className="forensic-card" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 0.75rem' }}></div>
          <div>Loading case repository from bureau database...</div>
        </div>
      ) : error ? (
        <div className="forensic-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--status-danger)' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Error loading investigations:</p>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{error}</p>
          <button onClick={loadInvestigations} className="btn-secondary" style={{ marginTop: '1rem' }}>
            Retry Connection
          </button>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="forensic-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
          <CasesIcon size={36} color="var(--border-highlight)" />
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.85rem', marginBottom: '0.35rem' }}>
            No investigations found
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            No cases match the active search or filter criteria. Clear filters or create a new investigation.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={resetFilters} className="btn-secondary">
              Reset Filters
            </button>
            <button
              onClick={() => onOpenCreateCase ? onOpenCreateCase() : setIsCreateModalOpen(true)}
              className="btn-primary"
            >
              <PlusIcon size={14} />
              <span>Create Investigation</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {paginatedCases.map((c) => {
            const isSelected = selectedCaseId === c.case_id;
            const isArchived = c.status === 'ARCHIVED';
            return (
              <div
                key={c.case_id}
                className="forensic-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                  borderLeft: c.priority === 'CRITICAL' ? '3px solid var(--status-danger)' :
                              c.priority === 'HIGH' ? '3px solid var(--status-warning)' :
                              '3px solid var(--accent-primary)',
                  boxShadow: isSelected ? '0 0 0 1px var(--accent-primary), 0 4px 16px rgba(77, 131, 247, 0.12)' : undefined,
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  {/* Left Column: Case Information */}
                  <div style={{ flex: '1 1 340px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span className="mono" style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: 'var(--accent-primary)'
                      }}>
                        {c.case_number}
                      </span>
                      <span className={`badge ${c.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                        {c.priority}
                      </span>
                      <span className={`badge ${isArchived ? 'badge-medium' : c.status === 'CLOSED' ? 'badge-verified' : 'badge-open'}`}>
                        {c.status}
                      </span>
                    </div>

                    <h2
                      onClick={() => handleOpenDossier(c.case_id)}
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        margin: '0 0 0.35rem 0',
                        cursor: 'pointer',
                        letterSpacing: '-0.01em'
                      }}
                      title="Open full investigation dossier"
                    >
                      {c.title}
                    </h2>

                    <p style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      margin: '0 0 0.65rem 0',
                      lineHeight: 1.45,
                      maxWidth: '780px'
                    }}>
                      {c.description || 'No detailed docket description provided.'}
                    </p>

                    {/* Metadata Line */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)'
                    }}>
                      {c.incident_location && (
                        <span>📍 {c.incident_location}</span>
                      )}
                      <span>📅 Incident: {c.incident_date ? new Date(c.incident_date).toLocaleString() : 'Not specified'}</span>
                      <span>👤 Lead: <span style={{ color: 'var(--text-secondary)' }}>{c.lead_officer_name || 'Det. Alexander Cross'}</span> ({c.lead_officer_badge || 'DET-8841'})</span>
                    </div>
                  </div>

                  {/* Right Column: Entity Counts & Action Controls */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.75rem',
                    minWidth: '200px'
                  }}>
                    {/* Entity Counts Pill */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.65rem',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-control)',
                      color: 'var(--text-secondary)'
                    }}>
                      <span>📦 <strong>{c.evidence_count || 0}</strong> evd</span>
                      <span>👤 <strong>{c.suspect_count || 0}</strong> sus</span>
                      <span>👁️ <strong>{c.witness_count || 0}</strong> wit</span>
                    </div>

                    {/* Action Triggers */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleOpenDossier(c.case_id)}
                        className="btn-primary"
                        style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.85rem' }}
                        title="Open Investigation Dossier"
                      >
                        <ReportIcon size={14} />
                        <span>Open Dossier</span>
                      </button>

                      <button
                        onClick={() => setEditingCase(c)}
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.75rem' }}
                        title="Edit investigation parameters"
                      >
                        Edit
                      </button>

                      {isArchived ? (
                        <button
                          onClick={() => handleRestoreCase(c)}
                          className="btn-outline"
                          style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.75rem' }}
                          title="Restore case to active roster"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setArchivingCase(c)}
                          className="btn-outline"
                          style={{ fontSize: '0.78rem', height: '32px', padding: '0 0.75rem' }}
                          title="Archive case safely to long-term storage"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-card)',
              marginTop: '0.5rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCases.length)} of {filteredCases.length} investigations
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary"
                  style={{ height: '30px', padding: '0 0.65rem' }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary"
                  style={{ height: '30px', padding: '0 0.65rem' }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          5. MODALS & CONFIRMATION DIALOGS
          ========================================================================= */}
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCaseCreated={handleCaseCreated}
      />

      <EditCaseModal
        isOpen={Boolean(editingCase)}
        onClose={() => setEditingCase(null)}
        caseData={editingCase}
        onCaseUpdated={handleCaseUpdated}
      />

      {/* Archival Safety Confirmation Dialog */}
      {archivingCase && (
        <div
          className="modal-backdrop"
          onClick={() => !archivingInProgress && setArchivingCase(null)}
        >
          <div
            className="modal-sheet"
            role="dialog"
            style={{ maxWidth: '480px', padding: '1.75rem' }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Archive Investigation #{archivingCase.case_number}?
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              Archiving transfers <strong>{archivingCase.title}</strong> to bureau cold storage. All forensic evidence, audit logs, and timelines will be preserved, but the case will be excluded from the active command center caseload.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <button
                type="button"
                onClick={() => setArchivingCase(null)}
                disabled={archivingInProgress}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={archivingInProgress}
                className="btn-danger"
              >
                {archivingInProgress ? 'Archiving...' : 'Confirm Archival'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
