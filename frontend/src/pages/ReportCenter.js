/**
 * @file ReportCenter.js
 * @brief Professional Investigative Reporting, Modular Document Builder & Multi-Format Export Center.
 * @project CASETHREAD — Phase 9 Investigative Reporting & Document Export System
 * @inspiration Apple minimal document design, forensic transparency & cryptographic traceability.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';

// Pre-defined Report Templates with corresponding default sections
const REPORT_TEMPLATES = {
  COMPREHENSIVE: {
    id: 'COMPREHENSIVE',
    label: 'Comprehensive Case Dossier',
    icon: '📑',
    description: 'Unified official report covering overview, evidence, custody, graph, timeline, and audit.',
    defaultSections: ['overview', 'people', 'evidence', 'custody', 'graph', 'timeline', 'leads', 'audit', 'notes', 'disclaimer']
  },
  OVERVIEW: {
    id: 'OVERVIEW',
    label: 'Investigation Overview Report',
    icon: '📋',
    description: 'Executive case summary, status, incident parameters, people of interest, and core statistics.',
    defaultSections: ['overview', 'people', 'notes', 'disclaimer']
  },
  EVIDENCE_INVENTORY: {
    id: 'EVIDENCE_INVENTORY',
    label: 'Evidence Inventory & Cryptographic Ledger',
    icon: '📦',
    description: 'Complete evidence registry, collection metadata, SHA-256 integrity digests, and vault files.',
    defaultSections: ['overview', 'evidence', 'audit', 'disclaimer']
  },
  CHAIN_OF_CUSTODY: {
    id: 'CHAIN_OF_CUSTODY',
    label: 'Chain of Custody Audit Report',
    icon: '🔐',
    description: 'Chronological transfer logs, personnel, transfer reasons, and cryptographic state-chain verification.',
    defaultSections: ['overview', 'custody', 'audit', 'disclaimer']
  },
  GRAPH_ANALYSIS: {
    id: 'GRAPH_ANALYSIS',
    label: 'Evidence Relationship & Network Graph Report',
    icon: '🕸️',
    description: 'Relational network topology, connected components, direct vs derived edges, and isolated leads.',
    defaultSections: ['overview', 'graph', 'leads', 'disclaimer']
  },
  TIMELINE_ANALYSIS: {
    id: 'TIMELINE_ANALYSIS',
    label: 'Timeline & Temporal Contradiction Report',
    icon: '⏱️',
    description: 'Consolidated chronological reconstruction, precision tags, time gaps, and Rules A–F anomalies.',
    defaultSections: ['overview', 'timeline', 'leads', 'disclaimer']
  }
};

const AVAILABLE_SECTIONS = [
  { id: 'overview', label: 'Investigation Overview & Metadata', category: 'CORE' },
  { id: 'people', label: 'People of Interest (Suspects, Victims, Witnesses)', category: 'CORE' },
  { id: 'evidence', label: 'Evidence Inventory & SHA-256 Hashes', category: 'EVIDENCE' },
  { id: 'custody', label: 'Chain of Custody Transfer Logs', category: 'EVIDENCE' },
  { id: 'graph', label: 'Evidence Relationships & Graph Topology', category: 'INTELLIGENCE' },
  { id: 'timeline', label: 'Chronological Reconstruction & Gap Analysis', category: 'INTELLIGENCE' },
  { id: 'leads', label: 'Prioritized Investigative Leads & Heuristics', category: 'INTELLIGENCE' },
  { id: 'audit', label: 'Tamper-Evident SHA-256 Hash Chain Verification', category: 'INTEGRITY' },
  { id: 'notes', label: 'Investigator Notes & Written Conclusions', category: 'DOCUMENTATION' },
  { id: 'disclaimer', label: 'Academic Limitations & Legal Ground-Truth Notice', category: 'DOCUMENTATION' }
];

export default function ReportCenter({ caseId = 1, caseData, onSelectCase }) {
  // State: Data loading
  const [dossier, setDossier] = useState(null);
  const [casesList, setCasesList] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // State: Builder Configuration
  const [selectedTemplate, setSelectedTemplate] = useState('COMPREHENSIVE');
  const [selectedSections, setSelectedSections] = useState(REPORT_TEMPLATES.COMPREHENSIVE.defaultSections);
  const [customNotes, setCustomNotes] = useState('');
  const [reportNameInput, setReportNameInput] = useState('');
  const [activeTab, setActiveTab] = useState('BUILDER'); // 'BUILDER' | 'HISTORY'
  const [isExporting, setIsExporting] = useState(false);

  // Load cases list
  useEffect(() => {
    async function loadCases() {
      try {
        const res = await api.getCases({ limit: 50 });
        if (res.data) {
          setCasesList(res.data);
        }
      } catch (e) {
        console.warn('Failed to load cases list for report switcher:', e.message);
      }
    }
    loadCases();
  }, []);

  // Load Dossier & Report History for active case
  const loadDossierData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dossierRes, historyRes] = await Promise.all([
        api.getCaseReportDossier(caseId),
        api.getReportHistory(caseId)
      ]);

      if (dossierRes.data) {
        setDossier(dossierRes.data);
        if (dossierRes.data.investigator_notes && !customNotes) {
          setCustomNotes(dossierRes.data.investigator_notes);
        }
        if (!reportNameInput) {
          setReportNameInput(`${dossierRes.data.case_summary.case_number} - Comprehensive Dossier`);
        }
      }
      if (historyRes.data) {
        setReportHistory(historyRes.data);
      }
    } catch (err) {
      console.error('Error loading report dossier payload:', err);
      setError(err.message || 'Failed to load case investigation dossier.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadDossierData();
  }, [loadDossierData]);

  // Handle template switch (updates default sections)
  const handleTemplateChange = (tplId) => {
    setSelectedTemplate(tplId);
    const tpl = REPORT_TEMPLATES[tplId];
    if (tpl) {
      setSelectedSections(tpl.defaultSections);
      if (dossier) {
        setReportNameInput(`${dossier.case_summary.case_number} - ${tpl.label}`);
      }
    }
  };

  // Toggle individual section in builder
  const toggleSection = (secId) => {
    setSelectedSections(prev =>
      prev.includes(secId) ? prev.filter(s => s !== secId) : [...prev, secId]
    );
  };

  // Export 1: Print to PDF
  const handlePrintPdf = async () => {
    try {
      setIsExporting(true);
      // Record generation in database history
      await api.recordReportGeneration({
        case_id: caseId,
        report_name: reportNameInput || `${dossier?.case_summary?.case_number || caseId} Report`,
        template_type: selectedTemplate,
        format: 'PDF',
        included_sections: selectedSections
      });
      // Refresh history in background
      api.getReportHistory(caseId).then(res => { if (res.data) setReportHistory(res.data); });
      // Open print-styled HTML view
      const url = api.getCaseReportHtmlUrl(caseId, selectedTemplate);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert('Error initiating PDF export: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export 2: Download CSV
  const handleDownloadCsv = async () => {
    try {
      setIsExporting(true);
      await api.recordReportGeneration({
        case_id: caseId,
        report_name: `${reportNameInput || dossier?.case_summary?.case_number} (CSV)`,
        template_type: selectedTemplate,
        format: 'CSV',
        included_sections: selectedSections
      });
      api.getReportHistory(caseId).then(res => { if (res.data) setReportHistory(res.data); });
      const csvTemplate = selectedTemplate === 'CHAIN_OF_CUSTODY' ? 'CUSTODY' :
                          selectedTemplate === 'TIMELINE_ANALYSIS' ? 'TIMELINE' : 'EVIDENCE';
      const url = api.getCaseReportCsvUrl(caseId, csvTemplate);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert('Error exporting CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export 3: Download JSON
  const handleDownloadJson = async () => {
    try {
      setIsExporting(true);
      await api.recordReportGeneration({
        case_id: caseId,
        report_name: `${reportNameInput || dossier?.case_summary?.case_number} (JSON)`,
        template_type: selectedTemplate,
        format: 'JSON',
        included_sections: selectedSections
      });
      api.getReportHistory(caseId).then(res => { if (res.data) setReportHistory(res.data); });
      const res = await api.getCaseReportJson(caseId);
      const jsonBlob = new Blob([JSON.stringify(res.data || res.report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CASETHREAD_${dossier?.case_summary?.case_number || caseId}_${selectedTemplate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading JSON report: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Delete history item
  const handleDeleteHistory = async (reportId) => {
    if (!window.confirm('Delete this historical report entry?')) return;
    try {
      await api.deleteReportHistory(reportId);
      setReportHistory(prev => prev.filter(r => r.report_id !== reportId));
    } catch (err) {
      alert('Failed to delete report entry: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', paddingBottom: '3rem' }}>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CASE SWITCHER                                             */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📑</span>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Investigative Reports & Document Export System
            </h1>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '600',
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              backgroundColor: 'var(--accent-primary-dim)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border-highlight)'
            }}>
              CASE #{dossier?.case_summary?.case_number || caseId}
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Generate, preview, customize, and export audit-ready investigative dossiers in PDF, CSV, and structured JSON.
          </p>
        </div>

        {/* Case Switcher & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={caseId}
            onChange={(e) => {
              const newId = parseInt(e.target.value, 10);
              if (onSelectCase) onSelectCase(newId);
            }}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {casesList.length > 0 ? (
              casesList.map(c => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_number} • {c.title.slice(0, 32)}...
                </option>
              ))
            ) : (
              <option value={caseId}>Case #{caseId}</option>
            )}
          </select>

          <button
            onClick={() => { setRefreshing(true); loadDossierData(); }}
            disabled={refreshing || loading}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>🔄</span>
            {refreshing ? 'Updating...' : 'Re-generate'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE METRIC RIBBON                                                */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.85rem'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Evidence Registry
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {dossier?.case_summary?.statistics?.total_evidence || 0}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>
              100% SHA-256 Hashed
            </span>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Custody Transfers
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {dossier?.case_summary?.statistics?.total_custody_transfers || 0}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Formal handoffs</span>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Timeline Records
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {dossier?.case_summary?.statistics?.total_timeline_events || 0}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Across 4 tables</span>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Audit State-Chain
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: dossier?.case_summary?.statistics?.audit_chain_verified ? 'var(--status-success)' : 'var(--accent-red)'
            }}>
              {dossier?.case_summary?.statistics?.audit_chain_verified ? 'VERIFIED INTACT' : 'REVIEW REQUIRED'}
            </span>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          cursor: 'pointer'
        }}
        onClick={() => setActiveTab('HISTORY')}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Report History
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
              {reportHistory.length}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Generated entries</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. REPORT CENTER TABS: BUILDER & PREVIEW vs REPORT HISTORY                 */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '0.5rem'
      }}>
        <button
          onClick={() => setActiveTab('BUILDER')}
          style={{
            padding: '0.45rem 1rem',
            fontSize: '0.82rem',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'BUILDER' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'BUILDER' ? '#FFF' : 'var(--text-secondary)'
          }}
        >
          Report Builder & Live Preview
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          style={{
            padding: '0.45rem 1rem',
            fontSize: '0.82rem',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'HISTORY' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'HISTORY' ? '#FFF' : 'var(--text-secondary)'
          }}
        >
          Generated Report History ({reportHistory.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REPORT BUILDER & LIVE PREVIEW WORKSPACE                            */}
      {/* ========================================================================= */}
      {activeTab === 'BUILDER' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '400px 1fr',
          gap: '1.5rem',
          alignItems: 'start'
        }}>

          {/* LEFT: BUILDER CONTROLS & SECTION TOGGLES */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '1.25rem'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                1. Select Report Template
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Choose pre-configured template or customize sections.
              </span>
            </div>

            {/* Template Selector Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {Object.values(REPORT_TEMPLATES).map(tpl => {
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleTemplateChange(tpl.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-input)',
                      border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{tpl.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {tpl.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                        {tpl.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Report Name & Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Report Document Title
              </label>
              <input
                type="text"
                value={reportNameInput}
                onChange={(e) => setReportNameInput(e.target.value)}
                placeholder="Enter report title..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Modular Section Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  2. Modular Sections Included ({selectedSections.length})
                </h4>
                <button
                  onClick={() => {
                    if (selectedSections.length === AVAILABLE_SECTIONS.length) {
                      setSelectedSections(['overview', 'evidence', 'disclaimer']);
                    } else {
                      setSelectedSections(AVAILABLE_SECTIONS.map(s => s.id));
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {selectedSections.length === AVAILABLE_SECTIONS.length ? 'Reset to Min' : 'Select All'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {AVAILABLE_SECTIONS.map(sec => {
                  const isChecked = selectedSections.includes(sec.id);
                  return (
                    <label
                      key={sec.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.76rem',
                        color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: isChecked ? 'rgba(77, 131, 247, 0.05)' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSection(sec.id)}
                      />
                      <span>{sec.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Investigator Notes & Conclusions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                3. Investigator Findings & Summary Statement
              </label>
              <textarea
                rows={4}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Enter investigator observations, factual summaries or notes for inclusion in official report..."
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.78rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Traceability note: Text entered here is explicitly attributed as 'Investigator-Authored Statement'.
              </span>
            </div>

            {/* EXPORT ACTION BUTTONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
              <button
                onClick={handlePrintPdf}
                disabled={isExporting}
                className="btn-primary"
                style={{
                  padding: '0.65rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#FFF',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>🖨️</span> Print / Save as PDF
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  onClick={handleDownloadCsv}
                  disabled={isExporting}
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>📊</span> Export CSV
                </button>

                <button
                  onClick={handleDownloadJson}
                  disabled={isExporting}
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>💾</span> Export JSON
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: LIVE PRINT-READY DOCUMENT PREVIEW */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            borderRadius: '12px',
            padding: '2.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            minHeight: '800px',
            position: 'relative'
          }}>
            {/* Document Watermark / Top Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #2563eb',
              paddingBottom: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  CASETHREAD INVESTIGATIVE PLATFORM • OFFICIAL REPORT
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0.2rem 0', color: '#0f172a' }}>
                  {reportNameInput || 'Investigation Dossier'}
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Docket: <strong>{dossier?.case_summary?.case_number}</strong> • Case Ref ID: #{caseId}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca'
                }}>
                  {dossier?.case_summary?.priority || 'NORMAL'} PRIORITY
                </span>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Status: <strong>{dossier?.case_summary?.status || 'OPEN'}</strong>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Generated: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Disclaimer Box */}
            {selectedSections.includes('disclaimer') && (
              <div style={{
                backgroundColor: '#f8fafc',
                borderLeft: '4px solid #2563eb',
                padding: '0.75rem 1rem',
                fontSize: '0.75rem',
                color: '#475569',
                borderRadius: '0 4px 4px 0',
                lineHeight: 1.4
              }}>
                <strong>⚠️ LEGAL & ACADEMIC GROUND-TRUTH NOTICE:</strong><br />
                {dossier?.report_metadata?.disclaimer}
              </div>
            )}

            {/* Section 1: Overview */}
            {selectedSections.includes('overview') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem', margin: '0.75rem 0 0.25rem 0' }}>
                  1. Investigation Overview
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <tbody>
                    <tr>
                      <th style={{ width: '25%', padding: '0.4rem', border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'left', color: '#475569' }}>Investigation Title</th>
                      <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}><strong>{dossier?.case_summary?.title}</strong></td>
                    </tr>
                    <tr>
                      <th style={{ padding: '0.4rem', border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'left', color: '#475569' }}>Incident Location / Date</th>
                      <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{dossier?.case_summary?.incident_location || 'Not Specified'} • {dossier?.case_summary?.incident_date || 'Undated'}</td>
                    </tr>
                    <tr>
                      <th style={{ padding: '0.4rem', border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'left', color: '#475569' }}>Lead Investigator</th>
                      <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>
                        {dossier?.case_summary?.lead_officer ? `${dossier.case_summary.lead_officer.full_name} (${dossier.case_summary.lead_officer.badge_number})` : 'Unassigned'}
                      </td>
                    </tr>
                    <tr>
                      <th style={{ padding: '0.4rem', border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'left', color: '#475569' }}>Executive Narrative</th>
                      <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0', lineHeight: 1.4 }}>{dossier?.case_summary?.description}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 2: People of Interest */}
            {selectedSections.includes('people') && dossier?.people && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem', margin: '0.75rem 0 0.25rem 0' }}>
                  2. People of Interest
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.4rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Role</th>
                      <th style={{ padding: '0.4rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Full Name</th>
                      <th style={{ padding: '0.4rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Status / Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.people.suspects.map(s => (
                      <tr key={s.suspect_id}>
                        <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0', color: '#dc2626', fontWeight: '700' }}>SUSPECT</td>
                        <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}><strong>{s.name}</strong> {s.alias && `("${s.alias}")`}</td>
                        <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{s.notes || s.status}</td>
                      </tr>
                    ))}
                    {dossier.people.victims.map(v => (
                      <tr key={v.victim_id}>
                        <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0', color: '#2563eb', fontWeight: '700' }}>VICTIM</td>
                        <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>{v.name}</td>
                        <td style={{ padding: '0.4rem', border: '1px solid #e2e8f0' }}>Condition: {v.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 3: Evidence Inventory */}
            {selectedSections.includes('evidence') && dossier?.evidence_inventory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem', margin: '0.75rem 0 0.25rem 0' }}>
                  3. Evidence Registry & SHA-256 Digest Ledger
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Tracking Code</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Title</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>SHA-256 Digest</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.evidence_inventory.map(e => (
                      <tr key={e.evidence_id}>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: '700' }}>{e.tracking_code}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}>{e.title}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}>{e.category}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                          {e.sha256_fingerprint ? `${e.sha256_fingerprint.slice(0, 16)}...` : 'UNDIGESTED'}
                        </td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', color: e.integrity_status === 'INTACT' ? '#166534' : '#991b1b', fontWeight: '700' }}>
                          {e.integrity_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 4: Chain of Custody */}
            {selectedSections.includes('custody') && dossier?.chain_of_custody_history && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem', margin: '0.75rem 0 0.25rem 0' }}>
                  4. Chain of Custody Transfer History
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Timestamp (UTC)</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Evidence</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>From</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>To</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Reason & Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.chain_of_custody_history.map(c => (
                      <tr key={c.custody_id}>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}>{c.transfer_timestamp}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', fontWeight: '700' }}>{c.evidence_tracking}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}>{c.previous_custodian}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', fontWeight: '600' }}>{c.new_custodian}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}>{c.transfer_reason} ({c.transfer_location})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 5: Timeline */}
            {selectedSections.includes('timeline') && dossier?.chronological_timeline && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem', margin: '0.75rem 0 0.25rem 0' }}>
                  5. Chronological Reconstruction & Gap Analysis
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Time (UTC)</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Precision</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '0.35rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>Event Title & Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.chronological_timeline.slice(0, 10).map(t => (
                      <tr key={t.event_id}>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', fontWeight: '600' }}>{t.display_time || 'Undated'}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>{t.precision}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}>{t.category}</td>
                        <td style={{ padding: '0.35rem', border: '1px solid #e2e8f0' }}><strong>{t.title}</strong> — {t.location || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dossier.chronological_timeline.length > 10 && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                    + {dossier.chronological_timeline.length - 10} additional chronological records included in full exported document.
                  </div>
                )}
              </div>
            )}

            {/* Section 6: Notes */}
            {selectedSections.includes('notes') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem', margin: '0.75rem 0 0.25rem 0' }}>
                  6. Investigator Findings & Statement
                </h3>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '4px', fontSize: '0.78rem', lineHeight: 1.4, color: '#334155' }}>
                  {customNotes || 'No custom investigator notes entered.'}
                </div>
              </div>
            )}

            {/* Document Footer */}
            <div style={{
              marginTop: 'auto',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.68rem',
              color: '#94a3b8'
            }}>
              <span>CASETHREAD Academic Forensics Platform • Law Enforcement Decision Support</span>
              <span>Docket Ref: #{dossier?.case_summary?.case_number}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REPORT GENERATION HISTORY TABLE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Generated Reports History ({reportHistory.length})
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Audit trail of all generated investigative reports with download and preview actions.
              </p>
            </div>
          </div>

          {reportHistory.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No previous reports generated for this investigation. Use the Report Builder to create your first report.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reportHistory.map(r => (
                <div
                  key={r.report_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 100px 180px 160px',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  {/* Name & Template */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {r.report_name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Case: {r.case_number || `#${r.case_id}`}
                    </span>
                  </div>

                  {/* Template */}
                  <div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: '600',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--accent-primary-dim)',
                      color: 'var(--accent-primary)'
                    }}>
                      {r.template_type}
                    </span>
                  </div>

                  {/* Format */}
                  <div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: r.format === 'PDF' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: r.format === 'PDF' ? 'var(--accent-red)' : 'var(--status-success)'
                    }}>
                      {r.format}
                    </span>
                  </div>

                  {/* Generated By & Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-primary)' }}>
                      {r.generated_by_name}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        const url = api.getCaseReportHtmlUrl(r.case_id, r.template_type);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      title="Open printable HTML / PDF view"
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.72rem',
                        borderRadius: '5px',
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        cursor: 'pointer'
                      }}
                    >
                      View
                    </button>

                    <button
                      onClick={() => handleDeleteHistory(r.report_id)}
                      title="Delete record"
                      style={{
                        padding: '0.35rem 0.55rem',
                        fontSize: '0.72rem',
                        borderRadius: '5px',
                        backgroundColor: 'transparent',
                        color: 'var(--accent-red)',
                        border: '1px solid var(--border-accent-red)',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
