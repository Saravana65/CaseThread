import React, { useState } from 'react';
import api from '../services/api';
import { ReportIcon, CloseIcon } from './icons/Icons';

/**
 * @component ReportExportModal
 * @description Modal dialog for exporting comprehensive forensic investigation dossiers
 * in structured JSON, sanitized CSV, or official printable HTML/PDF format.
 */
export default function ReportExportModal({ isOpen, onClose, caseId, caseNumber, caseTitle, onNavigateToReportCenter }) {
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [template, setTemplate] = useState('COMPREHENSIVE');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleDownloadJson = async () => {
    try {
      setDownloadingJson(true);
      setError(null);
      const res = await api.getCaseReportJson(caseId);
      const jsonBlob = new Blob([JSON.stringify(res.data || res.report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CASETHREAD_REPORT_${caseNumber || caseId}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download JSON report');
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleOpenPrintableHtml = () => {
    const reportUrl = api.getCaseReportHtmlUrl(caseId, template);
    window.open(reportUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadCsv = () => {
    const csvTemplate = template === 'CHAIN_OF_CUSTODY' ? 'CUSTODY' :
                        template === 'TIMELINE_ANALYSIS' ? 'TIMELINE' : 'EVIDENCE';
    const csvUrl = api.getCaseReportCsvUrl(caseId, csvTemplate);
    window.open(csvUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-sheet"
        style={{
          maxWidth: '640px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                <ReportIcon size={20} />
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Export Forensic Case Dossier
              </h3>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              CASE #{caseNumber || caseId}: {caseTitle || 'The Metro Vault Intrusion'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ width: '28px', height: '28px', padding: 0 }}
            aria-label="Close export dialog"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--status-danger-dim)',
            border: '1px solid var(--status-danger-border)',
            color: '#F87171',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-control)',
            fontSize: '0.78rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Export a standardized, cryptographic forensic report containing evidentiary inventory, SHA-256 integrity digests, chain of custody logs, relational network topology, and chronological timeline reconstruction.
        </div>

        {/* Template Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Select Report Template:
          </label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          >
            <option value="COMPREHENSIVE">📑 Comprehensive Case Dossier (All Sections)</option>
            <option value="OVERVIEW">📋 Investigation Overview Report</option>
            <option value="EVIDENCE_INVENTORY">📦 Evidence Inventory & Cryptographic Ledger</option>
            <option value="CHAIN_OF_CUSTODY">🔐 Chain of Custody Audit Report</option>
            <option value="GRAPH_ANALYSIS">🕸️ Evidence Relationship & Network Graph Report</option>
            <option value="TIMELINE_ANALYSIS">⏱️ Timeline & Temporal Contradiction Report</option>
          </select>
        </div>

        {/* Export Formats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {/* Printable HTML / PDF */}
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                🖨️ Print / PDF
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                Printable stylesheet with A4 page breaks, headers & footers.
              </div>
            </div>
            <button
              onClick={handleOpenPrintableHtml}
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.4rem', width: '100%' }}
            >
              Open PDF View ↗
            </button>
          </div>

          {/* Structured CSV */}
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                📊 Export CSV
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                Sanitized CSV ledger safe from spreadsheet formula injection.
              </div>
            </div>
            <button
              onClick={handleDownloadCsv}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.4rem', width: '100%' }}
            >
              Download CSV ↓
            </button>
          </div>

          {/* Machine JSON */}
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                💾 Export JSON
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                Full structured JSON dossier for canonical data interchange.
              </div>
            </div>
            <button
              onClick={handleDownloadJson}
              disabled={downloadingJson}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.4rem', width: '100%' }}
            >
              {downloadingJson ? 'Generating...' : 'Download JSON ↓'}
            </button>
          </div>
        </div>

        {/* Link to Full Report Center */}
        {onNavigateToReportCenter && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => {
                onClose();
                onNavigateToReportCenter();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Open Full Interactive Report Center & Live Document Builder →
            </button>
          </div>
        )}

        {/* Academic Notice */}
        <div style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-control)',
          padding: '0.55rem 0.75rem',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          lineHeight: 1.4
        }}>
          <strong>Notice:</strong> This automated report is produced by an academic decision-support framework. Algorithmic inferences do not constitute certified legal evidence without independent sworn verification.
        </div>
      </div>
    </div>
  );
}
